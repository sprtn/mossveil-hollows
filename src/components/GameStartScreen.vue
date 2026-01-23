<template>
  <div class="start-screen">
    <h1 class="game-title">STRAT RPG</h1>
    <p class="subtitle">A turn-based adventure</p>
    
    <div class="start-actions">
      <button @click="startNewGame" class="start-button">
        New Game
      </button>
      <button disabled class="start-button disabled">
        Load Game
      </button>
      <button disabled class="start-button disabled">
        Settings
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject } from 'vue'
import type { Ref } from 'vue'
import type { GameState, Player, Room } from '@/engine/GameLoopDesign'
import { initGame, enterRoom } from '@/engine/GameLoop'

const gameState = inject<Ref<GameState>>('gameState')!
const dispatch = inject<(state: GameState) => void>('dispatch')!

function startNewGame() {
  // Create a default player and room for testing
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
  
  const initialState = initGame(player, firstRoom)
  const newState = enterRoom(initialState, firstRoom)
  dispatch(newState)
}
</script>

<style scoped>
.start-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: 32px;
}

.game-title {
  font-size: 48px;
  font-weight: 700;
  color: #ffffff;
  margin: 0;
  font-family: 'Georgia', serif;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
}

.subtitle {
  font-size: 18px;
  color: #aaa;
  margin: 0;
}

.start-actions {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 200px;
}

.start-button {
  padding: 16px 32px;
  font-size: 18px;
  font-weight: 600;
  background-color: #4caf50;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.start-button:hover:not(.disabled) {
  background-color: #66bb6a;
  transform: translateY(-2px);
}

.start-button.disabled {
  background-color: #3a3a3a;
  color: #666;
  cursor: not-allowed;
}
</style>
