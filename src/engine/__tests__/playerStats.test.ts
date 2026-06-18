import { describe, it, expect } from 'vitest'
import { createDefaultPlayer } from '../CombatEngine'
import { allocateAttributePoint, enterRoom, initGame } from '../GameLoop'
import { raisePlayerStat } from '../PlayerStats'
import { calculateMaxHp } from '../ProgressionSystem'
import type { Room } from '../GameLoopDesign'

const hubRoom: Room = {
  id: 'town_hub',
  name: 'Town',
  description: 'Hub',
  encounters: [],
  exits: [],
  isHub: true,
}

function hubState(overrides: Parameters<typeof createDefaultPlayer>[0] = {}) {
  const player = createDefaultPlayer(overrides)
  return enterRoom(initGame(player, hubRoom), hubRoom)
}

describe('raisePlayerStat', () => {
  it('raises the chosen stat by 1 without touching unallocated points', () => {
    const state = hubState({ unallocatedAttributePoints: 2 })
    const after = raisePlayerStat(state, 'strength')
    expect(after.player.stats.strength).toBe(state.player.stats.strength + 1)
    expect(after.player.unallocatedAttributePoints).toBe(2)
  })

  it('recalculates maxHp and bumps hp when constitution rises', () => {
    const state = hubState({
      level: 1,
      hp: 30,
      stats: {
        strength: 10,
        constitution: 10,
        dexterity: 8,
        agility: 8,
        defense: 1,
      },
    })
    const conBefore = state.player.stats.constitution
    const after = raisePlayerStat(state, 'constitution')
    const expectedMax = calculateMaxHp(1, conBefore + 1)
    expect(after.player.stats.constitution).toBe(conBefore + 1)
    expect(after.player.maxHp).toBe(expectedMax)
    expect(after.player.hp).toBe(Math.min(30 + 3, expectedMax))
  })
})

describe('allocateAttributePoint', () => {
  it('returns unchanged state when no points available', () => {
    const state = hubState({ unallocatedAttributePoints: 0 })
    const after = allocateAttributePoint(state, 'agility')
    expect(after).toBe(state)
  })

  it('raises stat and decrements unallocated pool', () => {
    const state = hubState({ unallocatedAttributePoints: 1 })
    const after = allocateAttributePoint(state, 'dexterity')
    expect(after.player.stats.dexterity).toBe(state.player.stats.dexterity + 1)
    expect(after.player.unallocatedAttributePoints).toBe(0)
  })

  it('applies constitution maxHp bump like raisePlayerStat', () => {
    const state = hubState({
      unallocatedAttributePoints: 1,
      hp: 35,
      stats: {
        strength: 10,
        constitution: 10,
        dexterity: 8,
        agility: 8,
        defense: 1,
      },
    })
    const after = allocateAttributePoint(state, 'constitution')
    const expectedMax = calculateMaxHp(1, 11)
    expect(after.player.maxHp).toBe(expectedMax)
    expect(after.player.hp).toBe(Math.min(35 + 3, expectedMax))
    expect(after.player.unallocatedAttributePoints).toBe(0)
  })
})
