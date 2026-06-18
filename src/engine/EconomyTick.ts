/**
 * Day-tick economy: market decay, vendor restock, production buildings.
 */

import type { GameState } from './GameLoopDesign'
import type { ProductionBuildingState } from './ContentSchemas'
import { getBuilding, getBuildingLevel } from './BuildingSystem'
import {
  decayMarkets,
  getWoodMarketPrice,
  ensureMarketState,
  recordTrade,
  circulateCampPayroll,
} from './MarketSystem'
import { restockVendors } from './VendorSystem'
import { getItemName } from './ItemDatabase'
import { SeededRandom } from './CombatEngine'
import {
  clampLabourPay,
  computeMoralePercent,
  rollMoraleSuccess,
  rollBonusLog,
  LABOUR_FAIR_WAGE,
} from './productionLabour'
import { processTownSupply, processNpcCrafters } from './NpcEconomy'

function defaultProductionState(): ProductionBuildingState {
  return {
    labourGoldPerDay: LABOUR_FAIR_WAGE,
    enabled: false,
    accumulatedLogs: 0,
    lastRevenue: 0,
    lastOutput: 0,
    campTreasury: 0,
    totalPayrollCirculated: 0,
  }
}

function productionRng(state: GameState): SeededRandom {
  const seed = Math.abs(
    ((state.seed ?? 0) * 73856093)
      ^ ((state.day ?? 1) * 19349663)
      ^ ((state.turnCount ?? 0) * 83492791)
      ^ 0x1a9ec0a
  )
  return new SeededRandom(seed)
}

export function ensureProductionState(state: GameState): GameState {
  const productionState = { ...(state.productionState ?? {}) }
  const existing = productionState.logging_camp
  productionState.logging_camp = {
    ...defaultProductionState(),
    ...existing,
    campTreasury: existing?.campTreasury ?? 0,
    totalPayrollCirculated: existing?.totalPayrollCirculated ?? 0,
  }
  return { ...state, productionState }
}

export function setProductionEnabled(
  state: GameState,
  buildingId: string,
  enabled: boolean
): GameState {
  const result = ensureProductionState(state)
  const current = result.productionState![buildingId] ?? defaultProductionState()
  return {
    ...result,
    productionState: {
      ...result.productionState!,
      [buildingId]: { ...current, enabled },
    },
  }
}

export function setProductionLabour(
  state: GameState,
  buildingId: string,
  labourGoldPerDay: number
): GameState {
  const result = ensureProductionState(state)
  const current = result.productionState![buildingId] ?? defaultProductionState()
  return {
    ...result,
    productionState: {
      ...result.productionState!,
      [buildingId]: { ...current, labourGoldPerDay: clampLabourPay(labourGoldPerDay) },
    },
  }
}

function processLoggingCamp(state: GameState): GameState {
  const level = getBuildingLevel(state, 'logging_camp')
  if (level < 1) return state

  const building = getBuilding('logging_camp')
  const prod = building?.production
  if (!prod) return state

  let result = ensureProductionState(ensureMarketState(state))
  const ps = { ...(result.productionState!.logging_camp ?? defaultProductionState()) }

  if (!ps.enabled) {
    ps.lastOutput = 0
    ps.lastRevenue = 0
    ps.lastMorale = undefined
    ps.lastSkipReason = 'Off — turn on auto-run below to produce on your next rest.'
    result.productionState = { ...result.productionState!, logging_camp: ps }
    return result
  }

  const labourPay = clampLabourPay(ps.labourGoldPerDay ?? prod.labourGoldPerDay ?? LABOUR_FAIR_WAGE)
  const morale = computeMoralePercent(labourPay)

  if (labourPay > 0 && result.player.gold < labourPay) {
    ps.lastOutput = 0
    ps.lastRevenue = 0
    ps.lastMorale = morale
    ps.lastSkipReason = `Skipped — need ${labourPay}g for labour (you have ${result.player.gold}g).`
    result.productionState = { ...result.productionState!, logging_camp: ps }
    return result
  }

  const rng = productionRng(result)
  if (!rollMoraleSuccess(() => rng.next(), labourPay)) {
    ps.lastOutput = 0
    ps.lastRevenue = 0
    ps.lastMorale = morale
    ps.lastSkipReason =
      morale <= 0
        ? 'Skipped — workers refuse to cut at 0g pay (0% morale).'
        : `Skipped — low morale (${morale}%). Workers sat out the shift.`
    result.productionState = { ...result.productionState!, logging_camp: ps }
    return result
  }

  let outputQty = prod.outputPerDay
  const bonusLog = rollBonusLog(() => rng.next(), labourPay)
  if (bonusLog) outputQty += 1

  const unitPrice = getWoodMarketPrice(result)
  const revenue = unitPrice * outputQty

  let player = {
    ...result.player,
    gold: result.player.gold - labourPay + revenue,
  }

  let campTreasury = ps.campTreasury + labourPay
  let totalPayrollCirculated = ps.totalPayrollCirculated

  if (labourPay > 0) {
    result = circulateCampPayroll(result, labourPay)
    campTreasury -= labourPay
    totalPayrollCirculated += labourPay
  }

  result = {
    ...result,
    player,
    productionState: {
      ...result.productionState!,
      logging_camp: {
        ...ps,
        lastOutput: outputQty,
        lastRevenue: revenue,
        lastMorale: morale,
        accumulatedLogs: ps.accumulatedLogs + outputQty,
        campTreasury,
        totalPayrollCirculated,
        lastRunDay: result.day ?? 1,
        lastSkipReason: undefined,
      },
    },
  }

  result = recordTrade(result, prod.outputMaterialId, outputQty, 'sell')

  const woodName = getItemName(prod.outputMaterialId)
  const existingMsg = result.statusMessage
  const bonusNote = bonusLog ? ' (+1 bonus log)' : ''
  const payrollNote =
    labourPay > 0
      ? ` ${labourPay}g payroll circulated through town.`
      : ''
  const prodMsg =
    `Logging Camp: ${outputQty} ${woodName} sold for ${revenue}g` +
    ` (pay ${labourPay}g, morale ${morale}%${bonusNote}).${payrollNote}`
  result.statusMessage = existingMsg ? `${existingMsg} ${prodMsg}` : prodMsg

  return result
}

export function tickEconomy(state: GameState): GameState {
  let result = decayMarkets(state)
  result = restockVendors(result)
  result = processLoggingCamp(result)
  result = processTownSupply(result)
  result = processNpcCrafters(result)
  return result
}

export function getProductionState(
  state: GameState,
  buildingId: string
): ProductionBuildingState {
  const result = ensureProductionState(state)
  return result.productionState![buildingId] ?? defaultProductionState()
}
