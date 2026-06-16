/**
 * Event card system — data-driven exploration events.
 */

import type { GameState } from './GameLoopDesign'
import type { EventCard, ActiveEventState } from './ContentSchemas'
import { applyOutcomes, meetsRequirements } from './Outcomes'
import { triggerEncounter } from './GameLoop'
import type { Enemy } from './GameLoopDesign'
import { SeededRandom } from './CombatEngine'

import berryThicket from '../assets/events/berry_thicket.json'
import woundedTraveler from '../assets/events/wounded_traveler.json'
import fallenLog from '../assets/events/fallen_log.json'
import oldShrine from '../assets/events/old_shrine.json'
import ambush from '../assets/events/ambush.json'
import gatherForestSnare from '../assets/events/gather_forest_snare.json'
import gatherCaveRockslide from '../assets/events/gather_cave_rockslide.json'
import gatherCaveGas from '../assets/events/gather_cave_gas.json'
import gatherRuinsWard from '../assets/events/gather_ruins_ward.json'
import { forfeitPendingGather } from './GatherDanger'

const FOREST_EVENTS: EventCard[] = [
  berryThicket as EventCard,
  woundedTraveler as EventCard,
  fallenLog as EventCard,
  oldShrine as EventCard,
  ambush as EventCard,
]

const GATHER_HAZARD_EVENTS: EventCard[] = [
  gatherForestSnare as EventCard,
  gatherCaveRockslide as EventCard,
  gatherCaveGas as EventCard,
  gatherRuinsWard as EventCard,
]

const ALL_EVENTS: EventCard[] = [...FOREST_EVENTS, ...GATHER_HAZARD_EVENTS]

const eventMap = new Map(ALL_EVENTS.map((e) => [e.id, e]))

/** Enemy templates for event-triggered combat */
const ENCOUNTER_TEMPLATES: Record<string, Enemy[]> = {
  forest_ambush: [
    {
      id: 'ambush_bandit',
      name: 'Bandit Scout',
      hp: 26,
      maxHp: 26,
      level: 2,
      stats: { strength: 13, defense: 3, constitution: 8, dexterity: 6, agility: 7 },
      archetype: 'attacker',
      xpReward: 40,
      goldReward: 8,
      loot: [
        { templateId: 'cloth_scrap', quantity: 1, chance: 0.65 },
        { templateId: 'rusty_shortsword', quantity: 1, chance: 0.06 },
      ],
    },
  ],
}

export function getEnemyEncounter(encounterId: string): Enemy[] {
  const enemies = ENCOUNTER_TEMPLATES[encounterId]
  return enemies ? enemies.map((e) => ({ ...e, statusEffects: e.statusEffects ?? [] })) : []
}

export function getEventCard(eventId: string): EventCard | undefined {
  return eventMap.get(eventId)
}

export function pickRandomEvent(state: GameState, zone: string): EventCard | null {
  const candidates = FOREST_EVENTS.filter((e) => {
    if (e.zone !== zone) return false
    if (e.once && state.flags?.[`event_done_${e.id}`]) return false
    return true
  })
  if (candidates.length === 0) return null

  const seed =
    ((state.seed ?? 0) * 73856093) ^
    ((state.exploreCount ?? 0) * 19349663) ^
    ((state.turnCount ?? 0) * 83492791)
  const rng = new SeededRandom(seed)
  const totalWeight = candidates.reduce((sum, e) => sum + e.weight, 0)
  let roll = rng.next() * totalWeight

  for (const event of candidates) {
    roll -= event.weight
    if (roll <= 0) return event
  }
  return candidates[candidates.length - 1] ?? null
}

export function pickGatherHazardEvent(state: GameState, zone: string): EventCard | null {
  const candidates = GATHER_HAZARD_EVENTS.filter((e) => {
    if (e.zone !== zone) return false
    if (!e.gatherHazard) return false
    if (e.once && state.flags?.[`event_done_${e.id}`]) return false
    return true
  })
  if (candidates.length === 0) return null

  const seed =
    ((state.seed ?? 0) * 48271) ^
    ((state.turnCount ?? 0) * 224729) ^
    ((state.moveCount ?? 0) * 6197) ^
    zone.length
  const rng = new SeededRandom(seed)
  const totalWeight = candidates.reduce((sum, e) => sum + e.weight, 0)
  let roll = rng.next() * totalWeight

  for (const event of candidates) {
    roll -= event.weight
    if (roll <= 0) return event
  }
  return candidates[candidates.length - 1] ?? null
}

export function startEvent(state: GameState, event: EventCard): GameState {
  const activeEvent: ActiveEventState = {
    eventId: event.id,
    title: event.title,
    text: event.text,
    choices: event.choices,
  }
  return { ...state, phase: 'event', activeEvent }
}

export function resolveEventChoice(
  state: GameState,
  choiceIndex: number
): GameState {
  const active = state.activeEvent
  if (!active) return state

  const choice = active.choices[choiceIndex]
  if (!choice || !meetsRequirements(state, choice.requires)) return state

  let result = applyOutcomes(state, choice.outcomes)

  const eventCard = getEventCard(active.eventId)
  if (eventCard?.once) {
    result = {
      ...result,
      flags: { ...(result.flags ?? {}), [`event_done_${active.eventId}`]: true },
    }
  }

  // Handle start_combat effects separately (avoid circular import in Outcomes)
  for (const effect of choice.outcomes) {
    if (effect.kind === 'start_combat') {
      const enemies = getEnemyEncounter(effect.encounterId)
      if (enemies.length > 0) {
        result = triggerEncounter(
          { ...result, activeEvent: undefined, phase: 'room_exploring', forcedEncounter: true },
          enemies
        )
        return result
      }
    }
  }

  result = {
    ...result,
    phase: 'event',
    activeEvent: { ...active, lastResult: choice.resultText },
  }

  return result
}

export function dismissEvent(state: GameState): GameState {
  let next: GameState = { ...state, activeEvent: undefined, phase: 'room_exploring' }
  if (next.pendingGather?.source === 'hazard') {
    next = forfeitPendingGather(next, 'You abandon the harvest.')
  }
  return next
}
