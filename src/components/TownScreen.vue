<template>
  <div class="town-screen">
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

    <!-- Services -->
    <div v-if="activeTab === 'services'" class="tab-panel panel">
      <div class="service-buttons">
        <button @click="handleRest" class="action-button">
          {{ resourceIcons.hp }} Free Rest (~60% cap)
        </button>
        <button @click="handleInn" class="action-button" :disabled="player.gold < innCost">
          {{ resourceIcons.gold }} Inn ({{ innCost }}g — full, safe)
        </button>
        <button
          v-if="hasHouse"
          @click="handleSleepHome"
          class="action-button primary"
        >
          {{ resourceIcons.hp }} Sleep at Home (free, full)
        </button>
        <button @click="handleHeal" class="action-button" :disabled="player.gold < healerCost">
          Healer ({{ healerCost }}g — full + clear wounded)
        </button>
        <button @click="handleSave" class="action-button">Save</button>
      </div>
      <p class="hint">Free rest never lowers HP. Inn/Home/Healer clear wounded.</p>

      <div class="npc-list">
        <h4>NPCs</h4>
        <div v-for="npc in npcs" :key="npc.id" class="npc-row">
          <span class="npc-name">{{ npc.name }}</span>
          <div class="npc-actions">
            <button class="action-button small" @click="talkTo(npc)">Talk</button>
            <button
              v-if="npc.services?.includes('shop')"
              class="action-button small"
              @click="openShop(npc)"
            >Trade</button>
            <button
              v-if="npc.services?.includes('crafting')"
              class="action-button small"
              @click="openCraft(npc)"
            >Craft</button>
            <button
              v-if="npc.services?.includes('training')"
              class="action-button small"
              @click="openTrain(npc)"
            >Training</button>
            <button
              v-if="npc.services?.includes('profession_training')"
              class="action-button small"
              @click="openProfessionTrain(npc)"
            >Recipes</button>
          </div>
        </div>
      </div>

      <CraftPanel
        v-if="craftNpc"
        :game-state="gameState"
        :npc-id="craftNpc.id"
        :npc-name="craftNpc.name"
        @craft="handleCraft"
        @selfCraft="handleSelfCraft"
      />

      <TrainPanel
        v-if="trainNpc"
        ref="trainPanelRef"
        :game-state="gameState"
        :npc-id="trainNpc.id"
        :npc-name="trainNpc.name"
        @attempt-training="handleAttemptTraining"
      />

      <ProfessionTrainPanel
        v-if="professionTrainNpc"
        :game-state="gameState"
        :npc-id="professionTrainNpc.id"
        :npc-name="professionTrainNpc.name"
        @unlock-tier="handleUnlockTier"
        @purchase-recipe="handlePurchaseRecipe"
      />
    </div>

    <!-- Shop -->
    <div v-if="activeTab === 'shop'" class="tab-panel panel">
      <h4>Local Market — Resources</h4>
      <p class="market-hint">
        Buy and sell raw materials here at live prices (Day {{ gameDay }}).
        What you sell enters town stock; traders sell from that stock.
        Sera and Garrick below deal in <em>finished goods</em> only — not pelts or timber.
      </p>
      <div class="shop-list">
        <div v-for="row in marketListings" :key="row.materialId" class="shop-item market-row">
          <div class="shop-item-info">
            <span class="shop-item-name">
              {{ materialIcon(row.materialId) }} {{ getItemName(row.materialId) }}
            </span>
            <span class="market-meta">
              You: {{ materialCount(row.materialId) }} ·
              In stock: {{ row.stock }} ·
              Buy {{ row.buyPrice }}g / Sell {{ row.sellPrice }}g
            </span>
          </div>
          <div class="sell-btns">
            <button
              v-if="row.stock > 0"
              class="shop-btn"
              :disabled="player.gold < row.buyPrice"
              @click="handleBuyMaterial(row.materialId, 1)"
            >Buy 1</button>
            <button
              v-if="row.stock > 0"
              class="shop-btn"
              :disabled="player.gold < row.buyPrice * row.stock"
              @click="handleBuyMaterial(row.materialId, row.stock)"
            >Buy all</button>
            <button
              v-if="materialCount(row.materialId) > 0"
              class="shop-btn"
              @click="handleSellMaterial(row.materialId, 1)"
            >Sell 1</button>
            <button
              v-if="materialCount(row.materialId) > 0"
              class="shop-btn"
              @click="handleSellMaterial(row.materialId, materialCount(row.materialId))"
            >Sell all</button>
          </div>
        </div>
        <div v-if="marketListings.length === 0" class="empty">
          No materials in the market yet. Gather resources in the zones or wait for stock.
        </div>
      </div>

      <h4 class="vendor-heading">Traders — Finished Goods</h4>
      <div class="vendor-tabs">
        <button
          v-for="vid in availableVendors"
          :key="vid"
          :class="['vendor-btn', { active: selectedVendor === vid }]"
          @click="selectedVendor = vid"
        >
          {{ vendorName(vid) }}
        </button>
      </div>
      <h4>Buy</h4>
      <div class="shop-list">
        <div
          v-for="item in buyList"
          :key="`${item.templateId}::${item.quality ?? 'common'}`"
          class="shop-item"
        >
          <div class="shop-item-info">
            <span class="shop-item-name" :style="{ color: qualityColor(item.quality) }">
              {{ formatItemName(getItemName(item.templateId), item.quality) }}
              x{{ item.stock }} — {{ buyPrice(item.templateId, item.quality) }}g
            </span>
            <span v-if="itemStats(item.templateId, item.quality)" class="item-stats">
              {{ itemStats(item.templateId, item.quality) }}
            </span>
            <span v-if="itemDesc(item.templateId)" class="item-desc">{{ itemDesc(item.templateId) }}</span>
          </div>
          <button
            @click="handleBuy(item.templateId, item.quality)"
            class="shop-btn"
            :disabled="player.gold < buyPrice(item.templateId, item.quality)"
          >Buy</button>
        </div>
        <div v-if="buyList.length === 0" class="empty">Nothing for sale right now.</div>
      </div>
      <h4>Sell</h4>
      <div class="shop-list">
        <div
          v-for="item in sellList"
          :key="`${item.templateId}::${item.quality}`"
          class="shop-item"
        >
          <div class="shop-item-info">
            <span class="shop-item-name" :style="{ color: qualityColor(item.quality) }">
              {{ formatItemName(getItemName(item.templateId), item.quality) }}
              x{{ item.quantity }} — {{ sellPrice(item.templateId, item.quality) }}g
            </span>
            <span v-if="itemStats(item.templateId, item.quality)" class="item-stats">
              {{ itemStats(item.templateId, item.quality) }}
            </span>
          </div>
          <button @click="handleSell(item.templateId, item.quality)" class="shop-btn">Sell</button>
        </div>
        <div v-if="sellList.length === 0" class="empty">Nothing to sell here.</div>
      </div>
      <div v-if="pendingSwap" class="swap-prompt">
        <p>Equip <strong>{{ formatItemName(getItemName(pendingSwap.templateId), pendingSwap.quality) }}</strong> (+{{ pendingSwap.newBonus }})?</p>
        <button @click="confirmSwap" class="shop-btn">Equip</button>
        <button @click="pendingSwap = null" class="shop-btn secondary">Keep</button>
      </div>
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
          <button @click="handleUpgrade(b.id)" class="shop-btn" :disabled="!canUpgrade(b.id)">Upgrade</button>
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
      <div v-for="q in activeQuests" :key="q.quest.id" class="quest-row">
        <div>
          <strong>{{ q.quest.name }}</strong>
          <p>{{ q.stage.description }}</p>
        </div>
        <span class="quest-progress">{{ q.progressText }}</span>
      </div>
      <div v-if="activeQuests.length === 0" class="empty">No active quests. Talk to NPCs in Services.</div>
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
import type { NpcDef } from '@/engine/ContentSchemas'
import { equipItemAction } from '@/engine/GameLoop'
import {
  buyItem, sellItem, sellMaterialToMarket, buyMaterialFromMarket,
  useHealer, manualSave, restAtHub, useInn, sleepAtHome,
  hubAttemptTraining, hubCraft, hubSelfCraft, hubUpgradeBuilding,
  hubSetProductionEnabled, hubSetProductionLabour,
  hubUnlockProfessionTier, hubPurchaseRecipe,
} from '@/engine/HubActions'
import { getMarketMaterialListings } from '@/engine/MarketSystem'
import { getItemName, getItemTemplate, getEquipBonus, hasItem } from '@/engine/ItemDatabase'
import { HEALER_COST, INN_COST } from '@/engine/gameConfig'
import { NPCS, getNpc } from '@/engine/NpcData'
import { startDialogue } from '@/engine/DialogueSystem'
import { getAllBuildings, canUpgradeBuilding, getBuildingLevel } from '@/engine/BuildingSystem'
import { getActiveQuestStages } from '@/engine/QuestSystem'
import { getMaterialCount } from '@/engine/Materials'
import { materialIcon, resourceIcons, itemStatSummary, formatItemName, qualityColor } from '@/utils/icons'
import type { Quality } from '@/engine/Quality'
import {
  getAvailableVendors,
  getVendorBuyList,
  getVendorSellList,
  getVendorBuyDiscount,
  getVendorSellBonus,
} from '@/engine/VendorSystem'
import { getPrice } from '@/engine/MarketSystem'
import { getTrainerProfession } from '@/engine/ProfessionTraining'
import { getSkill } from '@/engine/SkillSystem'
import CraftPanel from './CraftPanel.vue'
import TrainPanel from './TrainPanel.vue'
import ProfessionTrainPanel from './ProfessionTrainPanel.vue'
import ProductionPanel from './ProductionPanel.vue'

