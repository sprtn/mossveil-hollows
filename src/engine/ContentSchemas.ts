/**
 * Frozen content schemas for events, crafting, quests, dialogue, buildings, NPCs, skills.
 * Author JSON against these types only — do not change without a migration plan.
 */

import type { OutcomeEffect, OutcomeRequirement } from './Outcomes'
import type { Quality } from './Quality'
import type { ProfessionId } from './Professions'
import type { CombatEvent, PlayerStatKey, StatusType } from './GameLoopDesign'

export interface EventChoice {
  text: string
  requires?: OutcomeRequirement[]
  outcomes: OutcomeEffect[]
  resultText: string
}

export interface EventCard {
  id: string
  title: string
  text: string
  zone: string
  weight: number
  once?: boolean
  /** When true, offered during gather-danger rolls in this zone. */
  gatherHazard?: boolean
  choices: EventChoice[]
}

export interface RecipeDef {
  id: string
  name: string
  station: 'workbench' | 'forge' | 'alchemy'
  profession: ProfessionId
  /** Recipe complexity tier for stamina/XP scaling (1 = simple). */
  tier: number
  npcId?: string
  requires: {
    materials: Record<string, number>
    gold: number
  }
  output: { itemId: string; qty: number }
  /** Optional override for trainer recipe-purchase gold (default: tier × RECIPE_PURCHASE_GOLD_BASE). */
  purchaseGold?: number
  unlockedBy?: { flag?: string; building?: string; buildingLevel?: number }
}

export type QuestObjectiveType =
  | 'talk_npc'
  | 'collect_material'
  | 'collect_item'
  | 'craft_item'
  | 'defeat_boss'
  | 'defeat_enemy'
  | 'visit_room'
  | 'set_flag'

export interface QuestObjective {
  type: QuestObjectiveType
  target: string
  count?: number
}

export interface QuestStage {
  id: string
  description: string
  objective: QuestObjective
  rewards: OutcomeEffect[]
}

export interface QuestDef {
  id: string
  name: string
  stages: QuestStage[]
}

export interface QuestProgress {
  questId: string
  stageIndex: number
  counters: Record<string, number>
  completed: boolean
}

export interface CraftOrder {
  id: string
  recipeId: string
  npcId: string
  itemId: string
  qty: number
  readyOnDay: number
}

export interface MarketCategoryState {
  priceMultiplier: number
  shortTermSold: number
  longTermSold: number
  localSupply: number
  lastTradeDay: number
}

export interface VendorInventoryEntry {
  templateId: string
  stock: number
  quality?: Quality
}

export interface VendorState {
  xp: number
  inventory: VendorInventoryEntry[]
}

export interface ProductionBuildingState {
  labourGoldPerDay: number
  enabled: boolean
  accumulatedLogs: number
  lastRevenue: number
  lastOutput: number
  campTreasury: number
  totalPayrollCirculated: number
  lastMorale?: number
  lastRunDay?: number
  lastSkipReason?: string
}

export interface BuildingProductionDef {
  outputMaterialId: string
  outputPerDay: number
  labourGoldPerDay: number
  fairWageGold?: number
  maxLabourGold?: number
  minLevel: number
}

export interface DialogueResponse {
  text: string
  requires?: OutcomeRequirement[]
  next?: string
  outcomes?: OutcomeEffect[]
}

export interface DialogueNode {
  id: string
  text: string
  responses: DialogueResponse[]
}

export interface DialogueDef {
  id: string
  npcId: string
  nodes: DialogueNode[]
}

export interface DialogueState {
  dialogueId: string
  npcId: string
  currentNodeId: string
}

export interface BuildingLevelDef {
  cost: { gold: number; materials: Record<string, number> }
  unlocksText?: string
  effects: OutcomeEffect[]
}

export interface BuildingDef {
  id: string
  name: string
  description?: string
  levels: BuildingLevelDef[]
  production?: BuildingProductionDef
}

export interface NpcDef {
  id: string
  name: string
  role: string
  dialogueId: string
  services?: Array<
    'shop' | 'healer' | 'crafting' | 'training' | 'profession_training' | 'buildings'
  >
}

export type SkillTargetMode =
  | 'self'
  | 'single_enemy'
  | 'all_enemies'
  /** STAGE 3 ONLY: one to-hit roll for whole sweep; all hit or all miss. */
  | 'all_enemies_single_roll'

