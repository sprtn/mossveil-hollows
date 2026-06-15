<template>
  <div class="craft-panel panel">
    <h4>{{ npcName }} — Crafting</h4>

    <div v-if="pendingOrders.length > 0" class="orders-section">
      <h5>Commissions in progress</h5>
      <div v-for="order in pendingOrders" :key="order.id" class="order-row">
        {{ describeOrder(order) }}
      </div>
      <p class="order-hint">Finished commissions arrive when you rest, sleep, or stay at the inn.</p>
    </div>

    <div v-if="throughput <= 0 && recipes.length === 0" class="empty">
      Build the workbench in Buildings before crafting here.
    </div>
    <div v-else-if="recipes.length === 0" class="empty">
      No recipes available yet. Upgrade buildings or complete quests first.
    </div>

    <div v-for="recipe in recipes" :key="recipe.id" class="recipe-row">
      <div class="recipe-info">
        <strong>{{ recipe.name }}</strong>
        <span class="output">
          → {{ getItemName(recipe.output.itemId) }}<template v-if="recipe.output.qty > 1"> x{{ recipe.output.qty }}</template>
        </span>
        <span v-if="outputStats(recipe.output.itemId)" class="item-stats">{{ outputStats(recipe.output.itemId) }}</span>
        <span v-if="outputDesc(recipe.output.itemId)" class="item-desc">{{ outputDesc(recipe.output.itemId) }}</span>

        <div class="materials">
          <span
            v-for="(qty, matId) in recipe.requires.materials"
            :key="matId"
            :class="['mat', { short: materialCount(matId) < qty }]"
          >
            {{ materialIcon(matId) }} {{ getItemName(matId) }}: {{ materialCount(matId) }}/{{ qty }}
          </span>
        </div>

        <div class="self-craft-meta">
          <span>{{ resourceIcons.stamina }} Self-craft: {{ preview(recipe.id)?.staminaCost ?? '—' }} stamina</span>
          <span>{{ professionIcon(recipe.profession) }} {{ preview(recipe.id)?.professionName }} Lv {{ preview(recipe.id)?.professionLevel ?? 1 }}</span>
          <span class="quality-range">
            Quality {{ preview(recipe.id)?.qualityFloorLabel }} → {{ preview(recipe.id)?.qualityCeilingLabel }}+
          </span>
          <span class="xp-note">+{{ preview(recipe.id)?.xpReward ?? 0 }} XP (instant)</span>
        </div>

        <div class="commission-meta">
          <span v-if="recipe.requires.gold" class="mat">
            {{ resourceIcons.gold }} Order fee: {{ recipe.requires.gold }}g
          </span>
          <span class="eta">Commission: ready in ~{{ estimatedWait }} day{{ estimatedWait === 1 ? '' : 's' }} · Common quality · no XP</span>
        </div>
      </div>

      <div class="recipe-actions">
        <button
          class="shop-btn self-craft-btn"
          :disabled="!canSelfCraftRecipe(recipe.id)"
          @click="$emit('selfCraft', recipe.id)"
        >
          Craft yourself
        </button>
        <button
          class="shop-btn commission-btn"
          :disabled="!canCommissionRecipe(recipe.id)"
          @click="$emit('craft', recipe.id)"
        >
          Order
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { GameState } from '@/engine/GameLoopDesign'
import type { ProfessionId } from '@/engine/Professions'
import { getRecipesForNpc, canCraft } from '@/engine/CraftingSystem'
import { getPendingCraftOrders, describeCraftOrder, getCraftThroughput } from '@/engine/CraftOrderSystem'
import { canSelfCraft, getSelfCraftPreview } from '@/engine/SelfCraft'
import { getItemName, getItemTemplate } from '@/engine/ItemDatabase'
import { getMaterialCount } from '@/engine/Materials'
import { materialIcon, resourceIcons, itemStatSummary } from '@/utils/icons'

const props = defineProps<{
  gameState: GameState
  npcId: string
  npcName: string
}>()

defineEmits<{ craft: [recipeId: string]; selfCraft: [recipeId: string] }>()

const recipes = computed(() => getRecipesForNpc(props.gameState, props.npcId))
const pendingOrders = computed(() => getPendingCraftOrders(props.gameState, props.npcId))
const throughput = computed(() => getCraftThroughput(props.gameState, props.npcId))
const estimatedWait = computed(() => pendingOrders.value.length + 1)

function describeOrder(order: ReturnType<typeof getPendingCraftOrders>[number]) {
  return describeCraftOrder(props.gameState, order)
}

function materialCount(matId: string): number {
  return getMaterialCount(props.gameState.player, matId)
}

function outputStats(itemId: string): string {
  return itemStatSummary(getItemTemplate(itemId))
}

function outputDesc(itemId: string): string {
  return getItemTemplate(itemId)?.description ?? ''
}

function preview(recipeId: string) {
  return getSelfCraftPreview(props.gameState, recipeId)
}

function professionIcon(id: ProfessionId): string {
  switch (id) {
    case 'smithing': return '⚒️'
    case 'fletching': return '🏹'
    case 'alchemy': return '⚗️'
    default: return '🔧'
  }
}

function canSelfCraftRecipe(id: string): boolean {
  return canSelfCraft(props.gameState, id)
}

function canCommissionRecipe(id: string): boolean {
  return throughput.value > 0 && canCraft(props.gameState, id)
}
</script>

<style scoped>
.craft-panel { margin-top: 12px; }
.craft-panel h4 { margin: 0 0 10px; color: var(--color-accent); font-family: var(--font-display); font-size: 14px; }
.orders-section { margin-bottom: 12px; padding: 10px; background: rgba(107, 155, 90, 0.08); border: 1px solid var(--color-border); border-radius: var(--radius-sm); }
.orders-section h5 { margin: 0 0 8px; font-size: 12px; color: var(--color-accent); text-transform: uppercase; letter-spacing: 0.5px; }
.order-row { font-size: 12px; color: #ccc; margin-bottom: 4px; }
.order-hint { margin: 8px 0 0; font-size: 11px; color: #888; font-style: italic; }
.recipe-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding: 10px; background: var(--color-panel-inset); border: 1px solid var(--color-border); border-radius: var(--radius-sm); margin-bottom: 8px; }
.recipe-info { flex: 1; display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
.recipe-actions { display: flex; flex-direction: column; gap: 6px; }
.output { color: #888; font-size: 12px; }
.item-stats { color: #4caf50; font-size: 12px; font-weight: 600; }
.item-desc { color: #999; font-size: 11px; font-style: italic; }
.materials { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
.self-craft-meta, .commission-meta { display: flex; flex-direction: column; gap: 2px; font-size: 11px; margin-top: 4px; }
.self-craft-meta { color: #8fbf7a; }
.commission-meta { color: #888; border-top: 1px solid var(--color-border); padding-top: 6px; margin-top: 6px; }
.quality-range { color: #aaa; }
.xp-note { color: #7eb8da; }
.mat { font-size: 12px; color: #aaa; }
.mat.short { color: var(--color-danger-bright); }
.eta { font-size: 11px; color: var(--color-accent); margin-top: 2px; }
.shop-btn { padding: 6px 14px; background: var(--color-accent); border: none; border-radius: var(--radius-sm); color: var(--color-text); cursor: pointer; white-space: nowrap; font-size: 12px; }
.self-craft-btn { background: #3a5a3a; }
.commission-btn { background: #5a4a2a; }
.shop-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.empty { color: #666; font-style: italic; font-size: 13px; }
</style>
