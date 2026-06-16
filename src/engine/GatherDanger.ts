/**
 * Gathering danger — combat/hazard interrupts scaled by room difficulty and node richness.
 */

import type { Enemy, GameState, Room } from './GameLoopDesign'
import type { GatherNode, GatherNodeRuntimeState, GatherRollResult, GatheringProfessionId } from './GatherNodes'
import { SeededRandom } from './CombatEngine'
import { addMaterial } from './Materials'
import { getItemName } from './ItemDatabase'
import { grantProfessionXp, PROFESSIONS } from './Professions'

// --- Danger chance (playtest placeholders) ---

export const GATHER_DANGER_BASE = 0
/** Added per room difficulty point (0–6). */
export const GATHER_DANGER_PER_DIFFICULTY = 0.028
/** Added per richness point from getNodeRichness(). */
export const GATHER_DANGER_PER_RICHNESS = 0.038
/** Hard cap — avoids coin-flip-or-worse except at extreme depth/richness. */
export const GATHER_DANGER_CAP = 0.48
/** Early zones: difficulty ≤ this and richness below safe max stay near-zero. */
export const GATHER_DANGER_SAFE_DIFFICULTY_MAX = 1
export const GATHER_DANGER_SAFE_RICHNESS_MAX = 1.25
export const GATHER_DANGER_SAFE_CEILING = 0.04

/** Weight toward combat vs hazard event when danger triggers (remainder = hazard). */
export const GATHER_DANGER_ENCOUNTER_WEIGHT = 0.62

export const GATHER_DANGER_TRIGGER_MESSAGE =
  'Something stirs as you reach for the node…'

// --- Pending gather payload ---

export interface PendingGather {
  nodeId: string
  roomId: string
  primaryResource: string
  primaryQty: number
  bonusItems: Array<{ item: string; qty: number }>
  professionId: GatheringProfessionId
  xpGain: number
  /** Charge consumed only on secure (success). */
  source: 'combat' | 'hazard'
}

/**
 * Richness from baseYield + bonus drops (rarer / more bonuses = richer).
 * No authored fields — derived only.
 */
export function getNodeRichness(node: GatherNode): number {
  let score = node.baseYield
  for (const drop of node.bonusDrops ?? []) {
    const rarityFactor = 1 - Math.min(0.99, Math.max(0, drop.chance))
    score += 0.4 + rarityFactor * 2.2
  }
  return score
}

export function computeGatherDangerChance(roomDifficulty: number, nodeRichness: number): number {
  if (roomDifficulty <= 0) return 0

  let raw =
    GATHER_DANGER_BASE +
    roomDifficulty * GATHER_DANGER_PER_DIFFICULTY +
    nodeRichness * GATHER_DANGER_PER_RICHNESS

  if (
    roomDifficulty <= GATHER_DANGER_SAFE_DIFFICULTY_MAX &&
    nodeRichness <= GATHER_DANGER_SAFE_RICHNESS_MAX
  ) {
    raw = Math.min(raw, GATHER_DANGER_SAFE_CEILING)
  }

  return Math.min(GATHER_DANGER_CAP, Math.max(0, raw))
}

export function rollGatherDangerTriggered(
  roomDifficulty: number,
  nodeRichness: number,
  rng: SeededRandom
): boolean {
  return rng.next() < computeGatherDangerChance(roomDifficulty, nodeRichness)
}

export function isRoomGatherDangerous(room: Room): boolean {
  return (room.difficulty ?? 0) >= 2
}

export function buildPendingGather(
  node: GatherNode,
  room: Room,
  roll: GatherRollResult,
  xpGain: number,
  source: PendingGather['source']
): PendingGather {
  return {
    nodeId: node.id,
    roomId: room.id,
    primaryResource: node.resource,
    primaryQty: roll.primaryQty,
    bonusItems: roll.bonusItems,
    professionId: node.profession,
    xpGain,
    source,
  }
}

/** Stamina for the gather attempt is always spent up front (labor was attempted). */
export function applyGatherStaminaCost(state: GameState, staminaCost: number): GameState {
  return {
    ...state,
    player: {
      ...state.player,
      stamina: Math.max(0, state.player.stamina - staminaCost),
    },
  }
}

/**
 * Grant held resources + XP and consume one node charge.
 * Charge-on-success-only: interrupted gathers never decrement charges.
 */
