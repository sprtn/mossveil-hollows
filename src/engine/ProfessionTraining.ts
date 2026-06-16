/**
 * Profession recipe training — tier unlock + per-recipe purchase gates.
 * Crafting professions only; gathering is out of scope.
 */

import type { GameState, Player } from './GameLoopDesign'
import type { RecipeDef } from './ContentSchemas'
import {
  CRAFTING_PROFESSION_IDS,
  getProfessionLevel,
  PROFESSIONS,
  type ProfessionId,
} from './Professions'

// --- Tunable placeholders (playtest) ---

/** Profession level required to unlock each recipe tier at a trainer. */
export const TIER_UNLOCK_LEVEL: Record<number, number> = {
  1: 1,
  2: 3,
  3: 5,
  4: 7,
  5: 9,
}

/** Gold to unlock a tier at the trainer (tier 1 is always open — no fee). */
export const TIER_UNLOCK_GOLD: Record<number, number> = {
  1: 0,
  2: 50,
  3: 100,
  4: 175,
  5: 275,
}

/** Base gold to buy an individual recipe; scaled by tier unless overridden on recipe. */
export const RECIPE_PURCHASE_GOLD_BASE = 15

/** Trainer NPC id → crafting profession they teach. */
export const TRAINER_NPC_PROFESSION: Record<string, ProfessionId> = {
  brannoch: 'smithing',
  wren: 'fletching',
  yvane: 'alchemy',
}

export const PROFESSION_TRAINER_NPC: Partial<Record<ProfessionId, string>> = {
  smithing: 'brannoch',
  fletching: 'wren',
  alchemy: 'yvane',
}

export function isCraftingProfession(profession: ProfessionId): boolean {
  return (CRAFTING_PROFESSION_IDS as ProfessionId[]).includes(profession)
}

export function getTrainerProfession(npcId: string): ProfessionId | undefined {
  return TRAINER_NPC_PROFESSION[npcId]
}

export function createDefaultUnlockedProfessionTiers(): Partial<Record<ProfessionId, number>> {
  const tiers: Partial<Record<ProfessionId, number>> = {}
  for (const id of CRAFTING_PROFESSION_IDS) {
    tiers[id] = 1
  }
  return tiers
}

export function normalizeUnlockedProfessionTiers(
  player: Pick<Player, 'unlockedProfessionTiers'>
): Partial<Record<ProfessionId, number>> {
  const defaults = createDefaultUnlockedProfessionTiers()
  const existing = player.unlockedProfessionTiers ?? {}
  return { ...defaults, ...existing }
}

export function normalizePurchasedRecipes(
  player: Pick<Player, 'purchasedRecipes'>
): string[] {
  return [...(player.purchasedRecipes ?? [])]
}

export function getUnlockedProfessionTier(player: Player, profession: ProfessionId): number {
  if (!isCraftingProfession(profession)) return 0
  return normalizeUnlockedProfessionTiers(player)[profession] ?? 1
}

export function hasPurchasedRecipe(player: Player, recipeId: string): boolean {
  return normalizePurchasedRecipes(player).includes(recipeId)
}

export function getTierUnlockGold(tier: number): number {
  return TIER_UNLOCK_GOLD[tier] ?? TIER_UNLOCK_GOLD_BASE_FALLBACK(tier)
}

/** Fallback when tier exceeds authored table — linear extension. */
function TIER_UNLOCK_GOLD_BASE_FALLBACK(tier: number): number {
  return Math.max(0, (tier - 1) * 75)
}

export function getRecipePurchaseGold(recipe: RecipeDef): number {
  if (recipe.purchaseGold !== undefined) return recipe.purchaseGold
  return RECIPE_PURCHASE_GOLD_BASE * (recipe.tier ?? 1)
}

export function getTiersForProfession(
  profession: ProfessionId,
  recipes: RecipeDef[]
): number[] {
  const tiers = new Set<number>()
  for (const recipe of recipes) {
    if (recipe.profession === profession) tiers.add(recipe.tier ?? 1)
  }
  return [...tiers].sort((a, b) => a - b)
}

export function getRecipesForProfession(
  profession: ProfessionId,
  recipes: RecipeDef[]
): RecipeDef[] {
  return recipes.filter((r) => r.profession === profession)
}

export function passesTrainingGates(player: Player, recipe: RecipeDef): boolean {
  if (!isCraftingProfession(recipe.profession)) return true
  if ((recipe.tier ?? 1) > getUnlockedProfessionTier(player, recipe.profession)) {
    return false
  }
  return hasPurchasedRecipe(player, recipe.id)
}

