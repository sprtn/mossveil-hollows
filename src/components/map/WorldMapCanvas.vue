<template>
  <div class="world-map" :class="[`world-map--${variant}`]">
    <div v-if="showWorldToggle" class="world-map__toolbar">
      <button
        type="button"
        class="scope-btn"
        :class="{ active: effectiveScope === 'zone' }"
        @click="effectiveScope = 'zone'"
      >
        Zone
      </button>
      <button
        type="button"
        class="scope-btn"
        :class="{ active: effectiveScope === 'world' }"
        @click="effectiveScope = 'world'"
      >
        World
      </button>
      <button type="button" class="scope-btn" @click="fitView">Fit</button>
    </div>

    <div
      ref="containerRef"
      class="world-map__viewport"
      @wheel.prevent="onWheel"
      @pointerdown="onBackgroundPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointerleave="onPointerUp"
    >
      <svg
        class="world-map__svg"
        :viewBox="viewBox"
        role="img"
        :aria-label="ariaLabel"
      >
        <defs>
          <marker
            id="wmap-arrow"
            markerWidth="8"
            markerHeight="6"
            refX="7"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="currentColor" />
          </marker>
        </defs>

        <g v-for="zone in zoneRegions" :key="zone.key" class="zone-region">
          <rect
            :x="zone.bounds.minX"
            :y="zone.bounds.minY"
            :width="zone.bounds.maxX - zone.bounds.minX"
            :height="zone.bounds.maxY - zone.bounds.minY"
            :class="['zone-fill', `zone-fill--${zone.key}`]"
            rx="12"
          />
          <text
            :x="zone.bounds.minX + 8"
            :y="zone.bounds.minY + 16"
            class="zone-label"
          >
            {{ zone.label }}
          </text>
        </g>

        <g class="edges">
          <g
            v-for="(edge, i) in visibleEdges"
            :key="`edge-${i}`"
            :class="edgeClass(edge)"
            @click.stop="onEdgeClick(edge)"
          >
            <line
              :x1="edge.x1"
              :y1="edge.y1"
              :x2="edge.x2"
              :y2="edge.y2"
              marker-end="url(#wmap-arrow)"
            />
            <text :x="edge.mx" :y="edge.my" class="edge-label">{{ edge.label }}</text>
          </g>
          <line
            v-if="rubberBand"
            :x1="rubberBand.x1"
            :y1="rubberBand.y1"
            :x2="rubberBand.x2"
            :y2="rubberBand.y2"
            class="rubber-band"
          />
        </g>

        <g class="nodes">
          <g
            v-for="node in visibleNodes"
            :key="node.id"
            class="map-node"
            :class="nodeClass(node)"
            :transform="`translate(${node.x}, ${node.y})`"
            :data-room-id="node.id"
            @pointerdown.stop="onNodePointerDown($event, node)"
            @click.stop="onNodeClick(node)"
          >
            <circle :r="NODE_R" class="map-node__circle" />
            <text y="4" class="map-node__name">{{ node.shortName }}</text>
            <circle
              v-if="isEditor"
              :cx="NODE_R + 4"
              cy="0"
              r="7"
              class="map-node__port"
              @pointerdown.stop="onPortPointerDown($event, node)"
            />
          </g>
        </g>
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import type { GameState } from '@/engine/GameLoopDesign'
import type { Room } from '@/engine/RoomSystem'
import type { RoomLayoutsMap } from '@/engine/map/RoomLayout'
import {
  MAP_COORD_SIZE,
} from '@/engine/map/RoomLayout'
import {
  buildMapEdges,
  boundsToViewBox,
  canNavigateToRoom,
  clampLayoutPoint,
  directionLabel,
  getReachableTargetIds,
  getRoomZoneKey,
  getWorldBounds,
  getZoneBounds,
  groupRoomsByZone,
  zoneDisplayLabel,
} from '@/engine/map/worldMapUtils'

export type WorldMapVariant = 'editor' | 'navigation' | 'minimap'

const props = withDefaults(
  defineProps<{
    variant: WorldMapVariant
    rooms: Room[]
    layouts: RoomLayoutsMap
    currentRoomId?: string | null
    selectedRoomId?: string | null
    visitedRoomIds?: string[]
    gameState?: GameState
    /** Initial / controlled scope for player views */
    viewScope?: 'zone' | 'world'
    showWorldToggle?: boolean
  }>(),
  {
    currentRoomId: null,
    selectedRoomId: null,
    visitedRoomIds: () => [],
    viewScope: 'zone',
    showWorldToggle: false,
  },
)

const emit = defineEmits<{
  'select-room': [roomId: string]
  'layout-change': [roomId: string, x: number, y: number]
  'connect-rooms': [fromId: string, toId: string]
  navigate: [roomId: string]
}>()

