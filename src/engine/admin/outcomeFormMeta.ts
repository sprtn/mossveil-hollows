import type { OutcomeEffect, OutcomeRequirement } from '../Outcomes'

export type FieldType = 'text' | 'number' | 'boolean' | 'select' | 'ref'

export type RefEntity =
  | 'items'
  | 'materials'
  | 'quests'
  | 'questStages'
  | 'npcs'
  | 'skills'
  | 'recipes'
  | 'encounters'
  | 'rooms'
  | 'zones'
  | 'areas'
  | 'buildings'
  | 'flags'
  | 'counters'
  | 'marketCategories'

export interface FieldDef {
  key: string
  label: string
  type: FieldType
  optional?: boolean
  options?: string[]
  refType?: RefEntity
}

export interface KindMeta {
  label: string
  fields: FieldDef[]
}

const PROFESSION_IDS = ['forestry', 'mining', 'herbalism', 'farming_fishing', 'smithing', 'fletching', 'alchemy']
const STATUS_TYPES = ['poison', 'stun', 'bleed', 'slow', 'stun_immune']
const STAT_TYPES = ['strength', 'constitution', 'dexterity', 'agility', 'defense', 'level']
const HUB_PANELS = ['train', 'craft', 'shop', 'profession_train']
const GATHER_RESULTS = ['secure', 'forfeit']

export const OUTCOME_EFFECT_META: Record<OutcomeEffect['kind'], KindMeta> = {
  give_item: {
    label: 'Give Item',
    fields: [
      { key: 'itemId', label: 'Item', type: 'ref', refType: 'items' },
      { key: 'qty', label: 'Qty', type: 'number' },
    ],
  },
  take_item: {
    label: 'Take Item',
    fields: [
      { key: 'itemId', label: 'Item', type: 'ref', refType: 'items' },
      { key: 'qty', label: 'Qty', type: 'number' },
    ],
  },
  give_gold: {
    label: 'Give Gold',
    fields: [{ key: 'amount', label: 'Amount', type: 'number' }],
  },
  take_gold: {
    label: 'Take Gold',
    fields: [{ key: 'amount', label: 'Amount', type: 'number' }],
  },
  give_material: {
    label: 'Give Material',
    fields: [
      { key: 'materialId', label: 'Material', type: 'ref', refType: 'materials' },
      { key: 'qty', label: 'Qty', type: 'number' },
    ],
  },
  take_material: {
    label: 'Take Material',
    fields: [
      { key: 'materialId', label: 'Material', type: 'ref', refType: 'materials' },
      { key: 'qty', label: 'Qty', type: 'number' },
    ],
  },
  heal: {
    label: 'Heal',
    fields: [{ key: 'amount', label: 'Amount', type: 'number' }],
  },
  damage: {
    label: 'Damage',
    fields: [{ key: 'amount', label: 'Amount', type: 'number' }],
  },
  apply_status: {
    label: 'Apply Status',
    fields: [
      { key: 'status', label: 'Status', type: 'select', options: STATUS_TYPES },
      { key: 'turns', label: 'Turns', type: 'number' },
      { key: 'power', label: 'Power', type: 'number' },
    ],
  },
  set_flag: {
    label: 'Set Flag',
    fields: [
      { key: 'flag', label: 'Flag', type: 'ref', refType: 'flags' },
      { key: 'value', label: 'Value', type: 'boolean' },
    ],
  },
  advance_quest: {
    label: 'Advance Quest',
    fields: [
      { key: 'questId', label: 'Quest', type: 'ref', refType: 'quests' },
      { key: 'stageId', label: 'Stage', type: 'ref', refType: 'questStages', optional: true },
    ],
  },
  learn_skill: {
    label: 'Learn Skill',
    fields: [{ key: 'skillId', label: 'Skill', type: 'ref', refType: 'skills' }],
  },
  unlock_area: {
    label: 'Unlock Area',
    fields: [{ key: 'areaId', label: 'Area', type: 'ref', refType: 'areas' }],
  },
  clear_wounded: {
    label: 'Clear Wounded',
    fields: [],
  },
  set_wounded: {
    label: 'Set Wounded',
    fields: [],
  },
  restore_stamina: {
    label: 'Restore Stamina',
    fields: [{ key: 'amount', label: 'Amount', type: 'number' }],
  },
  restore_energy: {
    label: 'Restore Energy',
    fields: [{ key: 'amount', label: 'Amount', type: 'number' }],
  },
  start_quest: {
    label: 'Start Quest',
    fields: [{ key: 'questId', label: 'Quest', type: 'ref', refType: 'quests' }],
  },
  start_combat: {
    label: 'Start Combat',
    fields: [{ key: 'encounterId', label: 'Encounter', type: 'ref', refType: 'encounters' }],
  },
  increment_counter: {
    label: 'Increment Counter',
    fields: [
      { key: 'counter', label: 'Counter', type: 'ref', refType: 'counters' },
      { key: 'amount', label: 'Amount', type: 'number', optional: true },
    ],
  },
  give_vendor_xp: {
    label: 'Give Vendor XP',
    fields: [
      { key: 'vendorId', label: 'Vendor (NPC)', type: 'ref', refType: 'npcs' },
      { key: 'amount', label: 'Amount', type: 'number' },
    ],
  },
  record_market_sale: {
    label: 'Record Market Sale',
    fields: [
      { key: 'materialId', label: 'Material', type: 'ref', refType: 'materials' },
      { key: 'qty', label: 'Qty', type: 'number' },
    ],
  },
  open_hub_panel: {
    label: 'Open Hub Panel',
    fields: [
      { key: 'panel', label: 'Panel', type: 'select', options: HUB_PANELS },
      { key: 'npcId', label: 'NPC', type: 'ref', refType: 'npcs' },
    ],
  },
  resolve_gather: {
    label: 'Resolve Gather',
    fields: [{ key: 'result', label: 'Result', type: 'select', options: GATHER_RESULTS }],
  },
  unlock_profession_tier: {
    label: 'Unlock Profession Tier',
    fields: [
      { key: 'profession', label: 'Profession', type: 'select', options: PROFESSION_IDS },
      { key: 'tier', label: 'Tier', type: 'number' },
    ],
  },
  purchase_recipe: {
    label: 'Purchase Recipe',
    fields: [{ key: 'recipeId', label: 'Recipe', type: 'ref', refType: 'recipes' }],
  },
}

