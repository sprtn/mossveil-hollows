<template>
  <div class="game-screen" :class="{ 'game-screen--cover': phase === 'game_start' }">
    <RoomExploringScreen v-if="phase === 'room_exploring' || phase === 'room_enter'" />
    <EncounterScreen v-else-if="phase === 'encounter_action'" />
    <CombatResultsScreen v-else-if="phase === 'combat_results'" />
    <EventScreen v-else-if="phase === 'event'" />
    <DialogueScreen v-else-if="phase === 'dialogue'" />
    <GameOverScreen v-else-if="phase === 'game_over'" />
    <VictoryScreen v-else-if="phase === 'victory'" />
    <GameStartScreen v-else-if="phase === 'game_start'" />
  </div>
</template>

<script setup lang="ts">
import { inject, computed } from 'vue'
import type { Ref } from 'vue'
import type { GameState } from '@/engine/GameLoopDesign'
import RoomExploringScreen from './RoomExploringScreen.vue'
import EncounterScreen from './EncounterScreen.vue'
import CombatResultsScreen from './CombatResultsScreen.vue'
import EventScreen from './EventScreen.vue'
import DialogueScreen from './DialogueScreen.vue'
import GameOverScreen from './GameOverScreen.vue'
import GameStartScreen from './GameStartScreen.vue'
import VictoryScreen from './VictoryScreen.vue'

const gameState = inject<Ref<GameState>>('gameState')!
const phase = computed(() => gameState.value.phase)
</script>

<style scoped>
.game-screen {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 24px;
  max-width: 900px;
  margin: 0 auto;
  overflow-y: auto;
  width: 100%;
}

.game-screen--cover {
  padding: 0;
  max-width: none;
  margin: 0;
  overflow: hidden;
}
</style>
