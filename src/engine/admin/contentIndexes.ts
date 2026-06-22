import type { Room } from '../RoomSystem'
import type {
  NpcDef,
  QuestDef,
  QuestlineDef,
  DialogueDef,
  EventCard,
  RecipeDef,
  BuildingDef,
  SkillDef,
} from '../ContentSchemas'
import type { ItemTemplate, Enemy } from '../GameLoopDesign'
import type { OutcomeEffect, OutcomeRequirement } from '../Outcomes'
import type { ContentEntityMap, ContentType } from './ContentOverlayTypes'
import type { RefEntity } from './outcomeFormMeta'
import {
  getEffectiveMap,
  getAllQuestlines,
  getAllEncounterTemplates,
} from './ContentRegistry'

export type RefOption = { id: string; label: string }

export interface QuestStageOption extends RefOption {
  questId: string
}

export type AdminRefOptions = Record<RefEntity, RefOption[]> & {
  questStages: QuestStageOption[]
}

export type ContentRegistrySnapshot = {
  [K in ContentType]: Record<string, ContentEntityMap[K]>
}

export interface ContentIndexes {
  snapshot: ContentRegistrySnapshot
  options: { [K in ContentType]: RefOption[] }
  ids: { [K in ContentType]: Set<string> }
}

function labelForEntity(type: ContentType, id: string, entity: ContentEntityMap[ContentType]): string {
  switch (type) {
    case 'rooms':
      return (entity as Room).name || id
    case 'npcs':
      return (entity as NpcDef).name || id
    case 'quests':
      return (entity as QuestDef).name || id
    case 'questlines':
      return (entity as QuestlineDef).name || id
    case 'dialogues': {
      const d = entity as DialogueDef
      return d.npcId ? `(npc: ${d.npcId})` : id
    }
    case 'items':
      return (entity as ItemTemplate).name || id
    case 'events':
      return (entity as EventCard).title || id
    case 'recipes':
      return (entity as RecipeDef).name || id
    case 'buildings':
      return (entity as BuildingDef).name || id
    case 'skills':
      return (entity as SkillDef).name || id
    case 'encounterTemplates':
      return id
    default:
      return id
  }
}

function buildOptionsForType<K extends ContentType>(
  type: K,
  map: Record<string, ContentEntityMap[K]>,
): RefOption[] {
  return Object.entries(map).map(([id, entity]) => ({
    id,
    label: labelForEntity(type, id, entity),
  }))
}

export function buildContentIndexesFromSnapshot(snapshot: ContentRegistrySnapshot): ContentIndexes {
  const options = {} as ContentIndexes['options']
  const ids = {} as ContentIndexes['ids']

  for (const type of Object.keys(snapshot) as ContentType[]) {
    const map = snapshot[type]
    options[type] = buildOptionsForType(type, map)
    ids[type] = new Set(Object.keys(map))
  }

  return { snapshot, options, ids }
}

export function buildContentIndexes(): ContentIndexes {
  const encounterMap: Record<string, Enemy[]> = {}
  for (const { id, enemies } of getAllEncounterTemplates()) {
    encounterMap[id] = enemies
  }

  const snapshot: ContentRegistrySnapshot = {
    rooms: getEffectiveMap('rooms'),
    npcs: getEffectiveMap('npcs'),
    quests: getEffectiveMap('quests'),
    questlines: Object.fromEntries(getAllQuestlines().map((q) => [q.id, q])),
    dialogues: getEffectiveMap('dialogues'),
    items: getEffectiveMap('items'),
    events: getEffectiveMap('events'),
    recipes: getEffectiveMap('recipes'),
    buildings: getEffectiveMap('buildings'),
    skills: getEffectiveMap('skills'),
    encounterTemplates: encounterMap,
  }

  return buildContentIndexesFromSnapshot(snapshot)
}

/** Convenience accessors used by admin forms. */
export function getRefOptions(type: ContentType): RefOption[] {
  return buildContentIndexes().options[type]
}

export function getAllRefLists(): ContentIndexes['options'] {
  return buildContentIndexes().options
}

const KNOWN_AREAS = ['forest', 'cave', 'ruins'] as const

