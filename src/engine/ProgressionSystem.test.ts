/**
 * Progression System Tests
 *
 * Validates stat formulas, level progression, and power balance
 */

import { describe, it, expect } from 'vitest'
import {
  calculateMaxHp,
  calculateStrength,
  calculateDefense,
  calculateSpeed,
  calculateXpReward,
  checkLevelUp,
  getXpForNextLevel,
  levelUpPlayer,
  scaleEnemyStats,
  getProgressionTier,
  getProgressionSummary,
  BASE_STATS,
  MAX_LEVEL,
  LEVEL_XP_REQUIREMENTS,
} from './ProgressionSystem'
import type { Player } from './GameLoopDesign'

describe('Stat Formulas', () => {
  describe('calculateMaxHp', () => {
    it('should return base HP at level 1', () => {
      expect(calculateMaxHp(1)).toBe(100)
    })

    it('should increase HP with level', () => {
      expect(calculateMaxHp(2)).toBeGreaterThan(calculateMaxHp(1))
      expect(calculateMaxHp(10)).toBeGreaterThan(calculateMaxHp(5))
    })

    it('should cap at MAX_LEVEL', () => {
      const levelCappedHp = calculateMaxHp(MAX_LEVEL)
      expect(calculateMaxHp(MAX_LEVEL + 5)).toBe(levelCappedHp)
    })

    it('should show diminishing returns at high levels', () => {
      const hpGain1to5 = calculateMaxHp(5) - calculateMaxHp(1)
      const hpGain26to30 = calculateMaxHp(30) - calculateMaxHp(26)
      expect(hpGain1to5).toBeGreaterThan(hpGain26to30)
    })

    it('should reach 342 HP at level 30', () => {
      // 100 + (30-1)*8 + sqrt(29)*2 = 100 + 232 + 10.78... = 342
      expect(calculateMaxHp(30)).toBe(342)
    })
  })

  describe('calculateStrength', () => {
    it('should return base strength at level 1', () => {
      expect(calculateStrength(1)).toBe(10)
    })

    it('should grow slowly to prevent damage creep', () => {
      const level10 = calculateStrength(10)
      const level30 = calculateStrength(30)
      expect(level30 - level10).toBeLessThanOrEqual(10)
    })

    it('should reach 19 at level 30', () => {
      expect(calculateStrength(30)).toBe(19)
    })
  })

  describe('calculateDefense', () => {
    it('should return base defense at level 1', () => {
      expect(calculateDefense(1)).toBe(5)
    })

    it('should grow slowest of all stats', () => {
      const defenseGain = calculateDefense(30) - calculateDefense(1)
      const strengthGain = calculateStrength(30) - calculateStrength(1)
      const hpGain = calculateMaxHp(30) - calculateMaxHp(1)
      expect(defenseGain).toBeLessThan(strengthGain)
      expect(defenseGain).toBeLessThan(hpGain / 20)
    })

    it('should reach 7 at level 30', () => {
      // 5 + sqrt(29)*0.4 = 5 + 2.15... = 7
      expect(calculateDefense(30)).toBe(7)
    })
  })

  describe('calculateSpeed', () => {
    it('should return base speed at level 1', () => {
      expect(calculateSpeed(1)).toBe(5)
    })

    it('should grow minimally', () => {
      const speedGain = calculateSpeed(30) - calculateSpeed(1)
      expect(speedGain).toBeLessThan(5)
    })
  })
})

