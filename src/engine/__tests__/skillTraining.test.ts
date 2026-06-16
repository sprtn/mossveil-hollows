import { describe, it, expect } from 'vitest'
import { createDefaultPlayer } from '../CombatEngine'
import { getSkill } from '../SkillSystem'
import {
  attemptTraining,
  canAttemptTraining,
  computeTrainingChance,
  getTrainingPreview,
} from '../SkillTraining'
import { TRAINING_MIN_SUCCESS_PCT } from '../gameConfig'
import { enterRoom, initGame } from '../GameLoop'
import { migrateSaveV9 } from '../saveMigration'
import type { Room } from '../GameLoopDesign'

const testRoom: Room = {
  id: 'town_hub',
  name: 'Town',
  description: 'Hub',
  encounters: [],
  exits: [],
  isHub: true,
}

function hubState(overrides: Partial<ReturnType<typeof createDefaultPlayer>> = {}) {
  const player = createDefaultPlayer({
    gold: 100,
    knownSkills: [],
    ...overrides,
  })
  return enterRoom(initGame(player, testRoom), testRoom)
}

describe('computeTrainingChance', () => {
  const skill = getSkill('skill_power_strike')!

  it('returns 0 below minStat', () => {
    const player = createDefaultPlayer({
      stats: { strength: 5, constitution: 10, dexterity: 8, agility: 8, defense: 1 },
      equipment: {},
    })
    expect(computeTrainingChance(player, skill)).toBe(0)
  })

  it('returns 1 at or above maxStat', () => {
    const player = createDefaultPlayer({
      stats: { strength: 20, constitution: 10, dexterity: 8, agility: 8, defense: 1 },
      equipment: {},
    })
    expect(computeTrainingChance(player, skill)).toBe(1)
  })

  it('returns floor % at exactly minStat', () => {
    const player = createDefaultPlayer({
      stats: { strength: 8, constitution: 10, dexterity: 8, agility: 8, defense: 1 },
      equipment: {},
    })
    expect(computeTrainingChance(player, skill)).toBeCloseTo(TRAINING_MIN_SUCCESS_PCT)
  })

  it('ramps linearly between min and max', () => {
    const player = createDefaultPlayer({
      stats: { strength: 13, constitution: 10, dexterity: 8, agility: 8, defense: 1 },
      equipment: {},
    })
    const t = (13 - 8) / (18 - 8)
    const expected = TRAINING_MIN_SUCCESS_PCT + t * (1 - TRAINING_MIN_SUCCESS_PCT)
    expect(computeTrainingChance(player, skill)).toBeCloseTo(expected)
  })
})

describe('attemptTraining', () => {
  it('deducts gold and advances exactly one day on failure', () => {
    let state = hubState({
      stats: { strength: 14, constitution: 10, dexterity: 10, agility: 8, defense: 5 },
    })
    state = { ...state, day: 5 }
    const goldBefore = state.player.gold
    const { state: after, outcome } = attemptTraining(state, 'skill_power_strike', 0.99)
    expect(outcome?.success).toBe(false)
    expect(outcome?.goldSpent).toBe(18)
    expect(after.player.gold).toBe(goldBefore - 18)
    expect(after.day).toBe(6)
    expect(after.player.knownSkills).not.toContain('skill_power_strike')
  })

  it('adds skill on success with seeded roll', () => {
    let state = hubState({
      stats: { strength: 14, constitution: 10, dexterity: 10, agility: 8, defense: 5 },
    })
    const { state: after, outcome } = attemptTraining(state, 'skill_power_strike', 0)
    expect(outcome?.success).toBe(true)
    expect(outcome?.newlyKnown).toBe(true)
    expect(after.player.knownSkills).toContain('skill_power_strike')
  })

  it('cannot attempt below min stat', () => {
    const state = hubState({
      stats: { strength: 5, constitution: 10, dexterity: 8, agility: 8, defense: 1 },
      equipment: {},
    })
    expect(canAttemptTraining(state, 'skill_power_strike')).toBe(false)
    const { state: after, outcome } = attemptTraining(state, 'skill_power_strike', 0)
    expect(outcome).toBeNull()
    expect(after).toBe(state)
  })

  it('cannot attempt without prereqs', () => {
    const state = hubState()
    expect(canAttemptTraining(state, 'skill_cleave')).toBe(false)
  })

  it('cannot attempt without gold', () => {
    const state = hubState({ gold: 0 })
    expect(canAttemptTraining(state, 'skill_power_strike')).toBe(false)
  })

  it('cannot re-train known skill', () => {
    const state = hubState({ knownSkills: ['skill_power_strike'] })
    expect(getTrainingPreview(state.player, getSkill('skill_power_strike')!).lockedReason).toBe('known')
    expect(canAttemptTraining(state, 'skill_power_strike')).toBe(false)
  })
})

describe('migrateSaveV9', () => {
  it('drops skillPoints and preserves knownSkills', () => {
    const migrated = migrateSaveV9({
      player: {
        knownSkills: ['skill_bandage'],
        skillPoints: 5,
        gold: 50,
      },
    })
    expect(migrated.player.knownSkills).toEqual(['skill_bandage'])
    expect((migrated.player as { skillPoints?: number }).skillPoints).toBeUndefined()
  })
})
