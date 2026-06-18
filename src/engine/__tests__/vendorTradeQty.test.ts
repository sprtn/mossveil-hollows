/**
 * Vendor and market bulk trade qty clamps.
 */

import { describe, it, expect } from 'vitest'
import { initGame, enterRoom } from '../GameLoop'
import { createDefaultPlayer } from '../CombatEngine'
import {
  buyItem,
  sellItem,
  buyMaterialFromMarket,
} from '../HubActions'
import { ensureMarketState, getMarketMaterialBuyPrice, getMaterialMarketStock, getPrice } from '../MarketSystem'
import { ensureVendorState, getVendorStock, getVendorBuyDiscount, getVendorSellBonus } from '../VendorSystem'
import { addItemToInventory, getInventoryQuantity } from '../ItemDatabase'
import { DEFAULT_QUALITY } from '../Quality'
import type { Room } from '../GameLoopDesign'

const hubRoom: Room = {
  id: 'town_hub',
  name: 'Hub',
  description: 'Safe',
  isHub: true,
  encounters: [],
  exits: [],
}

function hubState(gold = 500) {
  let state = initGame(createDefaultPlayer({ gold }), hubRoom)
  state = enterRoom(state, hubRoom)
  state = ensureVendorState(ensureMarketState(state))
  return {
    ...state,
    player: { ...state.player, inventory: [] },
  }
}

describe('vendor trade qty', () => {
  it('buyItem adds multiple units and charges unitPrice × buyQty', () => {
    let state = hubState(500)
    const unitPrice = getPrice(state, 'health_potion', 'buy', {
      buyDiscount: getVendorBuyDiscount(state, 'sera_quartermaster'),
    })
    const stockBefore = getVendorStock(state, 'sera_quartermaster', 'health_potion')
    expect(stockBefore).toBeGreaterThanOrEqual(3)

    state = buyItem(state, 'sera_quartermaster', 'health_potion', DEFAULT_QUALITY, 3)

    expect(getInventoryQuantity(state.player, 'health_potion')).toBe(3)
    expect(getVendorStock(state, 'sera_quartermaster', 'health_potion')).toBe(stockBefore - 3)
    expect(state.player.gold).toBe(500 - unitPrice * 3)
  })

  it('buyItem clamps to affordable stock when gold is binding', () => {
    let state = hubState(25)
    const unitPrice = getPrice(state, 'health_potion', 'buy', {
      buyDiscount: getVendorBuyDiscount(state, 'sera_quartermaster'),
    })
    const affordable = Math.floor(25 / unitPrice)
    expect(affordable).toBeGreaterThan(0)
    expect(affordable).toBeLessThan(5)

    state = buyItem(state, 'sera_quartermaster', 'health_potion', DEFAULT_QUALITY, 5)

    expect(getInventoryQuantity(state.player, 'health_potion')).toBe(affordable)
    expect(state.player.gold).toBe(25 - unitPrice * affordable)
  })

  it('sellItem removes multiple units and pays unitPrice × sellQty', () => {
    let state = hubState(100)
    state = {
      ...state,
      player: {
        ...state.player,
        inventory: addItemToInventory(state.player.inventory, 'health_potion', 5),
      },
    }
    const unitPrice = getPrice(state, 'health_potion', 'sell', {
      sellBonus: getVendorSellBonus(state, 'sera_quartermaster'),
    })

    state = sellItem(state, 'sera_quartermaster', 'health_potion', DEFAULT_QUALITY, 3)

    expect(getInventoryQuantity(state.player, 'health_potion')).toBe(2)
    expect(state.player.gold).toBe(100 + unitPrice * 3)
  })

  it('sellItem clamps to owned minus equipped reserve', () => {
    let state = hubState(0)
    state = {
      ...state,
      player: {
        ...state.player,
        inventory: addItemToInventory(state.player.inventory, 'oak_spear', 2),
        equipment: {
          weapon: { templateId: 'oak_spear', quality: DEFAULT_QUALITY },
          armor: null,
        },
      },
    }

    state = sellItem(state, 'sera_quartermaster', 'oak_spear', DEFAULT_QUALITY, 5)

    expect(getInventoryQuantity(state.player, 'oak_spear')).toBe(1)
  })
})

describe('market buy qty clamp', () => {
  it('buyMaterialFromMarket buys affordable amount when gold is less than stock', () => {
    let state = hubState(12)
    state = {
      ...state,
      marketMaterialStock: { ...state.marketMaterialStock, oak_wood: 20 },
    }
    const unitPrice = getMarketMaterialBuyPrice(state, 'oak_wood')
    const affordable = Math.floor(12 / unitPrice)
    expect(affordable).toBeGreaterThan(0)
    expect(affordable).toBeLessThan(20)

    state = buyMaterialFromMarket(state, 'oak_wood', 20)

    expect(state.player.materials?.oak_wood).toBe(affordable)
    expect(getMaterialMarketStock(state, 'oak_wood')).toBe(20 - affordable)
    expect(state.player.gold).toBe(12 - unitPrice * affordable)
  })
})
