/**
 * Hub services: shop, healer, rest, save, training, crafting, buildings
 */

import type { GameState } from './GameLoopDesign'
import {
  addItemToInventory,
  getItemTemplate,
  getInventoryQuantity,
  getItemName,
  removeItemFromInventory,
} from './ItemDatabase'
import {
  HEALER_COST,
  HEALER_ENERGY_RESTORE,
  HEALER_HP_RESTORE,
  HEALER_STAMINA_RESTORE,
  REST_ENERGY_PERCENT,
  REST_HP_PERCENT,
  REST_STAMINA_PERCENT,
  INN_COST,
  INN_HP_PERCENT,
} from './gameConfig'
import { saveGame } from './saveGame'
import { getEffectiveMaxHp, applyWoundedClear } from './PlayerStats'
import { attemptTraining } from './SkillTraining'
import { placeCraftOrder } from './CraftOrderSystem'
import { selfCraft } from './SelfCraft'
import {
  unlockProfessionTier,
  purchaseRecipe,
} from './CraftingSystem'
import type { ProfessionId } from './Professions'
import { advanceDay } from './DayAdvance'
import { upgradeBuilding, getBuildingLevel } from './BuildingSystem'
import {
  getPrice,
  recordTrade,
  ensureMarketState,
  getMarketMaterialBuyPrice,
  getMaterialMarketStock,
  getMarketPlayerStock,
} from './MarketSystem'
import {
  ensureVendorState,
  vendorHasStock,
  getVendorStock,
  decrementVendorStock,
  addVendorXp,
  getVendorBuyDiscount,
  getVendorSellBonus,
} from './VendorSystem'
import { vendorAcceptsItem, getItemCategory } from './MarketCatalog'
import { setProductionEnabled, setProductionLabour } from './EconomyTick'
import { addMaterial } from './Materials'
import { appendStatus } from './statusMessages'
import type { Quality } from './Quality'
import { DEFAULT_QUALITY } from './Quality'

export function sellMaterialToMarket(
  state: GameState,
  materialId: string,
  qty = 1
): GameState {
  const template = getItemTemplate(materialId)
  if (!template || template.sellPrice === undefined) return state
  if (!getItemCategory(materialId)) return state

  const owned = getMarketPlayerStock(state.player, materialId)
  const sellQty = Math.min(Math.max(1, qty), owned)
  if (sellQty <= 0) return state

  let result = ensureMarketState(state)
  const unitPrice = getPrice(result, materialId, 'sell')
  const total = unitPrice * sellQty
  const name = getItemName(materialId)

  let player = { ...result.player, gold: result.player.gold + total }
  if (template.type === 'consumable') {
    player = {
      ...player,
      inventory: removeItemFromInventory(player.inventory, materialId, sellQty),
    }
  } else {
    player = addMaterial(player, materialId, -sellQty)
  }

  result = {
    ...result,
    player,
    statusMessage: `Sold ${sellQty} ${name} to the local market for ${total}g (${unitPrice}g each).`,
  }
  return recordTrade(result, materialId, sellQty, 'sell')
}

export function buyMaterialFromMarket(
  state: GameState,
  materialId: string,
  qty = 1
): GameState {
  const template = getItemTemplate(materialId)
  if (!template || template.sellPrice === undefined) return state
  if (!getItemCategory(materialId)) return state

  let result = ensureMarketState(state)
  const stock = getMaterialMarketStock(result, materialId)
  const unitPrice = getMarketMaterialBuyPrice(result, materialId)
  if (unitPrice <= 0 || stock <= 0) return state

  const affordable = Math.floor(result.player.gold / unitPrice)
  const buyQty = Math.min(Math.max(1, qty), stock, affordable)
  if (buyQty < 1) return state

  const total = unitPrice * buyQty

  const name = getItemName(materialId)
  let player = { ...result.player, gold: result.player.gold - total }
  if (template.type === 'consumable') {
    player = {
      ...player,
      inventory: addItemToInventory(player.inventory, materialId, buyQty, DEFAULT_QUALITY),
    }
  } else {
    player = addMaterial(player, materialId, buyQty)
  }

  result = {
    ...result,
    player,
    statusMessage: `Bought ${buyQty} ${name} from the local market for ${total}g (${unitPrice}g each).`,
  }
  return recordTrade(result, materialId, buyQty, 'buy')
}