export function securePendingGather(state: GameState): GameState {
  const pending = state.pendingGather
  if (!pending) return state

  const runtime = state.gatherNodeState?.[pending.nodeId]
  if (!runtime || pending.roomId !== state.currentRoom.id) {
    return clearPendingGather(state)
  }

  let player = addMaterial(state.player, pending.primaryResource, pending.primaryQty)
  for (const bonus of pending.bonusItems) {
    player = addMaterial(player, bonus.item, bonus.qty)
  }

  const xpResult = grantProfessionXp(player, pending.professionId, pending.xpGain)
  player = xpResult.player

  const parts: string[] = [
    `Secured ${pending.primaryQty} ${getItemName(pending.primaryResource)}`,
  ]
  for (const bonus of pending.bonusItems) {
    parts.push(`+${bonus.qty} ${getItemName(bonus.item)}`)
  }
  if (xpResult.leveledUp) {
    parts.push(
      `${PROFESSIONS[pending.professionId].name} reached level ${xpResult.newLevel}!`
    )
  }

  const updatedRuntime: GatherNodeRuntimeState = {
    ...runtime,
    charges: runtime.charges - 1,
  }

  return clearPendingGather({
    ...state,
    player,
    gatherNodeState: {
      ...(state.gatherNodeState ?? {}),
      [pending.nodeId]: updatedRuntime,
    },
    statusMessage: `${parts.join(', ')}.`,
  })
}

export function forfeitPendingGather(
  state: GameState,
  message = 'The harvest is lost — you pull back empty-handed.'
): GameState {
  if (!state.pendingGather) return state
  return clearPendingGather({
    ...state,
    statusMessage: message,
  })
}

export function clearPendingGather(state: GameState): GameState {
  if (!state.pendingGather) return state
  const { pendingGather: _removed, ...rest } = state
  return rest as GameState
}

export function resolvePendingGatherAfterCombat(state: GameState): GameState {
  if (!state.pendingGather || !state.combatResults) return state
  if (state.combatResults.result === 'win') {
    return securePendingGather(state)
  }
  if (state.combatResults.result === 'flee') {
    return forfeitPendingGather(state, 'You fled — the harvest scatters.')
  }
  return forfeitPendingGather(state)
}

const ZONE_GATHER_FALLBACK: Record<string, Enemy[]> = {
  forest: [
    {
      id: 'gather_forest_wolf',
      name: 'Forest Wolf',
      hp: 20,
      maxHp: 20,
      level: 1,
      stats: { strength: 11, defense: 2, constitution: 8, dexterity: 5, agility: 6 },
      archetype: 'attacker',
      xpReward: 28,
      goldReward: 0,
      loot: [],
    },
  ],
  cave: [
    {
      id: 'gather_cave_bat',
      name: 'Cave Bat',
      hp: 14,
      maxHp: 14,
      level: 2,
      stats: { strength: 9, defense: 1, constitution: 6, dexterity: 8, agility: 10 },
      archetype: 'caster',
      xpReward: 30,
      goldReward: 0,
      loot: [],
    },
  ],
  ruins: [
    {
      id: 'gather_ruins_sentinel',
      name: 'Warded Construct',
      hp: 28,
      maxHp: 28,
      level: 3,
      stats: { strength: 12, defense: 4, constitution: 10, dexterity: 6, agility: 5 },
      archetype: 'defender',
      xpReward: 42,
      goldReward: 0,
      loot: [],
    },
  ],
}

export function pickGatherEncounter(room: Room, rng: SeededRandom): Enemy[] {
  const pool = room.encounters.filter((e) => (e.enemies?.length ?? 0) > 0)
  if (pool.length > 0) {
    const enc = pool[Math.floor(rng.next() * pool.length)]!
    return enc.enemies!.map((e) => ({ ...e, statusEffects: e.statusEffects ?? [] }))
  }
  const zone = room.zoneId ?? 'forest'
  const fallback = ZONE_GATHER_FALLBACK[zone] ?? ZONE_GATHER_FALLBACK.forest!
  return fallback.map((e) => ({ ...e, statusEffects: e.statusEffects ?? [] }))
}

export function rollGatherDangerKind(rng: SeededRandom): 'combat' | 'hazard' {
  return rng.next() < GATHER_DANGER_ENCOUNTER_WEIGHT ? 'combat' : 'hazard'
}

export function gatherDangerSeed(state: GameState, nodeId: string): number {
  let hash = 0
  const roomId = state.currentRoom.id
  for (let i = 0; i < roomId.length; i++) {
    hash = ((hash << 5) - hash + roomId.charCodeAt(i)) | 0
  }
  for (let i = 0; i < nodeId.length; i++) {
    hash = ((hash << 5) - hash + nodeId.charCodeAt(i)) | 0
  }
  return Math.abs(
    (hash * 73856093) ^
      (state.turnCount * 19349663) ^
      ((state.moveCount ?? 0) * 83492791) ^
      0x9e3779b9
  )
}
