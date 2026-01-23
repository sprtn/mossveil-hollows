<template>
  <div id="app">
    <GameHeader v-if="gameState.phase !== 'game_start'" />
    <div class="main-content">
      <GameSidebar v-if="gameState.phase !== 'game_start'" />
      <GameScreen />
    </div>
    <PlayerScreen v-if="playerScreenOpen" />
  </div>
</template>

<script setup lang="ts">
import { ref, provide } from 'vue'
import type { Ref } from 'vue'
import type { GameState, Player, Room } from './engine/GameLoopDesign'
import { initGame, enterRoom } from './engine/GameLoop'
import GameHeader from './components/GameHeader.vue'
import GameScreen from './components/GameScreen.vue'
import PlayerScreen from './components/PlayerScreen.vue'
import GameSidebar from './components/GameSidebar.vue'

// Initialize game state
const defaultPlayer: Player = {
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
  unallocatedAttributePoints: 0,
}

const defaultRoom: Room = {
  id: 'room_start',
  name: 'Forest Entrance',
  description: 'You stand at the edge of a dense forest. Ancient trees tower above, their branches intertwined. The air is cool and smells of moss and earth. A worn path leads deeper into the woods.',
  picture: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80',
  nodeCount: 3,
  encounters: [
    {
      id: 'test_encounter',
      type: 'random',
      triggerChance: 0.8, // 80% chance to encounter when moving (for testing)
      enemies: [
        {
          id: 'goblin_1',
          name: 'Goblin Scout',
          hp: 20,
          maxHp: 20,
          level: 1,
          stats: {
            strength: 5,
            defense: 2,
            speed: 6,
          },
          loot: [],
          xpReward: 25,
        },
      ],
    },
  ],
  exits: [
    {
      direction: 'north',
      targetRoomId: 'room_1_forest_entrance',
    },
  ],
  nextRoomId: 'room_1_forest_entrance', // Deprecated, kept for backward compatibility
}

// Initialize game and transition to room_exploring phase
const initialState = initGame(defaultPlayer, defaultRoom)
const gameState = ref<GameState>(enterRoom(initialState, defaultRoom))
const playerScreenOpen = ref(false)

// Provide game state and dispatch function to child components
provide<Ref<GameState>>('gameState', gameState)

// Dispatch function to update game state
provide<(newState: GameState) => void>('dispatch', (newState: GameState) => {
  gameState.value = newState
})

// Provide player screen modal control
provide<(open: boolean) => void>('setPlayerScreenOpen', (open: boolean) => {
  playerScreenOpen.value = open
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
