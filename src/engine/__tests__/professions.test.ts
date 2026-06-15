import { describe, it, expect } from 'vitest'
import { createDefaultPlayer } from '../CombatEngine'
import {
  PROFESSION_IDS,
  PROFESSION_LEVEL_XP_REQUIREMENTS,
  MAX_PROFESSION_LEVEL,
  MIN_PROFESSION_LEVEL,
  xpForLevel,
  grantProfessionXp,
  normalizePlayerProfessions,
  createDefaultProfessions,
} from '../Professions'

describe('Professions', () => {
  describe('xpForLevel', () => {
    it('is monotonically non-decreasing across defined levels', () => {
      const levels = Object.keys(PROFESSION_LEVEL_XP_REQUIREMENTS)
        .map(Number)
        .sort((a, b) => a - b)
      for (let i = 1; i < levels.length; i++) {
        const prev = levels[i - 1]!
        const curr = levels[i]!
        expect(xpForLevel(curr)).toBeGreaterThanOrEqual(xpForLevel(prev))
      }
    })

    it('strictly increases after level 1', () => {
      for (let level = MIN_PROFESSION_LEVEL + 1; level <= MAX_PROFESSION_LEVEL; level++) {
        expect(xpForLevel(level)).toBeGreaterThan(xpForLevel(level - 1))
      }
    })
  })

  describe('grantProfessionXp', () => {
    it('grants XP without leveling when below threshold', () => {
      const player = createDefaultPlayer()
      const result = grantProfessionXp(player, 'forestry', 30)
      expect(result.xpGained).toBe(30)
      expect(result.leveledUp).toBe(false)
      expect(result.newLevel).toBe(1)
      expect(result.player.professions.forestry).toEqual({ xp: 30, level: 1 })
    })

    it('levels up once when crossing a threshold', () => {
      const player = createDefaultPlayer()
      const result = grantProfessionXp(player, 'mining', 50)
      expect(result.leveledUp).toBe(true)
      expect(result.newLevel).toBe(2)
      expect(result.player.professions.mining).toEqual({ xp: 50, level: 2 })
    })

    it('can gain multiple levels from a single grant', () => {
      const player = createDefaultPlayer()
      const result = grantProfessionXp(player, 'herbalism', 330)
      expect(result.leveledUp).toBe(true)
      expect(result.newLevel).toBe(5)
      expect(result.player.professions.herbalism).toEqual({ xp: 330, level: 5 })
    })

    it('clamps at MAX_PROFESSION_LEVEL and ignores further XP grants', () => {
      let player = createDefaultPlayer()
      player = {
        ...player,
        professions: {
          ...player.professions,
          smithing: { xp: PROFESSION_LEVEL_XP_REQUIREMENTS[MAX_PROFESSION_LEVEL]!, level: MAX_PROFESSION_LEVEL },
        },
      }
      const result = grantProfessionXp(player, 'smithing', 500)
      expect(result.leveledUp).toBe(false)
      expect(result.newLevel).toBe(MAX_PROFESSION_LEVEL)
      expect(result.xpGained).toBe(0)
      expect(result.player.professions.smithing.level).toBe(MAX_PROFESSION_LEVEL)
    })
  })

  describe('normalizePlayerProfessions', () => {
    it('defaults all seven professions when field is missing', () => {
      const player = createDefaultPlayer()
      const { professions: _removed, ...withoutProfessions } = player
      const normalized = normalizePlayerProfessions(withoutProfessions)
      expect(Object.keys(normalized)).toHaveLength(PROFESSION_IDS.length)
      for (const id of PROFESSION_IDS) {
        expect(normalized[id]).toEqual({ xp: 0, level: 1 })
      }
    })

    it('preserves existing entries and fills gaps', () => {
      const normalized = normalizePlayerProfessions({
        professions: {
          forestry: { xp: 80, level: 2 },
        },
      })
      expect(normalized.forestry).toEqual({ xp: 80, level: 2 })
      expect(normalized.mining).toEqual({ xp: 0, level: 1 })
      expect(PROFESSION_IDS.every((id) => normalized[id] !== undefined)).toBe(true)
    })
  })

  describe('createDefaultProfessions', () => {
    it('initializes every profession at level 1 with 0 XP', () => {
      const professions = createDefaultProfessions()
      expect(PROFESSION_IDS.every((id) => professions[id]?.level === 1 && professions[id]?.xp === 0)).toBe(
        true
      )
    })
  })
})
