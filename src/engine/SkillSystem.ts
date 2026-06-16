/**
 * Skill tree system — learn and use skills.
 */

import type { GameState } from './GameLoopDesign'
import type { SkillDef } from './ContentSchemas'
import { TRAINING_COST, TRAINING_SKILL_POINT_COST } from './gameConfig'

import powerStrike from '../assets/skills/power_strike.json'
import cleave from '../assets/skills/cleave.json'
import brace from '../assets/skills/brace.json'
import bandage from '../assets/skills/bandage.json'
import antidoteLore from '../assets/skills/antidote_lore.json'
import secondWind from '../assets/skills/second_wind.json'
import preciseShot from '../assets/skills/precise_shot.json'
import bleed from '../assets/skills/bleed.json'
import hamstring from '../assets/skills/hamstring.json'

const SKILLS: SkillDef[] = [
  powerStrike as SkillDef,
  cleave as SkillDef,
  brace as SkillDef,
  bandage as SkillDef,
  antidoteLore as SkillDef,
  secondWind as SkillDef,
  preciseShot as SkillDef,
  bleed as SkillDef,
  hamstring as SkillDef,
]

const skillMap = new Map(SKILLS.map((s) => [s.id, s]))
const actionMap = new Map(
  SKILLS.filter((s) => s.action).map((s) => [s.action!, s])
)

export function getSkill(id: string): SkillDef | undefined {
  return skillMap.get(id)
}

export function getSkillByAction(action: string): SkillDef | undefined {
  return actionMap.get(action)
}

export function getSkillEnergyCost(skillId: string): number {
  return getSkill(skillId)?.energyCost ?? 0
}

export function getAllSkills(): SkillDef[] {
  return SKILLS
}

export function canLearnSkill(state: GameState, skillId: string): boolean {
  const skill = getSkill(skillId)
  if (!skill) return false
  if ((state.player.knownSkills ?? []).includes(skillId)) return false
  if ((state.player.skillPoints ?? 0) < skill.cost) return false
  return skill.requires.every((req) => (state.player.knownSkills ?? []).includes(req))
}

export function learnSkill(state: GameState, skillId: string): GameState {
  if (!canLearnSkill(state, skillId)) return state
  const skill = getSkill(skillId)!
  const known = [...(state.player.knownSkills ?? []), skillId]
  return {
    ...state,
    player: {
      ...state.player,
      knownSkills: known,
      skillPoints: (state.player.skillPoints ?? 0) - skill.cost,
    },
  }
}

export function buySkillPoint(state: GameState): GameState {
  if (state.player.gold < TRAINING_COST) return state
  return {
    ...state,
    player: {
      ...state.player,
      gold: state.player.gold - TRAINING_COST,
      skillPoints: (state.player.skillPoints ?? 0) + TRAINING_SKILL_POINT_COST,
    },
  }
}
