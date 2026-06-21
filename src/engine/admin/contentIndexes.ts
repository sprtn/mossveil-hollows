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
import type { ContentEntityMap, ContentType } from './ContentOverlayTypes'
import {
  getEffectiveMap,
  getAllQuestlines,
  getAllEncounterTemplates,
} from './ContentRegistry'

export type RefOption = { id: string; label: string }

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
