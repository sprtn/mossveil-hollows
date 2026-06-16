import { describe, it, expect } from 'vitest'
import { initGame, enterRoom, endEncounter } from '../GameLoop'
import { createDefaultPlayer } from '../CombatEngine'
import {
  BOSS_RESPAWN_DAYS,
  BOSS_RESPAWN_GOLD_MULTIPLIER,
  BOSS_RESPAWN_XP_MULTIPLIER,
  ZONE_SHARD_IDS,
} from '../gameConfig'
import type { Room } from '../GameLoopDesign'

const forestBossRoom: Room = {
  id: 'zone_forest_boss',
  name: "Guardian's Grove",
  description: 'Boss clearing',
  zoneId: 'forest',
  difficulty: 3,
  encounters: [
    {
      id: 'forest_boss_encounter',
      type: 'fixed',
      onTrigger: 'auto',
      enemies: [
        {
          id: 'forest_guardian',
          name: 'Forest Guardian',
          hp: 90,
          maxHp: 90,
          level: 3,
          stats: { strength: 16, defense: 6, agility: 6, dexterity: 5, constitution: 12 },
          archetype: 'defender',
          isBoss: true,
          xpReward: 200,
          goldReward: 10,
          loot: [],
        },
      ],
    },
  ],
  exits: [],
  gatherNodes: [],
}

function countShards(inventory: { templateId: string; quantity: number }[]): number {
  return inventory
    .filter((i) => i.templateId === ZONE_SHARD_IDS.forest)
    .reduce((sum, i) => sum + i.quantity, 0)
}

describe('boss respawn', () => {
  it('first kill sets bossClearedDay and zone progression', () => {
    let state = initGame(createDefaultPlayer(), forestBossRoom)
    state = { ...state, day: 5 }
    state = enterRoom(state, forestBossRoom)
    expect(state.phase).toBe('encounter_action')

    state = endEncounter(state, 'win')
    expect(state.zonesCleared).toContain('forest')
    expect(state.bossClearedDay?.forest).toBe(5)
    expect(countShards(state.player.inventory)).toBe(1)
  })

  it('cleared boss room is safe before respawn window', () => {
    let state = initGame(createDefaultPlayer(), forestBossRoom)
    state = {
      ...state,
      day: 10,
      phase: 'room_exploring',
      zonesCleared: ['forest'],
      bossClearedDay: { forest: 5 },
      areasUnlocked: ['forest', 'cave'],
      currentEncounter: undefined,
    }
    state = enterRoom(state, forestBossRoom, 'zone_forest_deep')
    expect(state.phase).toBe('room_exploring')
    expect(state.currentEncounter).toBeUndefined()
  })

  it('boss re-arms at day+7 as respawn with reduced rewards and no shard', () => {
    let state = initGame(createDefaultPlayer(), forestBossRoom)
    state = {
      ...state,
      day: 12,
      zonesCleared: ['forest'],
      bossClearedDay: { forest: 5 },
      areasUnlocked: ['forest', 'cave'],
      bossesDefeated: ['forest_guardian'],
    }
    state = enterRoom(state, forestBossRoom, 'zone_forest_deep')
    expect(state.phase).toBe('encounter_action')
    expect(state.currentEncounter?.isRespawnBoss).toBe(true)

    const shardsBefore = countShards(state.player.inventory)
    state = endEncounter(state, 'win')
    expect(state.zonesCleared).toEqual(['forest'])
    expect(countShards(state.player.inventory)).toBe(shardsBefore)
    expect(state.combatResults?.xpGained).toBe(Math.floor(200 * BOSS_RESPAWN_XP_MULTIPLIER))
    expect(state.combatResults?.goldGained).toBe(Math.floor(10 * BOSS_RESPAWN_GOLD_MULTIPLIER))
    expect(state.bossClearedDay?.forest).toBe(12)
  })

  it('respawn timer uses BOSS_RESPAWN_DAYS constant', () => {
    expect(BOSS_RESPAWN_DAYS).toBe(7)
  })
})