const gameState = inject<Ref<GameState>>('gameState')!
const dispatch = inject<(state: GameState) => void>('dispatch')!

const activeTab = ref('services')
const craftNpc = ref<NpcDef | null>(null)
const trainNpc = ref<NpcDef | null>(null)
const trainPanelRef = ref<InstanceType<typeof TrainPanel> | null>(null)
const professionTrainNpc = ref<NpcDef | null>(null)
const selectedVendor = ref('sera_quartermaster')
const pendingSwap = ref<{
  templateId: string
  quality: Quality
  slot: 'weapon' | 'armor'
  currentId: string
  newBonus: number
  currentBonus: number
} | null>(null)

const tabs = [
  { id: 'services', label: 'Services' },
  { id: 'shop', label: 'Market' },
  { id: 'buildings', label: 'Buildings' },
  { id: 'quests', label: 'Quests' },
]

const player = computed(() => gameState.value.player)
const gameDay = computed(() => gameState.value.day ?? 1)
const marketListings = computed(() => getMarketMaterialListings(gameState.value))
const statusMessage = computed(() => gameState.value.statusMessage)
const healerCost = HEALER_COST
const innCost = INN_COST
const npcs = NPCS
const buildings = getAllBuildings()
const activeQuests = computed(() => getActiveQuestStages(gameState.value))
const hasHouse = computed(() => getBuildingLevel(gameState.value, 'house') >= 1)
const availableVendors = computed(() => getAvailableVendors(gameState.value))
const buyList = computed(() => getVendorBuyList(gameState.value, selectedVendor.value))
const sellList = computed(() => getVendorSellList(gameState.value, selectedVendor.value))

