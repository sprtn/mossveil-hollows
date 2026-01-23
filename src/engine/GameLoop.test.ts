/**
 * Unit tests for game loop logic
 * 
 * Philosophy: Pure functions are fully testable without Vue or UI
 * Run with: npx vitest (after installing it)
 */

import { describe, it, expect } from 'vitest'

import {
  initGame,
  enterRoom,
  triggerEncounter,
  resolveAttack,
  endEncounter,
} from './GameLoop'
import type { Player, Room, Enemy } from './GameLoopDesign'

/**
 * Test fixtures
 */
const createTestPlayer = (): Player => ({
  id: 'player_1',
  name: 'Hero',
  hp: 50,
  maxHp: 50,
  level: 1,
  inventory: [],
  stats: { strength: 10, defense: 5, speed: 8 },
})

const createTestRoom = (): Room => ({
  id: 'room_1',
  name: 'Forest',
  description: 'A spooky forest',
  nodeCount: 3,
  encounters: [],
  nextRoomId: 'room_2',
})

const createTestEnemy = (): Enemy => ({
  id: 'enemy_1',
  name: 'Goblin',
  hp: 20,
  maxHp: 20,
  level: 1,
  stats: { strength: 5, defense: 2, speed: 6 },
  loot: [{ id: 'gold', type: 'consumable', name: 'Gold', quantity: 10 }],
  xpReward: 50,
})

describe('Game Loop', () => {
  describe('initGame', () => {
    it('should initialize game with player and first room', () => {
      const player = createTestPlayer()
      const room = createTestRoom()

      const state = initGame(player, room)

      expect(state.phase).toBe('room_enter')
      expect(state.player.name).toBe('Hero')
      expect(state.currentRoom.id).toBe('room_1')
      expect(state.roomHistory).toContain('room_1')
    })
  })

  describe('enterRoom', () => {
    it('should transition to room_exploring', () => {
      const player = createTestPlayer()
      const room = createTestRoom()
      const state = initGame(player, room)

      const updatedState = enterRoom(state, room)

      expect(updatedState.phase).toBe('room_exploring')
    })

    it('should clear encounter state', () => {
      const player = createTestPlayer()
      const room = createTestRoom()
      let state = initGame(player, room)

      // Add an encounter (simulate previous state)
      const enemy = createTestEnemy()
      state = triggerEncounter(state, [enemy])
      expect(state.currentEncounter).toBeDefined()

      // Enter new room
      state = enterRoom(state, room)
      expect(state.currentEncounter).toBeUndefined()
    })
  })

  describe('triggerEncounter', () => {
    it('should transition to encounter_action phase', () => {
      const player = createTestPlayer()
      const room = createTestRoom()
      let state = initGame(player, room)
      state = enterRoom(state, room)

      const enemy = createTestEnemy()
      state = triggerEncounter(state, [enemy])

      expect(state.phase).toBe('encounter_action')
      expect(state.currentEncounter).toBeDefined()
      expect(state.currentEncounter?.enemies.length).toBe(1)
    })

    it('should calculate turn order by speed', () => {
      const player = createTestPlayer() // speed: 8
      const room = createTestRoom()
      let state = initGame(player, room)
      state = enterRoom(state, room)

      const fastEnemy = createTestEnemy()
      fastEnemy.stats.speed = 12
      state = triggerEncounter(state, [fastEnemy])

      const turnOrder = state.currentEncounter?.turnOrder || []
      // Fast enemy should go first
      expect(turnOrder[0]).toBe(fastEnemy.id)
    })
  })

  describe('resolveAttack', () => {
    it('should reduce enemy HP', () => {
      const player = createTestPlayer() // strength: 10, defense: 5
      const room = createTestRoom()
      let state = initGame(player, room)
      state = enterRoom(state, room)

      const enemy = createTestEnemy() // strength: 5, defense: 2
      state = triggerEncounter(state, [enemy])

      const initialEnemyHp = state.currentEncounter?.enemies[0]?.hp || 0
      state = resolveAttack(state, player.id, enemy.id)
      const finalEnemyHp = state.currentEncounter?.enemies[0]?.hp || 0

      expect(finalEnemyHp).toBeLessThan(initialEnemyHp)
    })

    it('should reduce player HP when enemy attacks', () => {
      const player = createTestPlayer()
      const room = createTestRoom()
      let state = initGame(player, room)
      state = enterRoom(state, room)

      const enemy = createTestEnemy()
      state = triggerEncounter(state, [enemy])

      const initialPlayerHp = state.player.hp
      state = resolveAttack(state, enemy.id, player.id)
      const finalPlayerHp = state.player.hp

      expect(finalPlayerHp).toBeLessThan(initialPlayerHp)
    })
  })

  describe('endEncounter', () => {
    it('should reward loot on win', () => {
      const player = createTestPlayer()
      const room = createTestRoom()
      let state = initGame(player, room)
      state = enterRoom(state, room)

      const enemy = createTestEnemy()
      enemy.hp = 0 // Pretend they're already dead
      state = triggerEncounter(state, [enemy])

      const initialInventorySize = state.player.inventory.length
      state = endEncounter(state, 'win')

      expect(state.player.inventory.length).toBeGreaterThan(initialInventorySize)
      expect(state.phase).toBe('room_exploring')
    })

    it('should end game on loss', () => {
      const player = createTestPlayer()
      const room = createTestRoom()
      let state = initGame(player, room)
      state = enterRoom(state, room)

      const enemy = createTestEnemy()
      state = triggerEncounter(state, [enemy])

      state = endEncounter(state, 'loss')

      expect(state.phase).toBe('game_over')
      expect(state.gameOverReason).toBe('defeat')
    })
  })
})
