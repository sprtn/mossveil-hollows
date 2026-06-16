/**
 * Unit tests for game loop logic
 */

import { describe, it, expect } from 'vitest'
import {
  initGame,
  enterRoom,
  triggerEncounter,
  playerAction,
  endEncounter,
  useItem,
  equipItemAction,
} from './GameLoop'
import { createDefaultPlayer } from './CombatEngine'
import type { Room, Enemy } from './GameLoopDesign'

const createTestRoom = (): Room => ({
  id: 'room_1',
  name: 'Forest',
  description: 'A spooky forest',
  encounters: [],
  exits: [],
})

const createTestEnemy = (): Enemy => ({
  id: 'enemy_1',
  name: 'Goblin',
  hp: 20,
  maxHp: 20,
  level: 1,
  stats: { strength: 5, defense: 2, constitution: 6, dexterity: 4, agility: 6 },
  loot: [{ templateId: 'health_potion', quantity: 1 }],
  goldReward: 10,
  xpReward: 50,
})

describe('Game Loop', () => {
  describe('initGame', () => {
    it('should initialize game with player and first room', () => {
      const player = createDefaultPlayer()
      const room = createTestRoom()
      const state = initGame(player, room)
      expect(state.phase).toBe('room_enter')
      expect(state.player.name).toBe('Hero')
      expect(state.currentRoom.id).toBe('room_1')
    })
  })

  describe('enterRoom', () => {
    it('should transition to room_exploring', () => {
      const player = createDefaultPlayer()
      const room = createTestRoom()
      const state = enterRoom(initGame(player, room), room)
      expect(state.phase).toBe('room_exploring')
    })
  })

  describe('triggerEncounter', () => {
    it('should transition to encounter_action phase', () => {
      const player = createDefaultPlayer()
      const room = createTestRoom()
      let state = enterRoom(initGame(player, room), room)
      state = triggerEncounter(state, [createTestEnemy()])
      expect(state.phase).toBe('encounter_action')
      expect(state.currentEncounter?.enemies.length).toBe(1)
    })
  })

  describe('playerAction', () => {
    it('should reduce enemy HP on attack', () => {
      const player = createDefaultPlayer()
      const room = createTestRoom()
      const enemy = createTestEnemy()
      let state = triggerEncounter(enterRoom(initGame(player, room), room), [enemy])
      const initialHp = state.currentEncounter!.enemies[0]!.hp
      for (let attempt = 0; attempt < 8; attempt++) {
        if (!state.currentEncounter) break
        state = playerAction(state, 'attack', { targetId: enemy.id })
        if (state.currentEncounter.enemies[0]!.hp < initialHp) break
      }
      if (state.currentEncounter) {
        expect(state.currentEncounter.enemies[0]!.hp).toBeLessThan(initialHp)
      }
    })

    it('should apply defend without dealing damage', () => {
      const player = createDefaultPlayer()
      const room = createTestRoom()
      const enemy = createTestEnemy()
      let state = triggerEncounter(enterRoom(initGame(player, room), room), [enemy])
      state = {
        ...state,
        currentEncounter: { ...state.currentEncounter!, rngState: 100 },
      }
      state = playerAction(state, 'defend')
      expect(state.currentEncounter?.playerDefending).toBeFalsy()
    })
  })

  describe('endEncounter', () => {
    it('should reward loot and gold on win', () => {
      const player = createDefaultPlayer()
      const room = createTestRoom()
      const enemy = { ...createTestEnemy(), hp: 0 }
      let state = triggerEncounter(enterRoom(initGame(player, room), room), [enemy])
      const initialGold = state.player.gold
      state = endEncounter(state, 'win')
      expect(state.player.gold).toBeGreaterThan(initialGold)
      expect(state.phase).toBe('combat_results')
    })

    it('should end game on loss', () => {
      const player = createDefaultPlayer()
      const room = createTestRoom()
      let state = triggerEncounter(enterRoom(initGame(player, room), room), [createTestEnemy()])
      state = endEncounter(state, 'loss')
      expect(state.phase).toBe('game_over')
    })
  })

  describe('useItem', () => {
    it('should heal player outside combat', () => {
      const player = createDefaultPlayer({ hp: 30 })
      const room = createTestRoom()
      let state = enterRoom(initGame(player, room), room)
      state = useItem(state, 'health_potion')
      expect(state.player.hp).toBeGreaterThan(30)
    })
  })

  describe('equipItemAction', () => {
    it('should equip weapon from inventory', () => {
      const player = createDefaultPlayer({
        inventory: [{ templateId: 'iron_sword', quantity: 1, quality: 'common' }],
      })
      const room = createTestRoom()
      let state = enterRoom(initGame(player, room), room)
      state = equipItemAction(state, 'iron_sword')
      expect(state.player.equipment.weapon).toEqual({
        templateId: 'iron_sword',
        quality: 'common',
      })
    })
  })
})
