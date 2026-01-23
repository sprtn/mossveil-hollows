<template>
  <div class="room-screen">
    <h1 class="room-title">{{ room.name }}</h1>
    
    <div v-if="room.picture" class="room-image-container">
      <img :src="room.picture" :alt="room.name" class="room-image" />
    </div>
    
    <div class="room-description">
      {{ room.description }}
    </div>
    
    <div v-if="explorationMessage" class="exploration-message">
      {{ explorationMessage }}
    </div>
    
    <div class="room-actions">
      <button
        v-if="previousRoomId"
        @click="handleGoBack"
        class="action-button"
        :disabled="isNavigating"
      >
        Go back to {{ previousRoomId ? getRoomNameSync(previousRoomId) : '' }}
      </button>
      
      <button
        v-for="exit in availableExits"
        :key="exit.targetRoomId"
        @click="handleGoTo(exit.targetRoomId)"
        class="action-button"
        :disabled="isNavigating"
      >
        Go to {{ getRoomNameSync(exit.targetRoomId) }}
      </button>
      
      <button 
        @click="handleExplore"
        class="action-button primary"
        :disabled="isNavigating"
      >
        {{ isNavigating ? 'Exploring...' : 'Explore' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject, computed, ref } from 'vue'
import type { Ref } from 'vue'
import type { GameState } from '@/engine/GameLoopDesign'
import { exploreRoom, goToRoom, goBack } from '@/engine/GameLoop'
import { loadRoom } from '@/engine/RoomManager'

const gameState = inject<Ref<GameState>>('gameState')!
const dispatch = inject<(state: GameState) => void>('dispatch')!

const room = computed(() => gameState.value.currentRoom)
const previousRoomId = computed(() => gameState.value.previousRoomId)
const isNavigating = ref(false)
const explorationMessage = ref<string>('')

// Room name cache
const roomNameCache = ref<Map<string, string>>(new Map())

// Get available exits (filter out hidden and locked)
const availableExits = computed(() => {
  const exits = room.value.exits || []
  const inventoryIds = gameState.value.player.inventory.map((item) => item.id)
  
  return exits.filter((exit) => {
    // Filter out hidden exits
    if (exit.hidden) return false
    
    // Filter out locked exits that require items we don't have
    if (exit.locked && exit.requiresItem) {
      return inventoryIds.includes(exit.requiresItem)
    }
    
    return true
  })
})

// Get room name (from cache or load it)
async function getRoomName(roomId: string): Promise<string> {
  // Check cache first
  if (roomNameCache.value.has(roomId)) {
    return roomNameCache.value.get(roomId)!
  }
  
  // Try to load room name
  try {
    const loadedRoom = await loadRoom(roomId)
    roomNameCache.value.set(roomId, loadedRoom.name)
    return loadedRoom.name
  } catch {
    // Fallback to formatted room ID
    return roomId.replace(/_/g, ' ').replace(/room\s*/i, '').replace(/\b\w/g, (l) => l.toUpperCase())
  }
}

// Synchronous version that uses cache or fallback
function getRoomNameSync(roomId: string): string {
  if (roomNameCache.value.has(roomId)) {
    return roomNameCache.value.get(roomId)!
  }
  // Pre-load room name asynchronously
  getRoomName(roomId).catch(() => {})
  // Return fallback
  return roomId.replace(/_/g, ' ').replace(/room\s*/i, '').replace(/\b\w/g, (l) => l.toUpperCase())
}

async function handleExplore() {
  isNavigating.value = true
  explorationMessage.value = '' // Clear previous message
  
  const newState = exploreRoom(gameState.value)
  
  // Check if an encounter was triggered
  // An encounter is triggered if phase changes to encounter_action OR if currentEncounter is set
  const encounterTriggered = newState.phase === 'encounter_action' || !!newState.currentEncounter
  
  if (!encounterTriggered && newState.phase === 'room_exploring') {
    // No encounter triggered - show message
    explorationMessage.value = 'You find nothing of interest.'
    
    // Clear message after 3 seconds
    setTimeout(() => {
      explorationMessage.value = ''
    }, 3000)
  } else {
    // Encounter was triggered, clear any message
    explorationMessage.value = ''
  }
  
  dispatch(newState)
  isNavigating.value = false
}

async function handleGoTo(targetRoomId: string) {
  isNavigating.value = true
  try {
    const newState = await goToRoom(gameState.value, targetRoomId)
    dispatch(newState)
  } catch (error) {
    console.error('Failed to navigate to room:', error)
  } finally {
    isNavigating.value = false
  }
}

async function handleGoBack() {
  isNavigating.value = true
  try {
    const newState = await goBack(gameState.value)
    dispatch(newState)
  } catch (error) {
    console.error('Failed to go back:', error)
  } finally {
    isNavigating.value = false
  }
}

// Pre-load current room name and previous room name
if (room.value.id) {
  getRoomName(room.value.id).catch(() => {})
}
if (previousRoomId.value) {
  getRoomName(previousRoomId.value).catch(() => {})
}
</script>

<style scoped>
.room-screen {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.room-title {
  font-size: 28px;
  font-weight: 700;
  margin: 0;
  color: #ffffff;
  font-family: 'Georgia', serif;
}

.room-image-container {
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid #444;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.room-image {
  width: 100%;
  height: auto;
  display: block;
  object-fit: cover;
}

.room-description {
  font-size: 16px;
  line-height: 1.8;
  color: #e0e0e0;
  padding: 16px;
  background-color: #2a2a2a;
  border-radius: 8px;
  border-left: 4px solid #4caf50;
}

.room-actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.action-button {
  padding: 12px 24px;
  font-size: 16px;
  font-weight: 600;
  background-color: #3a3a3a;
  color: #ffffff;
  border: 2px solid #555;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-button:hover {
  background-color: #4a4a4a;
  border-color: #666;
}

.action-button.primary {
  background-color: #4caf50;
  border-color: #66bb6a;
}

.action-button.primary:hover {
  background-color: #66bb6a;
}

.action-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.exploration-message {
  padding: 16px 24px;
  background-color: #3a3a3a;
  color: #aaa;
  border-radius: 8px;
  border-left: 4px solid #666;
  font-style: italic;
  text-align: center;
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

</style>
