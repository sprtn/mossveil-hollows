<template>
  <div class="game-sidebar">
    <div v-if="showMinimap" class="sidebar-section sidebar-map">
      <h3 class="sidebar-title">Map</h3>
      <WorldMapCanvas
        variant="minimap"
        :rooms="mapRooms"
        :layouts="roomLayouts"
        :current-room-id="gameState.currentRoom.id"
        :visited-room-ids="visitedRoomIds"
        :game-state="gameState"
        view-scope="zone"
        :show-world-toggle="true"
        @navigate="handleMapNavigate"
      />
    </div>

    <div class="sidebar-section">
      <h3 class="sidebar-title">Stats</h3>
      <div class="stats-list">
        <div
          v-for="stat in statKeys"
          :key="stat"
          class="stat-entry"
          @mouseenter="showTooltip($event, stat)"
          @mouseleave="hideTooltip"
        >
          <div class="stat-entry-header">
            <span class="stat-name">{{ statIcons[stat] }} {{ statLabelFor(stat) }}</span>
            <button v-if="unallocatedPoints > 0" @click="allocatePoint(stat)" class="allocate-button">+</button>
          </div>
          <span class="stat-value">
            {{ effectiveStats[stat] }}
            <span v-if="statModifier(stat) !== 0" class="stat-modifier">({{ formatModifier(statModifier(stat)) }})</span>
          </span>
          <span v-if="derived(stat)" class="stat-derived">{{ derived(stat) }}</span>
        </div>
        <div class="stat-entry">
          <span class="stat-name">{{ resourceIcons.hp }} HP</span>
          <span class="stat-value">{{ player.hp }}/{{ player.maxHp }}</span>
        </div>
      </div>
    </div>

    <div class="sidebar-section">
      <h3 class="sidebar-title">Resources</h3>
      <ResourceList />
    </div>
    
    <!-- Tooltip rendered outside sidebar bounds -->
    <Teleport to="body">
      <div 
        v-if="tooltipVisible" 
        class="tooltip" 
        :style="tooltipStyle"
      >
        {{ tooltipText }}
        <span class="tooltip-arrow"></span>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { inject, computed, ref } from 'vue'
import { Teleport } from 'vue'
import type { Ref } from 'vue'
import type { GameState, PlayerStatKey } from '@/engine/GameLoopDesign'
import { allocateAttributePoint, goToRoom } from '@/engine/GameLoop'
import { getEffectiveStats } from '@/engine/ItemDatabase'
import { statIcons, statDescriptions, resourceIcons } from '@/utils/icons'
import { derivedStatText, derivedStatProjection, statLabel } from '@/engine/statDisplay'
import { getAllRooms, getAllRoomLayouts } from '@/engine/admin/ContentRegistry'
import { getDiscoveredRoomIds } from '@/engine/map/worldMapUtils'
import ResourceList from './ResourceList.vue'
import WorldMapCanvas from './map/WorldMapCanvas.vue'

const statKeys: PlayerStatKey[] = ['strength', 'constitution', 'dexterity', 'agility', 'defense']

const gameState = inject<Ref<GameState>>('gameState')!
const dispatch = inject<(state: GameState) => void>('dispatch')!

const player = computed(() => gameState.value.player)
const effectiveStats = computed(() => getEffectiveStats(player.value))

const showMinimap = computed(
  () =>
    gameState.value.phase === 'room_exploring' || gameState.value.phase === 'room_enter',
)

const discoveredIds = computed(() => getDiscoveredRoomIds(gameState.value))
const mapRooms = computed(() => getAllRooms().filter((r) => discoveredIds.value.has(r.id)))
const roomLayouts = computed(() => getAllRoomLayouts())
const visitedRoomIds = computed(() => [
  ...(gameState.value.roomHistory ?? []),
  gameState.value.currentRoom.id,
])

const mapNavigating = ref(false)

async function handleMapNavigate(targetRoomId: string) {
  if (mapNavigating.value || gameState.value.phase !== 'room_exploring') return
  mapNavigating.value = true
  try {
    dispatch(await goToRoom(gameState.value, targetRoomId))
  } finally {
    mapNavigating.value = false
  }
}

const unallocatedPoints = computed(() => player.value.unallocatedAttributePoints || 0)