/** How to derive attacker power for rollDamage's attackerStr argument. */
export type StatScaling =
  | { mode: 'stat'; stat: PlayerStatKey }
  | { mode: 'stat_times'; stat: PlayerStatKey; multiplier: number }
  | { mode: 'stat_plus_bonus'; stat: PlayerStatKey; bonusStat: PlayerStatKey; bonusScale: number }

export type StatusPower =
  | { kind: 'fixed'; value: number }
  | { kind: 'stat'; stat: PlayerStatKey; flat: number; scale: number }

/** STAGE 3 ONLY: chance gate before apply_status. Omitted = always applies. */
export type StatusApplyChance = {
  base: number
  perStat?: { stat: PlayerStatKey; scale: number }
  max?: number
}

/** STAGE 3 ONLY: on-hit debuff after a landed damage roll. */
export type DefenseDebuffOnHit = {
  status: StatusType
  turns: number
  power: StatusPower
}

export type SkillEffect =
  | {
      kind: 'damage'
      scaling: StatScaling
      critBonus?: number
      guaranteedHit?: boolean
      consumeDamageBuff?: boolean
      hitModifier?: number
      /** Fraction 0–1 of defender DEF ignored. */
      ignoreDefense?: number
      defenseDebuffOnHit?: DefenseDebuffOnHit
      bonusPerTargetStatus?: { status: StatusType; scale: number }
      executeBelowHpPct?: number
      executeMultiplier?: number
      /** 'kill' = execute to 0 HP; 'bonus_crit' = critBonus when above threshold. */
      executeMode?: 'kill' | 'bonus_crit'
    }
  | {
      kind: 'heal'
      flat: number
      stat?: PlayerStatKey
      statScale?: number
      target: 'self'
    }
  | {
      kind: 'apply_status'
      status: StatusType
      turns: number
      power: StatusPower
      target?: 'self' | 'enemy'
      chance?: StatusApplyChance
      stackMode?: 'refresh' | 'stack'
      /** Stacks added per application (bleed); uses stat if stackStat set. */
      stackCount?: number
      stackStat?: PlayerStatKey
      stackStatScale?: number
    }
  | {
      kind: 'remove_status'
      /** Single status or omit for all cleansable debuffs. */
      status?: StatusType
      target: 'self'
      /** Bonus heal when a status was removed (CON-scaled). */
      bonusHealStat?: PlayerStatKey
      bonusHealScale?: number
    }
  | {
      kind: 'set_encounter_flag'
      flag: 'playerBracing'
      value: boolean
    }
  | {
      kind: 'add_combat_buff'
      target: 'self'
      label: string
      evasionBonus?: number
      damageTakenMultiplier?: number
      damageMultiplier?: number
    }
  | {
      kind: 'revive'
      hpPct: number
    }

export type SkillCombatLog = {
  eventType: CombatEvent['type']
  message: string
  messageCrit?: string
  messageMiss?: string
  aggregate?: boolean
  perTargetMessages?: boolean
  perTargetMessage?: string
}

export type SkillPassiveDef = {
  hook: 'on_lethal'
  effects: SkillEffect[]
}

export type SkillOutOfCombatDef = {
  hook: 'make_camp' | 'forager' | 'treasure_sense'
  implemented: boolean
}

export type SkillCombatDef = {
  activatable: boolean
  targetMode: SkillTargetMode
  effects: SkillEffect[]
  log: SkillCombatLog
  requireLivingTarget?: boolean
  passive?: SkillPassiveDef
}

export type SkillTrainingDef = {
  governingStat: PlayerStatKey
  minStat: number
  maxStat: number
  goldCost: number
  /** Stage 3 replaces provisional tuning; marks placeholder data in JSON. */
  provisional?: boolean
}

export interface SkillDef {
  id: string
  name: string
  branch: 'might' | 'survival' | 'hunter'
  description: string
  requires: string[]
  energyCost: number
  combat?: SkillCombatDef
  training?: SkillTrainingDef
  outOfCombat?: SkillOutOfCombatDef
}

export interface ActiveEventState {
  eventId: string
  title: string
  text: string
  choices: EventChoice[]
  lastResult?: string
}
