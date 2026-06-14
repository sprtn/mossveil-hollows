<template>
  <div class="room-screen">
    <h1 class="room-title">{{ room.name }}</h1>
    <div v-if="room.isHub" class="hub-badge">Mossveil Hollow</div>

    <div v-if="room.picture" class="room-image-container">
      <img :src="room.picture" :alt="room.name" class="room-image" />
    </div>

    <div class="room-description">{{ room.description }}</div>

    <div v-if="room.isHub" class="hub-services">
      <TownScreen />
    </div>

    <div v-if="explorationMessage || statusMessage" class="exploration-message">
      {{ explorationMessage || statusMessage }}
    </div>

    <div class="room-actions">
      <button v-if="previousRoomId" @click="handleGoBack" class="action-button" :disabled="isNavigating">
        Go Back
      </button>
      <button
        v-for="exit in availableExits"
        :key="exit.targetRoomId"
        @click="handleGoTo(exit.targetRoomId)"
        class="action-button"
        :disabled="isNavigating"
      >
        {{ exitLabel(exit) }}
      </button>
      <button
        v-if="showReturnHome"
        @click="handleReturnHome"
        class="action-button return-home"
        :disabled="isNavigating"
      >
        Return to {{ hubName }}
      </button>
      <button
        v-if="!room.isHub && room.zoneId === 'forest'"
        @click="handleGather"
        class="action-button"
        :disabled="isNavigating || player.stamina <= 0"
      >
        Gather Wood
      </button>
      <button
        v-if="!room.isHub"
        @click="handleExplore"
        class="action-button primary"
        :disabled="isNavigating || player.stamina <= 0"
      >
        {{ isNavigating ? 'Exploring...' : 'Explore' }}
      </button>
    </div>

    <div v-if="!room.isHub" class="stamina-hint">
      Stamina: {{ player.stamina }}/{{ player.maxStamina }}
      <span v-if="player.wounded" class="wounded-tag">Wounded</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject, computed, ref, watch } from 'vue'
import type { Ref } from 'vue'
import type { GameState } from '@/engine/GameLoopDesign'
import type { RoomExit } from '@/engine/RoomSystem'
import { exploreRoom, goToRoom, goBack, gatherMaterials, returnToHub } from '@/engine/GameLoop'
import { hasItem } from '@/engine/ItemDatabase'
import { loadRoom } from '@/engine/RoomManager'
import { START_ROOM_ID, GAME_TITLE_MAIN } from '@/engine/gameConfig'
import TownScreen from './TownScreen.vue'

const gameState = inject<Ref<GameState>>('gameState')!
const dispatch = inject<(state: GameState) => void>('dispatch')!

const room = computed(() => gameState.value.currentRoom)
const player = computed(() => gameState.value.player)
const previousRoomId = computed(() => gameState.value.previousRoomId)
const statusMessage = computed(() => gameState.value.statusMessage)
const isNavigating = ref(false)
const explorationMessage = ref('')
const roomNameCache = ref<Map<string, string>>(new Map())
const hubName = GAME_TITLE_MAIN
const showReturnHome = computed(() => !room.value.isHub)

const availableExits = computed(() => {
  const exits = room.value.exits || []
  const areas = gameState.value.areasUnlocked ?? ['forest']
  return exits.filter((exit) => {
    if (exit.targetRoomId === START_ROOM_ID) return false
    if (exit.hidden) return false
    const area = exit.targetRoomId
    if (area.startsWith('zone_cave') && !areas.includes('cave')) return false
    if (area.startsWith('zone_ruins') && !areas.includes('ruins')) return false
    if (exit.locked) {
      if (exit.requiresItems?.length) {
        return exit.requiresItems.every((id) => hasItem(player.value, id))
      }
      if (exit.requiresItem) return hasItem(player.value, exit.requiresItem)
      return false
    }
    return true
  })
})

function exitLabel(exit: RoomExit) {
  const name = roomNameCache.value.get(exit.targetRoomId)
    || exit.targetRoomId.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
  if (exit.locked) return `🔒 ${name}`
  return `Go to ${name}`
}

async function getRoomName(roomId: string) {
  if (roomNameCache.value.has(roomId)) return
  try {
    const r = await loadRoom(roomId)
    roomNameCache.value.set(roomId, r.name)
  } catch { /* ignore */ }
}

watch(availableExits, (exits) => {
  exits.forEach((e) => getRoomName(e.targetRoomId))
}, { immediate: true })

function handleGather() {
  dispatch(gatherMaterials(gameState.value))
}

async function handleExplore() {
  isNavigating.value = true
  explorationMessage.value = ''
  const newState = exploreRoom(gameState.value)
  const triggered = newState.phase === 'encounter_action'
    || newState.phase === 'event'
    || !!newState.currentEncounter
  if (!triggered && newState.statusMessage) {
    explorationMessage.value = newState.statusMessage
    setTimeout(() => { explorationMessage.value = '' }, 3000)
  }
  dispatch(newState)
  isNavigating.value = false
}

async function handleGoTo(targetRoomId: string) {
  isNavigating.value = true
  try {
    dispatch(await goToRoom(gameState.value, targetRoomId))
  } finally {
    isNavigating.value = false
  }
}

async function handleGoBack() {
  isNavigating.value = true
  try {
    dispatch(await goBack(gameState.value))
  } finally {
    isNavigating.value = false
  }
}

async function handleReturnHome() {
  isNavigating.value = true
  try {
    dispatch(await returnToHub(gameState.value))
  } finally {
    isNavigating.value = false
  }
}
</script>

<style scoped>
.room-screen { display: flex; flex-direction: column; gap: 20px; }
.room-title { font-size: 28px; font-weight: 700; margin: 0; color: #fff; font-family: Georgia, serif; }
.hub-badge { display: inline-block; background: #2a4a2a; color: #4caf50; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; width: fit-content; }
.room-image-container { max-width: 600px; margin: 0 auto; border-radius: 8px; overflow: hidden; border: 2px solid #444; max-height: 220px; }
.room-image { width: 100%; height: 220px; object-fit: cover; display: block; }
.room-description { font-size: 16px; line-height: 1.8; color: #e0e0e0; padding: 16px; background: #2a2a2a; border-radius: 8px; border-left: 4px solid #4caf50; }
.hub-services { background: transparent; padding: 0; border: none; }
.room-actions { display: flex; flex-wrap: wrap; gap: 12px; }
.action-button { padding: 12px 24px; font-size: 15px; font-weight: 600; background: #3a3a3a; color: #fff; border: 2px solid #555; border-radius: 6px; cursor: pointer; transition: all 0.2s; }
.action-button:hover:not(:disabled) { background: #4a4a4a; }
.action-button.primary { background: #4caf50; border-color: #66bb6a; }
.action-button.return-home { border-color: #c9a55c; color: #e8d9b0; }
.action-button.return-home:hover:not(:disabled) { background: #4a4030; border-color: #c9a55c; }
.action-button:disabled { opacity: 0.6; cursor: not-allowed; }
.exploration-message { padding: 16px; background: #3a3a3a; color: #aaa; border-radius: 8px; border-left: 4px solid #666; font-style: italic; text-align: center; }
.stamina-hint { font-size: 13px; color: #888; }
.wounded-tag { color: #f44336; margin-left: 8px; font-weight: 600; }
</style>
