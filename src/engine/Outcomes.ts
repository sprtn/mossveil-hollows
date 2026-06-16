/**
 * Shared outcome resolver for events, dialogue, and quest rewards.
 */

import type { GameState, Player, StatusType } from './GameLoopDesign'
import {
  addItemToInventory,
  getEffectiveStats,
  hasItem,
  removeItemFromInventory,
} from './ItemDatabase'
import { addMaterial, getMaterialCount } from './Materials'
import { getEffectiveMaxHp, applyWoundedClear } from './PlayerStats'
import { ensureQuest, bumpQuestStage } from './QuestProgressHelpers'
import { getQuestDef } from './QuestData'
import { getBuildingLevel } from './BuildingSystem'
import { getCraftOrdersForNpc } from './CraftOrderSystem'
import { getVendorTier, giveVendorXp } from './VendorSystem'
import { recordMaterialSale, ensureMarketState } from './MarketSystem'
import { securePendingGather, forfeitPendingGather } from './GatherDanger'
import {
  unlockProfessionTier,
  purchaseRecipe,
} from './CraftingSystem'
import { getProfessionLevel, type ProfessionId } from './Professions'

export type OutcomeEffect =
  | { kind: 'give_item'; itemId: string; qty: number }
  | { kind: 'take_item'; itemId: string; qty: number }
  | { kind: 'give_gold'; amount: number }
  | { kind: 'take_gold'; amount: number }
  | { kind: 'give_material'; materialId: string; qty: number }
  | { kind: 'take_material'; materialId: string; qty: number }
  | { kind: 'heal'; amount: number }
  | { kind: 'damage'; amount: number }
  | { kind: 'apply_status'; status: StatusType; turns: number; power: number }
  | { kind: 'set_flag'; flag: string; value: boolean }
  | { kind: 'advance_quest'; questId: string; stageId?: string }
  | { kind: 'learn_skill'; skillId: string }
  | { kind: 'unlock_area'; areaId: string }
  | { kind: 'give_skill_point'; amount: number }
  | { kind: 'clear_wounded' }
  | { kind: 'set_wounded' }
  | { kind: 'restore_stamina'; amount: number }
  | { kind: 'restore_energy'; amount: number }
  | { kind: 'start_quest'; questId: string }
  | { kind: 'start_combat'; encounterId: string }
  | { kind: 'increment_counter'; counter: string; amount?: number }
  | { kind: 'give_vendor_xp'; vendorId: string; amount: number }
  | { kind: 'record_market_sale'; materialId: string; qty: number }
  | { kind: 'open_hub_panel'; panel: 'train' | 'craft' | 'shop' | 'profession_train'; npcId: string }
  | { kind: 'resolve_gather'; result: 'secure' | 'forfeit' }
  | { kind: 'unlock_profession_tier'; profession: string; tier: number }
  | { kind: 'purchase_recipe'; recipeId: string }

export type OutcomeRequirement =
  | { kind: 'has_item'; itemId: string; qty?: number }
  | { kind: 'has_material'; materialId: string; qty?: number }
  | { kind: 'has_flag'; flag: string }
  | { kind: 'not_has_flag'; flag: string }
  | { kind: 'has_skill'; skillId: string }
  | { kind: 'stat_at_least'; stat: 'strength' | 'constitution' | 'dexterity' | 'agility' | 'defense' | 'level'; value: number }
  | { kind: 'gold_at_least'; amount: number }
  | { kind: 'quest_stage'; questId: string; stageId: string }
  | { kind: 'has_active_quest'; questId: string }
  | { kind: 'not_has_quest'; questId: string }
  | { kind: 'quest_completed'; questId: string }
  | { kind: 'counter_at_least'; counter: string; value: number }
  | { kind: 'building_level'; building: string; level: number }
  | { kind: 'building_below'; building: string; level: number }
  | { kind: 'has_craft_orders'; npcId: string }
  | { kind: 'vendor_tier_at_least'; vendorId: string; tier: number }
  | { kind: 'market_supply_at_least'; category: string; value: number }
  | { kind: 'market_supply_below'; category: string; value: number }
  | { kind: 'area_unlocked'; areaId: string }
  | { kind: 'profession_at_least'; profession: string; level: number }

