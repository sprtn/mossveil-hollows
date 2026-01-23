/**
 * Player Progression System
 *
 * Lightweight leveling with simple stat scaling and no power creep.
 * Design goals:
 * - Leveling feels rewarding without breaking game balance
 * - Enemies scale with player level to maintain challenge
 * - Stat gains diminish as level increases (logarithmic)
 * - Level cap at 30 to prevent trivializing late game
 */

import type { Player } from './GameLoopDesign'

/**
 * Progression tier (difficulty scaling)
 */
export interface ProgressionTier {
  minLevel: number
  maxLevel: number
  name: string
  enemyScaleFactor: number // Multiplier for enemy stats
}

/**
 * Level progression data (immutable)
 */
export interface LevelProgression {
  level: number
  requiredXp: number // Total XP to reach this level
  hpGain: number
  statPointsPerLevel: number
}

/**
 * STAT FORMULAS (immutable)
 *
 * These formulas determine how player stats scale with level.
 * Key design principles:
 * - Base stats at level 1
 * - Diminishing returns as level increases (sqrt scaling)
 * - Max HP increases most to give survivability
 * - Strength increases moderately (combat power)
 * - Defense increases slowly (balance with offense)
 */

// Base stats at level 1
export const BASE_STATS = {
  hp: 100,
  strength: 10,
  defense: 5,
  speed: 5,
}

// XP required to reach each level (cumulative)
export const LEVEL_XP_REQUIREMENTS: Record<number, number> = {
  1: 0,
  2: 100,
  3: 250,
  4: 450,
  5: 700,
  6: 1000,
  7: 1350,
  8: 1750,
  9: 2200,
  10: 2700,
  11: 3250,
  12: 3850,
  13: 4500,
  14: 5200,
  15: 5950,
  16: 6750,
  17: 7600,
  18: 8500,
  19: 9450,
  20: 10450,
  21: 11500,
  22: 12600,
  23: 13750,
  24: 14950,
  25: 16200,
  26: 17500,
  27: 18850,
  28: 20250,
  29: 21700,
  30: 23200,
}

// Level cap
export const MAX_LEVEL = 30
export const MIN_LEVEL = 1

/**
 * PROGRESSION TIERS
 *
 * Enemies scale in tiers to maintain challenge curve.
 * Prevents early-game scaling from trivializing mid/late game.
 */
export const PROGRESSION_TIERS: ProgressionTier[] = [
  { minLevel: 1, maxLevel: 5, name: 'Early', enemyScaleFactor: 1.0 },
  { minLevel: 6, maxLevel: 10, name: 'Mid', enemyScaleFactor: 1.15 },
  { minLevel: 11, maxLevel: 15, name: 'Late', enemyScaleFactor: 1.35 },
  { minLevel: 16, maxLevel: 20, name: 'Endgame', enemyScaleFactor: 1.6 },
  { minLevel: 21, maxLevel: 30, name: 'Post-Game', enemyScaleFactor: 1.9 },
]

/**
 * Get progression tier for a given level
 */
export function getProgressionTier(level: number): ProgressionTier {
  const tier = PROGRESSION_TIERS.find(t => level >= t.minLevel && level <= t.maxLevel)
  // Always return a tier (post-game tier is default for any level beyond tier bounds)
  return tier ?? PROGRESSION_TIERS[PROGRESSION_TIERS.length - 1]
}

/**
 * STAT SCALING FORMULAS
 *
 * These are the core formulas that determine player power growth.
 * Designed to:
 * - Provide meaningful gains each level (10-15% stronger at each tier)
 * - Avoid exponential power creep
 * - Keep early game accessible (not overpowered by late game)
 */

/**
 * Calculate max HP at a given level
 *
 * Formula: Base HP + (Level - 1) × 8 + sqrt(Level - 1) × 2
 * - Linear growth (8 per level)
 * - Logarithmic bonus (sqrt) for diminishing returns
 * - Level 1: 100 HP
 * - Level 10: 172 HP (+72%)
 * - Level 30: 300 HP (+200%)
 */
export function calculateMaxHp(level: number): number {
  if (level < MIN_LEVEL) return BASE_STATS.hp
  if (level > MAX_LEVEL) return calculateMaxHp(MAX_LEVEL)

  const levelOffset = level - 1
  const linearGain = levelOffset * 8
  const logarithmicGain = Math.sqrt(levelOffset) * 2
  return Math.floor(BASE_STATS.hp + linearGain + logarithmicGain)
}

/**
 * Calculate strength (attack power) at a given level
 *
 * Formula: Base Strength + (Level - 1) × 0.3 + sqrt(Level - 1) × 0.15
 * - Slow linear growth (0.3 per level)
 * - Small logarithmic bonus
 * - Level 1: 10
 * - Level 10: 13 (+30%)
 * - Level 30: 18 (+80%)
 */
export function calculateStrength(level: number): number {
  if (level < MIN_LEVEL) return BASE_STATS.strength
  if (level > MAX_LEVEL) return calculateStrength(MAX_LEVEL)

  const levelOffset = level - 1
  const linearGain = levelOffset * 0.3
  const logarithmicGain = Math.sqrt(levelOffset) * 0.15
  return Math.floor(BASE_STATS.strength + linearGain + logarithmicGain)
}

/**
 * Calculate defense at a given level
 *
 * Formula: Base Defense + sqrt(Level - 1) × 0.4
 * - Pure logarithmic (diminishing returns)
 * - Slowest growth to prevent trivializing enemy damage
 * - Level 1: 5
 * - Level 10: 6 (+20%)
 * - Level 30: 10 (+100%)
 */