const NODE_R = 26
const isEditor = computed(() => props.variant === 'editor')
const isPlayer = computed(() => props.variant === 'navigation' || props.variant === 'minimap')

const effectiveScope = ref<'zone' | 'world'>(props.viewScope)
watch(
  () => props.viewScope,
  (v) => {
    effectiveScope.value = v
  },
)

const containerRef = ref<HTMLElement | null>(null)
const viewBoxStr = ref(`0 0 ${MAP_COORD_SIZE} ${MAP_COORD_SIZE}`)

const currentZoneKey = computed(() => {
  const current = props.rooms.find((r) => r.id === props.currentRoomId)
  return current ? getRoomZoneKey(current) : null
})

const reachableIds = computed(() => {
  if (!props.gameState || !props.currentRoomId) return new Set<string>()
  const room = props.rooms.find((r) => r.id === props.currentRoomId)
  if (!room) return new Set<string>()
  return getReachableTargetIds(props.gameState, room)
})

const visitedSet = computed(() => new Set(props.visitedRoomIds ?? []))

interface MapNodeVm {
  id: string
  x: number
  y: number
  shortName: string
  zoneKey: string
  dimmed: boolean
}

const visibleNodes = computed<MapNodeVm[]>(() => {
  const scope = isEditor.value ? 'world' : effectiveScope.value
  const zoneKey = currentZoneKey.value
  return props.rooms.map((room) => {
    const layout = dragPreviewLayouts.value[room.id] ?? props.layouts[room.id] ?? { x: 500, y: 500 }
    const z = getRoomZoneKey(room)
    const dimmed =
      scope === 'zone' && zoneKey != null && z !== zoneKey && !room.isHub
    return {
      id: room.id,
      x: layout.x,
      y: layout.y,
      shortName: truncateName(room.name || room.id),
      zoneKey: z,
      dimmed,
    }
  })
})

interface EdgeVm {
  fromId: string
  toId: string
  x1: number
  y1: number
  x2: number
  y2: number
  mx: number
  my: number
  label: string
  locked: boolean
  hidden: boolean
  navigable: boolean
}

const visibleEdges = computed<EdgeVm[]>(() => {
  const pos = new Map(visibleNodes.value.map((n) => [n.id, n]))
  const edges: EdgeVm[] = []
  for (const edge of buildMapEdges(props.rooms)) {
    if (isPlayer.value && edge.hidden) continue
    const from = pos.get(edge.fromId)
    const to = pos.get(edge.toId)
    if (!from || !to) continue
    if (from.dimmed && to.dimmed) continue
    const dx = to.x - from.x
    const dy = to.y - from.y
    const len = Math.hypot(dx, dy) || 1
    const x1 = from.x + (dx / len) * NODE_R
    const y1 = from.y + (dy / len) * NODE_R
    const x2 = to.x - (dx / len) * (NODE_R + 6)
    const y2 = to.y - (dy / len) * (NODE_R + 6)
    const navigable =
      props.currentRoomId === edge.fromId && reachableIds.value.has(edge.toId)
    edges.push({
      fromId: edge.fromId,
      toId: edge.toId,
      x1,
      y1,
      x2,
      y2,
      mx: (x1 + x2) / 2,
      my: (y1 + y2) / 2 - 4,
      label: directionLabel(edge.direction) + (edge.locked ? ' 🔒' : ''),
      locked: edge.locked,
      hidden: edge.hidden,
      navigable,
    })
  }
  return edges
})

const zoneRegions = computed(() => {
  if (isPlayer.value && effectiveScope.value === 'zone' && currentZoneKey.value) {
    const b = getZoneBounds(props.rooms, props.layouts, currentZoneKey.value, 100)
    return [
      {
        key: currentZoneKey.value,
        label: zoneDisplayLabel(currentZoneKey.value),
        bounds: b,
      },
    ]
  }
  const groups = groupRoomsByZone(props.rooms)
  return [...groups.entries()].map(([key, zoneRooms]) => ({
    key,
    label: zoneDisplayLabel(key),
    bounds: getZoneBounds(zoneRooms, props.layouts, key, 70),
  }))
})

const viewBox = computed(() => viewBoxStr.value)

const ariaLabel = computed(() =>
  isEditor.value ? 'Room map editor' : 'World navigation map',
)

function truncateName(name: string): string {
  return name.length > 14 ? `${name.slice(0, 12)}…` : name
}

function fitView() {
  const scope = isEditor.value ? 'world' : effectiveScope.value
  let bounds
  if (scope === 'zone' && currentZoneKey.value) {
    bounds = getZoneBounds(props.rooms, props.layouts, currentZoneKey.value, 90)
  } else {
    bounds = getWorldBounds(props.rooms, props.layouts, 50)
  }
  viewBoxStr.value = boundsToViewBox(bounds)
}

