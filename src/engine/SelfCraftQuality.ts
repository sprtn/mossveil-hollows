/**
 * Self-craft output quality — rising floor + level-weighted roll.
 * Materials remain quality-less; Unique "best materials" gate is reserved below.
 */

import type { Quality } from './Quality'
import { DEFAULT_QUALITY, getQualityTier, QUALITY_ORDER } from './Quality'
import { MAX_PROFESSION_LEVEL } from './Professions'
import { SeededRandom } from './CombatEngine'

/** Playtest placeholders — tune floor thresholds during crafting feel pass. */
export const SELF_CRAFT_FLOOR_BY_LEVEL: Array<{ minLevel: number; floor: Quality }> = [
  { minLevel: 1, floor: 'poor' },
  { minLevel: 4, floor: 'common' },
  { minLevel: 7, floor: 'fine' },
  { minLevel: 9, floor: 'superior' },
]

/** Normal roll ceiling (Unique handled separately). */
export const SELF_CRAFT_ROLL_CEILING: Quality = 'masterwork'

/** Minimum profession level before Unique is eligible on a top-tier roll. */
export const SELF_CRAFT_UNIQUE_MIN_LEVEL = MAX_PROFESSION_LEVEL

/** Weight added per profession level when rolling above floor (shifts toward high tiers). */
export const SELF_CRAFT_LEVEL_WEIGHT_BIAS = 0.35

/** Relative tier weights within the floor→ceiling window (playtest placeholder). */
export const SELF_CRAFT_TIER_WEIGHTS: Record<Quality, number> = {
  trash: 1,
  poor: 3,
  common: 8,
  fine: 12,
  superior: 10,
  masterwork: 5,
  unique: 1,
}

/** Chance to upgrade a masterwork roll to Unique at max level (top roll only). */
export const SELF_CRAFT_UNIQUE_TOP_ROLL_CHANCE = 0.04

export function qualityFloorForLevel(professionLevel: number): Quality {
  let floor: Quality = DEFAULT_QUALITY
  for (const step of SELF_CRAFT_FLOOR_BY_LEVEL) {
    if (professionLevel >= step.minLevel) floor = step.floor
  }
  return floor
}

export function selfCraftQualityCeiling(professionLevel: number): Quality {
  return SELF_CRAFT_ROLL_CEILING
}

export interface SelfCraftQualityRange {
  floor: Quality
  ceiling: Quality
}

export function selfCraftQualityRange(professionLevel: number): SelfCraftQualityRange {
  return {
    floor: qualityFloorForLevel(professionLevel),
    ceiling: selfCraftQualityCeiling(professionLevel),
  }
}

/**
 * Future seam: require top-tier input materials before Unique can proc.
 * Materials are quality-less today — always returns true until material quality exists.
 */
export function canRollUniqueQuality(_professionLevel: number): boolean {
  return true
}

function tiersInWindow(floor: Quality, ceiling: Quality): Quality[] {
  const lo = getQualityTier(floor).order
  const hi = getQualityTier(ceiling).order
  return QUALITY_ORDER.filter((q) => {
    const o = getQualityTier(q).order
    return o >= lo && o <= hi
  })
}

export function rollSelfCraftQuality(
  professionLevel: number,
  rng: SeededRandom = new SeededRandom(Date.now())
): Quality {
  const { floor, ceiling } = selfCraftQualityRange(professionLevel)
  const candidates = tiersInWindow(floor, ceiling)
  if (candidates.length === 0) return floor

  const levelBias = Math.max(0, professionLevel - 1) * SELF_CRAFT_LEVEL_WEIGHT_BIAS
  const weighted = candidates.map((q, index) => {
    const base = SELF_CRAFT_TIER_WEIGHTS[q] ?? 1
    const tierBoost = index * levelBias
    return { q, w: Math.max(0.01, base + tierBoost) }
  })

  const total = weighted.reduce((s, e) => s + e.w, 0)
  let roll = rng.next() * total
  let chosen = floor
  for (const { q, w } of weighted) {
    roll -= w
    if (roll <= 0) {
      chosen = q
      break
    }
  }

  const isTopTier = chosen === ceiling
  if (
    isTopTier &&
    professionLevel >= SELF_CRAFT_UNIQUE_MIN_LEVEL &&
    canRollUniqueQuality(professionLevel) &&
    rng.next() < SELF_CRAFT_UNIQUE_TOP_ROLL_CHANCE
  ) {
    return 'unique'
  }

  return chosen
}

export function isUniqueEligible(professionLevel: number): boolean {
  return (
    professionLevel >= SELF_CRAFT_UNIQUE_MIN_LEVEL &&
    canRollUniqueQuality(professionLevel)
  )
}
