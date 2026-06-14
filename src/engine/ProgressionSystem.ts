/**
 * Player Progression System — five-attribute scaling.
 */

import type { PlayerStats } from './GameLoopDesign'

export const BASE_STATS: PlayerStats & { hp: number } = {
  hp: 10,
  strength: 10,
  constitution: 10,
  dexterity: 8,
  agility: 8,
  defense: 1,
}

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

export const MAX_LEVEL = 30
export const MIN_LEVEL = 1

/** Max HP from base HP, constitution (3 HP per CON), and level. */
export function calculateMaxHp(level: number, constitution = BASE_STATS.constitution): number {
  if (level < MIN_LEVEL) return BASE_STATS.hp + constitution * 3
  if (level > MAX_LEVEL) return calculateMaxHp(MAX_LEVEL, constitution)
  const levelHp = (level - 1) * 6
  const conHp = constitution * 3
  return Math.floor(BASE_STATS.hp + conHp + levelHp)
}

export function calculateStrength(level: number): number {
  if (level < MIN_LEVEL) return BASE_STATS.strength
  if (level > MAX_LEVEL) return calculateStrength(MAX_LEVEL)
  const levelOffset = level - 1
  return Math.floor(BASE_STATS.strength + levelOffset * 0.3 + Math.sqrt(levelOffset) * 0.15)
}

export function calculateConstitution(level: number): number {
  if (level < MIN_LEVEL) return BASE_STATS.constitution
  if (level > MAX_LEVEL) return calculateConstitution(MAX_LEVEL)
  const levelOffset = level - 1
  return Math.floor(BASE_STATS.constitution + levelOffset * 0.25 + Math.sqrt(levelOffset) * 0.1)
}

export function calculateDexterity(level: number): number {
  if (level < MIN_LEVEL) return BASE_STATS.dexterity
  if (level > MAX_LEVEL) return calculateDexterity(MAX_LEVEL)
  const levelOffset = level - 1
  return Math.floor(BASE_STATS.dexterity + levelOffset * 0.2 + Math.sqrt(levelOffset) * 0.1)
}

export function calculateAgility(level: number): number {
  if (level < MIN_LEVEL) return BASE_STATS.agility
  if (level > MAX_LEVEL) return calculateAgility(MAX_LEVEL)
  const levelOffset = level - 1
  return Math.floor(BASE_STATS.agility + levelOffset * 0.2 + Math.sqrt(levelOffset) * 0.1)
}

export function calculateDefense(level: number): number {
  if (level < MIN_LEVEL) return BASE_STATS.defense
  if (level > MAX_LEVEL) return calculateDefense(MAX_LEVEL)
  const levelOffset = level - 1
  return Math.floor(BASE_STATS.defense + Math.sqrt(levelOffset) * 0.4)
}

export function getBaseStatsForLevel(level: number): PlayerStats {
  return {
    strength: calculateStrength(level),
    constitution: calculateConstitution(level),
    dexterity: calculateDexterity(level),
    agility: calculateAgility(level),
    defense: calculateDefense(level),
  }
}

export function getXpForNextLevel(level: number): number {
  if (level >= MAX_LEVEL) return Infinity
  const nextLevel = Math.min(level + 1, MAX_LEVEL)
  return LEVEL_XP_REQUIREMENTS[nextLevel] || Infinity
}

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

export function calculateXpReward(
  enemyLevel: number,
  playerLevel: number,
  baseXp: number = 50
): number {
  if (playerLevel === 0) return baseXp
  const levelRatio = Math.max(0.1, enemyLevel / playerLevel)
  const scaledXp = baseXp * Math.sqrt(levelRatio)
  const difficultyBonus = Math.max(0, (enemyLevel - playerLevel) * 5)
  return Math.max(10, Math.floor(scaledXp + difficultyBonus))
}
