/**
 * Event card system — data-driven exploration events.
 */

import type { GameState } from './GameLoopDesign'
import type { EventCard, ActiveEventState } from './ContentSchemas'
import { applyOutcomes, meetsRequirements } from './Outcomes'
import { triggerEncounter } from './GameLoop'
import type { Enemy } from './GameLoopDesign'
import { SeededRandom } from './CombatEngine'
import { getEvent, getAllEvents, getEncounterTemplate } from './admin/ContentRegistry'
import { forfeitPendingGather } from './GatherDanger'

function explorationEvents(): EventCard[] {
  return getAllEvents().filter((e) => !e.gatherHazard)
}

function gatherHazardEvents(): EventCard[] {
  return getAllEvents().filter((e) => e.gatherHazard)
}

export function getEnemyEncounter(encounterId: string): Enemy[] {
  return getEncounterTemplate(encounterId) ?? []
}

export function getEventCard(eventId: string): EventCard | undefined {
  return getEvent(eventId)
}

export function pickRandomEvent(state: GameState, zone: string): EventCard | null {
  const candidates = explorationEvents().filter((e) => {
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
  const candidates = gatherHazardEvents().filter((e) => {
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
