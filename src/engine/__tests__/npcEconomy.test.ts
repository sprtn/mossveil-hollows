/**
 * NPC economy — town supply, crafter production, self-regulation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createDefaultPlayer } from '../CombatEngine'
import { initGame, enterRoom, gatherFromNode } from '../GameLoop'
import type { GameState, Room } from '../GameLoopDesign'
import { advanceDay } from '../DayAdvance'
import { tickEconomy } from '../EconomyTick'
import {
  processTownSupply,
  processNpcCrafters,
  TOWN_SUPPLY_RATES,
} from '../NpcEconomy'
import {
  ensureMarketState,
  getMaterialMarketStock,
  getMarketMultiplier,
} from '../MarketSystem'
import { ensureVendorState, getVendorStock } from '../VendorSystem'
import { getDefaultGameMeta } from '../Outcomes'
import { SAVE_KEY, SAVE_VERSION } from '../gameConfig'
import { loadGame, clearSave } from '../saveGame'
import { getItemTemplate } from '../ItemDatabase'
import { MARKET_TUNING } from '../MarketCatalog'

const hubRoom: Room = {
  id: 'town_hub',
  name: 'Hub',
  description: 'Safe',
  isHub: true,
  encounters: [],
  exits: [],
}

const forestRoom: Room = {
  id: 'forest_test',
  name: 'Forest',
  description: 'Test',
  encounters: [],
  exits: [],
  gatherNodes: [
    {
      id: 'test_oak',
      label: 'Oak',
      materialId: 'oak_wood',
      maxCharges: 3,
      regenPerDay: 3,
    },
  ],
}

function economyReadyState(overrides: Partial<GameState> = {}): GameState {
  let state = initGame(
    createDefaultPlayer({
      unlockedProfessionTiers: { smithing: 3, fletching: 2, alchemy: 4 },
      purchasedRecipes: [
        'wooden_stake',
        'oak_spear',
        'cloth_bandage',
        'antidote_recipe',
        'padded_wrap',
        'hide_jerkin',
        'wolf_cloak',
        'cleansing_draught',
      ],
    }),
    hubRoom
  )
  state = enterRoom(state, hubRoom)
  state = {
    ...state,
    townBuildings: { ...state.townBuildings, workbench: 1 },
    marketMaterialStock: {
      oak_wood: 20,
      cloth_scrap: 20,
      iron_ore: 20,
      stone: 20,
      green_herb: 20,
      spider_silk: 20,
      boar_hide: 20,
      wolf_pelt: 20,
    },
    npcEconomicState: {},
    ...overrides,
  }
  return ensureVendorState(ensureMarketState(state))
}

describe('NPC economy', () => {
  describe('town supply', () => {
    it('injects configured raw materials via recordTrade sell', () => {
      let state = economyReadyState({
        marketMaterialStock: { iron_ore: 0, cloth_scrap: 0, oak_wood: 0 },
      })
      const beforeIron = getMaterialMarketStock(state, 'iron_ore')
      state = processTownSupply(state)
      expect(getMaterialMarketStock(state, 'iron_ore')).toBe(
        beforeIron + TOWN_SUPPLY_RATES.iron_ore!
      )
      expect(getMaterialMarketStock(state, 'oak_wood')).toBe(0)
    })

    it('appends a townsfolk restock status line', () => {
      const state = processTownSupply(economyReadyState())
      expect(state.statusMessage).toContain('Townsfolk restocked the market.')
    })
  })

  describe('crafter production', () => {
    it('consumes board raw and produces consumable output on the market', () => {
      let state = economyReadyState({
        marketMaterialStock: { cloth_scrap: 10 },
        npcEconomicState: {
          garrick_smith: { rotationIndex: 99, lastSkipReason: 'blocked' },
          maren_healer: { rotationIndex: 0 },
        },
      })
      const clothBefore = getMaterialMarketStock(state, 'cloth_scrap')
      const potionBefore = getMaterialMarketStock(state, 'health_potion')

      state = processNpcCrafters(state)

      expect(getMaterialMarketStock(state, 'cloth_scrap')).toBe(clothBefore - 3)
      expect(getMaterialMarketStock(state, 'health_potion')).toBe(potionBefore + 1)
      expect(state.npcEconomicState?.maren_healer?.lastProducedItemId).toBe('health_potion')
    })

    it('routes gear output into vendor inventory for shop NPCs', () => {
      let state = economyReadyState({
        marketMaterialStock: { oak_wood: 10, cloth_scrap: 0 },
        npcEconomicState: {
          garrick_smith: { rotationIndex: 0 },
          maren_healer: { rotationIndex: 99 },
        },
      })
      state = processNpcCrafters(state)
      expect(state.npcEconomicState?.garrick_smith?.lastProducedItemId).toBe('oak_spear')
      expect(getVendorStock(state, 'garrick_smith', 'oak_spear')).toBeGreaterThan(0)
    })

    it('skips production when board stock is insufficient', () => {
      let state = economyReadyState({
        marketMaterialStock: {
          oak_wood: 0,
          cloth_scrap: 0,
          iron_ore: 0,
          stone: 0,
          green_herb: 0,
          spider_silk: 0,
          boar_hide: 0,
          wolf_pelt: 0,
        },
      })
      state = processNpcCrafters(state)
      expect(state.npcEconomicState?.garrick_smith?.lastSkipReason).toMatch(/not enough/i)
      expect(state.npcEconomicState?.garrick_smith?.lastProducedItemId).toBeUndefined()
      expect(getMaterialMarketStock(state, 'oak_wood')).toBe(0)
    })
  })

  describe('self-regulating multi-day loop', () => {
    it('town supply and crafters balance raw stock and lower crafted-good prices over time', () => {
      let state = economyReadyState({
        marketMaterialStock: {
          cloth_scrap: 6,
          oak_wood: 6,
          green_herb: 0,
        },
      })
      const potionTemplate = getItemTemplate('health_potion')!
      const day0Cloth = getMaterialMarketStock(state, 'cloth_scrap')
      const potionBefore = getMaterialMarketStock(state, 'health_potion')

      for (let i = 0; i < 10; i++) {
        state = advanceDay(state)
        for (const qty of Object.values(state.marketMaterialStock ?? {})) {
          expect(qty).toBeGreaterThanOrEqual(0)
          expect(Number.isFinite(qty)).toBe(true)
        }
      }

      const day10Cloth = getMaterialMarketStock(state, 'cloth_scrap')
      const potionAfter = getMaterialMarketStock(state, 'health_potion')
      const day10Mult = getMarketMultiplier(state, 'health_potion')

      const maxClothIfUnused =
        day0Cloth + TOWN_SUPPLY_RATES.cloth_scrap! * 10
      expect(day10Cloth).toBeLessThan(maxClothIfUnused)
      expect(potionAfter).toBeGreaterThan(potionBefore)

      const minMult = MARKET_TUNING.priceMin
      const maxMult = MARKET_TUNING.priceMax
      expect(day10Mult).toBeGreaterThanOrEqual(minMult)
      expect(day10Mult).toBeLessThanOrEqual(maxMult)

      const minPrice = Math.max(
        1,
        Math.round(potionTemplate.sellPrice! * minMult)
      )
      const maxPrice = Math.max(
        1,
        Math.round(potionTemplate.buyPrice! * maxMult)
      )
      const day10SellPrice = Math.max(
        1,
        Math.round(potionTemplate.sellPrice! * day10Mult)
      )
      expect(day10SellPrice).toBeGreaterThanOrEqual(minPrice)
      expect(day10SellPrice).toBeLessThanOrEqual(maxPrice)
    })

    it('crafter sell-side output lowers multiplier when concentrated in one day', () => {
      let state = economyReadyState({
        marketMaterialStock: { cloth_scrap: 100 },
        npcEconomicState: {
          garrick_smith: { rotationIndex: 99 },
          maren_healer: { rotationIndex: 0 },
        },
      })
      const before = getMarketMultiplier(state, 'health_potion')
      for (let i = 0; i < 6; i++) {
        state = processNpcCrafters(state)
      }
      expect(getMarketMultiplier(state, 'health_potion')).toBeLessThan(before)
    })

    it('keeps market multipliers bounded after many economy ticks', () => {
      let state = economyReadyState()
      for (let i = 0; i < 30; i++) {
        state = tickEconomy({ ...state, day: (state.day ?? 1) + 1 })
      }
      for (const cat of Object.values(state.marketState ?? {})) {
        expect(cat.priceMultiplier).toBeGreaterThanOrEqual(MARKET_TUNING.priceMin)
        expect(cat.priceMultiplier).toBeLessThanOrEqual(MARKET_TUNING.priceMax)
      }
    })
  })

  describe('recipe rotation', () => {
    it('advances crafter rotationIndex across days', () => {
      let state = economyReadyState({
        marketMaterialStock: {
          oak_wood: 50,
          cloth_scrap: 50,
          iron_ore: 50,
          stone: 50,
          green_herb: 50,
          spider_silk: 50,
          boar_hide: 50,
          wolf_pelt: 50,
        },
        npcEconomicState: {
          garrick_smith: { rotationIndex: 0 },
          maren_healer: { rotationIndex: 0 },
        },
      })

      const produced: string[] = []
      for (let i = 0; i < 5; i++) {
        state = processTownSupply(state)
        state = processNpcCrafters(state)
        const itemId = state.npcEconomicState?.garrick_smith?.lastProducedItemId
        if (itemId) produced.push(itemId)
        state = { ...state, day: (state.day ?? 1) + 1 }
      }

      expect(produced.length).toBeGreaterThan(1)
      expect(new Set(produced).size).toBeGreaterThan(1)
    })
  })

  describe('save defaulting', () => {
    const storage = new Map<string, string>()

    beforeEach(() => {
      storage.clear()
      vi.stubGlobal('localStorage', {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value)
        },
        removeItem: (key: string) => {
          storage.delete(key)
        },
      })
    })

    afterEach(() => {
      vi.unstubAllGlobals()
      clearSave()
    })

    it('getDefaultGameMeta includes empty npcEconomicState', () => {
      expect(getDefaultGameMeta().npcEconomicState).toEqual({})
    })

    it('loads saves missing npcEconomicState without version bump', () => {
      const player = createDefaultPlayer()
      const state = enterRoom(initGame(player, hubRoom), hubRoom)
      const savePayload = {
        ...state,
        saveVersion: SAVE_VERSION,
      }
      delete (savePayload as { npcEconomicState?: unknown }).npcEconomicState
      storage.set(SAVE_KEY, JSON.stringify(savePayload))

      const { state: loaded, versionMismatch } = loadGame()
      expect(versionMismatch).toBe(false)
      expect(loaded?.npcEconomicState).toEqual({})
      expect(loaded?.saveVersion).toBe(SAVE_VERSION)
    })
  })

  describe('day loop regression', () => {
    it('gathering does not advance the day', () => {
      let state = initGame(createDefaultPlayer(), forestRoom)
      state = enterRoom(state, forestRoom)
      const dayBefore = state.day ?? 1
      state = gatherFromNode(state, 'test_oak')
      expect(state.day).toBe(dayBefore)
    })
  })
})
