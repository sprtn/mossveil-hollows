/**
 * Captain Bryn — paid stat practice (deterministic +1 stat, gold + day per session).
 */

import type { GameState, PlayerStatKey } from './GameLoopDesign'
import { advanceDay } from './DayAdvance'
import { raisePlayerStat } from './PlayerStats'
import { statLabel } from './statDisplay'
import {
  BRYN_STAT_PRACTICE_GOLD,
  BRYN_STAT_PRACTICE_MAX_SESSIONS,
} from './gameConfig'

export type BrynStatPracticeOutcome = {
  ok: boolean
  stat: PlayerStatKey
  goldSpent: number
  dayAdvanced: boolean
  sessionsRemaining: number
  message: string
}

export function brynStatSessionsRemaining(player: GameState['player']): number {
  const used = player.brynStatSessionsUsed ?? 0
  return Math.max(0, BRYN_STAT_PRACTICE_MAX_SESSIONS - used)
}

export function canPracticeStat(state: GameState): boolean {
  if (!state.currentRoom.isHub) return false
  if (brynStatSessionsRemaining(state.player) <= 0) return false
  if (state.player.gold < BRYN_STAT_PRACTICE_GOLD) return false
  return true
}

export function attemptBrynStatPractice(
  state: GameState,
  stat: PlayerStatKey
): { state: GameState; outcome: BrynStatPracticeOutcome | null } {
  if (!canPracticeStat(state)) {
    return { state, outcome: null }
  }

  const dayBefore = state.day ?? 1
  const sessionsUsed = state.player.brynStatSessionsUsed ?? 0

  let next: GameState = {
    ...state,
    player: {
      ...state.player,
      gold: state.player.gold - BRYN_STAT_PRACTICE_GOLD,
    },
  }
  next = advanceDay(next)
  next = raisePlayerStat(next, stat)
  next = {
    ...next,
    player: {
      ...next.player,
      brynStatSessionsUsed: sessionsUsed + 1,
    },
  }

  const sessionsRemaining = brynStatSessionsRemaining(next.player)
  const label = statLabel(stat)

  return {
    state: next,
    outcome: {
      ok: true,
      stat,
      goldSpent: BRYN_STAT_PRACTICE_GOLD,
      dayAdvanced: (next.day ?? 1) === dayBefore + 1,
      sessionsRemaining,
      message: `Under Bryn's drill, your ${label} improves. (${sessionsRemaining} sessions left)`,
    },
  }
}
