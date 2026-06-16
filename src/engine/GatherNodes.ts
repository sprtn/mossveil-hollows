/**
 * Resource-node gathering — definitions, depletion, profession XP, and regen.
 */

import type { GameState, Room } from './GameLoopDesign'
import { SeededRandom } from './CombatEngine'
import { getBuildingLevel } from './BuildingSystem'
import { addMaterial } from './Materials'
import { getItemName } from './ItemDatabase'
import {
  grantProfessionXp,
  getProfessionLevel,
  PROFESSIONS,
  type ProfessionId,
} from './Professions'
import {
  applyGatherStaminaCost,
  buildPendingGather,
  rollGatherDangerTriggered,
  getNodeRichness,
  GATHER_DANGER_TRIGGER_MESSAGE,
} from './GatherDanger'

// --- Tunable placeholders for playtest tuning ---

/** Stamina spent per gather action. */
export const GATHER_STAMINA_COST = 1

/** Base profession XP awarded per successful gather. */
export const GATHER_XP_BASE = 8

/** Extra profession XP when a bonus/rare drop procs. */
export const GATHER_XP_BONUS_DROP = 4

/** Additional yield per profession level above 1 (multiplicative). */
export const GATHER_YIELD_PER_LEVEL = 0.12

/** Bonus drop chance added per profession level above 1. */
export const GATHER_BONUS_CHANCE_PER_LEVEL = 0.025

/** Max bonus drop chance after level scaling. */
export const GATHER_BONUS_CHANCE_CAP = 0.85

/** Logging camp +1 oak when forestry oak_wood node is gathered (legacy behavior). */
export const LOGGING_CAMP_OAK_BONUS = 1

// --- Types ---

export type GatheringProfessionId = Extract<
  ProfessionId,
  'forestry' | 'mining' | 'herbalism' | 'farming_fishing'
>

export interface GatherBonusDrop {
  item: string
  chance: number
}

export interface GatherNode {
  id: string
  profession: GatheringProfessionId
  resource: string
  baseYield: number
  bonusDrops?: GatherBonusDrop[]
  maxCharges: number
  regenPerDay: number
  minLevel?: number
}

export interface GatherNodeRuntimeState {
  charges: number
  maxCharges: number
  regenPerDay: number
  lastRegenDay: number
}

// --- Labels for UI ---

const RESOURCE_GATHER_LABELS: Record<string, string> = {
  oak_wood: 'Chop Oak',
  stone: 'Chip Stone',
  iron_ore: 'Mine Iron Vein',
  green_herb: 'Gather Herbs',
  moonshade_herb: 'Harvest Moonshade',
  raw_fish: 'Fish the Stream',
  fresh_produce: 'Forage Produce',
  crystal_sliver: 'Harvest Crystals',
  corrupted_sap: 'Tap Corrupted Sap',
}

export function getGatherNodeLabel(node: GatherNode): string {
  return RESOURCE_GATHER_LABELS[node.resource] ?? `Gather ${getItemName(node.resource)}`
}

// --- Node lookup ---

export function findGatherNode(room: Room, nodeId: string): GatherNode | undefined {
  return room.gatherNodes?.find((n) => n.id === nodeId)
}

function gatherSeed(state: GameState, nodeId: string): number {
  const roomId = state.currentRoom.id
  let hash = 0
  for (let i = 0; i < roomId.length; i++) {
    hash = ((hash << 5) - hash + roomId.charCodeAt(i)) | 0
  }
  for (let i = 0; i < nodeId.length; i++) {
    hash = ((hash << 5) - hash + nodeId.charCodeAt(i)) | 0
  }
  return Math.abs(
    (hash * 73856093) ^ (state.turnCount * 19349663) ^ ((state.moveCount ?? 0) * 83492791)
  )
}

// --- Runtime state ---

export function normalizeGatherNodeState(
  state: Pick<GameState, 'gatherNodeState'>
): Record<string, GatherNodeRuntimeState> {
  return { ...(state.gatherNodeState ?? {}) }
}

function initNodeState(node: GatherNode, day: number): GatherNodeRuntimeState {
  return {
    charges: node.maxCharges,
    maxCharges: node.maxCharges,
    regenPerDay: node.regenPerDay,
    lastRegenDay: day,
  }
}

export function getGatherNodeRuntimeState(
  state: GameState,
  node: GatherNode
): GatherNodeRuntimeState {
  const existing = state.gatherNodeState?.[node.id]
  if (existing) return existing
  return initNodeState(node, state.day ?? 1)
}

function ensureNodeStateInGame(
  state: GameState,
  node: GatherNode
): { state: GameState; runtime: GatherNodeRuntimeState } {
  const day = state.day ?? 1
  const existing = state.gatherNodeState?.[node.id]
  if (existing) {
    return { state, runtime: existing }
  }
  const runtime = initNodeState(node, day)
  return {
    state: {
      ...state,
      gatherNodeState: {
        ...(state.gatherNodeState ?? {}),
        [node.id]: runtime,
      },
    },
    runtime,
  }
}

// --- Yield & bonus scaling ---

export function scaledGatherYield(baseYield: number, professionLevel: number): number {
  const mult = 1 + Math.max(0, professionLevel - 1) * GATHER_YIELD_PER_LEVEL
  return Math.max(1, Math.floor(baseYield * mult))
}

