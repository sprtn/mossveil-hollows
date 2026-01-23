<template>
  <div class="game-sidebar">
    <div class="sidebar-section">
      <h3 class="sidebar-title">Room Map</h3>
      <div class="room-map">
        <div 
          v-for="room in visibleRooms" 
          :key="room.id"
          :class="['room-node', { 
            'current': room.id === currentRoomId,
            'connected': room.isConnected && room.id !== currentRoomId,
            'clickable': room.isConnected && room.id !== currentRoomId
          }]"
          :title="room.name"
          @click="room.isConnected && room.id !== currentRoomId ? handleRoomClick(room.id) : null"
        >
          <div class="room-node-content">
            <div class="room-node-name">{{ room.name }}</div>
            <div v-if="room.id === currentRoomId" class="current-indicator">●</div>
            <div v-else-if="room.isConnected" class="connection-indicator">→</div>
          </div>
        </div>
        <div v-if="visibleRooms.length === 0" class="no-rooms">
          No rooms discovered yet
        </div>
      </div>
    </div>
    
    <div class="sidebar-section">
      <h3 class="sidebar-title">Stats</h3>
      <div class="stats-list">
        <div 
          class="stat-entry" 
          @mouseenter="showTooltip($event, 'strength')" 
          @mouseleave="hideTooltip"
        >
          <div class="stat-entry-header">
            <span class="stat-name">
              Attack:
              <span class="tooltip-trigger">ℹ️</span>
            </span>
            <button
              v-if="unallocatedPoints > 0"
              @click="allocatePoint('strength')"
              class="allocate-button"
              title="Allocate 1 attribute point to Attack"
            >
              +
            </button>
          </div>
          <span class="stat-value">{{ player.stats.strength }}</span>
        </div>
        <div 
          class="stat-entry" 
          @mouseenter="showTooltip($event, 'defense')" 
          @mouseleave="hideTooltip"
        >
          <div class="stat-entry-header">
            <span class="stat-name">
              Defense:
              <span class="tooltip-trigger">ℹ️</span>
            </span>
            <button
              v-if="unallocatedPoints > 0"
              @click="allocatePoint('defense')"
              class="allocate-button"
              title="Allocate 1 attribute point to Defense"
            >
              +
            </button>
          </div>
          <span class="stat-value">{{ player.stats.defense }}</span>
        </div>
        <div 
          class="stat-entry" 
          @mouseenter="showTooltip($event, 'speed')" 
          @mouseleave="hideTooltip"
        >
          <div class="stat-entry-header">
            <span class="stat-name">
              Speed:
              <span class="tooltip-trigger">ℹ️</span>
            </span>
            <button
              v-if="unallocatedPoints > 0"
              @click="allocatePoint('speed')"
              class="allocate-button"
              title="Allocate 1 attribute point to Speed"
            >
              +
            </button>
          </div>
          <span class="stat-value">{{ player.stats.speed }}</span>
        </div>
        <div class="stat-entry">
          <span class="stat-name">Level:</span>
          <span class="stat-value">{{ player.level }}</span>
        </div>
        <div class="stat-entry">
          <span class="stat-name">HP:</span>
          <span class="stat-value">{{ player.hp }}/{{ player.maxHp }}</span>
        </div>
      </div>
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
import type { GameState } from '@/engine/GameLoopDesign'
import { allocateAttributePoint, goToRoom } from '@/engine/GameLoop'
import { loadRoom } from '@/engine/RoomManager'

const gameState = inject<Ref<GameState>>('gameState')!
const dispatch = inject<(state: GameState) => void>('dispatch')!

const player = computed(() => gameState.value.player)
const currentRoomId = computed(() => gameState.value.currentRoom.id)
const roomHistory = computed(() => gameState.value.roomHistory || [])

const unallocatedPoints = computed(() => player.value.unallocatedAttributePoints || 0)

const tooltipVisible = ref(false)
const tooltipText = ref('')
const tooltipStyle = ref({ top: '0px', left: '0px' })

const tooltipDescriptions: Record<string, string> = {
  strength: 'Increases damage dealt when attacking enemies. Each point adds 1 to your base attack damage.',
  defense: 'Reduces damage taken from enemy attacks. Each point reduces incoming damage by 1.',
  speed: 'Reserved for future turn order mechanics. Currently has no effect in combat.',
}

