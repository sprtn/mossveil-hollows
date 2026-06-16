import { describe, it, expect } from 'vitest'
import { createDefaultPlayer } from '../CombatEngine'
import { initGame, enterRoom } from '../GameLoop'
import type { GameState, Room } from '../GameLoopDesign'
import {
  canUnlockProfessionTier,
  canPurchaseRecipe,
  purchaseRecipe,
  unlockProfessionTier,
  isRecipeCraftable,
  passesRecipePrerequisites,
  getAllRecipes,
} from '../CraftingSystem'
import {
  getUnlockedProfessionTier,
  hasPurchasedRecipe,
  TIER_UNLOCK_LEVEL,
  TIER_UNLOCK_GOLD,
  getRecipePurchaseGold,
  computeMigrationTrainingState,
  createDefaultUnlockedProfessionTiers,
} from '../ProfessionTraining'
import { grantProfessionXp } from '../Professions'
import { migrateSaveV8 } from '../saveMigration'

const hubRoom: Room = {
  id: 'town_hub',
  name: 'Hub',
  description: 'Hub',
  encounters: [],
  exits: [],
  isHub: true,
}

function hubState(playerPatch: Partial<GameState['player']> = {}): GameState {
  let state = initGame(
    createDefaultPlayer({
      gold: 500,
      unlockedProfessionTiers: createDefaultUnlockedProfessionTiers(),
      purchasedRecipes: [],
      ...playerPatch,
    }),
    hubRoom
  )
  state = enterRoom(state, hubRoom)
  return { ...state, townBuildings: { workbench: 1 } }
}

function playerAtProfessionLevel(
  state: GameState,
  profession: 'smithing' | 'fletching' | 'alchemy',
  level: number
): GameState {
  let player = state.player
  while (player.professions[profession].level < level) {
    const result = grantProfessionXp(player, profession, 500)
    player = result.player
  }
  return { ...state, player }
}

describe('ProfessionTraining', () => {
  describe('tier unlock', () => {
    it('tier 2 locked below profession level threshold', () => {
      let state = hubState()
      expect(getUnlockedProfessionTier(state.player, 'fletching')).toBe(1)
      expect(canUnlockProfessionTier(state, 'fletching', 2)).toBe(false)
    })

    it('unlock requires level AND gold and persists', () => {
      let state = playerAtProfessionLevel(hubState(), 'fletching', TIER_UNLOCK_LEVEL[2]!)
      expect(canUnlockProfessionTier(state, 'fletching', 2)).toBe(true)

      const goldBefore = state.player.gold
      state = unlockProfessionTier(state, 'fletching', 2)

      expect(getUnlockedProfessionTier(state.player, 'fletching')).toBe(2)
      expect(state.player.gold).toBe(goldBefore - TIER_UNLOCK_GOLD[2]!)
    })

    it('cannot skip tiers', () => {
      let state = playerAtProfessionLevel(hubState({ gold: 1000 }), 'smithing', 9)
      expect(canUnlockProfessionTier(state, 'smithing', 3)).toBe(false)
    })
  })

  describe('recipe purchase two-gate model', () => {
    it('not craftable until tier unlocked AND recipe purchased', () => {
      let state = hubState()
      const stake = getAllRecipes().find((r) => r.id === 'wooden_stake')!

      expect(passesRecipePrerequisites(state, stake)).toBe(true)
      expect(isRecipeCraftable(state, stake)).toBe(false)

      state = purchaseRecipe(state, 'wooden_stake')
      expect(isRecipeCraftable(state, stake)).toBe(true)
      expect(hasPurchasedRecipe(state.player, 'wooden_stake')).toBe(true)
    })

    it('cannot buy recipe until its tier is unlocked', () => {
      let state = playerAtProfessionLevel(hubState(), 'fletching', 1)
      const spear = getAllRecipes().find((r) => r.id === 'oak_spear')!
      expect(canPurchaseRecipe(state, 'oak_spear')).toBe(false)

      state = playerAtProfessionLevel(state, 'fletching', TIER_UNLOCK_LEVEL[2]!)
      state = unlockProfessionTier(state, 'fletching', 2)
      expect(canPurchaseRecipe(state, 'oak_spear')).toBe(true)

      const goldBefore = state.player.gold
      state = purchaseRecipe(state, 'oak_spear')
      expect(state.player.gold).toBe(goldBefore - getRecipePurchaseGold(spear))
      expect(isRecipeCraftable(state, spear)).toBe(true)
    })

    it('buying deducts gold and adds to purchasedRecipes', () => {
      let state = hubState()
      const bandage = getAllRecipes().find((r) => r.id === 'cloth_bandage')!
      const cost = getRecipePurchaseGold(bandage)
      const goldBefore = state.player.gold

      state = purchaseRecipe(state, 'cloth_bandage')

      expect(state.player.gold).toBe(goldBefore - cost)
      expect(state.player.purchasedRecipes).toContain('cloth_bandage')
    })
  })

  describe('save migration v8', () => {
    it('backfills purchased recipes and tiers from legacy craftable state', () => {
      const migrated = migrateSaveV8({
        flags: {},
        townBuildings: { workbench: 1 },
        player: {},
      })

      expect(migrated.purchasedRecipes).toContain('wooden_stake')
      expect(migrated.purchasedRecipes).toContain('cloth_bandage')
      expect(migrated.unlockedProfessionTiers?.fletching).toBeGreaterThanOrEqual(1)
    })

    it('legacy cleansing draught needs quest flag', () => {
      const withoutFlag = computeMigrationTrainingState({}, { workbench: 1 }, getAllRecipes())
      expect(withoutFlag.purchasedRecipes).not.toContain('cleansing_draught')

      const withFlag = computeMigrationTrainingState(
        { forest_quest_started: true },
        { workbench: 1 },
        getAllRecipes()
      )
      expect(withFlag.purchasedRecipes).toContain('cleansing_draught')
      expect(withFlag.unlockedProfessionTiers?.alchemy).toBeGreaterThanOrEqual(4)
    })
  })

  describe('gathering professions unaffected', () => {
    it('no tier gates on non-crafting profession ids', () => {
      const state = hubState()
      expect(getUnlockedProfessionTier(state.player, 'forestry')).toBe(0)
      expect(state.player.purchasedRecipes ?? []).toHaveLength(0)
    })
  })
})