function vendorName(vendorId: string) {
  return getNpc(vendorId)?.name ?? vendorId
}

function buyPrice(templateId: string, quality?: Quality) {
  return getPrice(gameState.value, templateId, 'buy', {
    buyDiscount: getVendorBuyDiscount(gameState.value, selectedVendor.value),
    quality,
  })
}

function sellPrice(templateId: string, quality?: Quality) {
  return getPrice(gameState.value, templateId, 'sell', {
    sellBonus: getVendorSellBonus(gameState.value, selectedVendor.value),
    quality,
  })
}

function hasShard(id: string) { return hasItem(player.value, id) }
function itemStats(id: string, quality?: Quality) {
  return itemStatSummary(getItemTemplate(id), quality)
}
function itemDesc(id: string) { return getItemTemplate(id)?.description ?? '' }
function buildingLevel(id: string) { return getBuildingLevel(gameState.value, id) }
function canUpgrade(id: string) { return canUpgradeBuilding(gameState.value, id) }
function materialCount(matId: string) { return getMaterialCount(player.value, matId) }

function handleRest() { dispatch(restAtHub(gameState.value)) }
function handleInn() { dispatch(useInn(gameState.value)) }
function handleSleepHome() { dispatch(sleepAtHome(gameState.value)) }
function handleHeal() { dispatch(useHealer(gameState.value)) }
function handleSave() { dispatch(manualSave(gameState.value)) }
function handleAttemptTraining(skillId: string) {
  const skill = getSkill(skillId)
  const knownBefore = (gameState.value.player.knownSkills ?? []).includes(skillId)
  const newState = hubAttemptTraining(gameState.value, skillId, trainNpc.value?.id)
  dispatch(newState)
  const success = !knownBefore && (newState.player.knownSkills ?? []).includes(skillId)
  trainPanelRef.value?.showResult(success, skill?.name ?? skillId)
}
function handleUnlockTier(tier: number) {
  const npcId = professionTrainNpc.value?.id
  if (!npcId) return
  const profession = getTrainerProfession(npcId)
  if (!profession) return
  dispatch(hubUnlockProfessionTier(gameState.value, profession, tier))
}
function handlePurchaseRecipe(recipeId: string) {
  dispatch(hubPurchaseRecipe(gameState.value, recipeId))
}
function handleCraft(recipeId: string) { dispatch(hubCraft(gameState.value, recipeId)) }
function handleSelfCraft(recipeId: string) { dispatch(hubSelfCraft(gameState.value, recipeId)) }
function handleUpgrade(buildingId: string) { dispatch(hubUpgradeBuilding(gameState.value, buildingId)) }