export const OUTCOME_REQUIREMENT_META: Record<OutcomeRequirement['kind'], KindMeta> = {
  has_item: {
    label: 'Has Item',
    fields: [
      { key: 'itemId', label: 'Item', type: 'ref', refType: 'items' },
      { key: 'qty', label: 'Qty', type: 'number', optional: true },
    ],
  },
  has_material: {
    label: 'Has Material',
    fields: [
      { key: 'materialId', label: 'Material', type: 'ref', refType: 'materials' },
      { key: 'qty', label: 'Qty', type: 'number', optional: true },
    ],
  },
  has_flag: {
    label: 'Has Flag',
    fields: [{ key: 'flag', label: 'Flag', type: 'ref', refType: 'flags' }],
  },
  not_has_flag: {
    label: 'Not Has Flag',
    fields: [{ key: 'flag', label: 'Flag', type: 'ref', refType: 'flags' }],
  },
  has_skill: {
    label: 'Has Skill',
    fields: [{ key: 'skillId', label: 'Skill', type: 'ref', refType: 'skills' }],
  },
  stat_at_least: {
    label: 'Stat At Least',
    fields: [
      { key: 'stat', label: 'Stat', type: 'select', options: STAT_TYPES },
      { key: 'value', label: 'Value', type: 'number' },
    ],
  },
  gold_at_least: {
    label: 'Gold At Least',
    fields: [{ key: 'amount', label: 'Amount', type: 'number' }],
  },
  quest_stage: {
    label: 'Quest Stage',
    fields: [
      { key: 'questId', label: 'Quest', type: 'ref', refType: 'quests' },
      { key: 'stageId', label: 'Stage', type: 'ref', refType: 'questStages' },
    ],
  },
  has_active_quest: {
    label: 'Has Active Quest',
    fields: [{ key: 'questId', label: 'Quest', type: 'ref', refType: 'quests' }],
  },
  not_has_quest: {
    label: 'Not Has Quest',
    fields: [{ key: 'questId', label: 'Quest', type: 'ref', refType: 'quests' }],
  },
  quest_completed: {
    label: 'Quest Completed',
    fields: [{ key: 'questId', label: 'Quest', type: 'ref', refType: 'quests' }],
  },
  counter_at_least: {
    label: 'Counter At Least',
    fields: [
      { key: 'counter', label: 'Counter', type: 'ref', refType: 'counters' },
      { key: 'value', label: 'Value', type: 'number' },
    ],
  },
  building_level: {
    label: 'Building Level',
    fields: [
      { key: 'building', label: 'Building', type: 'ref', refType: 'buildings' },
      { key: 'level', label: 'Level', type: 'number' },
    ],
  },
  building_below: {
    label: 'Building Below',
    fields: [
      { key: 'building', label: 'Building', type: 'ref', refType: 'buildings' },
      { key: 'level', label: 'Level', type: 'number' },
    ],
  },
  has_craft_orders: {
    label: 'Has Craft Orders',
    fields: [{ key: 'npcId', label: 'NPC', type: 'ref', refType: 'npcs' }],
  },
  vendor_tier_at_least: {
    label: 'Vendor Tier At Least',
    fields: [
      { key: 'vendorId', label: 'Vendor (NPC)', type: 'ref', refType: 'npcs' },
      { key: 'tier', label: 'Tier', type: 'number' },
    ],
  },
  market_supply_at_least: {
    label: 'Market Supply At Least',
    fields: [
      { key: 'category', label: 'Category', type: 'ref', refType: 'marketCategories' },
      { key: 'value', label: 'Value', type: 'number' },
    ],
  },
  market_supply_below: {
    label: 'Market Supply Below',
    fields: [
      { key: 'category', label: 'Category', type: 'ref', refType: 'marketCategories' },
      { key: 'value', label: 'Value', type: 'number' },
    ],
  },
  area_unlocked: {
    label: 'Area Unlocked',
    fields: [{ key: 'areaId', label: 'Area', type: 'ref', refType: 'areas' }],
  },
  profession_at_least: {
    label: 'Profession At Least',
    fields: [
      { key: 'profession', label: 'Profession', type: 'select', options: PROFESSION_IDS },
      { key: 'level', label: 'Level', type: 'number' },
    ],
  },
}

