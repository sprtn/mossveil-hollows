<template>
  <div class="room-graph-preview">
    <div v-if="rooms.length === 0" class="graph-empty">No rooms to display.</div>
    <svg
      v-else
      class="graph-svg"
      :viewBox="`0 0 ${width} ${height}`"
      role="img"
      aria-label="Room connection graph"
    >
      <defs>
        <marker
          id="arrowhead"
          markerWidth="8"
          markerHeight="6"
          refX="7"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 8 3, 0 6" fill="var(--color-text-soft)" />
        </marker>
      </defs>
      <g class="graph-edges">
        <line
          v-for="(edge, i) in edges"
          :key="`edge-${i}`"
          :x1="edge.x1"
          :y1="edge.y1"
          :x2="edge.x2"
          :y2="edge.y2"
          class="graph-edge"
          marker-end="url(#arrowhead)"
        />
      </g>
      <g class="graph-nodes">
        <g
          v-for="node in nodes"
          :key="node.id"
          class="graph-node"
          :class="{ selected: node.id === selectedRoomId }"
        >
          <circle :cx="node.x" :cy="node.y" :r="NODE_R" />
          <text :x="node.x" :y="node.y + NODE_R + 14" text-anchor="middle" class="node-label">
            {{ node.name }}
          </text>
        </g>
      </g>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Room } from '@/engine/RoomSystem'

const props = defineProps<{
  rooms: Room[]
  selectedRoomId?: string | null
}>()

const NODE_R = 22
const width = 480
const height = 320
const padding = 48

interface GraphNode {
  id: string
  name: string
  x: number
  y: number
}

interface GraphEdge {
  x1: number
  y1: number
  x2: number
  y2: number
}

const nodes = computed<GraphNode[]>(() => {
  const rooms = props.rooms
  const n = rooms.length
  if (n === 0) return []

  const cx = width / 2
  const cy = height / 2
  const radius = Math.min(
    (Math.min(width, height) / 2) - padding - NODE_R,
    Math.max(60, n * 18),
  )

  return rooms.map((room, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2
    return {
      id: room.id,
      name: room.name || room.id,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    }
  })
})

const nodeById = computed(() => new Map(nodes.value.map((n) => [n.id, n])))

const edges = computed<GraphEdge[]>(() => {
  const pos = nodeById.value
  const result: GraphEdge[] = []

  for (const room of props.rooms) {
    const from = pos.get(room.id)
    if (!from) continue
    for (const exit of room.exits ?? []) {
      const to = pos.get(exit.targetRoomId)
      if (!to) continue
      result.push({
        x1: from.x,
        y1: from.y,
        x2: to.x,
        y2: to.y,
      })
    }
  }
  return result
})
</script>

<style scoped>
.room-graph-preview {
  flex-shrink: 0;
  border-top: 1px solid var(--color-border);
  background: var(--color-bg);
}

.graph-empty {
  padding: 16px;
  text-align: center;
  color: var(--color-text-soft);
  font-size: 12px;
  font-style: italic;
}

.graph-svg {
  display: block;
  width: 100%;
  height: auto;
  max-height: 240px;
}

.graph-edge {
  stroke: var(--color-text-soft);
  stroke-width: 1;
  stroke-opacity: 0.45;
  pointer-events: none;
}

.graph-node circle {
  fill: var(--color-bg-elevated);
  stroke: var(--color-accent);
  stroke-width: 2;
}

.graph-node.selected circle {
  fill: rgba(95, 143, 80, 0.2);
  stroke: var(--color-accent-bright, var(--color-accent));
  stroke-width: 2.5;
}

.node-label {
  font-family: var(--font-body);
  font-size: 10px;
  fill: var(--color-text);
  pointer-events: none;
}
</style>
