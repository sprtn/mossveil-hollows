<template>
  <div class="quest-panel">
    <div v-for="q in activeQuests" :key="q.quest.id" class="quest-row">
      <div>
        <strong>{{ q.quest.name }}</strong>
        <p>{{ q.stage.description }}</p>
      </div>
      <span class="quest-progress">{{ q.progressText }}</span>
    </div>
    <div v-if="activeQuests.length === 0" class="empty">
      No active quests. Talk to people around town.
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { GameState } from '@/engine/GameLoopDesign'
import { getActiveQuestStages } from '@/engine/QuestSystem'

const props = defineProps<{
  gameState: GameState
}>()

const activeQuests = computed(() => getActiveQuestStages(props.gameState))
</script>

<style scoped>
.quest-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  background: var(--color-panel-inset);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  margin-bottom: 6px;
}
.quest-row p {
  font-size: 13px;
  color: var(--color-text-soft);
  margin: 4px 0 0;
}
.quest-progress {
  font-weight: 700;
  color: var(--color-accent-bright);
  white-space: nowrap;
  margin-left: 12px;
}
.empty {
  font-size: 13px;
  color: var(--color-text-muted);
  padding: 8px 0;
}
</style>
