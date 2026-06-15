import { describe, it, expect } from 'vitest'
import {
  applyQualityToStat,
  applyQualityToPrice,
  compareQuality,
  DEFAULT_QUALITY,
  QUALITY_STAT_MIN_FLOOR,
} from '../Quality'
import {
  addItemToInventory,
  consolidateInventory,
  getEffectiveStats,
  getEquipBonus,
  removeItemFromInventory,
  scaledConsumablePower,
} from '../ItemDatabase'
import { getItemTemplate } from '../ItemDatabase'
import { getPrice } from '../MarketSystem'
import { createDefaultPlayer } from '../CombatEngine'
import { initGame, enterRoom } from '../GameLoop'
import { migrateSaveV6 } from '../saveMigration'
import type { Room } from '../GameLoopDesign'
import { applyConsumableEffect } from '../ItemDatabase'

describe('Quality system', () => {
  describe('multiplier math', () => {
    it('scales stats by tier with min floor for non-zero bases', () => {
      expect(applyQualityToStat(5, 'common')).toBe(5)
      expect(applyQualityToStat(5, 'fine')).toBe(6) // 5 * 1.25 = 6.25 → 6
      expect(applyQualityToStat(1, 'trash')).toBe(QUALITY_STAT_MIN_FLOOR) // 0.6 → 1 floor
      expect(applyQualityToStat(0, 'masterwork')).toBe(0)
    })

    it('scales prices by tier', () => {
      expect(applyQualityToPrice(20, 'common')).toBe(20)
      expect(applyQualityToPrice(20, 'fine')).toBe(24) // 20 * 1.2
      expect(applyQualityToPrice(20, 'masterwork')).toBe(35) // 20 * 1.75
    })

    it('orders tiers correctly', () => {
      expect(compareQuality('fine', 'common')).toBeGreaterThan(0)
      expect(compareQuality('poor', 'superior')).toBeLessThan(0)
    })
  })

  describe('inventory stacking', () => {
    it('merges same template + quality only', () => {
      let inv = addItemToInventory([], 'iron_sword', 1, 'common')
      inv = addItemToInventory(inv, 'iron_sword', 2, 'common')
      inv = addItemToInventory(inv, 'iron_sword', 1, 'fine')
      expect(inv).toHaveLength(2)
      expect(inv.find((i) => i.quality === 'common')?.quantity).toBe(3)
      expect(inv.find((i) => i.quality === 'fine')?.quantity).toBe(1)
    })

    it('consolidateInventory respects quality keys', () => {
      const merged = consolidateInventory([
        { templateId: 'health_potion', quantity: 1, quality: 'common' },
        { templateId: 'health_potion', quantity: 2, quality: 'common' },
        { templateId: 'health_potion', quantity: 1, quality: 'fine' },
      ])
      expect(merged).toHaveLength(2)
      expect(merged.find((i) => i.quality === 'common')?.quantity).toBe(3)
    })

    it('removeItemFromInventory consumes lowest quality first when unspecified', () => {
      let inv = [
        { templateId: 'health_potion', quantity: 2, quality: 'fine' as const },
        { templateId: 'health_potion', quantity: 3, quality: 'common' as const },
      ]
      inv = removeItemFromInventory(inv, 'health_potion', 1)
      expect(inv.find((i) => i.quality === 'common')?.quantity).toBe(2)
      expect(inv.find((i) => i.quality === 'fine')?.quantity).toBe(2)
    })
  })

  describe('combat stats', () => {
    it('Fine iron sword yields higher effective strength than Common', () => {
      const template = getItemTemplate('iron_sword')!
      const commonBonus = getEquipBonus(template, 'common')
      const fineBonus = getEquipBonus(template, 'fine')
      expect(fineBonus).toBeGreaterThan(commonBonus)

      const commonPlayer = createDefaultPlayer({
        inventory: [{ templateId: 'iron_sword', quantity: 1, quality: 'common' }],
        equipment: { weapon: { templateId: 'iron_sword', quality: 'common' } },
      })
      const finePlayer = createDefaultPlayer({
        inventory: [{ templateId: 'iron_sword', quantity: 1, quality: 'fine' }],
        equipment: { weapon: { templateId: 'iron_sword', quality: 'fine' } },
      })
      expect(getEffectiveStats(finePlayer).strength).toBeGreaterThan(
        getEffectiveStats(commonPlayer).strength
      )
    })
  })

  describe('consumables', () => {
    it('Masterwork health potion heals more than common', () => {
      const template = getItemTemplate('health_potion')!
      const commonPower = scaledConsumablePower(template, 'common')
      const mwPower = scaledConsumablePower(template, 'masterwork')
      expect(mwPower).toBeGreaterThan(commonPower)

      const base = createDefaultPlayer({ hp: 10, maxHp: 100 })
      const commonResult = applyConsumableEffect(base, template, 'common')
      const mwResult = applyConsumableEffect(base, template, 'masterwork')
      expect(mwResult.player.hp).toBeGreaterThan(commonResult.player.hp)
    })
  })

  describe('market pricing', () => {
    const hubRoom: Room = {
      id: 'town_hub',
      name: 'Hub',
      description: 'Hub',
      encounters: [],
      exits: [],
      isHub: true,
    }

    it('higher quality sells for more', () => {
      const state = enterRoom(initGame(createDefaultPlayer({ gold: 500 }), hubRoom), hubRoom)
      const common = getPrice(state, 'oak_spear', 'sell', { quality: 'common' })
      const fine = getPrice(state, 'oak_spear', 'sell', { quality: 'fine' })
      expect(fine).toBeGreaterThan(common)
    })
  })

  describe('save migration v6', () => {
    it('assigns common quality to legacy inventory and converts equipment strings', () => {
      const legacy = {
        templateId: 'player_1',
        inventory: [
          { templateId: 'health_potion', quantity: 2 },
          { templateId: 'rusty_shortsword', quantity: 1 },
        ],
        equipment: { weapon: 'rusty_shortsword', armor: 'worn_tunic' },
      }
      const { player } = migrateSaveV6(legacy as never)
      expect(player.inventory.every((i) => i.quality === DEFAULT_QUALITY)).toBe(true)
      expect(player.equipment.weapon).toEqual({
        templateId: 'rusty_shortsword',
        quality: 'common',
      })
      expect(player.equipment.armor).toEqual({
        templateId: 'worn_tunic',
        quality: 'common',
      })
    })
  })
})