export function scaledBonusChance(baseChance: number, professionLevel: number): number {
  const bonus = Math.max(0, professionLevel - 1) * GATHER_BONUS_CHANCE_PER_LEVEL
  return Math.min(GATHER_BONUS_CHANCE_CAP, baseChance + bonus)
}

export interface GatherRollResult {
  primaryQty: number
  bonusItems: Array<{ item: string; qty: number }>
}

export function rollGatherYield(
  node: GatherNode,
  professionLevel: number,
  rng: SeededRandom,
  loggingCampBonus = 0
): GatherRollResult {
  let primaryQty = scaledGatherYield(node.baseYield, professionLevel)
  if (loggingCampBonus > 0) {
    primaryQty += loggingCampBonus
  }

  const bonusItems: Array<{ item: string; qty: number }> = []
  for (const drop of node.bonusDrops ?? []) {
    const chance = scaledBonusChance(drop.chance, professionLevel)
    if (rng.next() < chance) {
      bonusItems.push({ item: drop.item, qty: 1 })
    }
  }

  return { primaryQty, bonusItems }
}

// --- Regeneration ---
// NOTE: Regen runs on advanceDay() (rest/inn/sleep only). If the day-loop changes
// later, regen timing may need revisiting.

export function regenerateGatherNodes(state: GameState, newDay: number): GameState {
  const nodeState = state.gatherNodeState
  if (!nodeState || Object.keys(nodeState).length === 0) return state

  const updated: Record<string, GatherNodeRuntimeState> = {}
  for (const [id, runtime] of Object.entries(nodeState)) {
    const daysElapsed = Math.max(0, newDay - runtime.lastRegenDay)
    if (daysElapsed <= 0) {
      updated[id] = runtime
      continue
    }
    const regen = runtime.regenPerDay * daysElapsed
    updated[id] = {
      ...runtime,
      charges: Math.min(runtime.maxCharges, runtime.charges + regen),
      lastRegenDay: newDay,
    }
  }

  return { ...state, gatherNodeState: updated }
}

// --- Main gather action ---

export function gatherFromNode(state: GameState, nodeId: string): GameState {
  if (state.phase !== 'room_exploring') return state
  if (state.currentRoom.isHub) return state

  const node = findGatherNode(state.currentRoom, nodeId)
  if (!node) return state

  if (state.player.stamina < GATHER_STAMINA_COST) {
    return { ...state, statusMessage: 'Too exhausted to gather.' }
  }

  let working = ensureNodeStateInGame(state, node).state
  const runtime = working.gatherNodeState![node.id]!

  if (runtime.charges <= 0) {
    return { ...working, statusMessage: `${getGatherNodeLabel(node)} is depleted.` }
  }

  const professionLevel = getProfessionLevel(working.player, node.profession)
  if (node.minLevel !== undefined && professionLevel < node.minLevel) {
    const profName = PROFESSIONS[node.profession].name
    return {
      ...working,
      statusMessage: `Requires ${profName} level ${node.minLevel} (you are ${professionLevel}).`,
    }
  }

  const loggingCampBonus =
    node.profession === 'forestry' &&
    node.resource === 'oak_wood' &&
    getBuildingLevel(working, 'logging_camp') > 0
      ? LOGGING_CAMP_OAK_BONUS
      : 0

  const rng = new SeededRandom(gatherSeed(working, nodeId))
  const roll = rollGatherYield(node, professionLevel, rng, loggingCampBonus)
  const xpGain = GATHER_XP_BASE + (roll.bonusItems.length > 0 ? GATHER_XP_BONUS_DROP : 0)

  // Stamina is always spent — the player attempted the labor.
  working = applyGatherStaminaCost(working, GATHER_STAMINA_COST)

  const roomDifficulty = working.currentRoom.difficulty ?? 0
  const richness = getNodeRichness(node)
  const dangerRoll = new SeededRandom(gatherSeed(working, nodeId) ^ 0x9e3779b9)
  if (roomDifficulty > 0 && rollGatherDangerTriggered(roomDifficulty, richness, dangerRoll)) {
    const pending = buildPendingGather(node, working.currentRoom, roll, xpGain, 'combat')
    return {
      ...working,
      pendingGather: pending,
      statusMessage: GATHER_DANGER_TRIGGER_MESSAGE,
      gatherDangerInterrupt: true,
    }
  }

  let player = working.player
  player = addMaterial(player, node.resource, roll.primaryQty)
  for (const bonus of roll.bonusItems) {
    player = addMaterial(player, bonus.item, bonus.qty)
  }

  const xpResult = grantProfessionXp(player, node.profession, xpGain)
  player = xpResult.player

  const updatedRuntime: GatherNodeRuntimeState = {
    ...runtime,
    charges: runtime.charges - 1,
  }

  const parts: string[] = [
    `Gathered ${roll.primaryQty} ${getItemName(node.resource)}`,
  ]
  for (const bonus of roll.bonusItems) {
    parts.push(`+1 ${getItemName(bonus.item)}`)
  }
  if (xpResult.leveledUp) {
    parts.push(
      `${PROFESSIONS[node.profession].name} reached level ${xpResult.newLevel}!`
    )
  }

  return {
    ...working,
    player,
    gatherNodeState: {
      ...(working.gatherNodeState ?? {}),
      [node.id]: updatedRuntime,
    },
    statusMessage: `${parts.join(', ')}.`,
  }
}