export function buyItem(
  state: GameState,
  vendorId: string,
  templateId: string,
  quality: Quality = DEFAULT_QUALITY,
  qty = 1
): GameState {
  const template = getItemTemplate(templateId)
  if (!template || template.buyPrice === undefined) return state

  let result = ensureVendorState(ensureMarketState(state))
  if (!vendorHasStock(result, vendorId, templateId, quality)) return result

  const unitPrice = getPrice(result, templateId, 'buy', {
    buyDiscount: getVendorBuyDiscount(result, vendorId),
    quality,
  })
  if (unitPrice <= 0) return state

  const vendorStock = getVendorStock(result, vendorId, templateId, quality)
  const affordable = Math.floor(result.player.gold / unitPrice)
  const buyQty = Math.min(Math.max(1, qty), vendorStock, affordable)
  if (buyQty < 1) return state

  const total = unitPrice * buyQty

  result = {
    ...result,
    player: {
      ...result.player,
      gold: result.player.gold - total,
      inventory: addItemToInventory(result.player.inventory, templateId, buyQty, quality),
    },
  }
  result = decrementVendorStock(result, vendorId, templateId, buyQty, quality)
  result = recordTrade(result, templateId, buyQty, 'buy')
  result = addVendorXp(result, vendorId, total)
  return result
}

export function sellItem(
  state: GameState,
  vendorId: string,
  templateId: string,
  quality: Quality = DEFAULT_QUALITY,
  qty = 1
): GameState {
  const template = getItemTemplate(templateId)
  if (!template || template.sellPrice === undefined) return state
  if (!vendorAcceptsItem(vendorId, templateId)) return state

  const owned = getInventoryQuantity(state.player, templateId, quality)
  if (owned <= 0) return state

  const w = state.player.equipment.weapon
  const a = state.player.equipment.armor
  const isEquipped =
    (w?.templateId === templateId && w.quality === quality) ||
    (a?.templateId === templateId && a.quality === quality)
  const reserved = isEquipped ? 1 : 0
  const sellable = owned - reserved
  const sellQty = Math.min(Math.max(1, qty), sellable)
  if (sellQty < 1) return state

  let result = ensureVendorState(ensureMarketState(state))
  const unitPrice = getPrice(result, templateId, 'sell', {
    sellBonus: getVendorSellBonus(result, vendorId),
    quality,
  })
  const total = unitPrice * sellQty

  result = {
    ...result,
    player: {
      ...result.player,
      gold: result.player.gold + total,
      inventory: removeItemFromInventory(result.player.inventory, templateId, sellQty, quality),
    },
  }
  result = recordTrade(result, templateId, sellQty, 'sell')
  result = addVendorXp(result, vendorId, total)
  return result
}

export function hubSetProductionEnabled(
  state: GameState,
  buildingId: string,
  enabled: boolean
): GameState {
  return setProductionEnabled(state, buildingId, enabled)
}

export function hubSetProductionLabour(
  state: GameState,
  buildingId: string,
  labourGoldPerDay: number
): GameState {
  return setProductionLabour(state, buildingId, labourGoldPerDay)
}

export function useHealer(state: GameState): GameState {
  if (!state.currentRoom.isHub) return state
  if (state.player.gold < HEALER_COST) return state

  const maxHp = state.player.maxHp
  const newState: GameState = {
    ...state,
    player: applyWoundedClear({
      ...state.player,
      gold: state.player.gold - HEALER_COST,
      hp: Math.min(maxHp, state.player.hp + HEALER_HP_RESTORE),
      energy: Math.min(state.player.maxEnergy, state.player.energy + HEALER_ENERGY_RESTORE),
      stamina: Math.min(state.player.maxStamina, state.player.stamina + HEALER_STAMINA_RESTORE),
      statusEffects: [],
    }),
    lastHealingOpportunity: state.turnCount,
    encounterChainCount: 0,
    statusMessage: 'The healer fully restores your body and spirit.',
  }

  saveGame(newState)
  return newState
}

export function manualSave(state: GameState): GameState {
  saveGame(state)
  return { ...state, statusMessage: 'Game saved.' }
}

