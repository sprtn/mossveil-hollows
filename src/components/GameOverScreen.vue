<template>
  <div class="game-over-screen">
    <h1 class="game-over-title">⚔️ GAME OVER ⚔️</h1>
    
    <div class="game-over-message">
      <p v-if="gameState.gameOverReason === 'defeat'">
        You have been defeated...
      </p>
      <p v-else-if="gameState.gameOverReason === 'victory'">
        Victory! You have completed your journey!
      </p>
      <p v-else>
        Your adventure has ended.
      </p>
    </div>
    
    <div class="game-over-actions">
      <button @click="restartGame" class="action-button">
        Try Again
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject } from 'vue'
import type { Ref } from 'vue'
import type { GameState, Player, Room } from '@/engine/GameLoopDesign'
import { initGame } from '@/engine/GameLoop'

const gameState = inject<Ref<GameState>>('gameState')!
const dispatch = inject<(state: GameState) => void>('dispatch')!

function restartGame() {
  const player: Player = {
    id: 'player_1',
    name: 'Hero',
    hp: 100,
    maxHp: 100,
    level: 1,
    xp: 0,
    inventory: [],
    stats: {
      strength: 10,
      defense: 5,
      speed: 8,
    },
  }
  
  const firstRoom: Room = {
    id: 'room_start',
    name: 'Forest Entrance',
    description: 'You stand at the edge of a dense forest. Ancient trees tower above, their branches intertwined. The air is cool and smells of moss and earth. A worn path leads deeper into the woods.',
    nodeCount: 3,
    encounters: [],
    nextRoomId: 'room_2',
  }
  
  const newState = initGame(player, firstRoom)
  dispatch(newState)
}
</script>

<style scoped>
.game-over-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
  padding: 48px;
  text-align: center;
}

.game-over-title {
  font-size: 36px;
  font-weight: 700;
  color: #ffffff;
  margin: 0;
}

.game-over-message {
  font-size: 20px;
  color: #e0e0e0;
}

.game-over-actions {
  display: flex;
  gap: 16px;
}

.action-button {
  padding: 12px 24px;
  font-size: 16px;
  font-weight: 600;
  background-color: #4caf50;
  color: #ffffff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-button:hover {
  background-color: #66bb6a;
  transform: translateY(-1px);
}
</style>
