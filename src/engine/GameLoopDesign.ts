/**
 * Core Game Loop Design
 * 
 * A turn-based RPG with room exploration and encounters
 */

/**
 * GAME LOOP FLOW
 * 
 * 1. ROOM_ENTER
 *    - Load room data (layout, static encounters)
 *    - Check for auto-trigger encounters
 *    - Player can now move/act
 * 
 * 2. ROOM_EXPLORING
 *    - Player moves between room nodes/positions
 *    - Triggers random/fixed encounters OR reaches next room
 *    - If encounter → transition to ENCOUNTER_START
 *    - If reached exit → transition to ROOM_ENTER (next room)
 * 
 * 3. ENCOUNTER_START
 *    - Initialize turn order (player vs enemies)
 *    - Present action choices to player
 * 
 * 4. ENCOUNTER_ACTION
 *    - Player chooses: Attack, Use Item, Flee, Defend
 *    - Resolve player action
 *    - Enemy turn(s)
 *    - Check win/loss/flee conditions
 * 
 * 5. ENCOUNTER_END
 *    - Rewards (XP, loot, items)
 *    - Return to ROOM_EXPLORING
 *    - OR transition to GAME_OVER if player defeated
 * 
 * 6. GAME_OVER (victory or defeat)
 */

/**
 * STATE DIAGRAM (ASCII)
 * 
 *   ┌─────────────┐
 *   │  GAME_START │
 *   └──────┬──────┘
 *          │
 *          ▼
 *   ┌─────────────────┐
 *   │   ROOM_ENTER    │◄──────────────────┐
 *   │ Load room, init │                   │
 *   └────────┬────────┘                   │
 *            │                           │
 *            ▼                           │
 *   ┌──────────────────┐                │
 *   │ ROOM_EXPLORING   │                │
 *   │ Player moves     │                │
 *   └────────┬─────────┘                │
 *            │                           │
 *      ┌─────┴─────┬──────────┐         │
 *      │            │          │         │
 *   RANDOM     FIXED      EXIT      BACK_DOOR
 *   ENCOUNTER  ENCOUNTER  ROOM      (no rewards)
 *      │         │         │         │
 *      ▼         ▼         ▼         │
 *   ┌──────────────────────┐         │
 *   │ ENCOUNTER_START      │         │
 *   │ Init turn order      │         │
 *   └───────────┬──────────┘         │
 *               │                    │
 *               ▼                    │
 *   ┌──────────────────────┐         │
 *   │ ENCOUNTER_ACTION     │         │
 *   │ Player chooses       │         │
 *   └───────────┬──────────┘         │
 *               │                    │
 *        ┌──────┼──────┐             │
 *        │      │      │             │
 *       WIN   LOSS   FLEE            │
 *        │      │      │             │
 *        ▼      ▼      ▼             │
 *    REWARDS  DEFEATED   BACK─────────┘
 *        │      │          to ROOM
 *        │      ▼
 *        │  GAME_OVER
 *        │
 *        └────────┐
 *                 │ Next Room?
 *                 ▼
 *          ROOM_ENTER ◄───┘
 */

/**
 * Game phases
 */
export type GamePhase = 
  | 'game_start'
  | 'room_enter'
  | 'room_exploring'
  | 'encounter_start'
  | 'encounter_action'
  | 'encounter_end'
  | 'combat_results'
  | 'game_over'

/**
 * Encounter result
 */
export type EncounterResult = 'win' | 'loss' | 'flee'

/**
 * Player action in encounter
 */
export type PlayerAction = 'attack' | 'use_item' | 'defend' | 'flee'

/**
 * Minimal player state
 */
export interface Player {
  id: string
  name: string
  hp: number
  maxHp: number
  level: number
  xp: number
  inventory: InventoryItem[]
  stats: {
    strength: number
    defense: number
    speed: number
  }
  unallocatedAttributePoints?: number // Points available to allocate to stats
}

/**
 * Inventory item
 */
export interface InventoryItem {
  id: string
  type: 'weapon' | 'armor' | 'consumable' | 'key'
  name: string
  quantity: number
  effect?: {
    hpRestore?: number
    damageBonus?: number
    defenseBonus?: number
  }
}

/**
 * Enemy in an encounter
 */
export interface Enemy {
  id: string
  name: string
  hp: number
  maxHp: number
  level: number
  stats: {
    strength: number
    defense: number
    speed: number
  }
  loot?: InventoryItem[]
  xpReward?: number
}

import type { RoomExit } from './RoomSystem'

/**
 * Room definition (data-driven)
 */
export interface Room {
  id: string
  name: string
  description: string
  nodeCount?: number // Number of movement nodes (optional for compatibility)
  encounters: EncounterDef[]
  exits: RoomExit[] // Connections to other rooms
  nextRoomId?: string // Deprecated: use exits array instead
  isLastRoom?: boolean
  picture?: string // URL or path to room image
}

/**
 * Encounter definition
 */
export interface EncounterDef {
  id: string
  type: 'fixed' | 'random'
  enemies: Enemy[]
  triggerChance?: number // 0-1, for random encounters
  onTrigger?: 'auto' | 'on_move' // auto = immediate, on_move = when moving to node
}

/**
 * Current encounter state
 */
export interface Encounter {
  id: string
  enemies: Enemy[]
  turnOrder: string[] // IDs of player and enemies in turn order
  currentTurnIndex: number
  roundNumber: number
  result?: EncounterResult
  playerAction?: PlayerAction
  combatLog?: string[] // Combat log messages for results screen
}

/**
 * Combat results for display after encounter ends
 */
export interface CombatResults {
  result: 'win' | 'loss' | 'flee'
  xpGained: number
  lootGained: InventoryItem[]
  combatLog: string[]
  levelsGained: number
}

/**
 * Top-level game state
 */
export interface GameState {
  phase: GamePhase
  player: Player
  currentRoom: Room
  currentEncounter?: Encounter
  combatResults?: CombatResults // Results from last combat
  roomHistory: string[] // IDs of visited rooms
  previousRoomId?: string // ID of the room we came from (for "Go Back")
  turnCount: number
  gameOverReason?: 'victory' | 'defeat'
  seed?: number // Deterministic seed for randomness (optional for backward compatibility)
  encounterChainCount?: number // Number of consecutive encounters without rest/healing
  lastHealingOpportunity?: number // Turn count when last healing was available
  moveCount?: number // Counter for moves within room (ensures seed variation)
}

/**
 * Game action interface (for reducer/event system)
 */
export interface GameAction {
  type: string
  payload?: any
}
