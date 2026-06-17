<template>
  <div class="town-screen">
    <TownActionsStrip
      :game-state="gameState"
      @rest="handleRest"
      @inn="handleInn"
      @sleep-home="handleSleepHome"
      @save="handleSave"
    />
    <p class="hint">
      Free rest never lowers HP. Inn/Home clear wounded. Visit Maren to heal fully.
    </p>

    <div class="town-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="['tab-btn', { active: activeTab === tab.id }]"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>

    <div v-if="statusMessage" class="status-msg">{{ statusMessage }}</div>

    <!-- People -->
    <div v-if="activeTab === 'people'" class="tab-panel">
      <NpcRoster
        v-if="!selectedNpcId"
        :game-state="gameState"
        @select="openNpcHub"
      />
      <NpcHub
        v-else
        ref="npcHubRef"
        :npc-id="selectedNpcId"
        :game-state="gameState"
        :focus-section="hubFocusSection"
        :pending-swap="pendingSwap"
        @back="closeNpcHub"
        @talk="talkToSelected"
        @heal="handleHeal"
        @craft="handleCraft"
        @self-craft="handleSelfCraft"
        @buy="handleBuy"
        @sell="handleSell"
        @confirm-swap="confirmSwap"
        @dismiss-swap="pendingSwap = null"
        @attempt-training="handleAttemptTraining"
        @unlock-tier="handleUnlockTier"
        @purchase-recipe="handlePurchaseRecipe"
      />
    </div>

    <!-- Market -->
    <div v-if="activeTab === 'market'" class="tab-panel panel">
      <MaterialMarketPanel
        :game-state="gameState"
        @buy-material="handleBuyMaterial"
        @sell-material="handleSellMaterial"
      />
    </div>

    <!-- Buildings -->
    <div v-if="activeTab === 'buildings'" class="tab-panel panel">
      <div v-for="b in buildings" :key="b.id" class="building-card">
        <div class="building-header">
          <strong>{{ b.name }}</strong>
          <span>Lv {{ buildingLevel(b.id) }}/{{ b.levels.length }}</span>
        </div>
        <p class="building-desc">{{ b.description }}</p>
        <template v-if="buildingLevel(b.id) < b.levels.length">
          <p class="upgrade-unlock">{{ b.levels[buildingLevel(b.id)]?.unlocksText }}</p>
          <div class="upgrade-cost">
            <span>{{ resourceIcons.gold }} {{ b.levels[buildingLevel(b.id)]?.cost.gold }}g</span>
            <span
              v-for="(qty, matId) in b.levels[buildingLevel(b.id)]?.cost.materials"
              :key="matId"
              :class="{ short: materialCount(matId) < qty }"
            >
              {{ materialIcon(matId) }} {{ getItemName(matId) }}: {{ materialCount(matId) }}/{{ qty }}
            </span>
          </div>
          <button class="shop-btn" :disabled="!canUpgrade(b.id)" @click="handleUpgrade(b.id)">
            Upgrade
          </button>
        </template>
        <p v-else class="maxed">Max level</p>
        <ProductionPanel
          v-if="b.production"
          :game-state="gameState"
          :building-id="b.id"
          :production="b.production"
          @toggle="(on) => handleProductionToggle(b.id, on)"
          @labour="(g) => handleProductionLabour(b.id, g)"
        />
      </div>
    </div>

    <!-- Quests -->
    <div v-if="activeTab === 'quests'" class="tab-panel panel">
      <QuestPanel :game-state="gameState" />
    </div>

    <div class="shard-progress">
      <span :class="['shard', { owned: hasShard('forest_shard') }]">Forest</span>
      <span :class="['shard', { owned: hasShard('cave_shard') }]">Cave</span>
      <span :class="['shard', { owned: hasShard('ruins_shard') }]">Ruins</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject, computed, ref, watch } from 'vue'