function talkTo(npc: NpcDef) {
  craftNpc.value = null
  trainNpc.value = null
  professionTrainNpc.value = null
  dispatch(startDialogue(gameState.value, npc.dialogueId))
}

function openCraft(npc: NpcDef) {
  activeTab.value = 'services'
  craftNpc.value = npc
  trainNpc.value = null
  professionTrainNpc.value = null
}

function openTrain(npc: NpcDef) {
  activeTab.value = 'services'
  trainNpc.value = npc
  craftNpc.value = null
  professionTrainNpc.value = null
}

function openProfessionTrain(npc: NpcDef) {
  activeTab.value = 'services'
  professionTrainNpc.value = npc
  craftNpc.value = null
  trainNpc.value = null
}

function openShop(npc: NpcDef) {
  craftNpc.value = null
  trainNpc.value = null
  professionTrainNpc.value = null
  selectedVendor.value = npc.id
  activeTab.value = 'shop'
}

function applyPendingHubPanel() {
  const pending = gameState.value.pendingHubPanel
  if (!pending || gameState.value.phase !== 'room_exploring') return

  const npc = NPCS.find((n) => n.id === pending.npcId)
  if (!npc) return

  activeTab.value = 'services'
  craftNpc.value = null
  trainNpc.value = null
  professionTrainNpc.value = null

  if (pending.panel === 'train') {
    trainNpc.value = npc
  } else if (pending.panel === 'craft') {
    craftNpc.value = npc
  } else if (pending.panel === 'profession_train') {
    professionTrainNpc.value = npc
  } else if (pending.panel === 'shop') {
    selectedVendor.value = npc.id
    activeTab.value = 'shop'
  }

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
  const goldBefore = gameState.value.player.gold
  let newState = buyItem(gameState.value, selectedVendor.value, templateId, quality)
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
  dispatch(sellItem(gameState.value, selectedVendor.value, templateId, quality))
}

