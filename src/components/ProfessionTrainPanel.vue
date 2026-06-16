<template>
  <div class="profession-train-panel panel">
    <h4>{{ npcName }} — {{ professionName }} Training</h4>
    <p v-if="trainerLine" class="trainer-line">{{ trainerLine }}</p>
    <p class="train-meta">
      <strong>{{ professionName }}:</strong> Level {{ professionLevel }} ·
      <strong>Gold:</strong> {{ gameState.player.gold }}g
    </p>

    <div v-for="tier in tiers" :key="tier" class="tier-block panel-inset">
      <div class="tier-header">
        <h5>Tier {{ tier }}</h5>
        <span v-if="tier <= unlockedTier" class="badge unlocked">Unlocked</span>
        <span v-else-if="tier === unlockedTier + 1" class="badge next">Next</span>
        <span v-else class="badge locked">Locked</span>
      </div>

      <p v-if="tier > unlockedTier + 1" class="tier-hint muted">
        Unlock tier {{ unlockedTier + 1 }} first.
      </p>
      <p v-else-if="tier > unlockedTier" class="tier-hint">
        Requires {{ professionName }} Lv {{ tierRequiredLevel(tier) }} ·
        {{ tierUnlockCost(tier) }}g to unlock
      </p>

      <button
        v-if="tier === unlockedTier + 1"
        class="btn btn-primary tier-unlock-btn"
        :disabled="!canUnlockTier(tier)"
        @click="$emit('unlockTier', tier)"
      >
        Unlock Tier {{ tier }} ({{ tierUnlockCost(tier) }}g)
      </button>

      <div v-if="tier <= unlockedTier" class="recipe-list">
        <div
          v-for="recipe in recipesInTier(tier)"
          :key="recipe.id"
          class="recipe-buy-row"
        >
          <div class="recipe-buy-info">
            <strong>{{ recipe.name }}</strong>
            <span class="recipe-tier-tag">T{{ recipe.tier }}</span>
          </div>
          <button
            v-if="isPurchased(recipe.id)"
            class="btn btn-owned"
            disabled
          >
            Owned
          </button>
          <button
            v-else
            class="btn"
            :class="canBuy(recipe.id) ? 'btn-primary' : 'btn-locked'"
            :disabled="!canBuy(recipe.id)"
            @click="$emit('purchaseRecipe', recipe.id)"
          >
            Buy ({{ recipePurchaseCost(recipe) }}g)
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { GameState } from '@/engine/GameLoopDesign'
import type { RecipeDef } from '@/engine/ContentSchemas'
import {
  getTrainerProfession,
  getTiersForProfession,
  getRecipesForProfession,
  getUnlockedProfessionTier,
  hasPurchasedRecipe,
  getTierUnlockGold,
  getRecipePurchaseGold,
  TIER_UNLOCK_LEVEL,
} from '@/engine/ProfessionTraining'
import { getAllRecipes, canUnlockProfessionTier, canPurchaseRecipe } from '@/engine/CraftingSystem'
import { getProfessionLevel, PROFESSIONS } from '@/engine/Professions'

const props = defineProps<{
  gameState: GameState
  npcId: string
  npcName: string
}>()

defineEmits<{
  unlockTier: [tier: number]
  purchaseRecipe: [recipeId: string]
}>()

const professionId = computed(() => getTrainerProfession(props.npcId)!)
const professionName = computed(() => PROFESSIONS[professionId.value].name)
const professionLevel = computed(() =>
  getProfessionLevel(props.gameState.player, professionId.value)
)
const unlockedTier = computed(() =>
  getUnlockedProfessionTier(props.gameState.player, professionId.value)
)
const tiers = computed(() => getTiersForProfession(professionId.value, getAllRecipes()))
const allRecipes = computed(() => getRecipesForProfession(professionId.value, getAllRecipes()))

const trainerLine = computed(() => {
  switch (props.npcId) {
    case 'brannoch':
      return '"Steel remembers honest labor. Buy the tier, then each blueprint — no shortcuts."'
    case 'wren':
      return '"Straight shafts, clean fletch. Pay for the tier, then the pattern."'
    case 'yvane':
      return '"Every reagent has a price — in coin and in study."'
    default:
      return ''
  }
})

function tierRequiredLevel(tier: number): number {
  return TIER_UNLOCK_LEVEL[tier] ?? tier
}

function tierUnlockCost(tier: number): number {
  return getTierUnlockGold(tier)
}

function recipesInTier(tier: number): RecipeDef[] {
  return allRecipes.value.filter((r) => (r.tier ?? 1) === tier)
}

function canUnlockTier(tier: number): boolean {
  return canUnlockProfessionTier(props.gameState, professionId.value, tier)
}

function isPurchased(recipeId: string): boolean {
  return hasPurchasedRecipe(props.gameState.player, recipeId)
}

function canBuy(recipeId: string): boolean {
  return canPurchaseRecipe(props.gameState, recipeId)
}

function recipePurchaseCost(recipe: RecipeDef): number {
  return getRecipePurchaseGold(recipe)
}
</script>

<style scoped>
.profession-train-panel { margin-top: 12px; }
.profession-train-panel h4 { margin: 0 0 8px; color: var(--color-accent); font-family: var(--font-display); }
.trainer-line { font-size: 13px; color: var(--color-text-soft); font-style: italic; margin: 0 0 8px; line-height: 1.4; }
.train-meta { margin-bottom: 12px; color: var(--color-text); font-size: 13px; }
.tier-block { margin-bottom: 12px; padding: 10px; }
.tier-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.tier-header h5 { margin: 0; color: var(--color-accent-warm); font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
.badge { font-size: 11px; padding: 2px 6px; border-radius: 4px; }
.badge.unlocked { background: rgba(107, 155, 90, 0.25); color: #8fbf7a; }
.badge.next { background: rgba(200, 160, 80, 0.2); color: #d4a85a; }
.badge.locked { background: rgba(120, 120, 120, 0.2); color: #888; }
.tier-hint { font-size: 12px; color: var(--color-text-soft); margin: 0 0 8px; }
.tier-hint.muted { color: #666; font-style: italic; }
.tier-unlock-btn { margin-bottom: 8px; }
.recipe-list { display: flex; flex-direction: column; gap: 6px; }
.recipe-buy-row { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 6px 0; border-top: 1px solid var(--color-border); }
.recipe-buy-row:first-child { border-top: none; }
.recipe-buy-info { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.recipe-tier-tag { font-size: 10px; color: #888; }
.btn { padding: 5px 12px; border: none; border-radius: var(--radius-sm); cursor: pointer; font-size: 12px; }
.btn-primary { background: var(--color-accent); color: var(--color-text); }
.btn-owned { opacity: 0.6; cursor: default; background: #3a4a3a; color: #aaa; }
.btn-locked { opacity: 0.5; cursor: not-allowed; background: #444; color: #888; }
</style>
