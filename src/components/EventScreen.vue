<template>
  <div class="event-screen">
    <h2>{{ event.title }}</h2>
    <p class="event-text">{{ event.text }}</p>
    <p v-if="event.lastResult" class="event-result">{{ event.lastResult }}</p>
    <div v-if="!event.lastResult" class="event-choices">
      <button
        v-for="(choice, idx) in event.choices"
        :key="idx"
        class="choice-btn"
        @click="selectChoice(idx)"
      >
        {{ choice.text }}
      </button>
    </div>
    <button v-else class="choice-btn primary" @click="dismiss">Continue</button>
  </div>
</template>

<script setup lang="ts">
import { inject, computed } from 'vue'
import type { Ref } from 'vue'
import type { GameState } from '@/engine/GameLoopDesign'
import { resolveEventChoice, dismissEvent } from '@/engine/EventSystem'

const gameState = inject<Ref<GameState>>('gameState')!
const dispatch = inject<(state: GameState) => void>('dispatch')!

const event = computed(() => gameState.value.activeEvent!)

function selectChoice(idx: number) {
  dispatch(resolveEventChoice(gameState.value, idx))
}

function dismiss() {
  dispatch(dismissEvent(gameState.value))
}
</script>

<style scoped>
.event-screen {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.event-text { line-height: 1.6; color: #ccc; }
.event-result { color: #8bc34a; font-style: italic; padding: 12px; background: #2a3a2a; border-radius: 6px; border-left: 4px solid #4caf50; }
.event-choices { display: flex; flex-direction: column; gap: 8px; }
.choice-btn {
  padding: 12px 16px;
  background: #3a3a3a;
  color: #fff;
  border: 2px solid #555;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
}
.choice-btn:hover { background: #4a4a4a; }
.choice-btn.primary { background: #2e7d32; border-color: #4caf50; }
</style>