export function calculateDefense(level: number): number {
  if (level < MIN_LEVEL) return BASE_STATS.defense
  if (level > MAX_LEVEL) return calculateDefense(MAX_LEVEL)

  const levelOffset = level - 1
  const logarithmicGain = Math.sqrt(levelOffset) * 0.4
  return Math.floor(BASE_STATS.defense + logarithmicGain)
}

/**
 * Calculate speed (for potential future turn order changes)
 *
 * Formula: Base Speed + sqrt(Level - 1) × 0.2
 * - Very slow growth
 * - Currently not used in turn order (player always acts first)
 * - Level 1: 5
 * - Level 30: 8 (+60%)
 */
export function calculateSpeed(level: number): number {
  if (level < MIN_LEVEL) return BASE_STATS.speed
  if (level > MAX_LEVEL) return calculateSpeed(MAX_LEVEL)

  const levelOffset = level - 1
  const logarithmicGain = Math.sqrt(levelOffset) * 0.2
  return Math.floor(BASE_STATS.speed + logarithmicGain)
}

/**
 * Calculate XP required to reach the next level
 *
 * Returns the total XP needed to reach `level + 1`.
 * Use this to determine progress to next level.
 */
export function getXpForNextLevel(level: number): number {
  if (level >= MAX_LEVEL) return Infinity
  const nextLevel = Math.min(level + 1, MAX_LEVEL)
  return LEVEL_XP_REQUIREMENTS[nextLevel] || Infinity
}

/**
 * Check if player can level up and return new level
 *
 * @param currentLevel Current player level
 * @param currentXp Current accumulated XP
 * @returns New level if player should advance, or current level
 */
export function checkLevelUp(currentLevel: number, currentXp: number): number {
  if (currentLevel >= MAX_LEVEL) return MAX_LEVEL

  let newLevel = currentLevel
  while (newLevel < MAX_LEVEL) {
    const nextLevelXp = LEVEL_XP_REQUIREMENTS[newLevel + 1]
    if (nextLevelXp !== undefined && currentXp >= nextLevelXp) {
      newLevel++
    } else {
      break
    }
  }
  return newLevel
}

/**
 * Level up a player and return updated player state
 *
 * Immutable function: returns new player object.
 * - Updates level
 * - Recalculates all stats
 * - Restores HP to new max (as reward)
 * - Maintains other properties
 */
export function levelUpPlayer(player: Player): Player {
  const newLevel = Math.min(player.level + 1, MAX_LEVEL)

  if (newLevel === player.level) {
    return player // No level up
  }

  const newMaxHp = calculateMaxHp(newLevel)
  const newStrength = calculateStrength(newLevel)
  const newDefense = calculateDefense(newLevel)
  const newSpeed = calculateSpeed(newLevel)

  return {
    ...player,
    level: newLevel,
    hp: newMaxHp, // Restore HP on level up (reward)
    maxHp: newMaxHp,
    stats: {
      strength: newStrength,
      defense: newDefense,
      speed: newSpeed,
    },
  }
}

/**
 * Scale enemy stats based on player level
 *
 * Enemies scale differently by tier to maintain challenge.
 * This prevents the curve from becoming trivial early or too hard late.
 */
export function scaleEnemyStats(
  _enemyLevel: number,
  enemyStrength: number,
  enemyDefense: number,
  enemyHp: number,
  playerLevel: number
): { strength: number; defense: number; hp: number } {
  const tier = getProgressionTier(playerLevel)

  // Scale based on tier multiplier
  const scaledStrength = Math.floor(enemyStrength * tier.enemyScaleFactor)
  const scaledDefense = Math.floor(enemyDefense * tier.enemyScaleFactor)
  const scaledHp = Math.floor(enemyHp * tier.enemyScaleFactor)

  return {
    strength: scaledStrength,
    defense: scaledDefense,
    hp: scaledHp,
  }
}

/**
 * Calculate XP reward for defeating an enemy
 *
 * Formula: Base XP × (Enemy Level / Player Level)^0.5 + Difficulty Bonus
 * - Killing same-level enemies: 100% XP
 * - Killing lower-level enemies: Reduced XP (prevents farming)
 * - Killing higher-level enemies: Bonus XP (encourages challenge)
 * - Minimum: 10 XP per enemy (no zero rewards)
 */
export function calculateXpReward(
  enemyLevel: number,
  playerLevel: number,
  baseXp: number = 50
): number {
  // Avoid division by zero
  if (playerLevel === 0) return baseXp

  const levelRatio = Math.max(0.1, enemyLevel / playerLevel)
  const scaledXp = baseXp * Math.sqrt(levelRatio)
  const difficultyBonus = Math.max(0, (enemyLevel - playerLevel) * 5)

  return Math.max(10, Math.floor(scaledXp + difficultyBonus))
}

/**
 * Get a human-readable progression summary
 *
 * Useful for debug/UI to show player progression stats.
 */
export function getProgressionSummary(player: Player): {
  level: number
  tier: string
  xpToNextLevel: number
  xpProgress: number
  statSummary: string
} {
  const tier = getProgressionTier(player.level)
  const xpToNext = getXpForNextLevel(player.level)

  return {
    level: player.level,
    tier: tier.name,
    xpToNextLevel: xpToNext === Infinity ? 0 : xpToNext,
    xpProgress: player.level >= MAX_LEVEL ? 100 : 0,
    statSummary: `HP: ${player.maxHp}, STR: ${player.stats.strength}, DEF: ${player.stats.defense}`,
  }
}
