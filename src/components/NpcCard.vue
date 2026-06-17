<template>
  <button
    class="npc-card panel"
    :data-npc-id="npc.id"
    type="button"
    @click="$emit('select', npc.id)"
  >
    <div class="npc-card__portrait-wrap">
      <img
        :src="portraitSrc"
        :alt="npc.name"
        class="npc-card__portrait"
        @error="onPortraitError"
      />
    </div>
    <div class="npc-card__body">
      <strong class="npc-card__name">{{ npc.name }}</strong>
      <span class="npc-card__role">{{ displayProfession }}</span>
      <div v-if="hints.length" class="npc-card__hints">
        <span v-for="hint in hints" :key="hint" class="npc-card__hint">{{ hint }}</span>
      </div>
      <div class="npc-card__meta" aria-hidden="true" />
    </div>
  </button>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { NpcDef } from '@/engine/ContentSchemas'
import type { GameState } from '@/engine/GameLoopDesign'
import {
  getNpcDisplayProfession,
  getNpcOfferingHints,
  getNpcPortraitSrc,
  NPC_PORTRAIT_PLACEHOLDER,
} from '@/engine/NpcHubCatalog'

const props = defineProps<{
  npc: NpcDef
  gameState: GameState
}>()

defineEmits<{
  select: [npcId: string]
}>()

const portraitFailed = ref(false)

const portraitSrc = computed(() =>
  portraitFailed.value ? NPC_PORTRAIT_PLACEHOLDER : getNpcPortraitSrc(props.npc)
)
const displayProfession = computed(() => getNpcDisplayProfession(props.npc))
const hints = computed(() => getNpcOfferingHints(props.npc.id, props.gameState))

function onPortraitError() {
  portraitFailed.value = true
}
</script>

<style scoped>
.npc-card {
  display: flex;
  flex-direction: column;
  padding: 0;
  text-align: left;
  cursor: pointer;
  overflow: hidden;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.npc-card:hover {
  border-color: rgba(201, 165, 92, 0.4);
  box-shadow: 0 0 12px rgba(201, 165, 92, 0.08);
}
.npc-card__portrait-wrap {
  aspect-ratio: 1;
  overflow: hidden;
  background: var(--color-bg-elevated);
}
.npc-card__portrait {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.npc-card__body {
  padding: 10px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.npc-card__name {
  font-family: var(--font-display);
  font-size: 14px;
  color: var(--color-text);
}
.npc-card__role {
  font-size: 12px;
  color: var(--color-text-soft);
}
.npc-card__hints {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}
.npc-card__hint {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  background: var(--color-bg-elevated);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
}
.npc-card__meta {
  display: none;
}
</style>
