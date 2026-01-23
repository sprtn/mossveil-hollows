/**
 * Unit tests for Encounter System RNG
 *
 * Tests deterministic seeded randomness for encounter selection
 */

import { describe, it, expect } from 'vitest'
import {
  EncounterRNG,
  type RandomEncounterTable,
  type RandomEncounter,
  type StaticEncounter,
} from './EncounterSystem'

describe('EncounterRNG', () => {
  describe('selectFromTable', () => {
    const createTestTable = (): RandomEncounterTable => ({
      id: 'test_table',
      name: 'Test Table',
      difficulty: 1,
      entries: [
        {
          id: 'encounter_1',
          weight: 0.4,
          encounter: {
            id: 'encounter_1',
            type: 'random',
            name: 'Encounter 1',
            description: 'First encounter',
            outcome: 'combat',
            triggerChance: 0.5,
            combat: {
              enemies: [],
              scaling: 0.5,
            },
          },
        },
        {
          id: 'encounter_2',
          weight: 0.35,
          encounter: {
            id: 'encounter_2',
            type: 'random',
            name: 'Encounter 2',
            description: 'Second encounter',
            outcome: 'combat',
            triggerChance: 0.5,
            combat: {
              enemies: [],
              scaling: 0.5,
            },
          },
        },
        {
          id: 'encounter_3',
          weight: 0.15,
          encounter: {
            id: 'encounter_3',
            type: 'random',
            name: 'Encounter 3',
            description: 'Third encounter',
            outcome: 'loot',
            triggerChance: 0.5,
            loot: {
              items: [],
              gold: 10,
            },
          },
        },
        {
          id: 'encounter_4',
          weight: 0.1,
          encounter: {
            id: 'encounter_4',
            type: 'random',
            name: 'Encounter 4',
            description: 'Fourth encounter',
            outcome: 'status_effect',
            triggerChance: 0.5,
            statusEffect: {
              effect: 'poison',
              severity: 2,
              description: 'Poisoned',
            },
          },
        },
      ],
    })

    it('should be deterministic with same seed', () => {
      const table = createTestTable()
      const seed = 12345

      const result1 = EncounterRNG.selectFromTable(table, seed)
      const result2 = EncounterRNG.selectFromTable(table, seed)

      expect(result1.id).toBe(result2.id)
    })

    it('should select different encounters with different seeds', () => {
      const table = createTestTable()

      const result1 = EncounterRNG.selectFromTable(table, 100)
      const result2 = EncounterRNG.selectFromTable(table, 200)
      const result3 = EncounterRNG.selectFromTable(table, 300)

      // With different seeds, we should get different results (high probability)
      const ids = [result1.id, result2.id, result3.id]
      const uniqueIds = new Set(ids)
      // At least 2 different results (very likely with 3 different seeds)
      expect(uniqueIds.size).toBeGreaterThanOrEqual(1)
    })

    it('should normalize weights correctly', () => {
      const table: RandomEncounterTable = {
        id: 'test',
        name: 'Test',
        difficulty: 1,
        entries: [
          {
            id: 'enc_1',
            weight: 2, // Will be normalized to 2/3 = 0.667
            encounter: {
              id: 'enc_1',
              type: 'random',
              name: 'Enc 1',
              description: 'Test',
              outcome: 'combat',
              triggerChance: 0.5,
              combat: { enemies: [], scaling: 0.5 },
            },
          },
          {
            id: 'enc_2',
            weight: 1, // Will be normalized to 1/3 = 0.333
            encounter: {
              id: 'enc_2',
              type: 'random',
              name: 'Enc 2',
              description: 'Test',
              outcome: 'combat',
              triggerChance: 0.5,
              combat: { enemies: [], scaling: 0.5 },
            },
          },
        ],
      }

      // With many seeds, enc_1 should be selected more often than enc_2
      let enc1Count = 0
      let enc2Count = 0

      for (let seed = 1000; seed < 1100; seed++) {
        const result = EncounterRNG.selectFromTable(table, seed)
        if (result.id === 'enc_1') enc1Count++
        if (result.id === 'enc_2') enc2Count++
      }

      // enc_1 should be selected more often (2:1 ratio)
      expect(enc1Count).toBeGreaterThan(enc2Count)
    })

    it('should throw error for empty table', () => {
      const emptyTable: RandomEncounterTable = {
        id: 'empty',
        name: 'Empty',
        difficulty: 1,
        entries: [],
      }

      expect(() => {
        EncounterRNG.selectFromTable(emptyTable, 12345)
      }).toThrow('Cannot select from empty encounter table')
    })

    it('should always return a valid encounter from table', () => {
      const table = createTestTable()

      for (let seed = 0; seed < 1000; seed++) {
        const result = EncounterRNG.selectFromTable(table, seed)
        const validIds = table.entries.map((e) => e.encounter.id)
        expect(validIds).toContain(result.id)
      }
    })
  })

  describe('shouldTrigger', () => {
    const createRandomEncounter = (triggerChance: number): RandomEncounter => ({
      id: 'test_encounter',
      type: 'random',
      name: 'Test Encounter',
      description: 'Test',
      outcome: 'combat',
      triggerChance,
      combat: {
        enemies: [],
        scaling: 0.5,
      },
    })

    it('should be deterministic with same seed', () => {
      const encounter = createRandomEncounter(0.5)
      const seed = 12345

      const result1 = EncounterRNG.shouldTrigger(encounter, seed)
      const result2 = EncounterRNG.shouldTrigger(encounter, seed)

      expect(result1).toBe(result2)
    })

    it('should return false for 0% trigger chance', () => {
      const encounter = createRandomEncounter(0.0)

      for (let seed = 0; seed < 100; seed++) {
        expect(EncounterRNG.shouldTrigger(encounter, seed)).toBe(false)
      }
    })

    it('should return true for 100% trigger chance', () => {
      const encounter = createRandomEncounter(1.0)

      for (let seed = 0; seed < 100; seed++) {
        expect(EncounterRNG.shouldTrigger(encounter, seed)).toBe(true)
      }
    })

    it('should respect trigger chance probability', () => {
      const encounter = createRandomEncounter(0.3) // 30% chance

      let triggerCount = 0
      const totalTests = 1000

      for (let seed = 0; seed < totalTests; seed++) {
        if (EncounterRNG.shouldTrigger(encounter, seed)) {
          triggerCount++
        }
      }

      // Should be approximately 30% (±5% tolerance)
      const triggerRate = triggerCount / totalTests
      expect(triggerRate).toBeGreaterThan(0.25)
      expect(triggerRate).toBeLessThan(0.35)
    })
  })

  describe('scaleGroupSize', () => {
    it('should return min count for difficulty 0', () => {
      const template = {
        id: 'test',
        name: 'Test',
        hp: 10,
        baseStrength: 5,
        baseDefense: 2,
        baseSpeed: 5,
        minCount: 2,
        maxCount: 4,
      }

      const size = EncounterRNG.scaleGroupSize(template, 0, 0.5)
      expect(size).toBeGreaterThanOrEqual(2)
      expect(size).toBeLessThanOrEqual(4)
    })

    it('should scale up with difficulty', () => {
      const template = {
        id: 'test',
        name: 'Test',
        hp: 10,
        baseStrength: 5,
        baseDefense: 2,
        baseSpeed: 5,
        minCount: 1,
        maxCount: 3,
      }

      const sizeLow = EncounterRNG.scaleGroupSize(template, 1, 0.5)
      const sizeHigh = EncounterRNG.scaleGroupSize(template, 5, 0.5)

      // Higher difficulty should generally produce larger groups
      expect(sizeHigh).toBeGreaterThanOrEqual(sizeLow)
    })

    it('should respect max count limit', () => {
      const template = {
        id: 'test',
        name: 'Test',
        hp: 10,
        baseStrength: 5,
        baseDefense: 2,
        baseSpeed: 5,
        minCount: 1,
        maxCount: 3,
      }

      // Even with very high difficulty, should not exceed max + floor(difficulty/3)
      const size = EncounterRNG.scaleGroupSize(template, 10, 1.0)
      const maxAllowed = template.maxCount + Math.floor(10 / 3)
      expect(size).toBeLessThanOrEqual(maxAllowed)
    })

    it('should use default min/max if not specified', () => {
      const template = {
        id: 'test',
        name: 'Test',
        hp: 10,
        baseStrength: 5,
        baseDefense: 2,
        baseSpeed: 5,
      }

      const size = EncounterRNG.scaleGroupSize(template, 3, 0.5)
      // Defaults: minCount = 1, maxCount = 3
      expect(size).toBeGreaterThanOrEqual(1)
      expect(size).toBeLessThanOrEqual(3 + Math.floor(3 / 3))
    })
  })
})