export function restAtHub(state: GameState): GameState {
  if (!state.currentRoom.isHub) return state

  const maxHp = getEffectiveMaxHp(state.player)
  const targetHp = Math.floor(maxHp * REST_HP_PERCENT)
  const targetEnergy = Math.floor(state.player.maxEnergy * REST_ENERGY_PERCENT)
  const targetStamina = Math.floor(state.player.maxStamina * REST_STAMINA_PERCENT)

  const advanced = advanceDay(state)

  return {
    ...advanced,
    player: {
      ...advanced.player,
      hp: Math.max(advanced.player.hp, targetHp),
      energy: Math.max(advanced.player.energy, targetEnergy),
      stamina: Math.max(advanced.player.stamina, targetStamina),
      statusEffects: advanced.player.statusEffects.filter((s) => s.type !== 'poison'),
    },
    encounterChainCount: 0,
    lastHealingOpportunity: state.turnCount,
    statusMessage: appendStatus('You rest outside and recover partially.', advanced.statusMessage),
  }
}

export function useInn(state: GameState): GameState {
  if (!state.currentRoom.isHub) return state
  if (state.player.gold < INN_COST) return state

  const maxHp = state.player.maxHp
  const advanced = advanceDay(state)
  const newState: GameState = {
    ...advanced,
    player: applyWoundedClear({
      ...advanced.player,
      gold: advanced.player.gold - INN_COST,
      hp: Math.min(maxHp, Math.floor(maxHp * INN_HP_PERCENT)),
      energy: advanced.player.maxEnergy,
      stamina: advanced.player.maxStamina,
      statusEffects: [],
    }),
    encounterChainCount: 0,
    lastHealingOpportunity: state.turnCount,
    statusMessage: appendStatus('A warm bed at the inn. You wake fully rested.', advanced.statusMessage),
  }
  saveGame(newState)
  return newState
}

export function sleepAtHome(state: GameState): GameState {
  if (!state.currentRoom.isHub) return state
  if (getBuildingLevel(state, 'house') < 1) return state

  const maxHp = state.player.maxHp
  const advanced = advanceDay(state)
  const newState: GameState = {
    ...advanced,
    player: applyWoundedClear({
      ...advanced.player,
      hp: maxHp,
      energy: advanced.player.maxEnergy,
      stamina: advanced.player.maxStamina,
      statusEffects: [],
    }),
    encounterChainCount: 0,
    lastHealingOpportunity: state.turnCount,
    statusMessage: appendStatus('You sleep soundly in your own home.', advanced.statusMessage),
  }
  saveGame(newState)
  return newState
}

export function hubAttemptTraining(
  state: GameState,
  skillId: string,
  trainerId?: string,
  roll?: number
): GameState {
  if (!state.currentRoom.isHub) return state
  const { state: result, outcome } = attemptTraining(state, skillId, roll)
  if (!outcome) return state

  const pct = Math.round(outcome.chance * 100)
  let message: string
  if (outcome.success) {
    message = trainerId === 'captain_bryn'
      ? `You train hard under Bryn's eye… and master ${outcome.skillName}! (${pct}% chance)`
      : `Training succeeds — you learned ${outcome.skillName}! (${pct}% chance)`
  } else {
    message = trainerId === 'captain_bryn'
      ? `You drill all day with Bryn, but ${outcome.skillName} won't stick. The ${outcome.goldSpent}g and the day are spent. (${pct}% chance)`
      : `Training failed — ${outcome.skillName} eludes you. ${outcome.goldSpent}g and a day lost. (${pct}% chance)`
  }
  saveGame(result)
  return { ...result, statusMessage: message }
}

export function hubCraft(state: GameState, recipeId: string): GameState {
  return placeCraftOrder(state, recipeId)
}

export function hubSelfCraft(state: GameState, recipeId: string): GameState {
  return selfCraft(state, recipeId)
}

export function hubUnlockProfessionTier(
  state: GameState,
  profession: ProfessionId,
  tier: number
): GameState {
  if (!state.currentRoom.isHub) return state
  return unlockProfessionTier(state, profession, tier)
}

export function hubPurchaseRecipe(state: GameState, recipeId: string): GameState {
  if (!state.currentRoom.isHub) return state
  return purchaseRecipe(state, recipeId)
}

export function hubUpgradeBuilding(state: GameState, buildingId: string): GameState {
  const before = state.townBuildings?.[buildingId] ?? 0
  const result = upgradeBuilding(state, buildingId)
  const after = result.townBuildings?.[buildingId] ?? 0
  if (after > before) {
    return { ...result, statusMessage: `Upgraded ${buildingId.replace(/_/g, ' ')} to level ${after}.` }
  }
  return result
}