describe('Level Progression', () => {
  describe('checkLevelUp', () => {
    it('should not level up without enough XP', () => {
      expect(checkLevelUp(1, 50)).toBe(1)
      expect(checkLevelUp(1, 99)).toBe(1)
    })

    it('should level up at XP threshold', () => {
      expect(checkLevelUp(1, 100)).toBe(2)
      expect(checkLevelUp(1, 150)).toBe(2)
    })

    it('should support multiple level-ups', () => {
      expect(checkLevelUp(1, 500)).toBe(4)
      expect(checkLevelUp(1, 1000)).toBe(6)
    })

    it('should cap at MAX_LEVEL', () => {
      expect(checkLevelUp(30, 999999)).toBe(30)
    })
  })

  describe('getXpForNextLevel', () => {
    it('should return XP requirement for next level', () => {
      expect(getXpForNextLevel(1)).toBe(100)
      expect(getXpForNextLevel(5)).toBe(1000)
      expect(getXpForNextLevel(6)).toBe(1350)
    })

    it('should return Infinity at MAX_LEVEL', () => {
      expect(getXpForNextLevel(MAX_LEVEL)).toBe(Infinity)
    })

    it('should increase with level', () => {
      expect(getXpForNextLevel(10)).toBeGreaterThan(getXpForNextLevel(5))
      expect(getXpForNextLevel(20)).toBeGreaterThan(getXpForNextLevel(10))
    })
  })

  describe('levelUpPlayer', () => {
    const createPlayer = (level: number = 1): Player => ({
      id: 'player_1',
      name: 'Test Player',
      hp: 100,
      maxHp: 100,
      level,
      xp: 0,
      inventory: [],
      stats: {
        strength: BASE_STATS.strength,
        defense: BASE_STATS.defense,
        speed: BASE_STATS.speed,
      },
    })

    it('should increment level', () => {
      const player = createPlayer(1)
      const leveled = levelUpPlayer(player)
      expect(leveled.level).toBe(2)
    })

    it('should recalculate all stats', () => {
      const player = createPlayer(1)
      const leveled = levelUpPlayer(player)
      expect(leveled.stats.strength).toBeGreaterThanOrEqual(player.stats.strength)
      expect(leveled.stats.defense).toBeGreaterThanOrEqual(player.stats.defense)
      expect(leveled.maxHp).toBeGreaterThan(player.maxHp)
    })

    it('should restore HP as reward', () => {
      const player = createPlayer(5)
      player.hp = 10 // Damaged
      const leveled = levelUpPlayer(player)
      expect(leveled.hp).toBe(leveled.maxHp)
    })

    it('should not level up if at MAX_LEVEL', () => {
      const player = createPlayer(MAX_LEVEL)
      const leveled = levelUpPlayer(player)
      expect(leveled.level).toBe(MAX_LEVEL)
    })

    it('should be immutable', () => {
      const player = createPlayer(1)
      const leveled = levelUpPlayer(player)
      expect(player.level).toBe(1)
      expect(leveled.level).toBe(2)
    })
  })
})

describe('Enemy Scaling', () => {
  describe('scaleEnemyStats', () => {
    it('should not scale at early tier (×1.0)', () => {
      const scaled = scaleEnemyStats(5, 10, 3, 20, 3)
      expect(scaled.strength).toBe(10)
      expect(scaled.defense).toBe(3)
      expect(scaled.hp).toBe(20)
    })

    it('should apply tier multiplier for mid tier (×1.15)', () => {
      const scaled = scaleEnemyStats(10, 10, 3, 20, 8)
      expect(scaled.strength).toBe(11) // 10 × 1.15 = 11.5 → 11
      expect(scaled.defense).toBe(3) // 3 × 1.15 = 3.45 → 3
      expect(scaled.hp).toBe(23) // 20 × 1.15 = 23
    })

    it('should apply tier multiplier for late tier (×1.35)', () => {
      const scaled = scaleEnemyStats(12, 10, 3, 20, 14)
      expect(scaled.strength).toBe(13) // 10 × 1.35 = 13.5 → 13
      expect(scaled.hp).toBe(27) // 20 × 1.35 = 27
    })

    it('should apply tier multiplier for endgame tier (×1.6)', () => {
      const scaled = scaleEnemyStats(15, 10, 3, 20, 18)
      expect(scaled.strength).toBe(16) // 10 × 1.6 = 16
      expect(scaled.hp).toBe(32) // 20 × 1.6 = 32
    })
  })

  describe('getProgressionTier', () => {
    it('should return Early tier for levels 1-5', () => {
      const tier = getProgressionTier(3)
      expect(tier.name).toBe('Early')
      expect(tier.enemyScaleFactor).toBe(1.0)
    })

    it('should return Mid tier for levels 6-10', () => {
      const tier = getProgressionTier(8)
      expect(tier.name).toBe('Mid')
      expect(tier.enemyScaleFactor).toBe(1.15)
    })

    it('should return endgame tier for levels 21-30', () => {
      const tier = getProgressionTier(25)
      expect(tier.name).toBe('Post-Game')
      expect(tier.enemyScaleFactor).toBe(1.9)
    })
  })
})

