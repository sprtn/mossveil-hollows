/**
 * Combat Resolver - Executes combat actions and state transitions
 *
 * Handles:
 * - Player action resolution (attack, defend, use item, flee)
 * - Enemy turn execution (deterministic AI: always attack)
 * - Combat flow (setup → player turn → enemy turns → check end)
 * - Flee success/failure logic
 */

import type {
  CombatState,
  CombatPhase,
  PlayerAction,
  CombatLogEntry,
  CombatResult,
} from './CombatSystem'
import {
  calculateDamage,
  applyDamage,
  applyHealing,
  isPlayerAlive,
  getAliveEnemies,
  isCombatOver,
} from './CombatSystem'

/**
 * Progress combat to next phase
 */
export function nextCombatPhase(state: CombatState): CombatPhase {
  switch (state.phase) {
    case 'combat_setup':
      return 'player_turn_start'

    case 'player_turn_start':
      return 'player_action'

    case 'player_action':
      // Check if player can still act
      if (!isPlayerAlive(state)) {
        return 'check_victory'
      }
      return 'enemy_turns'

    case 'enemy_turns':
      return 'check_victory'

    case 'check_victory':
      if (isCombatOver(state)) {
        return 'combat_end'
      }
      return 'player_turn_start'

    case 'combat_end':
      return 'combat_end' // Terminal state

    default:
      return 'combat_end'
  }
}

/**
 * Execute player action (attack, defend, use item, flee)
 *
 * @returns true if action was successful, false if not valid
 */
export function executePlayerAction(
  state: CombatState,
  action: PlayerAction
): CombatState {
  const newState = { ...state }
  let logEntry: CombatLogEntry | null = null

  switch (action.actionType) {
    case 'attack': {
      // Select first alive enemy (no targeting UI yet)
      const enemies = getAliveEnemies(newState)
      if (enemies.length === 0) {
        return newState
      }

      const target = enemies[0]
      if (!target) {
        return newState
      }

      const damageRoll = calculateDamage(newState.player, target, false)
      target.currentHp = applyDamage(target, damageRoll.finalDamage)

      // Update enemy alive status
      if (target.currentHp <= 0) {
        target.isAlive = false
      }

      logEntry = {
        round: newState.round,
        actor: newState.player.name,
        action: 'attack',
        target: target.name,
        result: `attacked ${target.name} for ${damageRoll.finalDamage} damage (strength ${newState.player.strength} - defense ${damageRoll.targetDefense} + variance ${damageRoll.variance})`,
        damage: damageRoll.finalDamage,
      }

      newState.playerDefending = false
      newState.playerDefenseBonus = 0
      break
    }

    case 'defend': {
      // Defend increases defense for next enemy turn
      newState.playerDefending = true
      newState.playerDefenseBonus = 5 // Fixed defense bonus

      logEntry = {
        round: newState.round,
        actor: newState.player.name,
        action: 'defend',
        result: `took a defensive stance (+${newState.playerDefenseBonus} defense next round)`,
      }
      break
    }

    case 'use_item': {
      // Simple health potion logic (no item database yet)
      // For now, just apply healing
      if (action.itemId) {
        const healingAmount = 30 // Fixed healing amount
        const newHp = applyHealing(newState.player, healingAmount)
        const actualHealing = newHp - newState.player.currentHp
        newState.player.currentHp = newHp

        logEntry = {
          round: newState.round,
          actor: newState.player.name,
          action: 'use_item',
          result: `used ${action.itemId} and restored ${actualHealing} HP`,
          damage: actualHealing,
        }

        newState.playerDefending = false
        newState.playerDefenseBonus = 0
      }
      break
    }

    case 'flee': {
      // Flee success: 50% chance by default
      const fleeChance = 0.5
      const roll = Math.random()

      if (roll < fleeChance) {
        logEntry = {
          round: newState.round,
          actor: newState.player.name,
          action: 'flee',
          result: `successfully fled from combat!`,
        }
        newState.phase = 'combat_end'
        if (logEntry) {
          newState.combatLog.push(logEntry)
        }
        return newState
      } else {
        logEntry = {
          round: newState.round,
          actor: newState.player.name,
          action: 'flee',
          result: `failed to flee from combat!`,
        }

        newState.playerDefending = false
        newState.playerDefenseBonus = 0
      }
      break
    }
  }

  // Add log entry
  if (logEntry) {
    newState.combatLog.push(logEntry)
  }

  return newState
}

/**
 * Execute single enemy turn (deterministic: always attack)
 */
