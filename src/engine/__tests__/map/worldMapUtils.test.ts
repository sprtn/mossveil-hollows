import { describe, it, expect } from 'vitest'
import type { Room } from '../../RoomSystem'
import type { GameState } from '../../GameLoopDesign'
import {
  resolveRoomLayouts,
  getRoomZoneKey,
  zoneDisplayLabel,
  getDiscoveredRoomIds,
  canNavigateToRoom,
  buildMapEdges,
} from '../../map/worldMapUtils'

const rooms: Room[] = [
  {
    id: 'town_hub',
    type: 'static',
    name: 'Hub',
    description: '',
    isHub: true,
    exits: [{ direction: 'north', targetRoomId: 'zone_forest_entrance' }],
  },
  {
    id: 'zone_forest_entrance',
    type: 'static',
    name: 'Forest',
    description: '',
    zoneId: 'forest',
    exits: [{ direction: 'south', targetRoomId: 'town_hub' }],
  },
]

function minimalState(overrides: Partial<GameState> = {}): GameState {
  return {
    currentRoom: rooms[0],
    player: {
      inventory: [],
      stats: { strength: 1, constitution: 1, dexterity: 1, agility: 1, defense: 1 },
      hp: 10,
      maxHp: 10,
      stamina: 10,
      maxStamina: 10,
    },
    roomHistory: ['zone_forest_entrance'],
    areasUnlocked: ['forest'],
    phase: 'exploring',
    ...overrides,
  } as GameState
}

describe('worldMapUtils', () => {
  it('resolves zone keys and labels', () => {
    expect(getRoomZoneKey(rooms[0])).toBe('__hub__')
    expect(getRoomZoneKey(rooms[1])).toBe('forest')
    expect(zoneDisplayLabel('__hub__')).toBe('Hub / Unzoned')
    expect(zoneDisplayLabel('forest')).toBe('Forest')
  })

  it('merges base and overlay layouts with defaults for missing rooms', () => {
    const merged = resolveRoomLayouts(rooms, { town_hub: { x: 10, y: 20 } }, {
      zone_forest_entrance: { x: 100, y: 200 },
    })
    expect(merged.town_hub).toEqual({ x: 10, y: 20 })
    expect(merged.zone_forest_entrance).toEqual({ x: 100, y: 200 })
  })

  it('builds directed edges from room exits', () => {
    const edges = buildMapEdges(rooms)
    expect(edges).toContainEqual({
      fromId: 'town_hub',
      toId: 'zone_forest_entrance',
      direction: 'north',
      locked: false,
      hidden: false,
    })
  })

  it('collects discovered room ids from history, current, and reachable exits', () => {
    const state = minimalState()
    const ids = getDiscoveredRoomIds(state)
    expect(ids.has('town_hub')).toBe(true)
    expect(ids.has('zone_forest_entrance')).toBe(true)
  })

  it('canNavigateToRoom respects passable exits', () => {
    const state = minimalState()
    expect(canNavigateToRoom(state, rooms[0], 'zone_forest_entrance')).toBe(true)
    expect(canNavigateToRoom(state, rooms[0], 'zone_cave_entrance')).toBe(false)
  })
})
