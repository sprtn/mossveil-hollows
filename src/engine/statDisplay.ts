import type { PlayerStatKey } from './GameLoopDesign'
import { critChanceFor, accuracyFor, evasionFor } from './CombatEngine'

function pct(n: number, decimals = 0): string {
  return `${(n * 100).toFixed(decimals)}%`
}

/**
 * Short combat-relevant readout shown inline under a stat (Dexterity / Agility).
 * Uses the live combat formulas so the numbers match what happens in battle.
 * Pass the *effective* stat value (base + gear).
 */
export function derivedStatText(stat: PlayerStatKey, value: number): string {
  if (stat === 'dexterity') {
    return `Crit ${pct(critChanceFor(value), 1)} · Acc ${pct(accuracyFor(value))}`
  }
  if (stat === 'agility') {
    return `Evade ${pct(evasionFor(value), 1)}`
  }
  return ''
}

/**
 * "Expected increase" line shown on hover: what the derived combat values
 * become with one more point in this stat.
 */
export function derivedStatProjection(stat: PlayerStatKey, value: number): string {
  const next = value + 1
  if (stat === 'dexterity') {
    const critGain = (critChanceFor(next) - critChanceFor(value)) * 100
    const accGain = (accuracyFor(next) - accuracyFor(value)) * 100
    return `With +1 Dexterity → Crit ${pct(critChanceFor(next), 1)} (+${critGain.toFixed(1)}%), Accuracy ${pct(accuracyFor(next))} (+${accGain.toFixed(1)}%)`
  }
  if (stat === 'agility') {
    const evadeGain = (evasionFor(next) - evasionFor(value)) * 100
    return `With +1 Agility → Evasion ${pct(evasionFor(next), 1)} (+${evadeGain.toFixed(1)}%), faster turn order & higher chance of an extra action`
  }
  return ''
}
