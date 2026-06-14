<template>
  <div class="resource-list">
    <div v-if="materialEntries.length === 0" class="empty-resources">
      No materials yet
    </div>
    <div
      v-for="entry in materialEntries"
      :key="entry.id"
      class="resource-entry"
    >
      <span class="resource-name">{{ materialIcon(entry.id) }} {{ entry.name }}</span>
      <span class="resource-qty">{{ entry.qty }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject, computed } from 'vue'
import type { Ref } from 'vue'
import type { GameState } from '@/engine/GameLoopDesign'
import { getItemName } from '@/engine/ItemDatabase'
import { materialIcon } from '@/utils/icons'

const gameState = inject<Ref<GameState>>('gameState')!

const materialEntries = computed(() =>
  Object.entries(gameState.value.player.materials ?? {})
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => ({
      id,
      name: getItemName(id),
      qty,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
)
</script>

<style scoped>
.resource-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.empty-resources {
  padding: 8px 12px;
  color: #666;
  font-size: 12px;
  font-style: italic;
}

.resource-entry {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background-color: #2a2a2a;
  border-radius: 4px;
  border-left: 3px solid #444;
}

.resource-name {
  font-size: 12px;
  color: #aaa;
  font-weight: 600;
}

.resource-qty {
  font-size: 14px;
  color: #ffffff;
  font-weight: 700;
}
</style>