export function canUnlockProfessionTier(
  state: GameState,
  profession: ProfessionId,
  tier: number,
  recipes: RecipeDef[]
): boolean {
  if (!isCraftingProfession(profession)) return false
  if (!getTiersForProfession(profession, recipes).includes(tier)) return false

  const current = getUnlockedProfessionTier(state.player, profession)
  if (tier !== current + 1) return false

  const requiredLevel = TIER_UNLOCK_LEVEL[tier] ?? Infinity
  if (getProfessionLevel(state.player, profession) < requiredLevel) return false

  const cost = getTierUnlockGold(tier)
  return state.player.gold >= cost
}

export function unlockProfessionTier(
  state: GameState,
  profession: ProfessionId,
  tier: number,
  recipes: RecipeDef[]
): GameState {
  if (!canUnlockProfessionTier(state, profession, tier, recipes)) return state

  const cost = getTierUnlockGold(tier)
  const tiers = normalizeUnlockedProfessionTiers(state.player)
  tiers[profession] = tier

  return {
    ...state,
    player: {
      ...state.player,
      gold: state.player.gold - cost,
      unlockedProfessionTiers: tiers,
    },
    statusMessage: `${PROFESSIONS[profession].name} tier ${tier} unlocked — recipes in this tier are now available to buy.`,
  }
}

export function canPurchaseRecipe(
  state: GameState,
  recipe: RecipeDef,
  prerequisitesMet: boolean
): boolean {
  if (!recipe || !isCraftingProfession(recipe.profession)) return false
  if (!prerequisitesMet) return false
  if (hasPurchasedRecipe(state.player, recipe.id)) return false
  if ((recipe.tier ?? 1) > getUnlockedProfessionTier(state.player, recipe.profession)) {
    return false
  }
  return state.player.gold >= getRecipePurchaseGold(recipe)
}

export function purchaseRecipe(state: GameState, recipeId: string, recipe: RecipeDef): GameState {
  if (!canPurchaseRecipe(state, recipe, true)) return state

  const cost = getRecipePurchaseGold(recipe)
  const purchased = normalizePurchasedRecipes(state.player)
  if (!purchased.includes(recipeId)) purchased.push(recipeId)

  return {
    ...state,
    player: {
      ...state.player,
      gold: state.player.gold - cost,
      purchasedRecipes: purchased,
    },
    statusMessage: `Learned recipe: ${recipe.name} (${cost}g).`,
  }
}

/** Recipes visible at a crafter NPC (legacy prerequisites only). */
export function filterRecipeCatalog(
  recipes: RecipeDef[],
  npcId: string,
  prerequisitesMet: (recipe: RecipeDef) => boolean
): RecipeDef[] {
  return recipes.filter((r) => r.npcId === npcId && prerequisitesMet(r))
}

export function wasRecipeCraftableUnderLegacyRules(
  recipe: RecipeDef,
  flags: Record<string, boolean>,
  townBuildings: Record<string, number>
): boolean {
  if (!recipe.unlockedBy) return true
  if (recipe.unlockedBy.flag && !flags[recipe.unlockedBy.flag]) return false
  if (recipe.unlockedBy.building) {
    const level = townBuildings[recipe.unlockedBy.building] ?? 0
    const required = recipe.unlockedBy.buildingLevel ?? 1
    if (level < required) return false
  }
  return true
}

/** Backfill for save migration — old rules (flag/building only). */
export function computeMigrationTrainingState(
  flags: Record<string, boolean>,
  townBuildings: Record<string, number>,
  recipes: RecipeDef[]
): {
  unlockedProfessionTiers: Partial<Record<ProfessionId, number>>
  purchasedRecipes: string[]
} {
  const purchasedRecipes: string[] = []
  const unlockedProfessionTiers = createDefaultUnlockedProfessionTiers()

  for (const recipe of recipes) {
    if (!wasRecipeCraftableUnderLegacyRules(recipe, flags, townBuildings)) continue
    purchasedRecipes.push(recipe.id)
    if (isCraftingProfession(recipe.profession)) {
      const prev = unlockedProfessionTiers[recipe.profession] ?? 1
      unlockedProfessionTiers[recipe.profession] = Math.max(prev, recipe.tier ?? 1)
    }
  }

  return { unlockedProfessionTiers, purchasedRecipes }
}