watch(
  [() => props.rooms, () => props.layouts, effectiveScope, currentZoneKey],
  () => fitView(),
  { deep: true },
)
onMounted(() => fitView())

function nodeClass(node: MapNodeVm) {
  return {
    'map-node--current': node.id === props.currentRoomId,
    'map-node--selected': node.id === props.selectedRoomId,
    'map-node--visited': visitedSet.value.has(node.id),
    'map-node--reachable':
      isPlayer.value &&
      props.currentRoomId !== node.id &&
      reachableIds.value.has(node.id),
    'map-node--dimmed': node.dimmed,
    'map-node--clickable':
      (isEditor.value && !node.dimmed) ||
      (isPlayer.value &&
        props.currentRoomId !== node.id &&
        reachableIds.value.has(node.id)),
  }
}

function edgeClass(edge: EdgeVm) {
  return {
    'edge--locked': edge.locked,
    'edge--hidden': edge.hidden,
    'edge--navigable': edge.navigable,
  }
}

// Pointer / drag state
const dragNodeId = ref<string | null>(null)
const dragOffset = ref({ x: 0, y: 0 })
const panning = ref(false)
const panStart = ref({ x: 0, y: 0, vbX: 0, vbY: 0, vbW: 0, vbH: 0 })
const connectFromId = ref<string | null>(null)
const rubberBand = ref<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
const dragPreviewLayouts = ref<RoomLayoutsMap>({})

function parseViewBox(): { x: number; y: number; w: number; h: number } {
  const parts = viewBoxStr.value.split(/\s+/).map(Number)
  return {
    x: parts[0] ?? 0,
    y: parts[1] ?? 0,
    w: parts[2] ?? MAP_COORD_SIZE,
    h: parts[3] ?? MAP_COORD_SIZE,
  }
}

function clientToMap(clientX: number, clientY: number): { x: number; y: number } {
  const el = containerRef.value
  if (!el) return { x: 0, y: 0 }
  const rect = el.getBoundingClientRect()
  const vb = parseViewBox()
  const relX = (clientX - rect.left) / rect.width
  const relY = (clientY - rect.top) / rect.height
  return {
    x: vb.x + relX * vb.w,
    y: vb.y + relY * vb.h,
  }
}

function onWheel(e: WheelEvent) {
  const vb = parseViewBox()
  const factor = e.deltaY > 0 ? 1.1 : 0.9
  const cx = vb.x + vb.w / 2
  const cy = vb.y + vb.h / 2
  const nw = Math.max(120, Math.min(MAP_COORD_SIZE, vb.w * factor))
  const nh = Math.max(120, Math.min(MAP_COORD_SIZE, vb.h * factor))
  viewBoxStr.value = boundsToViewBox({
    minX: cx - nw / 2,
    minY: cy - nh / 2,
    maxX: cx + nw / 2,
    maxY: cy + nh / 2,
  })
}