const tooltipVisible = ref(false)
const tooltipText = ref('')
const tooltipStyle = ref({ top: '0px', left: '0px' })

function statLabelFor(stat: PlayerStatKey): string {
  return statLabel(stat)
}

function statModifier(stat: PlayerStatKey): number {
  return effectiveStats.value[stat] - player.value.stats[stat]
}

function formatModifier(modifier: number): string {
  return modifier > 0 ? `+${modifier}` : `${modifier}`
}

function derived(stat: PlayerStatKey): string {
  return derivedStatText(stat, effectiveStats.value[stat])
}

function showTooltip(event: MouseEvent, stat: PlayerStatKey) {
  const base = player.value.stats[stat]
  const modifier = statModifier(stat)
  const total = effectiveStats.value[stat]
  const modifierText = modifier === 0 ? 'no gear bonus' : `gear ${formatModifier(modifier)}`
  const projection = derivedStatProjection(stat, total)
  tooltipText.value =
    `${statDescriptions[stat]} Base ${base}, ${modifierText}, total ${total}.` +
    (projection ? `\n${projection}` : '')
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const tooltipWidth = 250
  const tooltipHeight = 60 // Approximate height
  const spacing = 8
  
  // Position above the element, centered
  let left = rect.left + rect.width / 2 - tooltipWidth / 2
  let top = rect.top - tooltipHeight - spacing
  
  // Adjust if tooltip would go off screen
  if (left < 10) {
    left = 10
  } else if (left + tooltipWidth > window.innerWidth - 10) {
    left = window.innerWidth - tooltipWidth - 10
  }
  
  // If tooltip would go above viewport, position below instead
  if (top < 10) {
    top = rect.bottom + spacing
  }
  
  tooltipStyle.value = {
    top: `${top}px`,
    left: `${left}px`,
  }
  tooltipVisible.value = true
}

function hideTooltip() {
  tooltipVisible.value = false
}

function allocatePoint(stat: PlayerStatKey) {
  const newState = allocateAttributePoint(gameState.value, stat)
  dispatch(newState)
}
</script>

<style scoped>
.game-sidebar {
  width: 220px;
  background-color: var(--color-panel);
  border-right: 1px solid var(--color-border);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  overflow-y: auto;
  flex-shrink: 0;
}

.sidebar-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sidebar-map {
  flex-shrink: 0;
}

.sidebar-map :deep(.world-map--minimap) {
  width: 100%;
}

.sidebar-title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--color-accent);
  font-family: var(--font-display);
  text-transform: uppercase;
  letter-spacing: 1px;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 8px;
}

.stats-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-entry {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 12px;
  background-color: var(--color-panel-inset);
  border-radius: var(--radius-sm);
  border-left: 3px solid var(--color-border);
  cursor: help;
  position: relative;
}

.stat-entry-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-name {
  font-size: 12px;
  color: #aaa;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
}

.tooltip-trigger {
  font-size: 10px;
  color: #666;
  cursor: help;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.stat-entry:hover .tooltip-trigger {
  opacity: 1;
}

.stat-value {
  font-size: 14px;
  color: #ffffff;
  font-weight: 700;
}

.stat-modifier {
  color: var(--color-accent-bright);
  font-size: 12px;
  font-weight: 600;
  margin-left: 4px;
}

.stat-derived {
  font-size: 10px;
  color: var(--color-accent);
  font-weight: 600;
  letter-spacing: 0.3px;
}

.allocate-button {
  background-color: #4caf50;
  color: #ffffff;
  border: none;
  border-radius: 4px;
  width: 20px;
  height: 20px;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
  flex-shrink: 0;
}

.allocate-button:hover {
  background-color: #45a049;
}

.allocate-button:active {
  background-color: #3d8b40;
}

.tooltip {
  position: fixed;
  padding: 8px 12px;
  background-color: #1a1a1a;
  color: #ffffff;
  font-size: 11px;
  line-height: 1.4;
  border: 1px solid #444;
  border-radius: 4px;
  max-width: 250px;
  width: max-content;
  white-space: pre-line;
  z-index: 10000;
  pointer-events: none;
  transition: opacity 0.2s;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.5);
}

.tooltip-arrow {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border: 6px solid transparent;
  border-top-color: #1a1a1a;
}
</style>
