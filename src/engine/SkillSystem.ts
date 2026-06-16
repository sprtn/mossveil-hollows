/**
 * Skill tree system — registry and training entry points.
 */

import type { GameState } from './GameLoopDesign'
import type { SkillDef } from './ContentSchemas'
import { canAttemptTraining } from './SkillTraining'

import powerStrike from '../assets/skills/power_strike.json'
import cleave from '../assets/skills/cleave.json'
import brace from '../assets/skills/brace.json'
import bandage from '../assets/skills/bandage.json'
import antidoteLore from '../assets/skills/antidote_lore.json'
import secondWind from '../assets/skills/second_wind.json'
import preciseShot from '../assets/skills/precise_shot.json'
import bleed from '../assets/skills/bleed.json'
import hamstring from '../assets/skills/hamstring.json'

export {
  attemptTraining,
  canAttemptTraining,
  computeTrainingChance,
  getTrainingPreview,
} from './SkillTraining'
export type { TrainingAttemptOutcome, TrainingLockReason, TrainingPreview } from './SkillTraining'

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

/** Alias for TrainPanel compatibility during migration. */
export function canLearnSkill(state: GameState, skillId: string): boolean {
  return canAttemptTraining(state, skillId)
}
