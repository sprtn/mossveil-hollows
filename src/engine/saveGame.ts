/**
 * Save/load game state to localStorage
 */

import type { GameState } from './GameLoopDesign'
import { SAVE_KEY, SAVE_VERSION } from './gameConfig'
import { getDefaultGameMeta } from './Outcomes'
import { consolidateInventory } from './ItemDatabase'
import { ensureMarketState, ensureMarketMaterialStock } from './MarketSystem'
import { ensureVendorState } from './VendorSystem'
import { ensureProductionState } from './EconomyTick'
import { normalizePlayerProfessions } from './Professions'
import { normalizeGatherNodeState } from './GatherNodes'
import { migrateParsedSave } from './saveMigration'

function getStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

export function saveGame(state: GameState): void {
  const storage = getStorage()
  if (!storage) return
  try {
    const serializable = {
      ...state,
      saveVersion: SAVE_VERSION,
      currentEncounter: undefined,
      combatResults: undefined,
      activeEvent: undefined,
      activeDialogue: undefined,
      phase: state.phase === 'encounter_action' ? 'room_exploring' : state.phase,
    }
    storage.setItem(SAVE_KEY, JSON.stringify(serializable))
  } catch (e) {
    console.warn('Failed to save game:', e)
  }
}

export function loadGame(): { state: GameState | null; versionMismatch: boolean } {
  const storage = getStorage()
  if (!storage) return { state: null, versionMismatch: false }
  try {
    const raw = storage.getItem(SAVE_KEY)
    if (!raw) return { state: null, versionMismatch: false }
    let parsed = JSON.parse(raw) as GameState & { saveVersion?: number }
    if (!parsed.player || !parsed.currentRoom) return { state: null, versionMismatch: false }

    const savedVersion = parsed.saveVersion ?? 0
    if (savedVersion > SAVE_VERSION) {
      clearSave()
      return { state: null, versionMismatch: true }
    }

    if (savedVersion < SAVE_VERSION) {
      parsed = migrateParsedSave(parsed, savedVersion) as typeof parsed
    }

    const meta = getDefaultGameMeta()
    const state: GameState = {
      ...meta,
      ...parsed,
      player: {
        ...parsed.player,
        inventory: consolidateInventory(parsed.player.inventory ?? []),
        materials: parsed.player.materials ?? {},
        knownSkills: parsed.player.knownSkills ?? [],
        skillPoints: parsed.player.skillPoints ?? 0,
        wounded: parsed.player.wounded ?? false,
        stamina: parsed.player.stamina ?? parsed.player.maxStamina ?? 10,
        maxStamina: parsed.player.maxStamina ?? 10,
        professions: normalizePlayerProfessions(parsed.player),
      },
      quests: parsed.quests ?? meta.quests,
      flags: parsed.flags ?? meta.flags,
      townBuildings: parsed.townBuildings ?? meta.townBuildings,
      areasUnlocked: parsed.areasUnlocked ?? meta.areasUnlocked,
      bossesDefeated: parsed.bossesDefeated ?? meta.bossesDefeated,
      day: parsed.day ?? meta.day,
      counters: parsed.counters ?? meta.counters,
      craftOrders: parsed.craftOrders ?? meta.craftOrders,
      marketState: parsed.marketState ?? meta.marketState,
      marketMaterialStock: parsed.marketMaterialStock ?? meta.marketMaterialStock,
      vendorState: parsed.vendorState ?? meta.vendorState,
      productionState: parsed.productionState ?? meta.productionState,
      gatherNodeState: normalizeGatherNodeState(parsed),
      currentEncounter: undefined,
      combatResults: undefined,
      activeEvent: undefined,
      activeDialogue: undefined,
      phase: parsed.phase === 'game_start' ? 'room_exploring' : parsed.phase,
      saveVersion: SAVE_VERSION,
    }
    return {
      state: ensureProductionState(ensureVendorState(ensureMarketMaterialStock(ensureMarketState(state)))),
      versionMismatch: false,
    }
  } catch {
    return { state: null, versionMismatch: false }
  }
}

export function hasSaveGame(): boolean {
  return getStorage()?.getItem(SAVE_KEY) != null
}

export function clearSave(): void {
  getStorage()?.removeItem(SAVE_KEY)
}
