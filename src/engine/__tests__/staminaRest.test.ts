/**
 * Stamina and rest system tests
 */

import { describe, it, expect } from 'vitest'
import { initGame, enterRoom, exploreRoom, gatherFromNode, returnToHub } from '../GameLoop'
import { createDefaultPlayer } from '../CombatEngine'
import { restAtHub, useHealer } from '../HubActions'
import type { Room, GameState } from '../GameLoopDesign'

function ensureRoomExploring(state: GameState): GameState {
  if (state.phase === 'room_exploring') return state
  return { ...state, phase: 'room_exploring', activeEvent: undefined }
}

const hubRoom: Room = {
  id: 'town_hub',
  name: 'Hub',
  description: 'Safe',
  isHub: true,
  encounters: [],
  exits: [],
}

const forestRoom: Room = {
  id: 'zone_forest_entrance',
  name: 'Forest',
  description: 'Woods',
  zoneId: 'forest',
  difficulty: 1,
  encounters: [],
  exits: [{ direction: 'south', targetRoomId: 'town_hub' }],
  gatherNodes: [
    {
      id: 'test_oak',
      profession: 'forestry',
      resource: 'oak_wood',
      baseYield: 1,
      maxCharges: 5,
      regenPerDay: 3,
    },
  ],
}

const deepForestRoom: Room = {
  id: 'zone_forest_deep',
  name: 'Deep Forest',
  description: 'Deeper woods',
  zoneId: 'forest',
  encounters: [],
  exits: [{ direction: 'south', targetRoomId: 'zone_forest_entrance' }],
}

describe('Stamina and Rest', () => {
  it('drains stamina on forest entry from another room', () => {
    let state = initGame(createDefaultPlayer(), hubRoom)
    state = enterRoom(state, hubRoom)
    state = enterRoom(state, forestRoom, 'town_hub')
    expect(state.player.stamina).toBeLessThan(10)
  })

  it('blocks explore at 0 stamina', () => {
    const player = createDefaultPlayer({ stamina: 0 })
    let state = initGame(player, forestRoom)
    state = enterRoom(state, forestRoom)
    state = exploreRoom(state)
    expect(state.statusMessage).toContain('Exhausted')
  })

  it('healer restores full stamina and clears wounded', () => {
    const player = createDefaultPlayer({ wounded: true, stamina: 2, hp: 20, gold: 50 })
    let state = initGame(player, hubRoom)
    state = enterRoom(state, hubRoom)
    state = useHealer(state)
    expect(state.player.wounded).toBe(false)
    expect(state.player.stamina).toBe(10)
    expect(state.player.hp).toBe(40)
  })

  it('sleep outside never lowers HP when already healthy', () => {
    const player = createDefaultPlayer({ hp: 40, maxHp: 40, energy: 6, stamina: 10 })
    let state = initGame(player, hubRoom)
    state = enterRoom(state, hubRoom)
    state = restAtHub(state)
    expect(state.player.hp).toBe(40)
    expect(state.player.stamina).toBe(10)
  })

  it('sleep outside returns partial recovery when damaged', () => {
    const player = createDefaultPlayer({ hp: 15, energy: 2, stamina: 3 })
    let state = initGame(player, hubRoom)
    state = enterRoom(state, hubRoom)
    state = { ...state, seed: 12345, day: 1 }
    state = restAtHub(state)
    expect(state.player.hp).toBeLessThan(40)
    expect(state.player.hp).toBeGreaterThan(15)
    expect(state.player.hp).toBe(24)
  })

  it('gather adds oak wood and costs stamina', () => {
    const safeForest = { ...forestRoom, difficulty: 0 }
    let state = initGame(createDefaultPlayer(), safeForest)
    state = enterRoom(state, safeForest)
    const staminaBefore = state.player.stamina
    state = gatherFromNode(state, 'test_oak')
    expect(state.player.materials?.oak_wood).toBeGreaterThan(0)
    expect(state.player.stamina).toBeLessThan(staminaBefore)
  })

  it('each explore costs stamina until exhausted', () => {
    const player = createDefaultPlayer({ stamina: 3 })
    let state = initGame(player, forestRoom)
    state = enterRoom(state, forestRoom)
    state = { ...state, seed: 424242 }

    for (let i = 0; i < 3; i++) {
      state = ensureRoomExploring(state)
      const before = state.player.stamina
      state = exploreRoom(state)
      expect(state.player.stamina).toBe(before - 1)
    }

    state = ensureRoomExploring(state)
    state = exploreRoom(state)
    expect(state.statusMessage).toContain('Exhausted')
    expect(state.player.stamina).toBe(0)
  })

  it('explore-triggered encounter does not double-drain stamina', () => {
    const roomWithAmbush: Room = {
      ...forestRoom,
      encounters: [
        {
          id: 'always_fight',
          type: 'random',
          triggerChance: 1,
          enemies: [
            {
              id: 'test_rat',
              name: 'Rat',
              hp: 5,
              maxHp: 5,
              level: 1,
              stats: { strength: 4, defense: 1, constitution: 4, dexterity: 4, agility: 4 },
              xpReward: 1,
              goldReward: 0,
              loot: [],
            },
          ],
        },
      ],
    }
    let state = initGame(createDefaultPlayer({ stamina: 10 }), roomWithAmbush)
    state = enterRoom(state, roomWithAmbush)
    state = { ...state, seed: 1, exploreCount: 0 }
    state = exploreRoom(state)
    expect(state.phase).toBe('encounter_action')
    expect(state.player.stamina).toBe(9)
  })

  it('returnToHub works at 0 stamina from deep zone without a hub exit', async () => {
    const player = createDefaultPlayer({ stamina: 0 })
    let state = initGame(player, deepForestRoom)
    state = enterRoom(state, deepForestRoom)
    state = await returnToHub(state)
    expect(state.currentRoom.id).toBe('town_hub')
    expect(state.currentRoom.isHub).toBe(true)
    expect(state.player.stamina).toBe(0)
    expect(state.statusMessage).toContain('Mossveil Hollow')
  })
})
