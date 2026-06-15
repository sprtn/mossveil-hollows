/**
 * Quality rolls for loot drops and vendor stock (playtest placeholders).
 */

import type { Quality } from './Quality'
import { DEFAULT_QUALITY, QUALITY_ORDER } from './Quality'
import type { SeededRandom } from './CombatEngine'

/** Relative weights for loot/vendor rolls — heavily skewed toward common. */
export const LOOT_QUALITY_WEIGHTS: Record<Quality, number> = {
  trash: 4,
  poor: 10,
  common: 55,
  fine: 18,
  superior: 8,
  masterwork: 4,
  unique: 1,
}

/** Extra weight shifted toward higher tiers per room difficulty point (modest). */
export const LOOT_DIFFICULTY_QUALITY_BIAS = 0.015

/** Vendor stock: even more conservative than loot. */
export const VENDOR_QUALITY_WEIGHTS: Record<Quality, number> = {
  trash: 2,
  poor: 8,
  common: 70,
  fine: 14,
  superior: 5,
  masterwork: 1,
  unique: 0,
}

function rollFromWeights(
  rng: SeededRandom,
  weights: Record<Quality, number>,
  difficultyBias = 0
): Quality {
  const adjusted = QUALITY_ORDER.map((q) => {
    const base = weights[q] ?? 0
    const order = QUALITY_ORDER.indexOf(q)
    const commonOrder = QUALITY_ORDER.indexOf(DEFAULT_QUALITY)
    const tierBoost = order > commonOrder ? difficultyBias * (order - commonOrder) : 0
    return { q, w: Math.max(0, base + tierBoost) }
  })
  const total = adjusted.reduce((s, e) => s + e.w, 0)
  if (total <= 0) return DEFAULT_QUALITY

  let roll = rng.next() * total
  for (const { q, w } of adjusted) {
    roll -= w
    if (roll <= 0) return q
  }
  return DEFAULT_QUALITY
}

export function rollLootQuality(rng: SeededRandom, roomDifficulty = 0): Quality {
  const bias = Math.max(0, roomDifficulty) * LOOT_DIFFICULTY_QUALITY_BIAS
  return rollFromWeights(rng, LOOT_QUALITY_WEIGHTS, bias)
}

export function rollVendorQuality(rng: SeededRandom): Quality {
  return rollFromWeights(rng, VENDOR_QUALITY_WEIGHTS, 0)
}

/** Finished gear/consumables get rolled quality; materials and quest keys do not. */
export function itemTypeRollsQuality(type: string | undefined): boolean {
  return type === 'weapon' || type === 'armor' || type === 'consumable'
}