function showTooltip(event: MouseEvent, stat: string) {
  tooltipText.value = tooltipDescriptions[stat] || ''
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

function allocatePoint(stat: 'strength' | 'defense' | 'speed') {
  const newState = allocateAttributePoint(gameState.value, stat)
  dispatch(newState)
}

// Room name cache
const roomNameCache = ref<Map<string, string>>(new Map())

// Load room name asynchronously
async function loadRoomName(roomId: string): Promise<string> {
  if (roomNameCache.value.has(roomId)) {
    return roomNameCache.value.get(roomId)!
  }
  
  try {
    const loadedRoom = await loadRoom(roomId)
    roomNameCache.value.set(roomId, loadedRoom.name)
    return loadedRoom.name
  } catch {
    return roomId.replace(/_/g, ' ').replace(/room\s*/i, '').replace(/\b\w/g, (l) => l.toUpperCase())
  }
}

// Create a simplified list of rooms from history and current room exits
const visibleRooms = computed(() => {
  const rooms: Array<{ id: string; name: string; isConnected: boolean }> = []
  const seen = new Set<string>()
  
  // Add current room first
  rooms.push({
    id: currentRoomId.value,
    name: gameState.value.currentRoom.name,
    isConnected: false, // Current room is not "connected" to itself
  })
  seen.add(currentRoomId.value)
  
  // Add connected rooms (from exits)
  const currentRoom = gameState.value.currentRoom
  const exits = currentRoom.exits || []
  const inventoryIds = gameState.value.player.inventory.map((item) => item.id)
  
  for (const exit of exits) {
    // Only show non-hidden exits
    if (exit.hidden) continue
    
    // Check if locked exit requires item
    if (exit.locked && exit.requiresItem) {
      if (!inventoryIds.includes(exit.requiresItem)) continue
    }
    
    if (!seen.has(exit.targetRoomId)) {
      seen.add(exit.targetRoomId)
      const cachedName = roomNameCache.value.get(exit.targetRoomId)
      // Pre-load name if not cached
      if (!cachedName) {
        loadRoomName(exit.targetRoomId).catch(() => {})
      }
      rooms.push({
        id: exit.targetRoomId,
        name: cachedName || exit.targetRoomId.replace(/_/g, ' ').replace(/room\s*/i, '').replace(/\b\w/g, (l) => l.toUpperCase()),
        isConnected: true,
      })
    }
  }
  
  // Add rooms from history (visited but not current)
  for (const roomId of roomHistory.value) {
    if (!seen.has(roomId)) {
      seen.add(roomId)
      const cachedName = roomNameCache.value.get(roomId)
      if (!cachedName) {
        loadRoomName(roomId).catch(() => {})
      }
      rooms.push({
        id: roomId,
        name: cachedName || roomId.replace(/_/g, ' ').replace(/room\s*/i, '').replace(/\b\w/g, (l) => l.toUpperCase()),
        isConnected: false,
      })
    }
  }
  
  return rooms
})

async function handleRoomClick(roomId: string) {
  isNavigating.value = true
  try {
    const newState = await goToRoom(gameState.value, roomId)
    dispatch(newState)
  } catch (error) {
    console.error('Failed to navigate to room:', error)
  } finally {
    isNavigating.value = false
  }
}

const isNavigating = ref(false)
</script>

<style scoped>
.game-sidebar {
  width: 220px;
  background-color: #1a1a1a;
  border-right: 2px solid #444;
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

.sidebar-title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: #4caf50;
  text-transform: uppercase;
  letter-spacing: 1px;
  border-bottom: 1px solid #444;
  padding-bottom: 8px;
}

.room-map {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.room-node {
  padding: 8px 12px;
  background-color: #2a2a2a;
  border: 1px solid #444;
  border-radius: 4px;
  transition: all 0.2s;
}

.room-node.current {
  background-color: #2a4a2a;
  border-color: #4caf50;
  box-shadow: 0 0 8px rgba(76, 175, 80, 0.3);
}

.room-node.connected {
  border-left: 3px solid #666;
  opacity: 0.8;
}

.room-node.clickable {
  cursor: pointer;
}

.room-node.clickable:hover {
  background-color: #333;
  border-color: #666;
}

.room-node-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.room-node-name {
  font-size: 12px;
  color: #aaa;
  font-weight: 600;
}

.room-node.current .room-node-name {
  color: #4caf50;
  font-weight: 700;
}

.current-indicator {
  color: #4caf50;
  font-size: 12px;
  font-weight: bold;
}

.connection-indicator {
  color: #666;
  font-size: 12px;
}

.no-rooms {
  padding: 12px;
  text-align: center;
  color: #666;
  font-size: 12px;
  font-style: italic;
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
  background-color: #2a2a2a;
  border-radius: 4px;
  border-left: 3px solid #444;
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
  white-space: normal;
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
