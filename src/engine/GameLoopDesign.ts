/**
 * Core Game Loop Design - unified types for the finite RPG
 */

import type { Quality } from './Quality'
import type { ProfessionId, ProfessionState } from './Professions'
import type { RoomExit } from './RoomSystem'
import type { GatherNode, GatherNodeRuntimeState } from './GatherNodes'
import type { PendingGather } from './GatherDanger'
import type {
  ActiveEventState,
  CraftOrder,
  DialogueState,
  MarketCategoryState,
  NpcEconomicState,
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
  | 'defend'
  | 'flee'
  | 'use_skill'

export type PlayerStatKey = 'strength' | 'constitution' | 'dexterity' | 'agility' | 'defense'

export interface PlayerStats {
  strength: number
  constitution: number
  dexterity: number
  agility: number
  defense: number
}

export type ItemType = 'weapon' | 'armor' | 'consumable' | 'key' | 'quest' | 'crafting'
export type ItemEffect = 'heal_health' | 'restore_energy' | 'remove_poison' | 'boost_damage' | 'boost_defense'
export type StatusType =
  | 'poison'
  | 'stun'
  | 'bleed'
  | 'slow'
  | 'stun_immune'
  | 'accuracy_down'
  | 'vulnerable'
export type EnemyArchetype = 'attacker' | 'defender' | 'caster'

/** Item template loaded from JSON */
export interface ItemTemplate {
  id: string
  name: string
  description: string
  type: ItemType
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

/** Runtime inventory entry — stacks merge on (templateId, quality). */
export interface InventoryItem {
  templateId: string
  quantity: number
  quality: Quality
}

/** Equipped gear references a specific template + quality instance. */
export interface EquipmentRef {
  templateId: string
  quality: Quality
}

export interface EquipmentSlots {
  weapon?: EquipmentRef
  armor?: EquipmentRef
}

export interface StatusEffect {
  type: StatusType
  turnsRemaining: number
  power: number
  /** Bleed stack count; damage per tick = stacks * power. */
  stacks?: number
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
  wounded: boolean
  professions: Record<ProfessionId, ProfessionState>
  /** Highest recipe tier unlocked per crafting profession (tier 1 default). */
  unlockedProfessionTiers?: Partial<Record<ProfessionId, number>>
  /** Recipe ids bought from profession trainers. */
  purchasedRecipes?: string[]
  /** Captain Bryn stat-practice sessions completed (lifetime cap, all stats shared). */
  brynStatSessionsUsed?: number
}

export interface LootDrop {
  templateId: string
  quantity: number
  /** Drop probability 0–1. Defaults to 1 (guaranteed). */
  chance?: number
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
  difficulty?: number
  gatherNodes?: GatherNode[]
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
    /** Combat log only — consumables are applied via useCombatConsumable, not PlayerAction. */
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

export interface CombatBuff {
  id: string
  label: string
  damageMultiplier?: number
  sourceItemId?: string
  /** Additive evasion bonus for the player (reduces enemy hit chance). */
  evasionBonus?: number
  /** Multiplier on damage taken by the player (e.g. 1.25 = +25% damage taken). */
  damageTakenMultiplier?: number
}

export interface Encounter {
  id: string
  enemies: Enemy[]
  roundNumber: number
  rngState: number
  result?: EncounterResult
  playerAction?: PlayerAction
  playerDefending?: boolean
  playerBracing?: boolean
  playerBonusAction?: boolean
  consumableUsedThisTurn?: boolean
  combatBuffs?: CombatBuff[]
  combatLog?: string[]
  lastEvents?: CombatEvent[]
  /** Farm respawn encounter — reduced rewards, no shard/unlock. */
  isRespawnBoss?: boolean
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
  /** Calendar day when each zone boss was last cleared (first kill or respawn). */
  bossClearedDay?: Partial<Record<string, number>>
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
  npcEconomicState?: Record<string, NpcEconomicState>
  pendingHubPanel?: {
    panel: 'train' | 'craft' | 'shop' | 'profession_train'
    npcId: string
  }
  gatherNodeState?: Record<string, GatherNodeRuntimeState>
  /** Held harvest when gather danger interrupts — granted only on success. */
  pendingGather?: PendingGather
  /** Set when a gather roll triggered danger; resolved by gatherFromNode wrapper. */
  gatherDangerInterrupt?: boolean
}

export interface PlayerActionOptions {
  targetId?: string
  itemId?: string
  skillId?: string
}