function humanizeId(id: string): string {
  return id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function sortOptions(options: RefOption[]): RefOption[] {
  return [...options].sort((a, b) => a.label.localeCompare(b.label))
}

function collectMaterialIds(snapshot: ContentRegistrySnapshot): Set<string> {
  const ids = new Set<string>()
  for (const recipe of Object.values(snapshot.recipes)) {
    for (const id of Object.keys(recipe.requires.materials ?? {})) ids.add(id)
  }
  for (const building of Object.values(snapshot.buildings)) {
    for (const level of building.levels ?? []) {
      for (const id of Object.keys(level.cost.materials ?? {})) ids.add(id)
    }
    if (building.production?.outputMaterialId) ids.add(building.production.outputMaterialId)
  }
  for (const room of Object.values(snapshot.rooms)) {
    for (const node of room.gatherNodes ?? []) {
      if (node.resource) ids.add(node.resource)
    }
  }
  return ids
}

function collectZoneIds(snapshot: ContentRegistrySnapshot): RefOption[] {
  const ids = new Set<string>()
  for (const room of Object.values(snapshot.rooms)) {
    if (room.zoneId) ids.add(room.zoneId)
  }
  for (const event of Object.values(snapshot.events)) {
    if (event.zone) ids.add(event.zone)
  }
  return sortOptions([...ids].map((id) => ({ id, label: humanizeId(id) })))
}

function collectFlagsAndCounters(snapshot: ContentRegistrySnapshot): { flags: Set<string>; counters: Set<string> } {
  const flags = new Set<string>()
  const counters = new Set<string>()

  function walkEffects(effects: OutcomeEffect[] | undefined) {
    for (const eff of effects ?? []) {
      if (eff.kind === 'set_flag') flags.add(eff.flag)
      if (eff.kind === 'increment_counter') counters.add(eff.counter)
    }
  }

  function walkReqs(reqs: OutcomeRequirement[] | undefined) {
    for (const req of reqs ?? []) {
      if (req.kind === 'has_flag' || req.kind === 'not_has_flag') flags.add(req.flag)
      if (req.kind === 'counter_at_least') counters.add(req.counter)
    }
  }

  for (const event of Object.values(snapshot.events)) {
    for (const choice of event.choices ?? []) {
      walkEffects(choice.outcomes)
      walkReqs(choice.requires)
    }
  }
  for (const dialogue of Object.values(snapshot.dialogues)) {
    for (const node of dialogue.nodes ?? []) {
      for (const resp of node.responses ?? []) {
        walkEffects(resp.outcomes)
        walkReqs(resp.requires)
      }
    }
  }
  for (const quest of Object.values(snapshot.quests)) {
    for (const stage of quest.stages ?? []) {
      walkEffects(stage.rewards)
      if (stage.objective.type === 'set_flag') flags.add(stage.objective.target)
    }
  }
  for (const ql of Object.values(snapshot.questlines)) {
    if (ql.startFlag) flags.add(ql.startFlag)
  }
  for (const recipe of Object.values(snapshot.recipes)) {
    if (recipe.unlockedBy?.flag) flags.add(recipe.unlockedBy.flag)
  }
  for (const building of Object.values(snapshot.buildings)) {
    for (const level of building.levels ?? []) {
      walkEffects(level.effects)
    }
  }

  return { flags, counters }
}

function collectQuestStages(snapshot: ContentRegistrySnapshot): QuestStageOption[] {
  const out: QuestStageOption[] = []
  for (const quest of Object.values(snapshot.quests)) {
    for (const stage of quest.stages ?? []) {
      out.push({
        id: stage.id,
        questId: quest.id,
        label: `${quest.name || quest.id} → ${stage.description || stage.id}`,
      })
    }
  }
  return sortOptions(out) as QuestStageOption[]
}

function collectMarketCategories(materialIds: Set<string>): RefOption[] {
  return sortOptions([...materialIds].map((id) => ({ id, label: humanizeId(id) })))
}

/** All dropdown option lists for admin forms (rooms, items, zones, flags, …). */
export function buildAdminRefOptions(): AdminRefOptions {
  const indexes = buildContentIndexes()
  const snapshot = indexes.snapshot
  const materialIds = collectMaterialIds(snapshot)
  const { flags, counters } = collectFlagsAndCounters(snapshot)

  const materials = sortOptions(
    [...materialIds].map((id) => ({ id, label: humanizeId(id) })),
  )

  return {
    items: sortOptions(indexes.options.items),
    materials,
    quests: sortOptions(indexes.options.quests),
    questStages: collectQuestStages(snapshot),
    npcs: sortOptions(indexes.options.npcs),
    skills: sortOptions(indexes.options.skills),
    recipes: sortOptions(indexes.options.recipes),
    encounters: sortOptions(indexes.options.encounterTemplates),
    rooms: sortOptions(indexes.options.rooms),
    zones: collectZoneIds(snapshot),
    areas: sortOptions(KNOWN_AREAS.map((id) => ({ id, label: humanizeId(id) }))),
    buildings: sortOptions(indexes.options.buildings),
    flags: sortOptions([...flags].map((id) => ({ id, label: humanizeId(id) }))),
    counters: sortOptions([...counters].map((id) => ({ id, label: humanizeId(id) }))),
    marketCategories: collectMarketCategories(materialIds),
  }
}
