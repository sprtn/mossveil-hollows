<template>
  <div v-if="npc" class="npc-hub">
    <div class="npc-hub__header panel">
      <button class="back-btn" type="button" @click="$emit('back')">← Back</button>
      <div class="npc-hub__identity">
        <img
          :src="portraitSrc"
          :alt="npc.name"
          class="npc-hub__portrait"
          @error="onPortraitError"
        />
        <div>
          <h3 class="npc-hub__name">{{ npc.name }}</h3>
          <p class="npc-hub__role">{{ npc.role }}<template v-if="npc.profession"> · {{ professionLabel }}</template></p>
        </div>
      </div>
      <div class="npc-hub__actions">
        <button class="action-button" @click="$emit('talk')">Talk</button>
        <button
          v-if="sections.includes('heal')"
          class="action-button"
          :disabled="gameState.player.gold < healerCost"
          @click="$emit('heal')"
        >
          Heal ({{ healerCost }}g — full + clear wounded)
        </button>
      </div>
    </div>

    <section
      v-if="sections.includes('craft')"
      :id="sectionId('craft')"
      :class="['hub-section', { focused: focusSection === 'craft' }]"
    >
      <CraftPanel
        :game-state="gameState"
        :npc-id="npc.id"
        :npc-name="npc.name"
        @craft="$emit('craft', $event)"
        @self-craft="$emit('selfCraft', $event)"
      />
    </section>

    <section
      v-if="sections.includes('shop')"
      :id="sectionId('shop')"
      :class="['hub-section', { focused: focusSection === 'shop' }]"
    >
      <div v-if="!shopAvailable" class="locked-notice panel">
        <p>Shop unavailable until you build the workbench (Buildings tab).</p>
      </div>
      <VendorShopPanel
        v-else
        :game-state="gameState"
        :vendor-id="npc.id"
        @buy="(id, q, qty) => $emit('buy', id, q, qty)"
        @sell="(id, q, qty) => $emit('sell', id, q, qty)"
      />
    </section>

    <section
      v-if="sections.includes('train')"
      :id="sectionId('train')"
      :class="['hub-section', { focused: focusSection === 'train' }]"
    >
      <TrainPanel
        ref="trainPanelRef"
        :game-state="gameState"
        :npc-id="npc.id"
        :npc-name="npc.name"
        @attempt-training="$emit('attemptTraining', $event)"
        @attempt-stat-practice="$emit('attemptStatPractice', $event)"
      />
    </section>

    <section
      v-if="sections.includes('profession_train')"
      :id="sectionId('profession_train')"
      :class="['hub-section', { focused: focusSection === 'profession_train' }]"
    >
      <ProfessionTrainPanel
        :game-state="gameState"
        :npc-id="npc.id"
        :npc-name="npc.name"
        @unlock-tier="$emit('unlockTier', $event)"
        @purchase-recipe="$emit('purchaseRecipe', $event)"
      />
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import type { GameState, PlayerStatKey } from '@/engine/GameLoopDesign'
import type { Quality } from '@/engine/Quality'
import { HEALER_COST } from '@/engine/gameConfig'
import { getNpc } from '@/engine/NpcData'
import { PROFESSIONS } from '@/engine/Professions'
import {
  getNpcHubSections,
  getNpcPortraitSrc,
  isNpcShopAvailable,
  NPC_PORTRAIT_PLACEHOLDER,
  type HubSection,
} from '@/engine/NpcHubCatalog'
import CraftPanel from './CraftPanel.vue'
import TrainPanel from './TrainPanel.vue'
import ProfessionTrainPanel from './ProfessionTrainPanel.vue'
import VendorShopPanel from './VendorShopPanel.vue'

const props = defineProps<{
  npcId: string
  gameState: GameState
  focusSection?: HubSection | null
}>()

defineEmits<{
  back: []
  talk: []
  heal: []
  craft: [recipeId: string]
  selfCraft: [recipeId: string]
  buy: [templateId: string, quality?: Quality, qty?: number]
  sell: [templateId: string, quality?: Quality, qty?: number]
  attemptTraining: [skillId: string]
  attemptStatPractice: [stat: PlayerStatKey]
  unlockTier: [tier: number]
  purchaseRecipe: [recipeId: string]
}>()

const trainPanelRef = ref<InstanceType<typeof TrainPanel> | null>(null)
const portraitFailed = ref(false)

const npc = computed(() => getNpc(props.npcId))
const sections = computed(() => getNpcHubSections(props.npcId, props.gameState))
const shopAvailable = computed(() => isNpcShopAvailable(props.npcId, props.gameState))
const healerCost = HEALER_COST
const professionLabel = computed(() =>
  npc.value?.profession ? (PROFESSIONS[npc.value.profession]?.name ?? '') : ''
)
const portraitSrc = computed(() => {
  if (!npc.value || portraitFailed.value) return NPC_PORTRAIT_PLACEHOLDER
  return getNpcPortraitSrc(npc.value)
})

function sectionId(section: HubSection) {
  return `hub-section-${props.npcId}-${section}`
}

function onPortraitError() {
  portraitFailed.value = true
}

function scrollToFocus() {
  if (!props.focusSection) return
  const el = document.getElementById(sectionId(props.focusSection))
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

watch(
  () => props.focusSection,
  () => nextTick(() => scrollToFocus()),
  { immediate: true }
)

watch(
  () => props.npcId,
  () => {
    portraitFailed.value = false
  }
)

defineExpose({
  showTrainingResult: (success: boolean, skillName: string) => {
    trainPanelRef.value?.showResult(success, skillName)
  },
  showStatPracticeResult: (message: string) => {
    trainPanelRef.value?.showStatPracticeResult(message)
  },
})
</script>

<style scoped>
.npc-hub {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.npc-hub__header {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.back-btn {
  align-self: flex-start;
  padding: 4px 10px;
  font-size: 13px;
  background: var(--color-bg-elevated);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.npc-hub__identity {
  display: flex;
  gap: 12px;
  align-items: center;
}
.npc-hub__portrait {
  width: 72px;
  height: 72px;
  object-fit: cover;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-bg-elevated);
}
.npc-hub__name {
  margin: 0;
  font-size: 18px;
}
.npc-hub__role {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--color-text-soft);
}
.npc-hub__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.hub-section.focused :deep(.panel),
.hub-section.focused .locked-notice {
  border-color: rgba(201, 165, 92, 0.45);
  box-shadow: 0 0 12px rgba(201, 165, 92, 0.1);
}
.locked-notice p {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-muted);
}
</style>
