/**
 * Player stat helpers — effective max HP with wounded penalty, etc.
 */

import type { GameState, Player, PlayerStatKey } from './GameLoopDesign'
import { WOUNDED_MAX_HP_PENALTY } from './gameConfig'
import { calculateMaxHp } from './ProgressionSystem'

/** Permanently raise one base stat by 1 (CON also recalculates maxHp). */
export function raisePlayerStat(state: GameState, stat: PlayerStatKey): GameState {
  const newStats = {
    ...state.player.stats,
    [stat]: state.player.stats[stat] + 1,
  }
  let player: Player = {
    ...state.player,
    stats: newStats,
  }

  if (stat === 'constitution') {
    const newMaxHp = calculateMaxHp(player.level, newStats.constitution)
    player = {
      ...player,
      maxHp: newMaxHp,
      hp: Math.min(player.hp + 3, newMaxHp),
    }
  }

  return { ...state, player }
}

export function getEffectiveMaxHp(player: Player): number {
  if (player.wounded) {
    return Math.floor(player.maxHp * (1 - WOUNDED_MAX_HP_PENALTY))
  }
  return player.maxHp
}

export function applyWoundedClear(player: Player): Player {
  const maxHp = player.maxHp
  return {
    ...player,
    wounded: false,
    hp: Math.min(player.hp, maxHp),
  }
}

export function applyWounded(player: Player): Player {
  const effectiveMax = Math.floor(player.maxHp * (1 - WOUNDED_MAX_HP_PENALTY))
  return {
    ...player,
    wounded: true,
    hp: Math.min(player.hp, effectiveMax),
  }
}

export function clampPlayerHp(player: Player): Player {
  const max = getEffectiveMaxHp(player)
  return { ...player, hp: Math.min(player.hp, max) }
}