describe('XP Rewards', () => {
  describe('calculateXpReward', () => {
    it('should give base 50 XP for same-level enemy', () => {
      expect(calculateXpReward(5, 5)).toBe(50)
    })

    it('should penalize farming lower-level enemies', () => {
      const sameLevel = calculateXpReward(5, 5, 50)
      const lowerLevel = calculateXpReward(3, 5, 50)
      expect(lowerLevel).toBeLessThan(sameLevel)
    })

    it('should bonus for challenging higher-level enemies', () => {
      const sameLevel = calculateXpReward(5, 5, 50)
      const higherLevel = calculateXpReward(7, 5, 50)
      expect(higherLevel).toBeGreaterThan(sameLevel)
    })

    it('should enforce minimum 10 XP', () => {
      expect(calculateXpReward(1, 30, 50)).toBeGreaterThanOrEqual(10)
    })

    it('should use custom baseXp', () => {
      const xp50 = calculateXpReward(5, 5, 50)
      const xp100 = calculateXpReward(5, 5, 100)
      expect(xp100).toBeGreaterThan(xp50)
    })
  })
})

describe('Progression Summary', () => {
  const createPlayer = (level: number = 1): Player => ({
    id: 'player_1',
    name: 'Test Player',
    hp: calculateMaxHp(level),
    maxHp: calculateMaxHp(level),
    level,
    xp: 0,
    inventory: [],
    stats: {
      strength: calculateStrength(level),
      defense: calculateDefense(level),
      speed: calculateSpeed(level),
    },
  })

  it('should provide human-readable progression data', () => {
    const player = createPlayer(5)
    const summary = getProgressionSummary(player)
    expect(summary.level).toBe(5)
    expect(summary.tier).toBe('Early')
    expect(summary.statSummary).toContain('HP:')
  })

  it('should show XP to next level', () => {
    const player = createPlayer(5)
    const summary = getProgressionSummary(player)
    expect(summary.xpToNextLevel).toBe(1000) // Level 6 requirement
  })

  it('should cap XP progress at MAX_LEVEL', () => {
    const player = createPlayer(MAX_LEVEL)
    const summary = getProgressionSummary(player)
    expect(summary.xpToNextLevel).toBe(0)
  })
})

describe('Power Balance Verification', () => {
  it('should maintain reasonable damage-to-defense ratio', () => {
    for (let level = 1; level <= 30; level += 5) {
      const str = calculateStrength(level)
      const def = calculateDefense(level)
      // Damage should always be significantly higher than defense
      expect(str).toBeGreaterThan(def * 1.5)
    }
  })

  it('should ensure HP grows faster than damage', () => {
    const hpRatio = calculateMaxHp(30) / calculateMaxHp(1)
    const damageRatio = calculateStrength(30) / calculateStrength(1)
    expect(hpRatio).toBeGreaterThan(damageRatio)
  })

  it('should prevent early levels from trivializing damage', () => {
    const level1Damage = calculateStrength(1)
    // Base damage (10) is 1/10 of base HP (100), which is acceptable
    expect(level1Damage).toBeLessThanOrEqual(BASE_STATS.hp / 10)
  })

  it('should prevent late levels from making defense useless', () => {
    const level30Def = calculateDefense(30)
    const level30Damage = calculateStrength(30)
    // Defense should still matter: damage > def but not by huge margin
    expect(level30Damage / level30Def).toBeLessThan(3)
    expect(level30Damage / level30Def).toBeGreaterThan(1.5)
  })
})
