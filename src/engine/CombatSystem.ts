/**
 * Combat System Type Definitions
 *
 * Deterministic, turn-based combat:
 * - Player vs 1-3 enemies
 * - Turn order: Player always first, then enemies in order
 * - Actions: attack, defend, use item, flee
 * - No complex AI, no animations
 * - Combat is interruptible (flee)
 */

/**
 * Combat action types
 */
export type CombatAction = 'attack' | 'defend' | 'use_item' | 'flee'

/**
 * Combat phase (state machine)
 */
export type CombatPhase =
  | 'combat_setup' // Initialize, roll turn order
  | 'player_turn_start' // Player decides action
  | 'player_action' // Player executes (attack, defend, item, flee)
  | 'enemy_turns' // Each alive enemy acts
  | 'check_victory' // Did combat end?
  | 'combat_end' // Win/loss/fled

/**
 * Combat state during active battle
 */
export interface CombatState {
  id: string // Combat instance ID
  phase: CombatPhase
  player: CombatParticipant
  enemies: CombatEnemy[]
  turnOrder: TurnIndex[] // Order of participants (player first, then enemies by ID)
  currentTurnIndex: number // Index into turnOrder array
  round: number // Combat round counter
  playerDefending: boolean // Is player defending this round?
  playerDefenseBonus: number // Stacking defense bonus
  combatLog: CombatLogEntry[] // Action history
}

/**
 * Turn order index (who's up)
 */
export interface TurnIndex {
  type: 'player' | 'enemy'
  id: string // Player always 'player', enemies by their ID
  initiative: number // Speed stat (for future use)
}

/**
 * Combat participant (player or enemy)
 */
export interface CombatParticipant {
  id: string
  name: string
  maxHp: number
  currentHp: number
  strength: number
  defense: number
  speed: number // Not used for turn order yet, but tracked
}

/**
 * Enemy in combat
 */
export interface CombatEnemy extends CombatParticipant {
  isAlive: boolean
  lastActionTaken?: EnemyAction
}

/**
 * Enemy action (always attack for now)
 */
export interface EnemyAction {
  type: 'attack'
  targetId: string
  damage: number
}

/**
 * Player action (what player decides to do)
 */
export interface PlayerAction {
  actionType: CombatAction
  targetId?: string // For attack (pick specific enemy later)
  itemId?: string // For use_item
}

/**
 * Combat log entry (record of what happened)
 */
export interface CombatLogEntry {
  round: number
  actor: string // Player or enemy name
  action: CombatAction | 'enemy_attack'
  target?: string
  result: string // 'dealt 15 damage', 'defended', 'used health potion', etc.
  damage?: number // If applicable
}

/**
 * Combat result (outcome of entire combat)
 */
export interface CombatResult {
  victoryType: 'win' | 'loss' | 'fled'
  round: number
  playerHp: number
  playerMaxHp: number
  enemiesDefeated: number
  goldEarned: number
  itemsLooted: string[]
  experienceEarned: number
}

/**
 * Damage calculation result
 */
export interface DamageRoll {
  baseDamage: number
  variance: number // Random variance (-2 to +2)
  finalDamage: number
  damageDealt: number // After target defense
  targetDefense: number
  isCritical: boolean // For future use
}

/**
 * Initialize combat state
 */
export function initializeCombatState(
  combatId: string,
  player: CombatParticipant,
  enemies: CombatParticipant[]
): CombatState {
  const combatEnemies: CombatEnemy[] = enemies.map((enemy) => ({
    ...enemy,
    isAlive: true,
  }))

  // Turn order: Player always first, then enemies in order of ID
  const turnOrder: TurnIndex[] = [
    {
      type: 'player',
      id: 'player',
      initiative: player.speed,
    },
    ...combatEnemies.map((enemy) => ({
      type: 'enemy' as const,
      id: enemy.id,
      initiative: enemy.speed,
    })),
  ]

  return {
    id: combatId,
    phase: 'combat_setup',
    player: {
      ...player,
      currentHp: player.maxHp,
    },
    enemies: combatEnemies,
    turnOrder,
    currentTurnIndex: 0,
    round: 1,
    playerDefending: false,
    playerDefenseBonus: 0,
    combatLog: [],
  }
}

/**
 * Calculate damage from attacker to defender
 *
 * Formula: baseDamage - defenseReduction + variance
 * - baseDamage = attacker.strength
 * - defenseReduction = defender.defense
 * - variance = random -2 to +2
 * - minimum 1 damage
 */
export function calculateDamage(
  attacker: CombatParticipant,
  defender: CombatParticipant,
  defenderIsDefending: boolean = false
): DamageRoll {
  // Base damage from strength
  const baseDamage = Math.max(1, attacker.strength)

  // Defense reduction (50% reduction if defending, 100% otherwise)
  const defenseMultiplier = defenderIsDefending ? 0.5 : 1.0
  const targetDefense = Math.max(0, Math.floor(defender.defense * defenseMultiplier))

  // Random variance (-2 to +2)
  const variance = Math.floor(Math.random() * 5) - 2

  // Calculate final damage
  const finalDamage = Math.max(1, baseDamage - targetDefense + variance)

  return {
    baseDamage,
    variance,
    finalDamage,
    damageDealt: finalDamage,
    targetDefense,
    isCritical: false,
  }
}

/**
 * Apply damage to target, return remaining HP
 */
export function applyDamage(target: CombatParticipant, damage: number): number {
  return Math.max(0, target.currentHp - damage)
}

/**
 * Heal target, capped at maxHp
 */
export function applyHealing(target: CombatParticipant, healing: number): number {
  return Math.min(target.maxHp, target.currentHp + healing)
}

/**
 * Check if player is still alive
 */
export function isPlayerAlive(state: CombatState): boolean {
  return state.player.currentHp > 0
}

/**
 * Check if any enemies are alive
 */
export function areEnemiesAlive(state: CombatState): boolean {
  return state.enemies.some((enemy) => enemy.isAlive && enemy.currentHp > 0)
}

/**
 * Get current turn actor
 */
export function getCurrentActor(state: CombatState): TurnIndex | null {
  return state.turnOrder[state.currentTurnIndex] || null
}

/**
 * Get alive enemies
 */
export function getAliveEnemies(state: CombatState): CombatEnemy[] {
  return state.enemies.filter((enemy) => enemy.isAlive && enemy.currentHp > 0)
}

/**
 * Check if combat has ended
 */
export function isCombatOver(state: CombatState): boolean {
  return !isPlayerAlive(state) || !areEnemiesAlive(state)
}
