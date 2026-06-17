import { describe, it, expect } from 'vitest'
import { initGame, enterRoom, gatherFromNode, useItem } from '../GameLoop'
import { createDefaultPlayer } from '../CombatEngine'
import { applyConsumableEffect, getItemTemplate } from '../ItemDatabase'
import { sellMaterialToMarket } from '../HubActions'
import { DEFAULT_QUALITY } from '../Quality'
import {
  RAW_FISH_HP_RESTORE,
  FRESH_PRODUCE_HP_RESTORE,
} from '../gameConfig'
import type { Room } from '../GameLoopDesign'

const forestWithFood: Room = {
  id: 'zone_forest_entrance',
  name: 'Forest',
  description: 'Woods',
  zoneId: 'forest',
  difficulty: 0,
  encounters: [],
  exits: [],
  gatherNodes: [
    {
      id: 'test_fish',
      profession: 'farming_fishing',
      resource: 'raw_fish',
      baseYield: 1,
      maxCharges: 5,
      regenPerDay: 2,
    },
    {
      id: 'test_produce',
      profession: 'farming_fishing',
      resource: 'fresh_produce',
      baseYield: 1,
      maxCharges: 5,
      regenPerDay: 2,
    },
  ],
}

const hubRoom: Room = {
  id: 'town_hub',
  name: 'Hub',
  description: 'Safe',
  isHub: true,
  encounters: [],
  exits: [],
}

describe('farming & fishing food', () => {
  it('raw_fish gather node puts fish in inventory', () => {
    let state = initGame(createDefaultPlayer(), forestWithFood)
    state = enterRoom(state, forestWithFood)
    state = gatherFromNode(state, 'test_fish')
    const fish = state.player.inventory.find((i) => i.templateId === 'raw_fish')
    expect(fish?.quantity).toBeGreaterThan(0)
    expect(state.player.materials?.raw_fish).toBeUndefined()
  })

  it('fresh_produce gather node puts produce in inventory', () => {
    let state = initGame(createDefaultPlayer(), forestWithFood)
    state = enterRoom(state, forestWithFood)
    state = gatherFromNode(state, 'test_produce')
    const produce = state.player.inventory.find((i) => i.templateId === 'fresh_produce')
    expect(produce?.quantity).toBeGreaterThan(0)
  })

  it('raw_fish restores HP only via applyConsumableEffect', () => {
    const template = getItemTemplate('raw_fish')
    expect(template?.type).toBe('consumable')
    expect(template?.effect).toBe('heal_health')
    expect(template?.power).toBe(RAW_FISH_HP_RESTORE)

    const player = createDefaultPlayer({ hp: 10, energy: 2, stamina: 5 })
    const { player: after } = applyConsumableEffect(player, template!, DEFAULT_QUALITY)
    expect(after.hp).toBe(10 + RAW_FISH_HP_RESTORE)
    expect(after.energy).toBe(2)
    expect(after.stamina).toBe(5)
  })

  it('fresh_produce restores HP only via applyConsumableEffect', () => {
    const template = getItemTemplate('fresh_produce')
    expect(template?.type).toBe('consumable')
    expect(template?.effect).toBe('heal_health')
    expect(template?.power).toBe(FRESH_PRODUCE_HP_RESTORE)

    const player = createDefaultPlayer({ hp: 20, energy: 4, stamina: 8 })
    const { player: after } = applyConsumableEffect(player, template!, DEFAULT_QUALITY)
    expect(after.hp).toBe(20 + FRESH_PRODUCE_HP_RESTORE)
    expect(after.energy).toBe(4)
    expect(after.stamina).toBe(8)
  })

  it('eating uses the same useItem path as berries', () => {
    let state = initGame(createDefaultPlayer({ hp: 10 }), forestWithFood)
    state = enterRoom(state, forestWithFood)
    state = gatherFromNode(state, 'test_fish')
    const qtyBefore = state.player.inventory.find((i) => i.templateId === 'raw_fish')?.quantity ?? 0
    state = useItem(state, 'raw_fish')
    expect(state.player.hp).toBe(10 + RAW_FISH_HP_RESTORE)
    const qtyAfter = state.player.inventory.find((i) => i.templateId === 'raw_fish')?.quantity ?? 0
    expect(qtyAfter).toBe(qtyBefore - 1)
  })

  it('gathered raw_fish can be sold at the market', () => {
    let state = initGame(createDefaultPlayer({ gold: 0 }), forestWithFood)
    state = enterRoom(state, forestWithFood)
    state = gatherFromNode(state, 'test_fish')
    state = enterRoom(state, hubRoom)
    const goldBefore = state.player.gold
    state = sellMaterialToMarket(state, 'raw_fish', 1)
    expect(state.player.gold).toBeGreaterThan(goldBefore)
    expect(state.player.inventory.find((i) => i.templateId === 'raw_fish')?.quantity ?? 0).toBe(0)
  })
})
