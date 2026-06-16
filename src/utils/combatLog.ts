/**
 * Combat log helpers — partition events and trim without dropping pinned player lines.
 */

import type { CombatEvent } from '@/engine/GameLoopDesign'

export type CombatLogEntryType = 'player' | 'enemy' | 'system'

export interface CombatLogEntry {
  message: string
  type: CombatLogEntryType
  crit?: boolean
  /** Player-authored lines for the current turn — always shown, not subject to cap. */
  pinned?: boolean
}

export const COMBAT_LOG_CAP = 12

export function classifyCombatEvent(
  event: CombatEvent,
  playerId: string
): CombatLogEntryType {
  if (event.source === playerId) return 'player'
  if (event.source === 'status') return 'system'
  return 'enemy'
}

export function partitionCombatEvents(
  events: CombatEvent[],
  playerId: string
): { playerEvents: CombatEvent[]; otherEvents: CombatEvent[] } {
  const playerEvents: CombatEvent[] = []
  const otherEvents: CombatEvent[] = []
  for (const event of events) {
    if (event.source === playerId) {
      playerEvents.push(event)
    } else {
      otherEvents.push(event)
    }
  }
  return { playerEvents, otherEvents }
}

export function combatEventsToPinnedEntries(events: CombatEvent[]): CombatLogEntry[] {
  return events.map((event) => ({
    message: event.message,
    type: 'player' as const,
    crit: event.crit,
    pinned: true,
  }))
}

/** Trim scrollable log entries; pinned player lines are kept separately in the UI. */
export function trimCombatLog(
  entries: CombatLogEntry[],
  maxSize = COMBAT_LOG_CAP
): CombatLogEntry[] {
  return entries.slice(0, maxSize)
}

/**
 * Input readiness follows engine resolve, not log animation.
 * Mirrors EncounterScreen.runAction busy lifecycle for tests.
 */
export function runCombatResolveCycle(
  getBusy: () => boolean,
  setBusy: (value: boolean) => void,
  resolve: () => void,
  animateLog: (events: CombatEvent[]) => void,
  events: CombatEvent[]
): void {
  if (getBusy()) return
  setBusy(true)
  try {
    resolve()
    animateLog(events)
  } finally {
    setBusy(false)
  }
}
