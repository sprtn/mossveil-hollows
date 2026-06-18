import { describe, it, expect } from 'vitest'
import { createDefaultPlayer } from '../CombatEngine'
import { enterRoom, initGame } from '../GameLoop'
import {
  attemptBrynStatPractice,
  brynStatSessionsRemaining,
  canPracticeStat,
} from '../BrynStatTraining'
import {
  BRYN_STAT_PRACTICE_GOLD,
  BRYN_STAT_PRACTICE_MAX_SESSIONS,
} from '../gameConfig'
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

const zoneRoom: Room = {
  id: 'forest_1',
  name: 'Forest',
  description: 'Zone',
  encounters: [],
  exits: [],
}

function hubState(overrides: Parameters<typeof createDefaultPlayer>[0] = {}) {
  const player = createDefaultPlayer({
    gold: 100,
    brynStatSessionsUsed: 0,
    ...overrides,
  })
  return enterRoom(initGame(player, hubRoom), hubRoom)
}

describe('attemptBrynStatPractice', () => {
  it('spends 10g, advances one day, raises chosen stat, and increments counter', () => {
    let state = hubState()
    state = { ...state, day: 3 }
    const strBefore = state.player.stats.strength
    const goldBefore = state.player.gold

    const { state: after, outcome } = attemptBrynStatPractice(state, 'strength')

    expect(outcome?.ok).toBe(true)
    expect(outcome?.goldSpent).toBe(BRYN_STAT_PRACTICE_GOLD)
    expect(outcome?.dayAdvanced).toBe(true)
    expect(after.day).toBe(4)
    expect(after.player.gold).toBe(goldBefore - BRYN_STAT_PRACTICE_GOLD)
    expect(after.player.stats.strength).toBe(strBefore + 1)
    expect(after.player.brynStatSessionsUsed).toBe(1)
    expect(brynStatSessionsRemaining(after.player)).toBe(BRYN_STAT_PRACTICE_MAX_SESSIONS - 1)
  })

  it('raises maxHp on constitution practice', () => {
    const state = hubState({
      hp: 30,
      stats: {
        strength: 10,
        constitution: 10,
        dexterity: 8,
        agility: 8,
        defense: 1,
      },
    })
    const { state: after } = attemptBrynStatPractice(state, 'constitution')
    expect(after.player.stats.constitution).toBe(11)
    expect(after.player.maxHp).toBe(calculateMaxHp(1, 11))
    expect(after.player.hp).toBe(Math.min(30 + 3, after.player.maxHp))
  })

  it('blocks when session cap reached', () => {
    const state = hubState({ brynStatSessionsUsed: BRYN_STAT_PRACTICE_MAX_SESSIONS })
    expect(canPracticeStat(state)).toBe(false)
    const { state: after, outcome } = attemptBrynStatPractice(state, 'defense')
    expect(outcome).toBeNull()
    expect(after).toBe(state)
  })

  it('blocks when gold is below cost', () => {
    const state = hubState({ gold: BRYN_STAT_PRACTICE_GOLD - 1 })
    expect(canPracticeStat(state)).toBe(false)
    const { state: after, outcome } = attemptBrynStatPractice(state, 'agility')
    expect(outcome).toBeNull()
    expect(after).toBe(state)
  })

  it('blocks outside hub', () => {
    const player = createDefaultPlayer({ gold: 100 })
    const state = enterRoom(initGame(player, zoneRoom), zoneRoom)
    expect(canPracticeStat(state)).toBe(false)
    const { outcome } = attemptBrynStatPractice(state, 'dexterity')
    expect(outcome).toBeNull()
  })

  it('allows deferred sessions — partial use then spend remainder later', () => {
    let state = hubState({ gold: 500 })
    for (let i = 0; i < 5; i++) {
      const { state: next } = attemptBrynStatPractice(state, 'strength')
      state = next
    }
    expect(state.player.brynStatSessionsUsed).toBe(5)
    expect(brynStatSessionsRemaining(state.player)).toBe(10)
    expect(canPracticeStat(state)).toBe(true)

    for (let i = 0; i < 10; i++) {
      const { state: next } = attemptBrynStatPractice(state, 'defense')
      state = next
    }
    expect(state.player.brynStatSessionsUsed).toBe(15)
    expect(canPracticeStat(state)).toBe(false)
  })
})
