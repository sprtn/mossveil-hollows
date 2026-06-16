import { describe, it, expect } from 'vitest'
import { createDefaultPlayer } from '../CombatEngine'
import { initGame, enterRoom, continueFromCombatResults, endEncounter, triggerGatherDanger, triggerEncounter, gatherFromNode } from '../GameLoop'
import {
  computeGatherDangerChance,
  getNodeRichness,
  securePendingGather,
  forfeitPendingGather,
  clearPendingGather,
  buildPendingGather,
  pickGatherEncounter,
  GATHER_DANGER_SAFE_CEILING,
  GATHER_DANGER_CAP,
} from '../GatherDanger'
import { pickGatherHazardEvent, resolveEventChoice, startEvent } from '../EventSystem'
import { applyOutcomes } from '../Outcomes'
import { SeededRandom } from '../CombatEngine'
import type { Room } from '../GameLoopDesign'
import type { GatherNode } from '../GatherNodes'

const plainNode: GatherNode = {
  id: 'plain',
  profession: 'forestry',
  resource: 'oak_wood',
  baseYield: 1,
  maxCharges: 5,
  regenPerDay: 2,
}

const richNode: GatherNode = {
  id: 'rich',
  profession: 'herbalism',
  resource: 'green_herb',
  baseYield: 3,
  bonusDrops: [
    { item: 'moonshade_herb', chance: 0.05 },
    { item: 'corrupted_sap', chance: 0.12 },
  ],
  maxCharges: 4,
  regenPerDay: 2,
}

const safeRoom: Room = {
  id: 'safe_forest',
  name: 'Safe',
  description: 'Safe',
  zoneId: 'forest',
  difficulty: 1,
  encounters: [],
  exits: [],
  gatherNodes: [plainNode],
}

const deepRoom: Room = {
  id: 'deep_ruins',
  name: 'Deep Ruins',
  description: 'Dangerous',
  zoneId: 'ruins',
  difficulty: 5,
  encounters: [
    {
      id: 'ruins_guard',
      type: 'random',
      triggerChance: 0.5,
      enemies: [
        {
          id: 'ward_guard',
          name: 'Ward Guard',
          hp: 30,
          maxHp: 30,
          level: 4,
          stats: { strength: 14, defense: 5, constitution: 10, dexterity: 6, agility: 5 },
          xpReward: 50,
        },
      ],
    },
  ],
  exits: [],
  gatherNodes: [richNode],
}

const noHazardZoneRoom: Room = {
  ...deepRoom,
  id: 'unknown_zone',
  zoneId: 'unknown_zone',
  encounters: [],
}

function stateInRoom(room: Room) {
  let state = initGame(createDefaultPlayer(), room)
  state = enterRoom(state, room)
  state = {
    ...state,
    gatherNodeState: {
      [room.gatherNodes![0]!.id]: {
        charges: room.gatherNodes![0]!.maxCharges,
        maxCharges: room.gatherNodes![0]!.maxCharges,
        regenPerDay: room.gatherNodes![0]!.regenPerDay,
        lastRegenDay: 1,
      },
    },
  }
  return state
}