export const EFFECT_KIND_OPTIONS = Object.entries(OUTCOME_EFFECT_META).map(([kind, meta]) => ({
  id: kind as OutcomeEffect['kind'],
  label: meta.label,
}))

export const REQUIREMENT_KIND_OPTIONS = Object.entries(OUTCOME_REQUIREMENT_META).map(([kind, meta]) => ({
  id: kind as OutcomeRequirement['kind'],
  label: meta.label,
}))

export function makeDefaultEffect(kind: OutcomeEffect['kind']): OutcomeEffect {
  const meta = OUTCOME_EFFECT_META[kind]
  const obj: Record<string, unknown> = { kind }
  for (const field of meta.fields) {
    if (field.optional) continue
    if (field.type === 'number') obj[field.key] = 0
    else if (field.type === 'boolean') obj[field.key] = false
    else if (field.type === 'select') obj[field.key] = field.options?.[0] ?? ''
    else obj[field.key] = ''
  }
  return obj as OutcomeEffect
}

export function makeDefaultRequirement(kind: OutcomeRequirement['kind']): OutcomeRequirement {
  const meta = OUTCOME_REQUIREMENT_META[kind]
  const obj: Record<string, unknown> = { kind }
  for (const field of meta.fields) {
    if (field.optional) continue
    if (field.type === 'number') obj[field.key] = 0
    else if (field.type === 'boolean') obj[field.key] = false
    else if (field.type === 'select') obj[field.key] = field.options?.[0] ?? ''
    else obj[field.key] = ''
  }
  return obj as OutcomeRequirement
}