export function executeEnemyTurn(state: CombatState, enemyId: string): CombatState {
  const newState = { ...state }
  const enemy = newState.enemies.find((e) => e.id === enemyId)

  if (!enemy || !enemy.isAlive || enemy.currentHp <= 0) {
    return newState
  }

  // Simple AI: attack player (always)
  const playerDefenseBonus = newState.playerDefending ? newState.playerDefenseBonus : 0
  const effectiveDefense = newState.player.defense + playerDefenseBonus

  const damageRoll = calculateDamage(
    enemy,
    { ...newState.player, defense: effectiveDefense },
    newState.playerDefending
  )

  newState.player.currentHp = applyDamage(newState.player, damageRoll.finalDamage)

  const logEntry: CombatLogEntry = {
    round: newState.round,
    actor: enemy.name,
    action: 'enemy_attack',
    target: newState.player.name,
    result: `attacked ${newState.player.name} for ${damageRoll.finalDamage} damage${
      newState.playerDefending ? ' (reduced by defense)' : ''
    }`,
    damage: damageRoll.finalDamage,
  }

  newState.combatLog.push(logEntry)
  newState.playerDefending = false // Reset defend flag after enemy turn

  return newState
}

/**
 * Execute all alive enemy turns in order
 */
export function executeAllEnemyTurns(state: CombatState): CombatState {
  let newState = { ...state }

  for (const enemy of getAliveEnemies(newState)) {
    if (isPlayerAlive(newState)) {
      newState = executeEnemyTurn(newState, enemy.id)
    }
  }

  return newState
}

/**
 * Advance to next turn (increment turn index, handle round end)
 */
export function advanceTurn(state: CombatState): CombatState {
  const newState = { ...state }

  // Move to next actor in turn order
  newState.currentTurnIndex += 1

  // Check if we've completed a full round
  if (newState.currentTurnIndex >= newState.turnOrder.length) {
    newState.currentTurnIndex = 0
    newState.round += 1
  }

  return newState
}

/**
 * Get combat result (called when combat ends)
 */
export function getCombatResult(state: CombatState): CombatResult {
  const aliveEnemies = getAliveEnemies(state)
  const playerWon = aliveEnemies.length === 0
  const playerFled = state.combatLog[state.combatLog.length - 1]?.action === 'flee'

  let victoryType: 'win' | 'loss' | 'fled' = 'loss'
  let goldEarned = 0
  let experienceEarned = 0
  const itemsLooted: string[] = []

  if (playerFled) {
    victoryType = 'fled'
  } else if (playerWon) {
    victoryType = 'win'

    // Calculate rewards from defeated enemies
    for (const enemy of state.enemies) {
      if (!enemy.isAlive || enemy.currentHp <= 0) {
        goldEarned += Math.ceil(enemy.strength * 2 + enemy.defense * 0.5)
        experienceEarned += 10 + state.round * 2

        // Potential item drops (placeholder)
        if (Math.random() < 0.3) {
          itemsLooted.push(`loot_${enemy.id}`)
        }
      }
    }
  }

  return {
    victoryType,
    round: state.round,
    playerHp: state.player.currentHp,
    playerMaxHp: state.player.maxHp,
    enemiesDefeated: state.enemies.filter((e) => !e.isAlive || e.currentHp <= 0).length,
    goldEarned,
    itemsLooted,
    experienceEarned,
  }
}

/**
 * Format combat log for display
 */
export function formatCombatLog(combatState: CombatState): string[] {
  return combatState.combatLog.map(
    (entry) =>
      `[Round ${entry.round}] ${entry.actor}: ${entry.result}`
  )
}

/**
 * Get combat summary (health bars, status)
 */
export interface CombatSummary {
  playerName: string
  playerHp: number
  playerMaxHp: number
  playerHpPercent: number
  playerDefending: boolean
  enemies: Array<{
    id: string
    name: string
    hp: number
    maxHp: number
    hpPercent: number
    isAlive: boolean
  }>
  currentRound: number
  lastAction?: string
}

export function getCombatSummary(state: CombatState): CombatSummary {
  const playerHpPercent = Math.round((state.player.currentHp / state.player.maxHp) * 100)

  return {
    playerName: state.player.name,
    playerHp: state.player.currentHp,
    playerMaxHp: state.player.maxHp,
    playerHpPercent,
    playerDefending: state.playerDefending,
    enemies: state.enemies.map((enemy) => ({
      id: enemy.id,
      name: enemy.name,
      hp: enemy.currentHp,
      maxHp: enemy.maxHp,
      hpPercent: Math.round((enemy.currentHp / enemy.maxHp) * 100),
      isAlive: enemy.isAlive && enemy.currentHp > 0,
    })),
    currentRound: state.round,
    lastAction:
      state.combatLog.length > 0
        ? state.combatLog[state.combatLog.length - 1]?.result
        : undefined,
  }
}
