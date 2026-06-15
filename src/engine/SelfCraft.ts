/**
 * Player self-craft — instant, stamina-cost, profession XP, rolled quality.
 * Commission path (CraftOrderSystem) remains separate.
 */

import type { GameState } from './GameLoopDesign'
import type { RecipeDef } from './ContentSchemas'
import {
  getRecipe,
  isRecipeUnlocked,
  totalRecipeMaterialCount,
} from './CraftingSystem'
import { addItemToInventory, getItemName } from './ItemDatabase'
import { hasMaterials, spendMaterials } from './Materials'
import {
  getProfessionLevel,
  grantProfessionXp,
  PROFESSIONS,
} from './Professions'
import { rollSelfCraftQuality, selfCraftQualityRange } from './SelfCraftQuality'
import { getQualityTier } from './Quality'

/** Self-craft waives NPC gold fees — player supplies labor instead. */
export const SELF_CRAFT_WAIVES_GOLD_FEE = true

/** Playtest placeholders — stamina cost formula tuning. */
export const SELF_CRAFT_STAMINA_BASE = 2
export const SELF_CRAFT_STAMINA_PER_TIER = 1
export const SELF_CRAFT_STAMINA_PER_MATERIAL = 1
export const SELF_CRAFT_STAMINA_LEVEL_DISCOUNT = 0.5
export const SELF_CRAFT_STAMINA_MIN = 1
export const SELF_CRAFT_STAMINA_MAX = 12

/** Profession XP awarded per self-craft (playtest placeholder). */
export const SELF_CRAFT_XP_BASE = 8
export const SELF_CRAFT_XP_PER_TIER = 4

export function selfCraftStaminaCost(recipe: RecipeDef, professionLevel: number): number {
  const tier = recipe.tier ?? 1
  const materialUnits = totalRecipeMaterialCount(recipe)
  const raw =
    SELF_CRAFT_STAMINA_BASE +
    tier * SELF_CRAFT_STAMINA_PER_TIER +
    materialUnits * SELF_CRAFT_STAMINA_PER_MATERIAL -
    Math.max(0, professionLevel - 1) * SELF_CRAFT_STAMINA_LEVEL_DISCOUNT
  return Math.max(
    SELF_CRAFT_STAMINA_MIN,
    Math.min(SELF_CRAFT_STAMINA_MAX, Math.round(raw))
  )
}

export function selfCraftXpReward(recipe: RecipeDef): number {
  return SELF_CRAFT_XP_BASE + (recipe.tier ?? 1) * SELF_CRAFT_XP_PER_TIER
}

function drainStamina(player: GameState['player'], amount: number): GameState['player'] {
  return { ...player, stamina: Math.max(0, player.stamina - amount) }
}

export function canSelfCraft(state: GameState, recipeId: string): boolean {
  const recipe = getRecipe(recipeId)
  if (!recipe || !isRecipeUnlocked(state, recipe)) return false
  if (!hasMaterials(state.player, recipe.requires.materials)) return false
  if (!SELF_CRAFT_WAIVES_GOLD_FEE && state.player.gold < recipe.requires.gold) return false
  const level = getProfessionLevel(state.player, recipe.profession)
  const staminaCost = selfCraftStaminaCost(recipe, level)
  return state.player.stamina >= staminaCost
}

export function getSelfCraftPreview(state: GameState, recipeId: string) {
  const recipe = getRecipe(recipeId)
  if (!recipe) return null
  const professionLevel = getProfessionLevel(state.player, recipe.profession)
  const range = selfCraftQualityRange(professionLevel)
  return {
    profession: recipe.profession,
    professionName: PROFESSIONS[recipe.profession].name,
    professionLevel,
    staminaCost: selfCraftStaminaCost(recipe, professionLevel),
    qualityFloor: range.floor,
    qualityCeiling: range.ceiling,
    qualityFloorLabel: getQualityTier(range.floor).label,
    qualityCeilingLabel: getQualityTier(range.ceiling).label,
    xpReward: selfCraftXpReward(recipe),
    hasMaterials: hasMaterials(state.player, recipe.requires.materials),
    enoughStamina: state.player.stamina >= selfCraftStaminaCost(recipe, professionLevel),
  }
}

export function selfCraft(state: GameState, recipeId: string): GameState {
  const recipe = getRecipe(recipeId)
  if (!recipe || !canSelfCraft(state, recipeId)) return state

  const professionId = recipe.profession
  const professionLevel = getProfessionLevel(state.player, professionId)
  const staminaCost = selfCraftStaminaCost(recipe, professionLevel)
  const rolledQuality = rollSelfCraftQuality(professionLevel)

  let player = spendMaterials(state.player, recipe.requires.materials)
  if (!SELF_CRAFT_WAIVES_GOLD_FEE && recipe.requires.gold > 0) {
    player = { ...player, gold: player.gold - recipe.requires.gold }
  }
  player = drainStamina(player, staminaCost)
  player = {
    ...player,
    inventory: addItemToInventory(
      player.inventory,
      recipe.output.itemId,
      recipe.output.qty,
      rolledQuality
    ),
  }

  const xpResult = grantProfessionXp(player, professionId, selfCraftXpReward(recipe))
  player = xpResult.player

  const itemName = getItemName(recipe.output.itemId)
  const qLabel = getQualityTier(rolledQuality).label
  const profName = PROFESSIONS[professionId].name
  let message = `Crafted ${itemName} (${qLabel}) — ${staminaCost} stamina, +${xpResult.xpGained} ${profName} XP.`
  if (xpResult.leveledUp) {
    message += ` ${profName} reached level ${xpResult.newLevel}!`
  }

  return {
    ...state,
    player,
    flags: {
      ...(state.flags ?? {}),
      [`crafted_${recipe.output.itemId}`]: true,
    },
    statusMessage: message,
  }
}
