<template>
  <div class="game-over-screen">
    <h1 class="game-over-title">GAME OVER</h1>
    <div class="game-over-message">
      <p v-if="gameState.gameOverReason === 'defeat'">You have been defeated. The darkness claims another soul.</p>
      <p v-else>Your adventure has ended.</p>
    </div>
    <div class="game-over-actions">
      <button @click="restartGame" class="action-button">Try Again</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject } from 'vue'
import type { Ref } from 'vue'
import type { GameState } from '@/engine/GameLoopDesign'
import { createDefaultPlayer } from '@/engine/CombatEngine'
import { startGameFromRoom } from '@/engine/GameLoop'
import { clearSave } from '@/engine/saveGame'
import { START_ROOM_ID } from '@/engine/gameConfig'

const gameState = inject<Ref<GameState>>('gameState')!
const dispatch = inject<(state: GameState) => void>('dispatch')!

async function restartGame() {
  clearSave()
  const state = await startGameFromRoom(START_ROOM_ID, createDefaultPlayer())
  dispatch(state)
}
</script>

<style scoped>
.game-over-screen { display: flex; flex-direction: column; align-items: center; gap: 32px; padding: 48px; text-align: center; }
.game-over-title { font-size: 36px; font-weight: 700; color: #f44336; margin: 0; }
.game-over-message { font-size: 18px; color: #e0e0e0; max-width: 400px; line-height: 1.6; }
.action-button { padding: 12px 24px; font-size: 16px; font-weight: 600; background: #4caf50; color: #fff; border: none; border-radius: 6px; cursor: pointer; }
.action-button:hover { background: #66bb6a; }
</style>
