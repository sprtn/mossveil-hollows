import { describe, it, expect } from 'vitest'
import { initGame, enterRoom, gatherFromNode } from '../GameLoop'
import { createDefaultPlayer } from '../CombatEngine'
import { applyConsumableEffect } from '../ItemDatabase'
import { getItemTemplate } from '../ItemDatabase'
import { getEventCard } from '../EventSystem'
import { DEFAULT_QUALITY } from '../Quality'
import { BERRY_ENERGY_RESTORE } from '../gameConfig'
import type { Room } from '../GameLoopDesign'

const forestWithBerries: Room = {
  id: 'zone_forest_entrance',
  name: 'Forest',
  description: 'Woods',
  zoneId: 'forest',
  difficulty: 0,
  encounters: [],
  exits: [],
  gatherNodes: [
    {
      id: 'test_berries',
      profession: 'herbalism',
      resource: 'berries',
      baseYield: 1,
      maxCharges: 4,
      regenPerDay: 2,
    },
  ],
}

describe('berry gather nodes', () => {
  it('berry node costs stamina and depletes charges', () => {
    let state = initGame(createDefaultPlayer(), forestWithBerries)
    state = enterRoom(state, forestWithBerries)
    const staminaBefore = state.player.stamina
    state = gatherFromNode(state, 'test_berries')
    expect(state.player.stamina).toBeLessThan(staminaBefore)
    expect(state.gatherNodeState?.test_berries?.charges).toBe(3)
    const berries = state.player.inventory.find((i) => i.templateId === 'berries')
    expect(berries?.quantity).toBeGreaterThan(0)
  })

  it('berries consumable restores energy', () => {
    const template = getItemTemplate('berries')
    expect(template?.effect).toBe('restore_energy')
    expect(template?.power).toBe(BERRY_ENERGY_RESTORE)

    const player = createDefaultPlayer({ energy: 2 })
    const { player: after } = applyConsumableEffect(player, template!, DEFAULT_QUALITY)
    expect(after.energy).toBe(2 + BERRY_ENERGY_RESTORE)
  })

  it('berry_thicket explore event no longer exists', () => {
    expect(getEventCard('berry_thicket')).toBeUndefined()
  })
})