function handleSellMaterial(materialId: string, qty: number) {
  dispatch(sellMaterialToMarket(gameState.value, materialId, qty))
}

function handleBuyMaterial(materialId: string, qty: number) {
  dispatch(buyMaterialFromMarket(gameState.value, materialId, qty))
}
</script>

<style scoped>
.town-screen { display: flex; flex-direction: column; gap: 16px; }
.town-tabs { display: flex; flex-wrap: wrap; gap: 6px; }
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
.tab-panel { margin-top: 4px; }
.service-buttons { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.hint { font-size: 13px; color: var(--color-text-muted); margin: 0 0 12px; }
.npc-list h4 { margin: 12px 0 8px; color: var(--color-accent); font-family: var(--font-display); font-size: 14px; }
.npc-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  background: var(--color-panel-inset);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  margin-bottom: 6px;
}
.npc-name { font-size: 14px; }
.npc-actions { display: flex; gap: 6px; }
.vendor-heading { margin-top: 16px; }
.market-hint { font-size: 12px; color: var(--color-text-soft); margin: 0 0 10px; line-height: 1.4; }
.market-meta { display: block; font-size: 11px; color: var(--color-text-muted); margin-top: 2px; }
.market-row { flex-wrap: wrap; }
.sell-btns { display: flex; flex-wrap: wrap; gap: 6px; flex-shrink: 0; }
.vendor-tabs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.vendor-btn {
  padding: 6px 12px;
  background: var(--color-bg-elevated);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 13px;
}
.vendor-btn.active {
  background: var(--color-panel);
  color: var(--color-accent-bright);
  border-color: var(--color-accent);
}
.shop-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
.shop-item, .quest-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  background: var(--color-panel-inset);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  margin-bottom: 6px;
}
.shop-item-info { display: flex; flex-direction: column; gap: 2px; }
.shop-item-name { color: var(--color-text); }
.shop-btn { padding: 4px 12px; background: var(--color-accent); border: none; border-radius: var(--radius-sm); color: var(--color-text); cursor: pointer; }
.shop-btn.secondary { background: var(--color-bg-elevated); border: 1px solid var(--color-border); }
.swap-prompt { padding: 12px; background: var(--color-panel-inset); border: 1px solid var(--color-water); border-radius: var(--radius-md); margin-top: 8px; }
.building-card { padding: 12px; background: var(--color-panel-inset); border: 1px solid var(--color-border); border-radius: var(--radius-sm); margin-bottom: 10px; }
.building-header { display: flex; justify-content: space-between; margin-bottom: 6px; }
.building-desc, .upgrade-unlock { font-size: 13px; color: var(--color-text-soft); margin: 4px 0; }
.upgrade-cost { display: flex; flex-wrap: wrap; gap: 10px; font-size: 12px; color: var(--color-text-soft); margin: 8px 0; }
.upgrade-cost .short { color: var(--color-danger-bright); }
.maxed { color: var(--color-accent-bright); font-size: 13px; }
.quest-progress { font-weight: 700; color: var(--color-accent-bright); white-space: nowrap; margin-left: 12px; }
.shard-progress { display: flex; gap: 8px; }
.shard { padding: 6px 12px; border-radius: var(--radius-md); background: var(--color-bg-elevated); color: var(--color-text-muted); font-size: 12px; border: 1px solid var(--color-border); }
.shard.owned { background: rgba(90, 138, 170, 0.2); color: var(--color-water); border-color: var(--color-water); }
</style>
