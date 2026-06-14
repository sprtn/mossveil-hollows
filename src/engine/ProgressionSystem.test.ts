/**
 * Progression System Tests
 */

import { describe, it, expect } from 'vitest'
import {
  calculateMaxHp,
  calculateStrength,
  calculateDefense,
  calculateAgility,
  calculateXpReward,
  checkLevelUp,
} from './ProgressionSystem'

describe('Stat Formulas', () => {
  describe('calculateMaxHp', () => {
    it('should return base HP at level 1', () => {
      expect(calculateMaxHp(1)).toBe(40)
    })

    it('should increase with constitution', () => {
      expect(calculateMaxHp(1, 12)).toBe(46)
    })

    it('should grow linearly (+6 per level)', () => {
      expect(calculateMaxHp(5) - calculateMaxHp(1)).toBe(24)
    })
  })

  describe('calculateStrength', () => {
    it('should return base strength at level 1', () => {
      expect(calculateStrength(1)).toBe(10)
    })
  })

  describe('calculateDefense', () => {
    it('should return base defense at level 1', () => {
      expect(calculateDefense(1)).toBe(1)
    })
  })

  describe('calculateAgility', () => {
    it('should return base agility at level 1', () => {
      expect(calculateAgility(1)).toBe(8)
    })
  })
})

describe('Level Progression', () => {
  describe('checkLevelUp', () => {
    it('should level up at XP threshold', () => {
      expect(checkLevelUp(1, 100)).toBe(2)
    })

    it('should cap at MAX_LEVEL', () => {
      expect(checkLevelUp(30, 999999)).toBe(30)
    })
  })
})

describe('XP Rewards', () => {
  it('should give base 50 XP for same-level enemy', () => {
    expect(calculateXpReward(5, 5)).toBe(50)
  })
})

describe('Power Balance Verification', () => {
  it('should maintain reasonable damage-to-defense ratio', () => {
    for (let level = 1; level <= 30; level += 5) {
      const str = calculateStrength(level)
      const def = calculateDefense(level)
      expect(str).toBeGreaterThan(def * 1.5)
    }
  })
})
