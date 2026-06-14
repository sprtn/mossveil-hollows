<template>
  <div class="victory-screen">
    <div class="victory-content">
      <h1 class="victory-title">Victory!</h1>
      <p class="victory-subtitle">The Shadow Lord has been vanquished.</p>

      <div class="recap">
        <h2>Your Journey</h2>
        <div class="recap-stat"><span>Level reached:</span><span>{{ player.level }}</span></div>
        <div class="recap-stat"><span>Gold collected:</span><span>{{ player.gold }}</span></div>
        <div class="recap-stat"><span>Rooms explored:</span><span>{{ roomCount }}</span></div>
        <div class="recap-stat"><span>Guardians defeated:</span><span>{{ zonesCleared.length }} / 3</span></div>
        <div class="recap-stat"><span>Turns taken:</span><span>{{ turnCount }}</span></div>
      </div>

      <p class="epilogue">
        Peace returns to Mossveil Hollow. The forest, caves, and ruins grow quiet once more.
        Your name will be remembered here for generations.
      </p>

      <button @click="restart" class="restart-button">Play Again</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject, computed } from 'vue'
import type { Ref } from 'vue'
import type { GameState } from '@/engine/GameLoopDesign'
import { createDefaultPlayer } from '@/engine/CombatEngine'
import { startGameFromRoom } from '@/engine/GameLoop'
import { clearSave } from '@/engine/saveGame'
import { START_ROOM_ID } from '@/engine/gameConfig'

const gameState = inject<Ref<GameState>>('gameState')!
const dispatch = inject<(state: GameState) => void>('dispatch')!

const player = computed(() => gameState.value.player)
const roomCount = computed(() => gameState.value.roomHistory.length)
const zonesCleared = computed(() => gameState.value.zonesCleared || [])
const turnCount = computed(() => gameState.value.turnCount)

async function restart() {
  clearSave()
  const state = await startGameFromRoom(START_ROOM_ID, createDefaultPlayer())
  dispatch(state)
}
</script>

<style scoped>
.victory-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 500px;
  padding: 40px;
}

.victory-content {
  max-width: 560px;
  text-align: center;
  background: linear-gradient(135deg, #1a2a1a 0%, #2a2a1a 100%);
  padding: 48px;
  border-radius: 16px;
  border: 2px solid #4caf50;
  box-shadow: 0 0 40px rgba(76, 175, 80, 0.2);
}

.victory-title {
  font-size: 48px;
  color: #ffd700;
  margin: 0 0 8px;
  font-family: Georgia, serif;
  text-shadow: 0 0 20px rgba(255, 215, 0, 0.4);
}

.victory-subtitle {
  font-size: 18px;
  color: #4caf50;
  margin: 0 0 32px;
}

.recap {
  background: #1a1a1a;
  padding: 24px;
  border-radius: 8px;
  margin-bottom: 24px;
  text-align: left;
}

.recap h2 {
  margin: 0 0 16px;
  color: #fff;
  font-size: 18px;
  text-align: center;
}

.recap-stat {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #333;
  color: #ddd;
}

.epilogue {
  font-size: 15px;
  line-height: 1.8;
  color: #aaa;
  font-style: italic;
  margin-bottom: 32px;
}

.restart-button {
  padding: 16px 40px;
  font-size: 18px;
  font-weight: 700;
  background: #4caf50;
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.restart-button:hover {
  background: #66bb6a;
  transform: translateY(-2px);
}
</style>
