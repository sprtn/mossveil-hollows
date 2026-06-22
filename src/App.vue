<template>
  <div id="app">
    <GameHeader v-if="showHeader" />
    <div class="main-content">
      <GameSidebar v-if="showHeader" />
      <GameScreen />
    </div>
    <PlayerScreen v-if="playerScreenOpen" />
    <AdminOverlay v-if="DEV_ADMIN_ENABLED" v-model:open="adminOpen" />
  </div>
</template>

<script setup lang="ts">
import { ref, provide, computed, onMounted, onUnmounted, watch } from 'vue'
import type { Ref } from 'vue'
import type { GameState } from './engine/GameLoopDesign'
import { createDefaultPlayer } from './engine/CombatEngine'
import { loadRoom } from './engine/RoomManager'
import { roomFromAsset } from './engine/GameLoop'
import { DEV_ADMIN_ENABLED, START_ROOM_ID } from './engine/gameConfig'
import AdminOverlay from './components/admin/AdminOverlay.vue'
import { getDefaultGameMeta } from './engine/Outcomes'
import { audioManager } from './engine/AudioManager'
import GameHeader from './components/GameHeader.vue'
import GameScreen from './components/GameScreen.vue'
import PlayerScreen from './components/PlayerScreen.vue'
import GameSidebar from './components/GameSidebar.vue'

const initialPlayer = createDefaultPlayer()

const placeholderRoom = {
  id: 'loading',
  name: 'Loading...',
  description: '',
  encounters: [],
  exits: [],
}

const meta = getDefaultGameMeta()

const gameState = ref<GameState>({
  phase: 'game_start',
  player: initialPlayer,
  currentRoom: placeholderRoom,
  roomHistory: [],
  turnCount: 0,
  encounterChainCount: 0,
  lastHealingOpportunity: 0,
  moveCount: 0,
  zonesCleared: [],
  finalBossDefeated: false,
  ...meta,
})

const playerScreenOpen = ref(false)
const adminOpen = ref(false)

function onKeydown(e: KeyboardEvent) {
  if (!DEV_ADMIN_ENABLED) return
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'q') {
    e.preventDefault()
    adminOpen.value = !adminOpen.value
  }
}

const showHeader = computed(
  () => gameState.value.phase !== 'game_start' && gameState.value.phase !== 'victory'
)

provide<Ref<GameState>>('gameState', gameState)
provide<(newState: GameState) => void>('dispatch', (newState: GameState) => {
  gameState.value = newState
})
provide<(open: boolean) => void>('setPlayerScreenOpen', (open: boolean) => {
  playerScreenOpen.value = open
})
provide('unlockAudio', () => audioManager.unlock())
provide('audioManager', audioManager)

watch(
  () => [gameState.value.phase, gameState.value.currentRoom.id, gameState.value.currentEncounter?.id],
  () => audioManager.playForState(gameState.value),
  { deep: true, immediate: true }
)

onMounted(async () => {
  window.addEventListener('keydown', onKeydown)

  try {
    const hub = await loadRoom(START_ROOM_ID)
    gameState.value = {
      ...gameState.value,
      currentRoom: roomFromAsset(hub),
    }
  } catch (e) {
    console.error('Failed to preload hub room:', e)
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<style>
#app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  width: 100%;
}

.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}
</style>
