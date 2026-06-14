/**
 * Frozen content schemas for events, crafting, quests, dialogue, buildings, NPCs, skills.
 * Author JSON against these types only — do not change without a migration plan.
 */

import type { OutcomeEffect, OutcomeRequirement } from './Outcomes'

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
  choices: EventChoice[]
}

export interface RecipeDef {
  id: string
  name: string
  station: 'workbench' | 'forge' | 'alchemy'
  npcId?: string
  requires: {
    materials: Record<string, number>
    gold: number
  }
  output: { itemId: string; qty: number }
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
  services?: Array<'shop' | 'healer' | 'crafting' | 'training' | 'buildings'>
}

export interface SkillDef {
  id: string
  name: string
  branch: 'might' | 'survival' | 'hunter'
  description: string
  requires: string[]
  cost: number
  energyCost: number
  action?: string
  effect?: string
}

export interface ActiveEventState {
  eventId: string
  title: string
  text: string
  choices: EventChoice[]
  lastResult?: string
}
