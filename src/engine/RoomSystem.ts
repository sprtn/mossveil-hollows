/**
 * Room System Design
 * 
 * Supports both static (hand-authored) and procedurally generated rooms.
 * Rooms form a connected graph with guaranteed paths to progression.
 */

import type { EncounterDef, Enemy } from './GameLoopDesign'

/**
 * Exit direction (compass + up/down for future expansion)
 */
export type ExitDirection = 'north' | 'south' | 'east' | 'west' | 'up' | 'down'

/**
 * Room exit to adjacent room
 */
export interface RoomExit {
  direction: ExitDirection
  targetRoomId: string
  locked?: boolean
  requiresItem?: string // Item ID to unlock (e.g., 'key_1')
  hidden?: boolean // Discovered only on certain conditions
}

/**
 * Static room definition (hand-authored JSON)
 */
export interface StaticRoom {
  id: string
  type: 'static'
  name: string
  description: string
  exits: RoomExit[]
  encounters?: EncounterDef[]
  flavor?: {
    // Narrative elements
    onEnter?: string // Text shown when entering room
    onExit?: string // Text shown when leaving
    atmosphere?: string // Mood/theme
  }
  difficulty?: number // 1-10 scale for encounters
}

/**
 * Procedurally generated room definition
 */
export interface ProceduralRoom {
  id: string
  type: 'procedural'
  seed: number // Deterministic generation from seed
  name: string // Generated name based on seed
  description: string // Generated description
  exits: RoomExit[]
  encounters?: EncounterDef[]
  difficulty: number // 1-10, affects enemy stats
  biome?: 'forest' | 'cave' | 'dungeon' | 'ruin' // Affects encounters & descriptions
}

/**
 * Union type for any room
 */
export type Room = StaticRoom | ProceduralRoom

/**
 * Room graph structure for tracking connections
 */
export interface RoomGraph {
  rooms: Map<string, Room>
  // Adjacency for pathfinding
  adjacency: Map<string, string[]>
  // Rooms on critical path (guaranteed to reach end)
  criticalPath: string[]
  // Optional rooms (can be skipped)
  optional: Set<string>
}

/**
 * Configuration for procedural room generation
 */
export interface RoomGenConfig {
  width: number // Number of rooms horizontally
  height: number // Number of rooms vertically
  connectedness: 0.5 | 0.7 | 0.9 // How many extra connections (0.5 = mostly linear, 0.9 = highly connected)
  minDifficulty: number
  maxDifficulty: number
  biomes: ('forest' | 'cave' | 'dungeon' | 'ruin')[]
  encounterDensity: 0.3 | 0.5 | 0.7 // Fraction of rooms with encounters
}

/**
 * Encounter template for generation
 */
export interface EncounterTemplate {
  type: 'random' | 'fixed'
  triggerChance: number
  enemyPool: Enemy[] // Enemies to randomly pick from
  minEnemies: number
  maxEnemies: number
}

/**
 * Procedural encounter templates by difficulty
 */
export const ENCOUNTER_TEMPLATES: Map<number, EncounterTemplate> = new Map([
  [1, { type: 'random', triggerChance: 0.4, enemyPool: [], minEnemies: 1, maxEnemies: 1 }],
  [2, { type: 'random', triggerChance: 0.5, enemyPool: [], minEnemies: 1, maxEnemies: 2 }],
  [3, { type: 'random', triggerChance: 0.6, enemyPool: [], minEnemies: 1, maxEnemies: 3 }],
  [5, { type: 'random', triggerChance: 0.7, enemyPool: [], minEnemies: 2, maxEnemies: 4 }],
  [8, { type: 'random', triggerChance: 0.8, enemyPool: [], minEnemies: 2, maxEnemies: 5 }],
])

/**
 * Procedural room name seeds (deterministic)
 */
export const ROOM_NAMES = {
  forest: [
    'Ancient Thicket',
    'Shadowed Grove',
    'Twisted Path',
    'Lost Clearing',
    'Overgrown Trail',
    'Misty Hollow',
    'Darkwood',
    'Fang Forest',
  ],
  cave: [
    'Crystal Cavern',
    'Obsidian Tunnel',
    'Echoing Chamber',
    'Underground River',
    'Stalactite Hall',
    'Magma Pit',
    'Midnight Grotto',
  ],
  dungeon: [
    'Forgotten Vault',
    'Crumbling Tower',
    'Prison Cell',
    'Throne Room',
    'Guard Hall',
    'Treasure Chamber',
    'Ritual Circle',
  ],
  ruin: [
    'Collapsed Temple',
    'Shattered Plaza',
    'Abandoned Sanctum',
    'Weathered Gate',
    'Stone Garden',
    'Fallen Statue Hall',
  ],
}
