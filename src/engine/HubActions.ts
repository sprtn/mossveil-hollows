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
import { learnSkill, buySkillPoint } from './SkillSystem'
import { placeCraftOrder } from './CraftOrderSystem'
import { selfCraft } from './SelfCraft'
import { advanceDay } from './DayAdvance'
import { upgradeBuilding, getBuildingLevel } from './BuildingSystem'
import {
  getPrice,
  recordTrade,
  ensureMarketState,
  getMarketMaterialBuyPrice,
  getMaterialMarketStock,
} from './MarketSystem'
import {
  ensureVendorState,
  vendorHasStock,
  decrementVendorStock,
  addVendorXp,
  getVendorBuyDiscount,
  getVendorSellBonus,
} from './VendorSystem'
import { vendorAcceptsItem, getItemCategory } from './MarketCatalog'
import { setProductionEnabled, setProductionLabour } from './EconomyTick'
import { getMaterialCount, addMaterial } from './Materials'
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

  const owned = getMaterialCount(state.player, materialId)
  const sellQty = Math.min(Math.max(1, qty), owned)
  if (sellQty <= 0) return state

  let result = ensureMarketState(state)
  const unitPrice = getPrice(result, materialId, 'sell')
  const total = unitPrice * sellQty
  const name = getItemName(materialId)

  result = {
    ...result,
    player: addMaterial(
      { ...result.player, gold: result.player.gold + total },
      materialId,
      -sellQty
    ),
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
  const buyQty = Math.min(Math.max(1, qty), stock)
  if (buyQty <= 0) return state

  const unitPrice = getMarketMaterialBuyPrice(result, materialId)
  const total = unitPrice * buyQty
  if (result.player.gold < total) return state

  const name = getItemName(materialId)
  result = {
    ...result,
    player: addMaterial(
      { ...result.player, gold: result.player.gold - total },
      materialId,
      buyQty
    ),
    statusMessage: `Bought ${buyQty} ${name} from the local market for ${total}g (${unitPrice}g each).`,
  }
  return recordTrade(result, materialId, buyQty, 'buy')
}

export function buyItem(
  state: GameState,
  vendorId: string,
  templateId: string,
  quality: Quality = DEFAULT_QUALITY
): GameState {
  const template = getItemTemplate(templateId)
  if (!template || template.buyPrice === undefined) return state

  let result = ensureVendorState(ensureMarketState(state))
  if (!vendorHasStock(result, vendorId, templateId, quality)) return result

  const price = getPrice(result, templateId, 'buy', {
    buyDiscount: getVendorBuyDiscount(result, vendorId),
    quality,
  })
  if (result.player.gold < price) return result

  result = {
    ...result,
    player: {
      ...result.player,
      gold: result.player.gold - price,
      inventory: addItemToInventory(result.player.inventory, templateId, 1, quality),
    },
  }
  result = decrementVendorStock(result, vendorId, templateId, 1, quality)
  result = recordTrade(result, templateId, 1, 'buy')
  result = addVendorXp(result, vendorId, price)
  return result
}

export function sellItem(
  state: GameState,
  vendorId: string,
  templateId: string,
  quality: Quality = DEFAULT_QUALITY
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
  if (owned - reserved <= 0) return state

  let result = ensureVendorState(ensureMarketState(state))
  const price = getPrice(result, templateId, 'sell', {
    sellBonus: getVendorSellBonus(result, vendorId),
    quality,
  })

  result = {
    ...result,
    player: {
      ...result.player,
      gold: result.player.gold + price,
      inventory: removeItemFromInventory(result.player.inventory, templateId, 1, quality),
    },
  }
  result = recordTrade(result, templateId, 1, 'sell')
  result = addVendorXp(result, vendorId, price)
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

export function trainSkillPoint(state: GameState, trainerId?: string): GameState {
  if (!state.currentRoom.isHub) return state
  const result = buySkillPoint(state)
  if (result.player.skillPoints > state.player.skillPoints) {
    const message = trainerId === 'captain_bryn'
      ? "Captain Bryn wipes his brow. 'Good. One more technique awaits — choose wisely.'"
      : 'Training complete — skill point gained.'
    return { ...result, statusMessage: message }
  }
  return result
}

export function trainLearnSkill(state: GameState, skillId: string, trainerId?: string): GameState {
  const result = learnSkill(state, skillId)
  if (result.player.knownSkills.length > state.player.knownSkills.length) {
    const skillName = skillId.replace('skill_', '').replace(/_/g, ' ')
    const message = trainerId === 'captain_bryn'
      ? `Captain Bryn nods. 'Well learned — ${skillName} will serve you in the wild.'`
      : `Learned ${skillName}.`
    return { ...result, statusMessage: message }
  }
  return result
}

export function hubCraft(state: GameState, recipeId: string): GameState {
  return placeCraftOrder(state, recipeId)
}

export function hubSelfCraft(state: GameState, recipeId: string): GameState {
  return selfCraft(state, recipeId)
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