function onBackgroundPointerDown(e: PointerEvent) {
  if ((e.target as Element).closest('.map-node')) return
  panning.value = true
  const vb = parseViewBox()
  panStart.value = { x: e.clientX, y: e.clientY, vbX: vb.x, vbY: vb.y, vbW: vb.w, vbH: vb.h }
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function onNodePointerDown(e: PointerEvent, node: MapNodeVm) {
  if (!isEditor.value) return
  dragNodeId.value = node.id
  const map = clientToMap(e.clientX, e.clientY)
  dragOffset.value = { x: map.x - node.x, y: map.y - node.y }
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function onPortPointerDown(e: PointerEvent, node: MapNodeVm) {
  if (!isEditor.value) return
  connectFromId.value = node.id
  rubberBand.value = { x1: node.x, y1: node.y, x2: node.x, y2: node.y }
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function findNodeAt(mapX: number, mapY: number): string | null {
  for (const n of visibleNodes.value) {
    if (n.dimmed && isPlayer.value) continue
    if (Math.hypot(n.x - mapX, n.y - mapY) <= NODE_R + 8) return n.id
  }
  return null
}

function onPointerMove(e: PointerEvent) {
  const map = clientToMap(e.clientX, e.clientY)
  if (dragNodeId.value && isEditor.value) {
    const pt = clampLayoutPoint(map.x - dragOffset.value.x, map.y - dragOffset.value.y)
    dragPreviewLayouts.value = { ...dragPreviewLayouts.value, [dragNodeId.value]: pt }
  } else if (connectFromId.value && rubberBand.value) {
    rubberBand.value = { ...rubberBand.value, x2: map.x, y2: map.y }
  } else if (panning.value) {
    const rect = containerRef.value?.getBoundingClientRect()
    if (!rect) return
    const dx = ((e.clientX - panStart.value.x) / rect.width) * panStart.value.vbW
    const dy = ((e.clientY - panStart.value.y) / rect.height) * panStart.value.vbH
    viewBoxStr.value = boundsToViewBox({
      minX: panStart.value.vbX - dx,
      minY: panStart.value.vbY - dy,
      maxX: panStart.value.vbX - dx + panStart.value.vbW,
      maxY: panStart.value.vbY - dy + panStart.value.vbH,
    })
  }
}

function onPointerUp(e: PointerEvent) {
  if (dragNodeId.value && isEditor.value) {
    const pt = dragPreviewLayouts.value[dragNodeId.value]
    if (pt) {
      emit('layout-change', dragNodeId.value, pt.x, pt.y)
    }
    dragNodeId.value = null
    dragPreviewLayouts.value = {}
  }
  if (connectFromId.value) {
    const map = clientToMap(e.clientX, e.clientY)
    const toId = findNodeAt(map.x, map.y)
    if (toId && toId !== connectFromId.value) {
      emit('connect-rooms', connectFromId.value, toId)
    }
    connectFromId.value = null
    rubberBand.value = null
  }
  panning.value = false
}

function onNodeClick(node: MapNodeVm) {
  if (isEditor.value) {
    emit('select-room', node.id)
    return
  }
  if (!props.gameState || !props.currentRoomId) return
  const fromRoom = props.rooms.find((r) => r.id === props.currentRoomId)
  if (!fromRoom) return
  if (node.id === props.currentRoomId) return
  if (canNavigateToRoom(props.gameState, fromRoom, node.id)) {
    emit('navigate', node.id)
  }
}

function onEdgeClick(edge: EdgeVm) {
  if (isPlayer.value && edge.navigable) {
    emit('navigate', edge.toId)
  }
}
</script>

<style scoped>
.world-map {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.world-map--minimap {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.world-map--navigation .world-map__viewport {
  min-height: 200px;
}

.world-map--editor .world-map__viewport {
  min-height: 280px;
}

.world-map--minimap .world-map__viewport {
  height: 180px;
}

.world-map__toolbar {
  display: flex;
  gap: 6px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--color-border);
}

.scope-btn {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-bg-elevated);
  color: var(--color-text-soft);
  cursor: pointer;
}

.scope-btn.active {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.world-map__viewport {
  flex: 1;
  overflow: hidden;
  cursor: grab;
  background: var(--color-bg);
  touch-action: none;
}

.world-map__viewport:active {
  cursor: grabbing;
}

.world-map__svg {
  display: block;
  width: 100%;
  height: 100%;
}

.zone-fill {
  fill: rgba(95, 143, 80, 0.06);
  stroke: rgba(95, 143, 80, 0.15);
  stroke-width: 1;
}

.zone-fill--__hub__ {
  fill: rgba(184, 160, 120, 0.08);
  stroke: rgba(184, 160, 120, 0.2);
}

.zone-label {
  font-size: 11px;
  fill: var(--color-text-muted);
  font-family: var(--font-display);
  pointer-events: none;
}

.edges line {
  stroke: var(--color-text-soft);
  stroke-width: 1.5;
  stroke-opacity: 0.45;
  pointer-events: stroke;
}

.edge--navigable line {
  stroke: var(--color-accent);
  stroke-opacity: 0.85;
  stroke-width: 2;
  cursor: pointer;
}

.edge--locked line {
  stroke-dasharray: 4 3;
}

.edge--hidden line {
  stroke-dasharray: 2 4;
  stroke-opacity: 0.25;
}

.edge-label {
  font-size: 9px;
  fill: var(--color-text-muted);
  text-anchor: middle;
  pointer-events: none;
}

.rubber-band {
  stroke: var(--color-accent-warm);
  stroke-width: 2;
  stroke-dasharray: 6 4;
  pointer-events: none;
}

.map-node {
  cursor: default;
}

.map-node--clickable {
  cursor: pointer;
}

.map-node--dimmed {
  opacity: 0.28;
}

.map-node__circle {
  fill: var(--color-bg-elevated);
  stroke: var(--color-accent);
  stroke-width: 2;
}

.map-node--current .map-node__circle {
  fill: rgba(95, 143, 80, 0.25);
  stroke-width: 3;
}

.map-node--selected .map-node__circle {
  stroke: var(--color-accent-warm);
  stroke-width: 3;
}

.map-node--reachable .map-node__circle {
  stroke: var(--color-accent-bright, var(--color-accent));
  filter: drop-shadow(0 0 4px rgba(95, 143, 80, 0.5));
}

.map-node--visited:not(.map-node--current) .map-node__circle {
  fill: rgba(95, 143, 80, 0.08);
}

.map-node__name {
  font-size: 10px;
  fill: var(--color-text);
  text-anchor: middle;
  font-family: var(--font-body);
  pointer-events: none;
}

.map-node__port {
  fill: var(--color-accent-warm);
  stroke: var(--color-bg);
  stroke-width: 1;
  cursor: crosshair;
}
</style>