import type { Ref } from 'vue'
import type { GameState } from '@/engine/GameLoopDesign'
import { equipItemAction } from '@/engine/GameLoop'
import {
  buyItem,
  sellItem,
  sellMaterialToMarket,
  buyMaterialFromMarket,
  useHealer,
  manualSave,
  restAtHub,
  useInn,
  sleepAtHome,
  hubAttemptTraining,
  hubCraft,
  hubSelfCraft,
  hubUpgradeBuilding,
  hubSetProductionEnabled,
  hubSetProductionLabour,
  hubUnlockProfessionTier,
  hubPurchaseRecipe,
} from '@/engine/HubActions'
import { getItemName, getItemTemplate, getEquipBonus, hasItem } from '@/engine/ItemDatabase'
import { getNpc } from '@/engine/NpcData'
import { startDialogue } from '@/engine/DialogueSystem'
import { getAllBuildings, canUpgradeBuilding, getBuildingLevel } from '@/engine/BuildingSystem'
import { getMaterialCount } from '@/engine/Materials'
import { materialIcon, resourceIcons } from '@/utils/icons'
import type { Quality } from '@/engine/Quality'
import { getTrainerProfession } from '@/engine/ProfessionTraining'
import { getSkill } from '@/engine/SkillSystem'
import {
  resolvePendingHubNavigation,
  type HubSection,
} from '@/engine/NpcHubCatalog'
import TownActionsStrip from './TownActionsStrip.vue'
import NpcRoster from './NpcRoster.vue'
import NpcHub from './NpcHub.vue'
import MaterialMarketPanel from './MaterialMarketPanel.vue'
import QuestPanel from './QuestPanel.vue'
import ProductionPanel from './ProductionPanel.vue'
import type { PendingEquipSwap } from './VendorShopPanel.vue'

type TownTab = 'people' | 'market' | 'buildings' | 'quests'

const gameState = inject<Ref<GameState>>('gameState')!
const dispatch = inject<(state: GameState) => void>('dispatch')!

const activeTab = ref<TownTab>('people')
const selectedNpcId = ref<string | null>(null)
const hubFocusSection = ref<HubSection | null>(null)
const npcHubRef = ref<InstanceType<typeof NpcHub> | null>(null)
const pendingSwap = ref<PendingEquipSwap | null>(null)

const tabs: { id: TownTab; label: string }[] = [
  { id: 'people', label: 'People' },
  { id: 'market', label: 'Market' },
  { id: 'buildings', label: 'Buildings' },
  { id: 'quests', label: 'Quests' },
]

const player = computed(() => gameState.value.player)
const statusMessage = computed(() => gameState.value.statusMessage)
const buildings = getAllBuildings()

function hasShard(id: string) {
  return hasItem(player.value, id)
}
function buildingLevel(id: string) {
  return getBuildingLevel(gameState.value, id)
}
function canUpgrade(id: string) {
  return canUpgradeBuilding(gameState.value, id)
}
function materialCount(matId: string) {
  return getMaterialCount(player.value, matId)
}

function openNpcHub(npcId: string) {
  selectedNpcId.value = npcId
  hubFocusSection.value = null
}

function closeNpcHub() {
  selectedNpcId.value = null
  hubFocusSection.value = null
  pendingSwap.value = null
}

function talkToSelected() {
  const npc = selectedNpcId.value ? getNpc(selectedNpcId.value) : undefined
  if (!npc) return
  dispatch(startDialogue(gameState.value, npc.dialogueId))
}

function handleRest() {
  dispatch(restAtHub(gameState.value))
}
function handleInn() {
  dispatch(useInn(gameState.value))
}
function handleSleepHome() {
  dispatch(sleepAtHome(gameState.value))
}
function handleHeal() {
  dispatch(useHealer(gameState.value))
}
function handleSave() {
  dispatch(manualSave(gameState.value))
}

function handleAttemptTraining(skillId: string) {
  const skill = getSkill(skillId)
  const knownBefore = (gameState.value.player.knownSkills ?? []).includes(skillId)
  const newState = hubAttemptTraining(gameState.value, skillId, selectedNpcId.value ?? undefined)
  dispatch(newState)
  const success = !knownBefore && (newState.player.knownSkills ?? []).includes(skillId)
  npcHubRef.value?.showTrainingResult(success, skill?.name ?? skillId)
}

function handleUnlockTier(tier: number) {
  const npcId = selectedNpcId.value
  if (!npcId) return
  const profession = getTrainerProfession(npcId)
  if (!profession) return
  dispatch(hubUnlockProfessionTier(gameState.value, profession, tier))
}

function handlePurchaseRecipe(recipeId: string) {
  dispatch(hubPurchaseRecipe(gameState.value, recipeId))
}

function handleCraft(recipeId: string) {
  dispatch(hubCraft(gameState.value, recipeId))
}
function handleSelfCraft(recipeId: string) {
  dispatch(hubSelfCraft(gameState.value, recipeId))
}
function handleUpgrade(buildingId: string) {
  dispatch(hubUpgradeBuilding(gameState.value, buildingId))
}

