/**
 * Market economy and vendor XP simulation tests
 */

import { describe, it, expect } from 'vitest'
import { initGame, enterRoom } from '../GameLoop'
import { createDefaultPlayer } from '../CombatEngine'
import { buyItem, sellItem, sellMaterialToMarket, buyMaterialFromMarket, restAtHub, hubSetProductionEnabled, hubSetProductionLabour } from '../HubActions'
import type { Room } from '../GameLoopDesign'
import {
  ensureMarketState,
  getMarketMultiplier,
  recordTrade,
  decayMarkets,
  getIronLocalSupply,
  getPrice,
  circulateCampPayroll,
} from '../MarketSystem'
import {
  ensureVendorState,
  getVendorTier,
  giveVendorXp,
  getVendorSellBonus,
} from '../VendorSystem'
import { addItemToInventory } from '../ItemDatabase'

const hubRoom: Room = {
  id: 'town_hub',
  name: 'Hub',
  description: 'Safe',
  isHub: true,
  encounters: [],
  exits: [],
}

function hubState() {
  let state = initGame(createDefaultPlayer({ gold: 500 }), hubRoom)
  state = enterRoom(state, hubRoom)
  return ensureVendorState(ensureMarketState(state))
}

describe('Market economy', () => {
  it('burst selling crashes wood_products multiplier', () => {
    let state = hubState()
    const before = getMarketMultiplier(state, 'oak_spear')

    for (let i = 0; i < 6; i++) {
      state = recordTrade(state, 'oak_spear', 1, 'sell')
    }

    const after = getMarketMultiplier(state, 'oak_spear')
    expect(after).toBeLessThan(before)
  })

  it('slow selling over days raises wood_products multiplier', () => {
    let state = hubState()
    const before = getMarketMultiplier(state, 'oak_spear')

    for (let day = 0; day < 7; day++) {
      state = recordTrade(state, 'oak_spear', 1, 'sell')
      state = decayMarkets({ ...state, day: day + 2 })
    }

    const after = getMarketMultiplier(state, 'oak_spear')
    expect(after).toBeGreaterThanOrEqual(before)
  })

  it('iron supply lowers freight markup on iron products', () => {
    let state = hubState()
    const before = getMarketMultiplier(state, 'rusty_shortsword')

    for (let i = 0; i < 6; i++) {
      state = recordTrade(state, 'iron_ore', 1, 'sell')
    }

    const after = getMarketMultiplier(state, 'rusty_shortsword')
    expect(getIronLocalSupply(state)).toBeGreaterThan(0)
    expect(after).toBeLessThan(before)
  })

  it('vendor XP tier improves sell payout', () => {
    let state = hubState()
    state = {
      ...state,
      player: {
        ...state.player,
        inventory: addItemToInventory(state.player.inventory, 'oak_spear', 2),
      },
    }

    const basePrice = getPrice(state, 'oak_spear', 'sell', { sellBonus: 0 })
    state = giveVendorXp(state, 'sera_quartermaster', 200)
    expect(getVendorTier(state, 'sera_quartermaster')).toBeGreaterThanOrEqual(2)

    const tierPrice = getPrice(state, 'oak_spear', 'sell', {
      sellBonus: getVendorSellBonus(state, 'sera_quartermaster'),
    })
    expect(tierPrice).toBeGreaterThanOrEqual(basePrice)
  })

  it('buy decrements vendor stock', () => {
    let state = hubState()
    const stockBefore = state.vendorState!.sera_quartermaster!.inventory
      .find((i) => i.templateId === 'health_potion')!.stock

    state = buyItem(state, 'sera_quartermaster', 'health_potion')
    const stockAfter = state.vendorState!.sera_quartermaster!.inventory
      .find((i) => i.templateId === 'health_potion')!.stock

    expect(stockAfter).toBe(stockBefore - 1)
  })

  it('sell material to local market removes from pack and credits gold', () => {
    let state = hubState()
    state = {
      ...state,
      player: {
        ...state.player,
        materials: { oak_wood: 10 },
      },
    }
    const goldBefore = state.player.gold
    state = sellMaterialToMarket(state, 'oak_wood', 3)

    expect(state.player.materials?.oak_wood).toBe(7)
    expect(state.player.gold).toBeGreaterThan(goldBefore)
    expect(state.marketMaterialStock?.oak_wood).toBeGreaterThan(6)
    expect(state.statusMessage).toContain('local market')
  })

  it('buy material from local market adds to pack and spends gold', () => {
    let state = hubState()
    const goldBefore = state.player.gold
    state = buyMaterialFromMarket(state, 'oak_wood', 2)

    expect(state.player.materials?.oak_wood).toBe(2)
    expect(state.player.gold).toBeLessThan(goldBefore)
    expect(state.marketMaterialStock?.oak_wood).toBe(4)
  })

  it('rest appends logging camp production message', () => {
    let state = hubState()
    state = {
      ...state,
      townBuildings: { ...state.townBuildings, logging_camp: 1 },
      player: { ...state.player, gold: 100 },
      seed: 42,
    }
    state = hubSetProductionEnabled(state, 'logging_camp', true)
    state = hubSetProductionLabour(state, 'logging_camp', 5)
    state = restAtHub(state)

    expect(state.statusMessage).toContain('rest')
    expect(state.statusMessage).toContain('Logging Camp')
    expect(state.productionState?.logging_camp?.totalPayrollCirculated).toBe(5)
  })

  it('zero pay skips camp production for low morale', () => {
    let state = hubState()
    state = {
      ...state,
      townBuildings: { ...state.townBuildings, logging_camp: 1 },
      seed: 42,
    }
    state = hubSetProductionEnabled(state, 'logging_camp', true)
    state = hubSetProductionLabour(state, 'logging_camp', 0)
    state = restAtHub(state)

    expect(state.productionState?.logging_camp?.lastSkipReason).toContain('0% morale')
    expect(state.productionState?.logging_camp?.lastOutput).toBe(0)
  })

  it('camp payroll circulation eases wood market pressure', () => {
    let state = hubState()
    for (let i = 0; i < 4; i++) {
      state = recordTrade(state, 'oak_wood', 1, 'sell')
    }
    const beforeSold = state.marketState!.wood!.shortTermSold
    const beforeMult = getMarketMultiplier(state, 'oak_wood')
    state = circulateCampPayroll(state, 10)
    expect(state.marketState!.wood!.shortTermSold).toBeLessThan(beforeSold)
    expect(getMarketMultiplier(state, 'oak_wood')).toBeGreaterThanOrEqual(beforeMult)
  })

  it('sell through vendor records market trade', () => {
    let state = hubState()
    state = {
      ...state,
      player: {
        ...state.player,
        inventory: addItemToInventory(state.player.inventory, 'oak_spear', 2),
      },
    }

    const multBefore = getMarketMultiplier(state, 'oak_spear')
    state = sellItem(state, 'sera_quartermaster', 'oak_spear')

    expect(state.player.gold).toBeGreaterThan(500)
    expect(state.marketState?.wood_products?.shortTermSold).toBeGreaterThan(0)
    expect(getMarketMultiplier(state, 'oak_spear')).toBeDefined()
    expect(multBefore).toBeGreaterThan(0)
  })
})
