<template>
  <div class="dialogue-screen">
    <h3>{{ npcName }}</h3>
    <p class="dialogue-text">{{ currentNode?.text }}</p>
    <div class="dialogue-responses">
      <button
        v-for="response in visibleResponses"
        :key="response.index"
        class="response-btn"
        @click="selectResponse(response.index)"
      >
        {{ response.text }}
      </button>
    </div>
    <button
      v-if="!hasDialogueExit"
      class="response-btn secondary"
      @click="end"
    >Leave</button>
  </div>
</template>

<script setup lang="ts">
import { inject, computed } from 'vue'
import type { Ref } from 'vue'
import type { GameState } from '@/engine/GameLoopDesign'
import { selectDialogueResponse, endDialogue, getDialogue } from '@/engine/DialogueSystem'
import { meetsRequirements } from '@/engine/Outcomes'
import { getNpc } from '@/engine/NpcData'

const gameState = inject<Ref<GameState>>('gameState')!
const dispatch = inject<(state: GameState) => void>('dispatch')!

const active = computed(() => gameState.value.activeDialogue!)
const dialogue = computed(() => getDialogue(active.value.dialogueId))
const currentNode = computed(() =>
  dialogue.value?.nodes.find((n) => n.id === active.value.currentNodeId)
)
const visibleResponses = computed(() =>
  (currentNode.value?.responses ?? [])
    .map((response, index) => ({ response, index }))
    .filter(({ response }) => meetsRequirements(gameState.value, response.requires))
    .map(({ response, index }) => ({ text: response.text, index }))
)

const hasDialogueExit = computed(() =>
  (currentNode.value?.responses ?? []).some(
    (response) => meetsRequirements(gameState.value, response.requires) && !response.next
  )
)
const npcName = computed(() => getNpc(active.value.npcId)?.name ?? 'NPC')

function selectResponse(idx: number) {
  dispatch(selectDialogueResponse(gameState.value, idx))
}

function end() {
  dispatch(endDialogue(gameState.value))
}
</script>

<style scoped>
.dialogue-screen { display: flex; flex-direction: column; gap: 12px; }
.dialogue-text { line-height: 1.6; color: #ccc; padding: 12px; background: #2a2a2a; border-radius: 8px; }
.dialogue-responses { display: flex; flex-direction: column; gap: 8px; }
.response-btn {
  padding: 10px 14px;
  background: #3a3a3a;
  color: #fff;
  border: 2px solid #555;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
}
.response-btn:hover { background: #4a4a4a; }
.response-btn.secondary { color: #aaa; }
</style>
