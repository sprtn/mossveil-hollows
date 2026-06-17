/**
 * Skill tree system — registry and training entry points.
 */

import type { GameState } from './GameLoopDesign'
import type { SkillDef } from './ContentSchemas'
import { canAttemptTraining } from './SkillTraining'

import empoweredStrike from '../assets/skills/empowered_strike.json'
import wildSwing from '../assets/skills/wild_swing.json'
import stunningBlow from '../assets/skills/stunning_blow.json'
import crushingBlow from '../assets/skills/crushing_blow.json'
import concussiveSlam from '../assets/skills/concussive_slam.json'
import recklessOnslaught from '../assets/skills/reckless_onslaught.json'
import whirlwindSweep from '../assets/skills/whirlwind_sweep.json'
import preciseShot from '../assets/skills/precise_shot.json'
import bleed from '../assets/skills/bleed.json'
import hamstring from '../assets/skills/hamstring.json'
import exploitWound from '../assets/skills/exploit_wound.json'
import killingMark from '../assets/skills/killing_mark.json'
import evasiveReflexes from '../assets/skills/evasive_reflexes.json'
import fieldDressing from '../assets/skills/field_dressing.json'
import antidoteLore from '../assets/skills/antidote_lore.json'
import makeCamp from '../assets/skills/make_camp.json'
import forager from '../assets/skills/forager.json'
import treasureSense from '../assets/skills/treasure_sense.json'
import secondWind from '../assets/skills/second_wind.json'

export {
  attemptTraining,
  canAttemptTraining,
  computeTrainingChance,
  getTrainingPreview,
} from './SkillTraining'
export type { TrainingAttemptOutcome, TrainingLockReason, TrainingPreview } from './SkillTraining'

const SKILLS: SkillDef[] = [
  empoweredStrike as SkillDef,
  wildSwing as SkillDef,
  stunningBlow as SkillDef,
  crushingBlow as SkillDef,
  concussiveSlam as SkillDef,
  recklessOnslaught as SkillDef,
  whirlwindSweep as SkillDef,
  preciseShot as SkillDef,
  bleed as SkillDef,
  hamstring as SkillDef,
  exploitWound as SkillDef,
  killingMark as SkillDef,
  evasiveReflexes as SkillDef,
  fieldDressing as SkillDef,
  antidoteLore as SkillDef,
  makeCamp as SkillDef,
  forager as SkillDef,
  treasureSense as SkillDef,
  secondWind as SkillDef,
]

const skillMap = new Map(SKILLS.map((s) => [s.id, s]))

export function getSkill(id: string): SkillDef | undefined {
  return skillMap.get(id)
}

export function getSkillEnergyCost(skillId: string): number {
  return getSkill(skillId)?.energyCost ?? 0
}

export function getAllSkills(): SkillDef[] {
  return SKILLS
}

export function getActivatableCombatSkills(state: GameState): SkillDef[] {
  const known = new Set(state.player.knownSkills ?? [])
  return SKILLS.filter(
    (s) =>
      known.has(s.id) &&
      s.combat?.activatable !== false &&
      !s.combat?.passive &&
      (s.combat?.effects.length ?? 0) > 0
  )
}

export function getOutOfCombatSkills(state: GameState): SkillDef[] {
  const known = new Set(state.player.knownSkills ?? [])
  return SKILLS.filter((s) => known.has(s.id) && s.outOfCombat)
}

/** Alias for TrainPanel compatibility during migration. */
export function canLearnSkill(state: GameState, skillId: string): boolean {
  return canAttemptTraining(state, skillId)
}
