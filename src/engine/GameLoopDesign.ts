/**
 * Core Game Loop Design - unified types for the finite RPG
 */

import type { RoomExit } from './RoomSystem'
import type {
  ActiveEventState,
  CraftOrder,
  DialogueState,
  MarketCategoryState,
  ProductionBuildingState,
  QuestProgress,
  VendorState,
} from './ContentSchemas'

export type GamePhase =
  | 'game_start'
  | 'room_enter'
  | 'room_exploring'
  | 'encounter_action'
  | 'combat_results'
  | 'event'
  | 'dialogue'
  | 'game_over'
  | 'victory'

export type EncounterResult = 'win' | 'loss' | 'flee'

export type PlayerAction =
  | 'attack'
  | 'use_item'
  | 'defend'
  | 'flee'
  | 'skill_power_strike'
  | 'skill_cleave'
  | 'skill_bandage'
  | 'skill_brace'
  | 'skill_antidote_lore'
  | 'skill_precise_shot'
  | 'skill_bleed'
  | 'skill_hamstring'
  | 'skill_second_wind'

export type PlayerStatKey = 'strength' | 'constitution' | 'dexterity' | 'agility' | 'defense'

export interface PlayerStats {
  strength: number
  constitution: number
  dexterity: number
  agility: number
  defense: number
}

export type ItemType = 'weapon' | 'armor' | 'consumable' | 'key' | 'quest' | 'crafting'
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
export type ItemEffect = 'heal_health' | 'restore_energy' | 'remove_poison' | 'boost_damage' | 'boost_defense'
export type StatusType = 'poison' | 'stun' | 'bleed' | 'slow'
export type EnemyArchetype = 'attacker' | 'defender' | 'caster'

/** Item template loaded from JSON */
export interface ItemTemplate {
  id: string
  name: string
  description: string
  type: ItemType
  rarity: ItemRarity
  stackable: boolean
  maxStackSize?: number
  power?: number
  effect?: ItemEffect
  damageBonus?: number
  defenseBonus?: number
  statBonus?: Partial<PlayerStats>
  slot?: 'weapon' | 'armor' | 'body'
  buyPrice?: number
  sellPrice?: number
}

/** Runtime inventory entry */
export interface InventoryItem {
  templateId: string
  quantity: number
}

export interface EquipmentSlots {
  weapon?: string
  armor?: string
}

export interface StatusEffect {
  type: StatusType
  turnsRemaining: number
  power: number
}

export interface Player {
  id: string
  name: string
  hp: number
  maxHp: number
  level: number
  xp: number
  gold: number
  energy: number
  maxEnergy: number
  stamina: number
  maxStamina: number
  inventory: InventoryItem[]
  equipment: EquipmentSlots
  stats: PlayerStats
  statusEffects: StatusEffect[]
  unallocatedAttributePoints: number
  materials: Record<string, number>
  knownSkills: string[]
  skillPoints: number
  wounded: boolean
}

export interface LootDrop {
  templateId: string
  quantity: number
}

export interface Enemy {
  id: string
  name: string
  hp: number
  maxHp: number
  level: number
  stats: PlayerStats
  archetype?: EnemyArchetype
  abilities?: string[]
  loot?: LootDrop[]
  goldReward?: number
  xpReward?: number
  isBoss?: boolean
  statusEffects?: StatusEffect[]
}

export interface Room {
  id: string
  name: string
  description: string
  encounters: EncounterDef[]
  exits: RoomExit[]
  isHub?: boolean
  isFinalBoss?: boolean
  picture?: string
  zoneId?: string
}

export interface EncounterDef {
  id: string
  type: 'fixed' | 'random'
  enemies: Enemy[]
  triggerChance?: number
  onTrigger?: 'auto' | 'on_move'
}

export interface CombatEvent {
  type:
    | 'attack'
    | 'heal'
    | 'defend'
    | 'skill'
    | 'status_apply'
    | 'status_tick'
    | 'flee'
    | 'miss'
    | 'use_item'
    | 'stun_skip'
  source: string
  sourceName: string
  target?: string
  targetName?: string
  amount?: number
  crit?: boolean
  status?: StatusType
  message: string
}

export interface Encounter {
  id: string
  enemies: Enemy[]
  turnOrder: string[]
  currentTurnIndex: number
  roundNumber: number
  rngState: number
  result?: EncounterResult
  playerAction?: PlayerAction
  playerDefending?: boolean
  playerBracing?: boolean
  playerBonusAction?: boolean
  combatLog?: string[]
  lastEvents?: CombatEvent[]
}

export interface CombatResults {
  result: 'win' | 'loss' | 'flee'
  xpGained: number
  goldGained: number
  lootGained: InventoryItem[]
  combatLog: string[]
  levelsGained: number
  events: CombatEvent[]
}

export interface GameState {
  phase: GamePhase
  player: Player
  currentRoom: Room
  currentEncounter?: Encounter
  combatResults?: CombatResults
  roomHistory: string[]
  previousRoomId?: string
  turnCount: number
  gameOverReason?: 'victory' | 'defeat'
  seed?: number
  encounterChainCount?: number
  lastHealingOpportunity?: number
  moveCount?: number
  exploreCount?: number
  zonesCleared?: string[]
  finalBossDefeated?: boolean
  quests: Record<string, QuestProgress>
  flags: Record<string, boolean>
  townBuildings: Record<string, number>
  areasUnlocked: string[]
  bossesDefeated: string[]
  day: number
  activeEvent?: ActiveEventState
  activeDialogue?: DialogueState
  saveVersion?: number
  statusMessage?: string
  forcedEncounter?: boolean
  counters?: Record<string, number>
  craftOrders?: CraftOrder[]
  marketState?: Record<string, MarketCategoryState>
  marketMaterialStock?: Record<string, number>
  vendorState?: Record<string, VendorState>
  productionState?: Record<string, ProductionBuildingState>
  pendingHubPanel?: { panel: 'train' | 'craft' | 'shop'; npcId: string }
}

export interface PlayerActionOptions {
  targetId?: string
  itemId?: string
}
