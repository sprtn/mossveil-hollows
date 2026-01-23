/**
 * Unit tests for Encounter Manager
 *
 * Tests loot drop weighted selection and encounter resolution
 */

import { describe, it, expect } from 'vitest'
import {
  resolveCombatEncounter,
  type EnemyTemplate,
} from './EncounterManager'
import type { ItemDrop } from './EncounterSystem'

describe('EncounterManager', () => {
  describe('resolveCombatEncounter', () => {
    const createEnemyWithLoot = (loot: ItemDrop[]): EnemyTemplate => ({
      id: 'test_enemy',
      name: 'Test Enemy',
      hp: 20,
      baseStrength: 5,
      baseDefense: 2,
      baseSpeed: 5,
      loot,
    })

    it('should use weighted selection for loot drops', () => {
      const enemy = createEnemyWithLoot([
        { id: 'common_item', weight: 0.8 }, // 80% chance
        { id: 'rare_item', weight: 0.2 },   // 20% chance
      ])

      const seed1 = 1000
      const seed2 = 2000

      const result1 = resolveCombatEncounter('win', [enemy], 1, seed1)
      const result2 = resolveCombatEncounter('win', [enemy], 1, seed2)

      // Both should have exactly one item (one drop per enemy)
      expect(result1.itemsLooted.length).toBe(1)
      expect(result2.itemsLooted.length).toBe(1)

      // Items should be valid loot IDs
      expect(['common_item', 'rare_item']).toContain(result1.itemsLooted[0])
      expect(['common_item', 'rare_item']).toContain(result2.itemsLooted[0])
    })

    it('should be deterministic with same seed', () => {
      const enemy = createEnemyWithLoot([
        { id: 'item_a', weight: 0.5 },
        { id: 'item_b', weight: 0.5 },
      ])

      const seed = 12345

      const result1 = resolveCombatEncounter('win', [enemy], 1, seed)
      const result2 = resolveCombatEncounter('win', [enemy], 1, seed)

      expect(result1.itemsLooted).toEqual(result2.itemsLooted)
      expect(result1.goldEarned).toBe(result2.goldEarned)
      expect(result1.experienceEarned).toBe(result2.experienceEarned)
    })

    it('should respect item quantities', () => {
      const enemy = createEnemyWithLoot([
        { id: 'gold_coin', weight: 1.0, quantity: 5 },
      ])

      const result = resolveCombatEncounter('win', [enemy], 1, 1000)

      expect(result.itemsLooted.length).toBe(5)
      expect(result.itemsLooted.every((id) => id === 'gold_coin')).toBe(true)
    })

    it('should not drop loot on loss', () => {
      const enemy = createEnemyWithLoot([
        { id: 'item', weight: 1.0 },
      ])

      const result = resolveCombatEncounter('loss', [enemy], 1, 1000)

      expect(result.itemsLooted.length).toBe(0)
      expect(result.goldEarned).toBe(0)
      expect(result.experienceEarned).toBe(0)
    })

    it('should give partial XP on flee', () => {
      const enemy = createEnemyWithLoot([])

      const winResult = resolveCombatEncounter('win', [enemy], 1, 1000)
      const fleeResult = resolveCombatEncounter('fled', [enemy], 1, 1000)

      // Flee should give 25% of win XP
      expect(fleeResult.experienceEarned).toBe(Math.ceil(winResult.experienceEarned * 0.25))
      expect(fleeResult.itemsLooted.length).toBe(0)
    })

    it('should calculate gold based on enemy strength and difficulty', () => {
      const weakEnemy = createEnemyWithLoot([])
      weakEnemy.baseStrength = 5

      const strongEnemy = createEnemyWithLoot([])
      strongEnemy.baseStrength = 15

      const weakResult = resolveCombatEncounter('win', [weakEnemy], 1, 1000)
      const strongResult = resolveCombatEncounter('win', [strongEnemy], 3, 1000)

      // Strong enemy + higher difficulty should give more gold
      expect(strongResult.goldEarned).toBeGreaterThan(weakResult.goldEarned)
    })

    it('should handle enemies with no loot', () => {
      const enemy = createEnemyWithLoot([])

      const result = resolveCombatEncounter('win', [enemy], 1, 1000)

      expect(result.itemsLooted.length).toBe(0)
      expect(result.goldEarned).toBeGreaterThan(0) // Should still give gold
      expect(result.experienceEarned).toBeGreaterThan(0) // Should still give XP
    })

    it('should handle multiple enemies', () => {
      const enemy1 = createEnemyWithLoot([{ id: 'item1', weight: 1.0 }])
      const enemy2 = createEnemyWithLoot([{ id: 'item2', weight: 1.0 }])

      const result = resolveCombatEncounter('win', [enemy1, enemy2], 1, 1000)

      // Should get loot from both enemies
      expect(result.itemsLooted.length).toBe(2)
      expect(result.itemsLooted).toContain('item1')
      expect(result.itemsLooted).toContain('item2')
    })
  })
})