export function meetsRequirements(state: GameState, reqs: OutcomeRequirement[] = []): boolean {
  return reqs.every((req) => meetsRequirement(state, req))
}

function meetsRequirement(state: GameState, req: OutcomeRequirement): boolean {
  const player = state.player
  switch (req.kind) {
    case 'has_item':
      return hasItem(player, req.itemId) // qty check simplified for stackables
    case 'has_material':
      return getMaterialCount(player, req.materialId) >= (req.qty ?? 1)
    case 'has_flag':
      return !!state.flags?.[req.flag]
    case 'not_has_flag':
      return !state.flags?.[req.flag]
    case 'has_skill':
      return (player.knownSkills ?? []).includes(req.skillId)
    case 'stat_at_least': {
      if (req.stat === 'level') return player.level >= req.value
      const stats = getEffectiveStats(player)
      return stats[req.stat] >= req.value
    }
    case 'gold_at_least':
      return player.gold >= req.amount
    case 'quest_stage': {
      const progress = state.quests?.[req.questId]
      if (!progress || progress.completed) return false
      const quest = getQuestDef(req.questId)
      if (!quest) return false
      const stage = quest.stages[progress.stageIndex]
      return stage?.id === req.stageId
    }
    case 'has_active_quest': {
      const progress = state.quests?.[req.questId]
      return !!progress && !progress.completed
    }
    case 'not_has_quest':
      return !state.quests?.[req.questId]
    case 'quest_completed':
      return !!state.quests?.[req.questId]?.completed
    case 'counter_at_least':
      return (state.counters?.[req.counter] ?? 0) >= req.value
    case 'building_level':
      return getBuildingLevel(state, req.building) >= req.level
    case 'building_below':
      return getBuildingLevel(state, req.building) < req.level
    case 'has_craft_orders':
      return getCraftOrdersForNpc(state, req.npcId).length > 0
    case 'vendor_tier_at_least':
      return getVendorTier(state, req.vendorId) >= req.tier
    case 'market_supply_at_least': {
      const cat = ensureMarketState(state).marketState?.[req.category]
      return (cat?.localSupply ?? 0) >= req.value
    }
    case 'market_supply_below': {
      const cat = ensureMarketState(state).marketState?.[req.category]
      return (cat?.localSupply ?? 0) < req.value
    }
    case 'area_unlocked':
      return (state.areasUnlocked ?? []).includes(req.areaId)
    case 'profession_at_least':
      return getProfessionLevel(player, req.profession as ProfessionId) >= req.level
    default:
      return false
  }
}

export function applyOutcomes(state: GameState, effects: OutcomeEffect[]): GameState {
  let result = { ...state, player: { ...state.player } }

  for (const effect of effects) {
    result = applySingleOutcome(result, effect)
  }

  return result
}

