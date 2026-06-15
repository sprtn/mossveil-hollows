import { describe, it, expect, vi } from 'vitest'
import { createDefaultPlayer } from '../CombatEngine'
import { initGame, enterRoom } from '../GameLoop'
import type { GameState, Room } from '../GameLoopDesign'
import {
  selfCraftStaminaCost,
  selfCraftXpReward,
  canSelfCraft,
  selfCraft,
  SELF_CRAFT_STAMINA_MAX,
  SELF_CRAFT_STAMINA_MIN,
  SELF_CRAFT_WAIVES_GOLD_FEE,
} from '../SelfCraft'
import {
  qualityFloorForLevel,
  rollSelfCraftQuality,
  isUniqueEligible,
  canRollUniqueQuality,
} from '../SelfCraftQuality'
import { getRecipe } from '../CraftingSystem'
import { placeCraftOrder, processCraftOrders } from '../CraftOrderSystem'
import { getInventoryQuantity } from '../ItemDatabase'
import { getMaterialCount } from '../Materials'
import { getProfessionLevel } from '../Professions'
import { SeededRandom } from '../CombatEngine'
import { DEFAULT_QUALITY } from '../Quality'

const hubRoom: Room = {
  id: 'town_hub',
  name: 'Hub',
  description: 'Hub',
  encounters: [],
  exits: [],
  isHub: true,
}

function baseState(overrides: Partial<GameState['player']> = {}): GameState {
  let state = initGame(createDefaultPlayer(overrides), hubRoom)
  state = enterRoom(state, hubRoom)
  state = {
    ...state,
    townBuildings: { ...state.townBuildings, workbench: 1 },
  }
  return state
}

function playerWithStakeMaterials(
  state: GameState,
  playerPatch: Partial<GameState['player']> = {}
): GameState {
  return {
    ...state,
    player: {
      ...state.player,
      ...playerPatch,
      materials: {
        oak_wood: 5,
        ...(state.player.materials ?? {}),
        ...(playerPatch.materials ?? {}),
      },
      stamina: playerPatch.stamina ?? 10,
      gold: playerPatch.gold ?? 100,
    },
  }
}

