import type { Room } from '../RoomSystem'
import type {
  NpcDef, QuestDef, DialogueDef, EventCard, RecipeDef, BuildingDef, SkillDef,
} from '../ContentSchemas'
import type { ItemTemplate, Enemy } from '../GameLoopDesign'

export const OVERLAY_BUNDLE_VERSION = 1 as const
export const OVERLAY_STORAGE_KEY = 'strat_content_overlay_v1'

export interface QuestlineDef {
  id: string
  name: string
  description?: string
  questIds: string[]
  requiredQuestIds?: string[]
  startFlag?: string
}

export type ContentType =
  | 'rooms' | 'npcs' | 'quests' | 'questlines' | 'dialogues'
  | 'items' | 'events' | 'recipes' | 'buildings' | 'skills' | 'encounterTemplates'

export type ContentEntityMap = {
  rooms: Room
  npcs: NpcDef
  quests: QuestDef
  questlines: QuestlineDef
  dialogues: DialogueDef
  items: ItemTemplate
  events: EventCard
  recipes: RecipeDef
  buildings: BuildingDef
  skills: SkillDef
  encounterTemplates: Enemy[]
}

export interface ContentOverlayState {
  upserts: { [K in ContentType]: Record<string, ContentEntityMap[K]> }
  deletedIds: { [K in ContentType]: string[] }
}

export interface ContentOverlayBundle {
  version: typeof OVERLAY_BUNDLE_VERSION
  exportedAt: string
  gameVersion: string
  upserts: ContentOverlayState['upserts']
  deletedIds: ContentOverlayState['deletedIds']
}
