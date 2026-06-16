/**
 * Stat-based skill training — gold + day per attempt, pure roll.
 */

import type { GameState, Player, PlayerStatKey } from './GameLoopDesign'
import type { SkillDef } from './ContentSchemas'
import { getEffectiveStats } from './ItemDatabase'
import { advanceDay } from './DayAdvance'
import { TRAINING_MIN_SUCCESS_PCT } from './gameConfig'
import { getSkill } from './SkillSystem'

export type TrainingLockReason =
  | 'known'
  | 'missing_prereq'
  | 'stat_too_low'
  | 'cant_afford'
  | 'no_training_data'

export type TrainingPreview = {
  governingStat: PlayerStatKey
  currentStat: number
  minStat: number
  maxStat: number
  chance: number
  goldCost: number
  attemptable: boolean
  lockedReason: TrainingLockReason | null
}

export type TrainingAttemptOutcome = {
  success: boolean
  chance: number
  goldSpent: number
  dayAdvanced: boolean
  newlyKnown: boolean
  skillId: string
  skillName: string
}

function governingStatValue(player: Player, stat: PlayerStatKey): number {
  return getEffectiveStats(player)[stat]
}

export function computeTrainingChance(player: Player, skill: SkillDef): number {
  const training = skill.training
  if (!training) return 0

  const stat = governingStatValue(player, training.governingStat)
  const { minStat, maxStat } = training

  if (stat < minStat) return 0
  if (stat >= maxStat) return 1
  if (maxStat <= minStat) return 1

  const t = (stat - minStat) / (maxStat - minStat)
  return TRAINING_MIN_SUCCESS_PCT + t * (1 - TRAINING_MIN_SUCCESS_PCT)
}

function prereqsMet(player: Player, skill: SkillDef): boolean {
  return skill.requires.every((req) => (player.knownSkills ?? []).includes(req))
}

export function getTrainingPreview(player: Player, skill: SkillDef): TrainingPreview {
  const training = skill.training
  if (!training) {
    return {
      governingStat: 'strength',
      currentStat: 0,
      minStat: 0,
      maxStat: 0,
      chance: 0,
      goldCost: 0,
      attemptable: false,
      lockedReason: 'no_training_data',
    }
  }

  const currentStat = governingStatValue(player, training.governingStat)
  const chance = computeTrainingChance(player, skill)
  const known = (player.knownSkills ?? []).includes(skill.id)

  let lockedReason: TrainingLockReason | null = null
  if (known) lockedReason = 'known'
  else if (!prereqsMet(player, skill)) lockedReason = 'missing_prereq'
  else if (currentStat < training.minStat) lockedReason = 'stat_too_low'
  else if (player.gold < training.goldCost) lockedReason = 'cant_afford'

  return {
    governingStat: training.governingStat,
    currentStat,
    minStat: training.minStat,
    maxStat: training.maxStat,
    chance,
    goldCost: training.goldCost,
    attemptable: lockedReason === null,
    lockedReason,
  }
}

export function canAttemptTraining(state: GameState, skillId: string): boolean {
  const skill = getSkill(skillId)
  if (!skill?.training) return false
  return getTrainingPreview(state.player, skill).attemptable
}

export function attemptTraining(
  state: GameState,
  skillId: string,
  roll?: number
): { state: GameState; outcome: TrainingAttemptOutcome | null } {
  const skill = getSkill(skillId)
  if (!skill?.training || !canAttemptTraining(state, skillId)) {
    return { state, outcome: null }
  }

  const training = skill.training
  const chance = computeTrainingChance(state.player, skill)
  const goldSpent = training.goldCost
  const dayBefore = state.day ?? 1

  let next: GameState = {
    ...state,
    player: {
      ...state.player,
      gold: state.player.gold - goldSpent,
    },
  }
  next = advanceDay(next)

  const successRoll = roll ?? Math.random()
  const success = successRoll < chance

  if (success) {
    next = {
      ...next,
      player: {
        ...next.player,
        knownSkills: [...(next.player.knownSkills ?? []), skillId],
      },
    }
  }

  return {
    state: next,
    outcome: {
      success,
      chance,
      goldSpent,
      dayAdvanced: (next.day ?? 1) === dayBefore + 1,
      newlyKnown: success,
      skillId,
      skillName: skill.name,
    },
  }
}
