<template>
  <div class="game-screen">
    <!-- Room Exploring Screen -->
    <RoomExploringScreen 
      v-if="phase === 'room_exploring' || phase === 'room_enter'"
    />
    
    <!-- Encounter Screen -->
    <EncounterScreen 
      v-else-if="phase === 'encounter_action'"
    />
    
    <!-- Combat Results Screen -->
    <CombatResultsScreen 
      v-else-if="phase === 'combat_results'"
    />
    
    <!-- Game Over Screen -->
    <GameOverScreen 
      v-else-if="phase === 'game_over'"
    />
    
    <!-- Game Start Screen -->
    <GameStartScreen 
      v-else-if="phase === 'game_start'"
    />
  </div>
</template>

<script setup lang="ts">
import { inject, computed } from 'vue'
import type { Ref } from 'vue'
import type { GameState } from '@/engine/GameLoopDesign'
import RoomExploringScreen from './RoomExploringScreen.vue'
import EncounterScreen from './EncounterScreen.vue'
import CombatResultsScreen from './CombatResultsScreen.vue'
import GameOverScreen from './GameOverScreen.vue'
import GameStartScreen from './GameStartScreen.vue'

const gameState = inject<Ref<GameState>>('gameState')!

const phase = computed(() => gameState.value.phase)
</script>

<style scoped>
.game-screen {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 24px;
  max-width: 800px;
  margin: 0 auto;
  overflow-y: auto;
}
</style>
