import { describe, it, expect } from 'vitest'
import { endEncounter, triggerEncounter, enterRoom, initGame } from '../GameLoop'
import { createDefaultPlayer, SeededRandom } from '../CombatEngine'
import type { Enemy, Room } from '../GameLoopDesign'

const room: Room = {
  id: 'test_room',
  name: 'Test',
  description: '',
  encounters: [],
  exits: [],
}

describe('loot drops', () => {
  const wolf: Enemy = {
    id: 'test_wolf',
    name: 'Wolf',
    hp: 0,
    maxHp: 20,
    level: 1,
    stats: { strength: 10, defense: 2, constitution: 8, dexterity: 5, agility: 6 },
    xpReward: 30,
    goldReward: 0,
    loot: [
      { templateId: 'wolf_pelt', quantity: 1, chance: 0.7 },
      { templateId: 'canine_tooth', quantity: 1, chance: 0.12 },
    ],
  }

  const bandit: Enemy = {
    id: 'test_bandit',
    name: 'Bandit',
    hp: 0,
    maxHp: 26,
    level: 2,
    stats: { strength: 13, defense: 3, constitution: 8, dexterity: 6, agility: 7 },
    xpReward: 40,
    goldReward: 8,
    loot: [{ templateId: 'cloth_scrap', quantity: 1, chance: 1 }],
  }

  it('beasts drop no gold', () => {
    let state = triggerEncounter(enterRoom(initGame(createDefaultPlayer(), room), room), [wolf])
    const goldBefore = state.player.gold
    state = endEncounter(state, 'win')
    expect(state.player.gold).toBe(goldBefore)
  })

  it('humanoids still drop coin purses', () => {
    let state = triggerEncounter(enterRoom(initGame(createDefaultPlayer(), room), room), [bandit])
    const goldBefore = state.player.gold
    state = endEncounter(state, 'win')
    expect(state.player.gold).toBe(goldBefore + 8)
  })

  it('rolls loot chances deterministically from seed', () => {
    let state = initGame(createDefaultPlayer(), room)
    state = { ...state, seed: 999 }
    state = triggerEncounter(enterRoom(state, room), [wolf])
    state = endEncounter(state, 'win')
    const loot = state.combatResults?.lootGained ?? []
    const ids = loot.map((l) => l.templateId).sort()
    expect(ids).toEqual(['wolf_pelt'])
  })

  it('rare trophies drop on some seeds', () => {
    let foundTooth = false
    for (let seed = 0; seed < 500 && !foundTooth; seed++) {
      let state = initGame(createDefaultPlayer(), room)
      state = { ...state, seed, turnCount: 1 }
      state = triggerEncounter(enterRoom(state, room), [wolf])
      state = endEncounter(state, 'win')
      if (state.combatResults?.lootGained.some((l) => l.templateId === 'canine_tooth')) {
        foundTooth = true
      }
    }
    expect(foundTooth).toBe(true)
  })
})

describe('SeededRandom loot rolls', () => {
  it('respects chance thresholds', () => {
    const rng = new SeededRandom(42)
    let hits = 0
    for (let i = 0; i < 100; i++) {
      if (rng.next() < 0.12) hits++
    }
    expect(hits).toBeGreaterThan(0)
    expect(hits).toBeLessThan(30)
  })
})
