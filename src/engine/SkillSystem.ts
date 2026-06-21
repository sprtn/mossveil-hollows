/**
 * Skill tree system — registry and training entry points.
 */

import type { GameState } from './GameLoopDesign'
import type { SkillDef } from './ContentSchemas'
import { canAttemptTraining } from './SkillTraining'
import { getSkill, getAllSkills } from './admin/ContentRegistry'

export {
  attemptTraining,
  canAttemptTraining,
  computeTrainingChance,
  getTrainingPreview,
} from './SkillTraining'
export type { TrainingAttemptOutcome, TrainingLockReason, TrainingPreview } from './SkillTraining'

export { getSkill, getAllSkills }

export function getSkillEnergyCost(skillId: string): number {
  return getSkill(skillId)?.energyCost ?? 0
}

export function getActivatableCombatSkills(state: GameState): SkillDef[] {
  const known = new Set(state.player.knownSkills ?? [])
  return getAllSkills().filter(
    (s) =>
      known.has(s.id) &&
      s.combat?.activatable !== false &&
      !s.combat?.passive &&
      (s.combat?.effects.length ?? 0) > 0
  )
}

export function getOutOfCombatSkills(state: GameState): SkillDef[] {
  const known = new Set(state.player.knownSkills ?? [])
  return getAllSkills().filter((s) => known.has(s.id) && s.outOfCombat)
}

/** Alias for TrainPanel compatibility during migration. */
export function canLearnSkill(state: GameState, skillId: string): boolean {
  return canAttemptTraining(state, skillId)
}
