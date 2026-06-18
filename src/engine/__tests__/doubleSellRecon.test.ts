/**
 * Recon: market sell then vendor sell on same consumable stack — engine safety.
 */

import { describe, it, expect } from 'vitest'
import { initGame, enterRoom } from '../GameLoop'
import { createDefaultPlayer } from '../CombatEngine'
import { addItemToInventory, getInventoryQuantity } from '../ItemDatabase'
import { sellMaterialToMarket, sellItem } from '../HubActions'
import { ensureMarketState, getPrice } from '../MarketSystem'
import { ensureVendorState } from '../VendorSystem'
import { DEFAULT_QUALITY } from '../Quality'
import type { Room } from '../GameLoopDesign'

const FISH_ID = 'raw_fish'
const VENDOR_ID = 'sera_quartermaster'
const STACK_QTY = 5

const hubRoom: Room = {
  id: 'town_hub',
  name: 'Hub',
  description: 'Safe',
  isHub: true,
  encounters: [],
  exits: [],
}

function townWithFish(gold: number) {
  let state = initGame(createDefaultPlayer({ gold }), hubRoom)
  state = enterRoom(state, hubRoom)
  state = ensureVendorState(ensureMarketState(state))
  state = {
    ...state,
    player: {
      ...state.player,
      inventory: addItemToInventory(
        state.player.inventory,
        FISH_ID,
        STACK_QTY,
        DEFAULT_QUALITY
      ),
    },
  }
  return state
}

describe('double sell recon (market then vendor)', () => {
  it('vendor sell no-ops after market sell-all emptied the stack', () => {
    const startGold = 100
    let state = townWithFish(startGold)

    expect(getInventoryQuantity(state.player, FISH_ID)).toBe(STACK_QTY)

    const unitPrice = getPrice(state, FISH_ID, 'sell')
    const goldBeforeMarket = state.player.gold

    state = sellMaterialToMarket(state, FISH_ID, STACK_QTY)

    expect(getInventoryQuantity(state.player, FISH_ID)).toBe(0)
    expect(state.player.gold).toBe(goldBeforeMarket + unitPrice * STACK_QTY)

    const afterMarket = state
    const goldBeforeVendor = afterMarket.player.gold

    state = sellItem(afterMarket, VENDOR_ID, FISH_ID, DEFAULT_QUALITY)

    expect(getInventoryQuantity(state.player, FISH_ID)).toBe(0)
    expect(state.player.gold).toBe(goldBeforeVendor)
    expect(state.player.gold).toBe(goldBeforeMarket + unitPrice * STACK_QTY)
  })
})