describe('GatherDanger', () => {
  describe('getNodeRichness', () => {
    it('ranks rich high-yield/rare-bonus node above plain node', () => {
      expect(getNodeRichness(richNode)).toBeGreaterThan(getNodeRichness(plainNode))
    })
  })

  describe('computeGatherDangerChance', () => {
    it('is near-zero for low difficulty and humble node', () => {
      const chance = computeGatherDangerChance(1, getNodeRichness(plainNode))
      expect(chance).toBeLessThanOrEqual(GATHER_DANGER_SAFE_CEILING)
      expect(chance).toBeLessThan(0.06)
    })

    it('is meaningfully high for high difficulty and rich node', () => {
      const low = computeGatherDangerChance(1, getNodeRichness(plainNode))
      const high = computeGatherDangerChance(5, getNodeRichness(richNode))
      expect(high).toBeGreaterThan(0.15)
      expect(high).toBeGreaterThan(low * 3)
      expect(high).toBeLessThanOrEqual(GATHER_DANGER_CAP)
    })
  })

  describe('pending gather resolution', () => {
    it('grants resources and consumes charge only on secure', () => {
      let state = stateInRoom(safeRoom)
      const roll = { primaryQty: 2, bonusItems: [] as Array<{ item: string; qty: number }> }
      state = {
        ...state,
        pendingGather: buildPendingGather(plainNode, safeRoom, roll, 8, 'combat'),
      }
      const matsBefore = state.player.materials?.oak_wood ?? 0
      const chargesBefore = state.gatherNodeState!.plain!.charges

      state = securePendingGather(state)

      expect(state.pendingGather).toBeUndefined()
      expect(state.player.materials?.oak_wood).toBe(matsBefore + 2)
      expect(state.gatherNodeState?.plain?.charges).toBe(chargesBefore - 1)
      expect(state.statusMessage).toContain('Secured')
    })

    it('forfeits without consuming charge', () => {
      let state = stateInRoom(safeRoom)
      state = {
        ...state,
        pendingGather: buildPendingGather(
          plainNode,
          safeRoom,
          { primaryQty: 3, bonusItems: [] },
          8,
          'combat'
        ),
      }
      const matsBefore = state.player.materials?.oak_wood ?? 0
      const chargesBefore = state.gatherNodeState!.plain!.charges

      state = forfeitPendingGather(state)

      expect(state.pendingGather).toBeUndefined()
      expect(state.player.materials?.oak_wood ?? 0).toBe(matsBefore)
      expect(state.gatherNodeState?.plain?.charges).toBe(chargesBefore)
    })

    it('survives combat round-trip and clears after continue', () => {
      let state = stateInRoom(deepRoom)
      state = {
        ...state,
        pendingGather: buildPendingGather(
          richNode,
          deepRoom,
          { primaryQty: 4, bonusItems: [{ item: 'moonshade_herb', qty: 1 }] },
          12,
          'combat'
        ),
        phase: 'combat_results',
        combatResults: {
          result: 'win',
          xpGained: 10,
          goldGained: 0,
          lootGained: [],
          combatLog: [],
          levelsGained: 0,
          events: [],
        },
      }

      state = continueFromCombatResults(state)

      expect(state.pendingGather).toBeUndefined()
      expect(state.player.materials?.green_herb).toBeGreaterThan(0)
      expect(state.gatherNodeState?.rich?.charges).toBe(richNode.maxCharges - 1)
      expect(state.phase).toBe('room_exploring')
    })

    it('does not double-grant on second continue', () => {
      let state = stateInRoom(deepRoom)
      state = {
        ...state,
        pendingGather: buildPendingGather(
          richNode,
          deepRoom,
          { primaryQty: 2, bonusItems: [] },
          8,
          'combat'
        ),
        phase: 'combat_results',
        combatResults: {
          result: 'win',
          xpGained: 0,
          goldGained: 0,
          lootGained: [],
          combatLog: [],
          levelsGained: 0,
          events: [],
        },
      }
      state = continueFromCombatResults(state)
      const mats = state.player.materials?.green_herb ?? 0
      state = continueFromCombatResults({ ...state, combatResults: state.combatResults })
      expect(state.player.materials?.green_herb ?? 0).toBe(mats)
    })
  })

  describe('triggerGatherDanger', () => {
    it('falls back to combat when zone has no hazard deck', () => {
      const state = stateInRoom(noHazardZoneRoom)
      const pending = buildPendingGather(
        richNode,
        noHazardZoneRoom,
        { primaryQty: 2, bonusItems: [] },
        8,
        'combat'
      )
      expect(pickGatherHazardEvent(state, 'unknown_zone')).toBeNull()

      const rng = new SeededRandom(42)
      const after = triggerGatherDanger(state, pending, richNode.id)

      expect(after.pendingGather).toBeDefined()
      expect(after.phase).toBe('encounter_action')
      expect(after.currentEncounter?.enemies.length).toBeGreaterThan(0)
    })

    it('can start a hazard event when deck exists', () => {
      const state = stateInRoom(deepRoom)
      const hazard = pickGatherHazardEvent(state, 'ruins')
      expect(hazard).not.toBeNull()

      const pending = buildPendingGather(
        richNode,
        deepRoom,
        { primaryQty: 2, bonusItems: [] },
        8,
        'hazard'
      )
      const after = startEvent({ ...state, pendingGather: pending }, hazard!)

      expect(after.phase).toBe('event')
      expect(after.activeEvent?.eventId).toMatch(/^gather_/)
      expect(after.pendingGather).toBeDefined()
    })
  })

  describe('gatherFromNode integration', () => {
    it('pays stamina even when danger interrupts', () => {
      let state = stateInRoom(deepRoom)
      const staminaBefore = state.player.stamina

      for (let i = 0; i < 30; i++) {
        state = {
          ...stateInRoom(deepRoom),
          turnCount: i,
          moveCount: i,
        }
        const after = gatherFromNode(state, 'rich')
        if (after.pendingGather) {
          expect(after.player.stamina).toBe(staminaBefore - 1)
          return
        }
      }
      expect.fail('expected at least one danger trigger in 30 seeded attempts')
    })

    it('blocks gather when stamina insufficient', () => {
      let state = stateInRoom(safeRoom)
      state = { ...state, player: { ...state.player, stamina: 0 } }
      const after = gatherFromNode(state, 'plain')
      expect(after.statusMessage).toContain('exhausted')
      expect(after.gatherNodeState?.plain?.charges).toBe(plainNode.maxCharges)
    })

    it('safe room gathering still succeeds without danger at difficulty 0', () => {
      const zeroDiffRoom = { ...safeRoom, difficulty: 0 }
      let state = stateInRoom(zeroDiffRoom)
      state = gatherFromNode(state, 'plain')
      expect(state.pendingGather).toBeUndefined()
      expect(state.player.materials?.oak_wood).toBeGreaterThan(0)
      expect(state.gatherNodeState?.plain?.charges).toBe(plainNode.maxCharges - 1)
    })
  })

  describe('hazard event resolve_gather', () => {
    it('applyOutcomes secure grants held pull', () => {
      let state = stateInRoom(safeRoom)
      state = {
        ...state,
        pendingGather: buildPendingGather(
          plainNode,
          safeRoom,
          { primaryQty: 3, bonusItems: [] },
          8,
          'hazard'
        ),
      }
      state = applyOutcomes(state, [{ kind: 'resolve_gather', result: 'secure' }])
      expect(state.player.materials?.oak_wood).toBe(3)
      expect(state.pendingGather).toBeUndefined()
    })

    it('secures held pull on positive resolution', () => {
      let state = stateInRoom({ ...safeRoom, difficulty: 3, zoneId: 'forest' })
      const hazard = pickGatherHazardEvent(state, 'forest')!
      const pending = buildPendingGather(
        plainNode,
        safeRoom,
        { primaryQty: 3, bonusItems: [] },
        8,
        'hazard'
      )
      state = startEvent({ ...state, pendingGather: pending }, hazard)
      state = resolveEventChoice(state, 0)
      expect(state.player.materials?.oak_wood).toBeGreaterThan(0)
      expect(state.pendingGather).toBeUndefined()
    })

    it('forfeits held pull on bad resolution', () => {
      let state = stateInRoom({ ...safeRoom, difficulty: 3, zoneId: 'forest' })
      const hazard = pickGatherHazardEvent(state, 'forest')!
      const pending = buildPendingGather(
        plainNode,
        safeRoom,
        { primaryQty: 3, bonusItems: [] },
        8,
        'hazard'
      )
      state = startEvent({ ...state, pendingGather: pending }, hazard)
      const charges = state.gatherNodeState?.plain?.charges
      state = resolveEventChoice(state, 1)
      expect(state.player.materials?.oak_wood ?? 0).toBe(0)
      expect(state.gatherNodeState?.plain?.charges).toBe(charges)
      expect(state.pendingGather).toBeUndefined()
    })
  })

  describe('pickGatherEncounter', () => {
    it('reuses room encounter enemies when available', () => {
      const enemies = pickGatherEncounter(deepRoom, new SeededRandom(1))
      expect(enemies[0]?.id).toBe('ward_guard')
    })
  })

  describe('endEncounter forfeit', () => {
    it('forfeits pending gather on combat flee', () => {
      let state = stateInRoom(deepRoom)
      const pending = buildPendingGather(
        richNode,
        deepRoom,
        { primaryQty: 2, bonusItems: [] },
        8,
        'combat'
      )
      const enemies = pickGatherEncounter(deepRoom, new SeededRandom(1))
      state = triggerEncounter(
        { ...state, pendingGather: pending, forcedEncounter: true },
        enemies
      )
      expect(state.phase).toBe('encounter_action')
      state = endEncounter(state, 'flee', [])
      expect(state.pendingGather).toBeUndefined()
      expect(state.gatherNodeState?.rich?.charges).toBe(richNode.maxCharges)
    })
  })
})
