import { describe, it, expect } from 'vitest'
import { createDefaultPlayer } from '../CombatEngine'
import { initGame, enterRoom } from '../GameLoop'
import { advanceDay } from '../DayAdvance'
import { normalizePlayerProfessions } from '../Professions'
import {
  gatherFromNode,
  scaledGatherYield,
  scaledBonusChance,
  rollGatherYield,
  getGatherNodeRuntimeState,
  GATHER_XP_BASE,
  normalizeGatherNodeState,
} from '../GatherNodes'
import type { Room } from '../GameLoopDesign'
import { SeededRandom } from '../CombatEngine'

const forestRoom: Room = {
  id: 'zone_forest_entrance',
  name: 'Forest',
  description: 'Woods',
  zoneId: 'forest',
  difficulty: 1,
  encounters: [],
  exits: [],
  gatherNodes: [
    {
      id: 'test_oak',
      profession: 'forestry',
      resource: 'oak_wood',
      baseYield: 2,
      maxCharges: 3,
      regenPerDay: 3,
    },
    {
      id: 'test_herbs',
      profession: 'herbalism',
      resource: 'green_herb',
      baseYield: 1,
      bonusDrops: [{ item: 'moonshade_herb', chance: 0.5 }],
      maxCharges: 2,
      regenPerDay: 2,
      minLevel: 5,
    },
  ],
}

const caveRoom: Room = {
  id: 'zone_cave_entrance',
  name: 'Cave',
  description: 'Cave',
  zoneId: 'cave',
  difficulty: 2,
  encounters: [],
  exits: [],
  gatherNodes: [
    {
      id: 'test_iron',
      profession: 'mining',
      resource: 'iron_ore',
      baseYield: 1,
      maxCharges: 4,
      regenPerDay: 2,
    },
  ],
}

function stateInRoom(room: Room) {
  let state = initGame(createDefaultPlayer(), room)
  state = enterRoom(state, room)
  return state
}

describe('GatherNodes', () => {
  describe('scaling', () => {
    it('yield increases with profession level', () => {
      const low = scaledGatherYield(2, 1)
      const high = scaledGatherYield(2, 10)
      expect(high).toBeGreaterThan(low)
    })

    it('bonus chance increases with profession level', () => {
      const low = scaledBonusChance(0.1, 1)
      const high = scaledBonusChance(0.1, 8)
      expect(high).toBeGreaterThan(low)
    })
  })

  describe('gatherFromNode', () => {
    it('grants materials, profession XP, and costs stamina', () => {
      let state = stateInRoom(forestRoom)
      const staminaBefore = state.player.stamina
      const xpBefore = state.player.professions.forestry.xp

      state = gatherFromNode(state, 'test_oak')

      expect(state.player.materials?.oak_wood).toBeGreaterThan(0)
      expect(state.player.stamina).toBe(staminaBefore - 1)
      expect(state.player.professions.forestry.xp).toBe(xpBefore + GATHER_XP_BASE)
      expect(state.gatherNodeState?.test_oak?.charges).toBe(2)
    })

    it('depletes charges and blocks at zero', () => {
      let state = stateInRoom(forestRoom)
      state = gatherFromNode(state, 'test_oak')
      state = gatherFromNode(state, 'test_oak')
      state = gatherFromNode(state, 'test_oak')
      expect(state.gatherNodeState?.test_oak?.charges).toBe(0)

      const blocked = gatherFromNode(state, 'test_oak')
      expect(blocked.statusMessage).toContain('depleted')
      expect(blocked.player.materials?.oak_wood).toBe(state.player.materials?.oak_wood)
    })

    it('enforces minLevel requirement', () => {
      const state = stateInRoom(forestRoom)
      const result = gatherFromNode(state, 'test_herbs')
      expect(result.statusMessage).toContain('level 5')
    })

    it('iron_ore gathers from mining node', () => {
      let state = stateInRoom(caveRoom)
      state = gatherFromNode(state, 'test_iron')
      expect(state.player.materials?.iron_ore).toBeGreaterThan(0)
    })

    it('bonus chance scales with profession level', () => {
      const low = scaledBonusChance(0.1, 1)
      const high = scaledBonusChance(0.1, 10)
      expect(high).toBeGreaterThan(low)
    })

    it('bonus drops grant extra profession XP when roll succeeds', () => {
      const node = forestRoom.gatherNodes![1]!
      const rng = { next: () => 0 } as SeededRandom
      const roll = rollGatherYield(node, 10, rng)
      expect(roll.bonusItems.length).toBeGreaterThan(0)
    })

    it('can level profession from repeated gathering', () => {
      let state = stateInRoom(forestRoom)
      for (let i = 0; i < 3; i++) {
        state = gatherFromNode(state, 'test_oak')
      }
      expect(state.player.professions.forestry.xp).toBe(GATHER_XP_BASE * 3)
    })
  })

  describe('regenerateGatherNodes', () => {
    it('restores charges generously on day advance, clamped at max', () => {
      let state = stateInRoom(forestRoom)
      state = gatherFromNode(state, 'test_oak')
      state = gatherFromNode(state, 'test_oak')
      state = gatherFromNode(state, 'test_oak')
      expect(state.gatherNodeState?.test_oak?.charges).toBe(0)

      state = advanceDay(state)
      expect(state.gatherNodeState?.test_oak?.charges).toBe(3)
    })
  })

  describe('save migration', () => {
    it('defaults missing gatherNodeState', () => {
      expect(normalizeGatherNodeState({})).toEqual({})
    })

    it('defaults missing professions on legacy save shape', () => {
      const player = createDefaultPlayer()
      const { professions: _p, ...legacy } = player
      const normalized = normalizePlayerProfessions(legacy)
      expect(Object.keys(normalized)).toHaveLength(7)
    })
  })

  describe('getGatherNodeRuntimeState', () => {
    it('reports full charges before first gather', () => {
      const state = stateInRoom(forestRoom)
      const runtime = getGatherNodeRuntimeState(state, forestRoom.gatherNodes![0]!)
      expect(runtime.charges).toBe(3)
      expect(runtime.maxCharges).toBe(3)
    })
  })
})