describe('Self-craft', () => {
  const woodenStake = getRecipe('wooden_stake')!
  const oakSpear = getRecipe('oak_spear')!

  describe('stamina cost', () => {
    it('scales up with tier and material count', () => {
      const low = selfCraftStaminaCost(woodenStake, 1)
      const high = selfCraftStaminaCost(oakSpear, 1)
      expect(high).toBeGreaterThan(low)
    })

    it('scales down with profession level', () => {
      const lowLevel = selfCraftStaminaCost(oakSpear, 1)
      const highLevel = selfCraftStaminaCost(oakSpear, 8)
      expect(highLevel).toBeLessThan(lowLevel)
    })

    it('clamps to integer [min, max]', () => {
      const cost = selfCraftStaminaCost(oakSpear, 1)
      expect(Number.isInteger(cost)).toBe(true)
      expect(cost).toBeGreaterThanOrEqual(SELF_CRAFT_STAMINA_MIN)
      expect(cost).toBeLessThanOrEqual(SELF_CRAFT_STAMINA_MAX)
    })
  })

  describe('selfCraft action', () => {
    it('consumes materials, deducts stamina, adds item, grants XP instantly', () => {
      let state = playerWithStakeMaterials(baseState())
      const dayBefore = state.day ?? 1
      const staminaBefore = state.player.stamina
      const woodBefore = getMaterialCount(state.player, 'oak_wood')

      state = selfCraft(state, 'wooden_stake')

      expect(state.day).toBe(dayBefore)
      expect(getMaterialCount(state.player, 'oak_wood')).toBe(woodBefore - 1)
      expect(state.player.stamina).toBeLessThan(staminaBefore)
      expect(getInventoryQuantity(state.player, 'wooden_stake')).toBeGreaterThan(0)
      expect(getProfessionLevel(state.player, 'fletching')).toBeGreaterThanOrEqual(1)
      expect(state.player.professions.fletching!.xp).toBeGreaterThan(0)
      expect(state.flags?.crafted_wooden_stake).toBe(true)
      expect(state.statusMessage).toMatch(/Crafted/)
    })

    it('blocks when stamina insufficient', () => {
      const state = playerWithStakeMaterials(baseState(), { stamina: 0 })
      const after = selfCraft(state, 'wooden_stake')
      expect(after).toBe(state)
      expect(canSelfCraft(state, 'wooden_stake')).toBe(false)
    })

    it('blocks when materials missing', () => {
      const state = baseState({ stamina: 10 })
      expect(canSelfCraft(state, 'wooden_stake')).toBe(false)
      const after = selfCraft(state, 'wooden_stake')
      expect(getInventoryQuantity(after.player, 'wooden_stake')).toBe(0)
    })

    it('waives gold fee', () => {
      expect(SELF_CRAFT_WAIVES_GOLD_FEE).toBe(true)
      let state = playerWithStakeMaterials(baseState(), { gold: 0 })
      state = selfCraft(state, 'wooden_stake')
      expect(state.player.gold).toBe(0)
      expect(getInventoryQuantity(state.player, 'wooden_stake')).toBeGreaterThan(0)
    })
  })

  describe('quality roll', () => {
    it('raises floor with profession level', () => {
      expect(qualityFloorForLevel(1)).toBe('poor')
      expect(qualityFloorForLevel(4)).toBe('common')
      expect(qualityFloorForLevel(7)).toBe('fine')
      expect(qualityFloorForLevel(9)).toBe('superior')
    })

    it('never rolls below floor at high level', () => {
      for (let i = 0; i < 30; i++) {
        const q = rollSelfCraftQuality(9, new SeededRandom(i))
        expect(['superior', 'masterwork', 'unique']).toContain(q)
      }
    })

    it('unique only when eligible and on forced top roll', () => {
      expect(isUniqueEligible(9)).toBe(false)
      expect(isUniqueEligible(10)).toBe(true)

      const rng = {
        next: vi
          .fn()
          .mockReturnValueOnce(0.99)
          .mockReturnValueOnce(0),
      } as unknown as SeededRandom

      const q = rollSelfCraftQuality(10, rng)
      expect(q).toBe('unique')
      expect(canRollUniqueQuality(10)).toBe(true)
    })

    it('does not roll unique below max level even on top roll', () => {
      const rng = {
        next: vi
          .fn()
          .mockReturnValueOnce(0.99)
          .mockReturnValueOnce(0),
      } as unknown as SeededRandom
      const q = rollSelfCraftQuality(9, rng)
      expect(q).not.toBe('unique')
    })
  })

  describe('commission path unchanged', () => {
    it('still queues common delivery on day advance without XP', () => {
      let state = playerWithStakeMaterials(baseState())
      state = {
        ...state,
        player: {
          ...state.player,
          materials: { oak_wood: 8, ...(state.player.materials ?? {}) },
        },
      }
      const xpBefore = state.player.professions.fletching!.xp
      const goldBefore = state.player.gold

      state = placeCraftOrder(state, 'oak_spear')
      expect(state.craftOrders?.length).toBe(1)
      expect(state.player.professions.fletching!.xp).toBe(xpBefore)
      expect(state.player.gold).toBeLessThan(goldBefore)

      state = processCraftOrders({ ...state, day: (state.day ?? 1) + 1 })
      const stacks = state.player.inventory.filter((i) => i.templateId === 'oak_spear')
      expect(stacks.some((s) => s.quality === DEFAULT_QUALITY)).toBe(true)
    })
  })

  describe('recipe mapping', () => {
    it('assigns fletching to wood recipes and alchemy to Maren recipes', () => {
      expect(getRecipe('wooden_stake')?.profession).toBe('fletching')
      expect(getRecipe('oak_spear')?.profession).toBe('fletching')
      expect(getRecipe('hide_jerkin')?.profession).toBe('smithing')
      expect(getRecipe('cloth_bandage')?.profession).toBe('alchemy')
    })

    it('xp reward scales with tier', () => {
      expect(selfCraftXpReward(getRecipe('wooden_stake')!)).toBeLessThan(
        selfCraftXpReward(getRecipe('oak_spear')!)
      )
    })
  })
})
