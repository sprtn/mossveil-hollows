/**
 * Crafting system — recipes, stations, material costs.
 */

import type { GameState } from './GameLoopDesign'
import type { RecipeDef } from './ContentSchemas'
import { hasMaterials } from './Materials'
import {
  filterRecipeCatalog,
  passesTrainingGates,
  canUnlockProfessionTier as canUnlockProfessionTierCore,
  canPurchaseRecipe as canPurchaseRecipeCore,
  purchaseRecipe as purchaseRecipeCore,
  unlockProfessionTier as unlockProfessionTierCore,
} from './ProfessionTraining'
import { getRecipe, getAllRecipes } from './admin/ContentRegistry'

export { getRecipe, getAllRecipes }

export function totalRecipeMaterialCount(recipe: RecipeDef): number {
  return Object.values(recipe.requires.materials).reduce((sum, qty) => sum + qty, 0)
}

/** Flag/building/quest prerequisites — unchanged from pre-training system. */
export function passesRecipePrerequisites(state: GameState, recipe: RecipeDef): boolean {
  if (!recipe.unlockedBy) return true
  if (recipe.unlockedBy.flag && !state.flags?.[recipe.unlockedBy.flag]) return false
  if (recipe.unlockedBy.building) {
    const level = state.townBuildings?.[recipe.unlockedBy.building] ?? 0
    const required = recipe.unlockedBy.buildingLevel ?? 1
    if (level < required) return false
  }
  return true
}

export function isRecipeCraftable(state: GameState, recipe: RecipeDef): boolean {
  if (!passesRecipePrerequisites(state, recipe)) return false
  return passesTrainingGates(state.player, recipe)
}

/** @deprecated alias — use isRecipeCraftable */
export function isRecipeUnlocked(state: GameState, recipe: RecipeDef): boolean {
  return isRecipeCraftable(state, recipe)
}

export function getRecipeCatalogForNpc(state: GameState, npcId: string): RecipeDef[] {
  return filterRecipeCatalog(getAllRecipes(), npcId, (r) => passesRecipePrerequisites(state, r))
}

export function getRecipesForNpc(state: GameState, npcId: string): RecipeDef[] {
  return getRecipeCatalogForNpc(state, npcId).filter((r) => isRecipeCraftable(state, r))
}

export function canCraft(state: GameState, recipeId: string): boolean {
  const recipe = getRecipe(recipeId)
  if (!recipe || !isRecipeCraftable(state, recipe)) return false
  if (state.player.gold < recipe.requires.gold) return false
  return hasMaterials(state.player, recipe.requires.materials)
}

export function canUnlockProfessionTier(
  state: GameState,
  profession: import('./Professions').ProfessionId,
  tier: number
): boolean {
  return canUnlockProfessionTierCore(state, profession, tier, getAllRecipes())
}

export function canPurchaseRecipe(state: GameState, recipeId: string): boolean {
  const recipe = getRecipe(recipeId)
  if (!recipe) return false
  return canPurchaseRecipeCore(state, recipe, passesRecipePrerequisites(state, recipe))
}

export function purchaseRecipe(state: GameState, recipeId: string): GameState {
  const recipe = getRecipe(recipeId)
  if (!recipe) return state
  if (!passesRecipePrerequisites(state, recipe)) return state
  return purchaseRecipeCore(state, recipeId, recipe)
}

export function unlockProfessionTier(
  state: GameState,
  profession: import('./Professions').ProfessionId,
  tier: number
): GameState {
  return unlockProfessionTierCore(state, profession, tier, getAllRecipes())
}