function applySingleOutcome(state: GameState, effect: OutcomeEffect): GameState {
  let player: Player = { ...state.player }
  let next: GameState = { ...state, player }

  switch (effect.kind) {
    case 'give_item':
      player.inventory = addItemToInventory(player.inventory, effect.itemId, effect.qty)
      break
    case 'take_item':
      player.inventory = removeItemFromInventory(player.inventory, effect.itemId, effect.qty)
      break
    case 'give_gold':
      player.gold += effect.amount
      break
    case 'take_gold':
      player.gold = Math.max(0, player.gold - effect.amount)
      break
    case 'give_material':
      player = addMaterial(player, effect.materialId, effect.qty)
      break
    case 'take_material':
      player = addMaterial(player, effect.materialId, -effect.qty)
      break
    case 'heal': {
      const maxHp = getEffectiveMaxHp(player)
      player.hp = Math.min(maxHp, player.hp + effect.amount)
      break
    }
    case 'damage':
      player.hp = Math.max(0, player.hp - effect.amount)
      break
    case 'apply_status':
      player.statusEffects = [
        ...player.statusEffects,
        { type: effect.status, turnsRemaining: effect.turns, power: effect.power },
      ]
      break
    case 'set_flag':
      next.flags = { ...(state.flags ?? {}), [effect.flag]: effect.value }
      break
    case 'advance_quest':
      next = bumpQuestStage(ensureQuest(next, effect.questId), effect.questId)
      break
    case 'learn_skill': {
      const known = new Set(player.knownSkills ?? [])
      known.add(effect.skillId)
      player.knownSkills = [...known]
      break
    }
    case 'unlock_area': {
      const areas = new Set(state.areasUnlocked ?? [])
      areas.add(effect.areaId)
      next.areasUnlocked = [...areas]
      break
    }
    case 'give_skill_point':
      player.skillPoints = (player.skillPoints ?? 0) + effect.amount
      break
    case 'clear_wounded':
      player = applyWoundedClear(player)
      break
    case 'set_wounded':
      player.wounded = true
      player.hp = Math.min(player.hp, getEffectiveMaxHp(player))
      break
    case 'restore_stamina':
      player.stamina = Math.min(player.maxStamina, player.stamina + effect.amount)
      break
    case 'restore_energy':
      player.energy = Math.min(player.maxEnergy, player.energy + effect.amount)
      break
    case 'start_combat':
      // Handled by EventSystem caller
      break
    case 'start_quest': {
      const quest = getQuestDef(effect.questId)
      if (quest && !next.quests?.[effect.questId]) {
        next.quests = {
          ...(next.quests ?? {}),
          [effect.questId]: { questId: effect.questId, stageIndex: 0, counters: {}, completed: false },
        }
      }
      break
    }
    case 'increment_counter': {
      const amount = effect.amount ?? 1
      next.counters = {
        ...(state.counters ?? {}),
        [effect.counter]: (state.counters?.[effect.counter] ?? 0) + amount,
      }
      break
    }
    case 'give_vendor_xp':
      next = giveVendorXp(next, effect.vendorId, effect.amount)
      break
    case 'record_market_sale':
      next = recordMaterialSale(next, effect.materialId, effect.qty)
      break
    case 'open_hub_panel':
      next.pendingHubPanel = { panel: effect.panel, npcId: effect.npcId }
      break
    case 'resolve_gather':
      if (effect.result === 'secure') {
        next = securePendingGather(next)
      } else {
        next = forfeitPendingGather(next)
      }
      player = next.player
      break
    case 'unlock_profession_tier':
      next = unlockProfessionTier(next, effect.profession as ProfessionId, effect.tier)
      player = next.player
      break
    case 'purchase_recipe':
      next = purchaseRecipe(next, effect.recipeId)
      player = next.player
      break
  }

  next.player = player
  return next
}

export function getDefaultGameMeta(): Pick<
  GameState,
  | 'quests'
  | 'flags'
  | 'townBuildings'
  | 'areasUnlocked'
  | 'bossesDefeated'
  | 'bossClearedDay'
  | 'day'
  | 'counters'
  | 'craftOrders'
  | 'marketState'
  | 'marketMaterialStock'
  | 'vendorState'
  | 'productionState'
> {
  return {
    quests: {},
    flags: {},
    townBuildings: {},
    areasUnlocked: ['forest'],
    bossesDefeated: [],
    bossClearedDay: {},
    day: 1,
    counters: {},
    craftOrders: [],
    marketState: {},
    marketMaterialStock: { oak_wood: 6, cloth_scrap: 3 },
    vendorState: {},
    productionState: {},
  }
}
