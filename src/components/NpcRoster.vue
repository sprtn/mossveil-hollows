<template>
  <div class="npc-roster">
    <h4 class="npc-roster__title">People of Mossveil Hollow</h4>
    <div class="npc-roster__grid">
      <NpcCard
        v-for="npc in npcs"
        :key="npc.id"
        :npc="npc"
        :game-state="gameState"
        @select="$emit('select', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { GameState } from '@/engine/GameLoopDesign'
import { NPCS } from '@/engine/NpcData'
import NpcCard from './NpcCard.vue'

defineProps<{
  gameState: GameState
}>()

defineEmits<{
  select: [npcId: string]
}>()

const npcs = NPCS
</script>

<style scoped>
.npc-roster__title {
  margin: 0 0 12px;
  color: var(--color-accent);
  font-size: 14px;
}
.npc-roster__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
}
</style>
