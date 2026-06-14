/**
 * Logging camp labour pay — morale, bonus output, pay caps.
 */

export const LABOUR_PAY_MAX = 10
export const LABOUR_FAIR_WAGE = 5
/** Morale percentage points gained per gold of daily pay (1g → 20%). */
export const MORALE_PERCENT_PER_GOLD = 20
/** Chance of one bonus log per gold paid above fair wage. */
export const BONUS_LOG_CHANCE_PER_GOLD = 0.1

export function clampLabourPay(pay: number): number {
  return Math.max(0, Math.min(LABOUR_PAY_MAX, Math.round(pay)))
}

/** Worker morale 0–100 from daily pay. */
export function computeMoralePercent(pay: number): number {
  return Math.min(100, clampLabourPay(pay) * MORALE_PERCENT_PER_GOLD)
}

/** Probability of one extra log when pay exceeds fair wage. */
export function computeBonusLogChance(pay: number): number {
  const clamped = clampLabourPay(pay)
  if (clamped <= LABOUR_FAIR_WAGE) return 0
  return (clamped - LABOUR_FAIR_WAGE) * BONUS_LOG_CHANCE_PER_GOLD
}

export function rollMoraleSuccess(rng: () => number, pay: number): boolean {
  const morale = computeMoralePercent(pay)
  if (morale >= 100) return true
  if (morale <= 0) return false
  return rng() < morale / 100
}

export function rollBonusLog(rng: () => number, pay: number): boolean {
  const chance = computeBonusLogChance(pay)
  if (chance <= 0) return false
  return rng() < chance
}

/** Expected logs per run (base output + bonus chance). */
export function expectedOutputPerRun(baseOutput: number, pay: number): number {
  return baseOutput + computeBonusLogChance(pay)
}