function applyPendingHubPanel() {
  const pending = gameState.value.pendingHubPanel
  if (!pending || gameState.value.phase !== 'room_exploring') return

  const nav = resolvePendingHubNavigation(pending)
  activeTab.value = 'people'
  selectedNpcId.value = nav.selectedNpcId
  hubFocusSection.value = nav.focusSection

  dispatch({ ...gameState.value, pendingHubPanel: undefined })
}

watch(
  () => [gameState.value.phase, gameState.value.pendingHubPanel] as const,
  () => applyPendingHubPanel(),
  { flush: 'post' }
)

function handleProductionToggle(buildingId: string, enabled: boolean) {
  dispatch(hubSetProductionEnabled(gameState.value, buildingId, enabled))
}

function handleProductionLabour(buildingId: string, gold: number) {
  dispatch(hubSetProductionLabour(gameState.value, buildingId, gold))
}

function handleBuy(templateId: string, quality?: Quality) {
  const vendorId = selectedNpcId.value
  if (!vendorId) return

  const goldBefore = gameState.value.player.gold
  let newState = buyItem(gameState.value, vendorId, templateId, quality)
  if (newState.player.gold === goldBefore) return

  const template = getItemTemplate(templateId)
  const boughtQuality = quality ?? 'common'
  if (template && (template.type === 'weapon' || template.type === 'armor')) {
    const slot: 'weapon' | 'armor' = template.type === 'weapon' ? 'weapon' : 'armor'
    const equipped = newState.player.equipment[slot]
    if (!equipped) {
      newState = equipItemAction(newState, templateId, boughtQuality)
    } else if (equipped.templateId !== templateId || equipped.quality !== boughtQuality) {
      const newBonus = getEquipBonus(template, boughtQuality)
      const currentBonus = getEquipBonus(
        getItemTemplate(equipped.templateId),
        equipped.quality
      )
      if (newBonus > currentBonus) {
        pendingSwap.value = {
          templateId,
          quality: boughtQuality,
          slot,
          currentId: equipped.templateId,
          newBonus,
          currentBonus,
        }
      }
    }
  }
  dispatch(newState)
}

function confirmSwap() {
  if (!pendingSwap.value) return
  dispatch(
    equipItemAction(
      gameState.value,
      pendingSwap.value.templateId,
      pendingSwap.value.quality
    )
  )
  pendingSwap.value = null
}

function handleSell(templateId: string, quality?: Quality) {
  const vendorId = selectedNpcId.value
  if (!vendorId) return
  dispatch(sellItem(gameState.value, vendorId, templateId, quality))
}

function handleSellMaterial(materialId: string, qty: number) {
  dispatch(sellMaterialToMarket(gameState.value, materialId, qty))
}

function handleBuyMaterial(materialId: string, qty: number) {
  dispatch(buyMaterialFromMarket(gameState.value, materialId, qty))
}
</script>

<style scoped>
.town-screen {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.hint {
  font-size: 13px;
  color: var(--color-text-muted);
  margin: 0;
}
.town-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.tab-btn {
  padding: 8px 14px;
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  background: var(--color-bg-elevated);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s;
}
.tab-btn.active {
  background: linear-gradient(180deg, rgba(58, 82, 48, 0.5) 0%, var(--color-panel-inset) 100%);
  color: var(--color-accent-warm);
  border-color: rgba(201, 165, 92, 0.4);
  box-shadow: 0 0 12px rgba(201, 165, 92, 0.08);
}
.tab-panel {
  margin-top: 4px;
}
.building-card {
  padding: 12px;
  background: var(--color-panel-inset);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  margin-bottom: 10px;
}
.building-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
}
.building-desc,
.upgrade-unlock {
  font-size: 13px;
  color: var(--color-text-soft);
  margin: 4px 0;
}
.upgrade-cost {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 12px;
  color: var(--color-text-soft);
  margin: 8px 0;
}
.upgrade-cost .short {
  color: var(--color-danger-bright);
}
.maxed {
  color: var(--color-accent-bright);
  font-size: 13px;
}
.shop-btn {
  padding: 4px 12px;
  background: var(--color-accent);
  border: none;
  border-radius: var(--radius-sm);
  color: var(--color-text);
  cursor: pointer;
}
.shard-progress {
  display: flex;
  gap: 8px;
}
.shard {
  padding: 6px 12px;
  border-radius: var(--radius-md);
  background: var(--color-bg-elevated);
  color: var(--color-text-muted);
  font-size: 12px;
  border: 1px solid var(--color-border);
}
.shard.owned {
  background: rgba(90, 138, 170, 0.2);
  color: var(--color-water);
  border-color: var(--color-water);
}
</style>
