/**
 * Crafting system — recipes, stations, material costs.
 */

import type { GameState } from './GameLoopDesign'
import type { RecipeDef } from './ContentSchemas'
import { hasMaterials } from './Materials'

import oakSpear from '../assets/recipes/oak_spear.json'
import hideJerkin from '../assets/recipes/hide_jerkin.json'
import woodenStake from '../assets/recipes/wooden_stake.json'
import antidoteRecipe from '../assets/recipes/antidote_recipe.json'
import cleansingDraught from '../assets/recipes/cleansing_draught.json'

import clothBandage from '../assets/recipes/cloth_bandage.json'
import wolfCloak from '../assets/recipes/wolf_cloak.json'
import paddedWrap from '../assets/recipes/padded_wrap.json'

const RECIPES: RecipeDef[] = [
  oakSpear as RecipeDef,
  hideJerkin as RecipeDef,
  woodenStake as RecipeDef,
  wolfCloak as RecipeDef,
  paddedWrap as RecipeDef,
  antidoteRecipe as RecipeDef,
  cleansingDraught as RecipeDef,
  clothBandage as RecipeDef,
]

export function getRecipe(id: string): RecipeDef | undefined {
  return RECIPES.find((r) => r.id === id)
}

export function isRecipeUnlocked(state: GameState, recipe: RecipeDef): boolean {
  if (!recipe.unlockedBy) return true
  if (recipe.unlockedBy.flag && !state.flags?.[recipe.unlockedBy.flag]) return false
  if (recipe.unlockedBy.building) {
    const level = state.townBuildings?.[recipe.unlockedBy.building] ?? 0
    const required = recipe.unlockedBy.buildingLevel ?? 1
    if (level < required) return false
  }
  return true
}

export function getRecipesForNpc(state: GameState, npcId: string): RecipeDef[] {
  return RECIPES.filter((r) => r.npcId === npcId && isRecipeUnlocked(state, r))
}

export function canCraft(state: GameState, recipeId: string): boolean {
  const recipe = getRecipe(recipeId)
  if (!recipe || !isRecipeUnlocked(state, recipe)) return false
  if (state.player.gold < recipe.requires.gold) return false
  return hasMaterials(state.player, recipe.requires.materials)
}
