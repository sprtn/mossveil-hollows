import type { Room } from '../RoomSystem'
import type {
  NpcDef, QuestDef, QuestlineDef, DialogueDef, EventCard, RecipeDef, BuildingDef, SkillDef,
} from '../ContentSchemas'
import type { ItemTemplate } from '../GameLoopDesign'
import { loadOverlay } from './ContentOverlayStore'
import type { ContentEntityMap, ContentOverlayState, ContentType } from './ContentOverlayTypes'

const roomModules = import.meta.glob<{ default: Room }>('../../assets/rooms/*.json', { eager: true })
const npcModules = import.meta.glob<{ default: NpcDef }>('../../assets/npcs/*.json', { eager: true })
const questModules = import.meta.glob<{ default: QuestDef }>('../../assets/quests/*.json', { eager: true })
const dialogueModules = import.meta.glob<{ default: DialogueDef }>('../../assets/dialogue/*.json', { eager: true })
const itemModules = import.meta.glob<{ default: ItemTemplate }>('../../assets/items/*.json', { eager: true })
const eventModules = import.meta.glob<{ default: EventCard }>('../../assets/events/*.json', { eager: true })
const recipeModules = import.meta.glob<{ default: RecipeDef }>('../../assets/recipes/*.json', { eager: true })
const buildingModules = import.meta.glob<{ default: BuildingDef }>('../../assets/buildings/*.json', { eager: true })
const skillModules = import.meta.glob<{ default: SkillDef }>('../../assets/skills/*.json', { eager: true })

function loadBaseRooms(): Record<string, Room> {
  const map: Record<string, Room> = {}
  for (const mod of Object.values(roomModules)) {
    const room = mod.default
    map[room.id] = room
  }
  return map
}

function loadBaseNpcs(): Record<string, NpcDef> {
  const map: Record<string, NpcDef> = {}
  for (const mod of Object.values(npcModules)) {
    const npc = mod.default
    map[npc.id] = npc
  }
  return map
}

function loadBaseQuests(): Record<string, QuestDef> {
  const map: Record<string, QuestDef> = {}
  for (const mod of Object.values(questModules)) {
    const quest = mod.default
    map[quest.id] = quest
  }
  return map
}

function loadBaseDialogues(): Record<string, DialogueDef> {
  const map: Record<string, DialogueDef> = {}
  for (const mod of Object.values(dialogueModules)) {
    const dialogue = mod.default
    map[dialogue.id] = dialogue
  }
  return map
}

function loadBaseItems(): Record<string, ItemTemplate> {
  const map: Record<string, ItemTemplate> = {}
  for (const mod of Object.values(itemModules)) {
    const item = mod.default
    map[item.id] = item
  }
  return map
}

function loadBaseEvents(): Record<string, EventCard> {
  const map: Record<string, EventCard> = {}
  for (const mod of Object.values(eventModules)) {
    const event = mod.default
    map[event.id] = event
  }
  return map
}

function loadBaseRecipes(): Record<string, RecipeDef> {
  const map: Record<string, RecipeDef> = {}
  for (const mod of Object.values(recipeModules)) {
    const recipe = mod.default
    map[recipe.id] = recipe
  }
  return map
}

function loadBaseBuildings(): Record<string, BuildingDef> {
  const map: Record<string, BuildingDef> = {}
  for (const mod of Object.values(buildingModules)) {
    const building = mod.default
    map[building.id] = building
  }
  return map
}

function loadBaseSkills(): Record<string, SkillDef> {
  const map: Record<string, SkillDef> = {}
  for (const mod of Object.values(skillModules)) {
    const skill = mod.default
    map[skill.id] = skill
  }
  return map
}

function mergeMaps<K extends ContentType>(
  base: Record<string, ContentEntityMap[K]>,
  overlay: ContentOverlayState,
  type: K,
): Record<string, ContentEntityMap[K]> {
  const result = { ...base, ...overlay.upserts[type] }
  for (const id of overlay.deletedIds[type]) delete result[id]
  return result
}

let baseRooms: Record<string, Room> = {}
let baseNpcs: Record<string, NpcDef> = {}
let baseQuests: Record<string, QuestDef> = {}
let baseDialogues: Record<string, DialogueDef> = {}
let baseItems: Record<string, ItemTemplate> = {}
let baseEvents: Record<string, EventCard> = {}
let baseRecipes: Record<string, RecipeDef> = {}
let baseBuildings: Record<string, BuildingDef> = {}
let baseSkills: Record<string, SkillDef> = {}
let effectiveRooms: Record<string, Room> = {}
let effectiveNpcs: Record<string, NpcDef> = {}
let effectiveQuests: Record<string, QuestDef> = {}
let effectiveDialogues: Record<string, DialogueDef> = {}
let effectiveItems: Record<string, ItemTemplate> = {}
let effectiveEvents: Record<string, EventCard> = {}
let effectiveRecipes: Record<string, RecipeDef> = {}
let effectiveBuildings: Record<string, BuildingDef> = {}
let effectiveSkills: Record<string, SkillDef> = {}
let initialized = false

export function initContentRegistry(): void {
  baseRooms = loadBaseRooms()
  baseNpcs = loadBaseNpcs()
  baseQuests = loadBaseQuests()
  baseDialogues = loadBaseDialogues()
  baseItems = loadBaseItems()
  baseEvents = loadBaseEvents()
  baseRecipes = loadBaseRecipes()
  baseBuildings = loadBaseBuildings()
  baseSkills = loadBaseSkills()
  initialized = true
  refreshContentRegistry()
}

export function refreshContentRegistry(): void {
  if (!initialized) {
    baseRooms = loadBaseRooms()
    baseNpcs = loadBaseNpcs()
    baseQuests = loadBaseQuests()
    baseDialogues = loadBaseDialogues()
    baseItems = loadBaseItems()
    baseEvents = loadBaseEvents()
    baseRecipes = loadBaseRecipes()
    baseBuildings = loadBaseBuildings()
    baseSkills = loadBaseSkills()
    initialized = true
  }
  const overlay = loadOverlay()
  effectiveRooms = mergeMaps(baseRooms, overlay, 'rooms')
  effectiveNpcs = mergeMaps(baseNpcs, overlay, 'npcs')
  effectiveQuests = mergeMaps(baseQuests, overlay, 'quests')
  effectiveDialogues = mergeMaps(baseDialogues, overlay, 'dialogues')
  effectiveItems = mergeMaps(baseItems, overlay, 'items')
  effectiveEvents = mergeMaps(baseEvents, overlay, 'events')
  effectiveRecipes = mergeMaps(baseRecipes, overlay, 'recipes')
  effectiveBuildings = mergeMaps(baseBuildings, overlay, 'buildings')
  effectiveSkills = mergeMaps(baseSkills, overlay, 'skills')
}

export function getRoom(id: string): Room | undefined {
  if (!initialized) initContentRegistry()
  return effectiveRooms[id]
}

export function getAllRooms(): Room[] {
  if (!initialized) initContentRegistry()
  return Object.values(effectiveRooms)
}

export function getNpc(id: string): NpcDef | undefined {
  if (!initialized) initContentRegistry()
  return effectiveNpcs[id]
}

export function getAllNpcs(): NpcDef[] {
  if (!initialized) initContentRegistry()
  return Object.values(effectiveNpcs)
}

export function getQuest(id: string): QuestDef | undefined {
  if (!initialized) initContentRegistry()
  return effectiveQuests[id]
}

export function getAllQuests(): QuestDef[] {
  if (!initialized) initContentRegistry()
  return Object.values(effectiveQuests)
}

export function getDialogue(id: string): DialogueDef | undefined {
  if (!initialized) initContentRegistry()
  return effectiveDialogues[id]
}

export function getAllDialogues(): DialogueDef[] {
  if (!initialized) initContentRegistry()
  return Object.values(effectiveDialogues)
}

export function getItemTemplate(id: string): ItemTemplate | undefined {
  if (!initialized) initContentRegistry()
  return effectiveItems[id]
}

export function getAllItems(): ItemTemplate[] {
  if (!initialized) initContentRegistry()
  return Object.values(effectiveItems)
}

export function getEvent(id: string): EventCard | undefined {
  if (!initialized) initContentRegistry()
  return effectiveEvents[id]
}

export function getAllEvents(): EventCard[] {
  if (!initialized) initContentRegistry()
  return Object.values(effectiveEvents)
}

export function getRecipe(id: string): RecipeDef | undefined {
  if (!initialized) initContentRegistry()
  return effectiveRecipes[id]
}

export function getAllRecipes(): RecipeDef[] {
  if (!initialized) initContentRegistry()
  return Object.values(effectiveRecipes)
}

export function getBuilding(id: string): BuildingDef | undefined {
  if (!initialized) initContentRegistry()
  return effectiveBuildings[id]
}

export function getAllBuildings(): BuildingDef[] {
  if (!initialized) initContentRegistry()
  return Object.values(effectiveBuildings)
}

export function getSkill(id: string): SkillDef | undefined {
  if (!initialized) initContentRegistry()
  return effectiveSkills[id]
}

export function getAllSkills(): SkillDef[] {
  if (!initialized) initContentRegistry()
  return Object.values(effectiveSkills)
}

export function getAllQuestlines(): QuestlineDef[] {
  return Object.values(getEffectiveMap('questlines')) as QuestlineDef[]
}

export function getEffectiveMap<K extends ContentType>(type: K): Record<string, ContentEntityMap[K]> {
  if (!initialized) initContentRegistry()
  switch (type) {
    case 'rooms':
      return effectiveRooms as Record<string, ContentEntityMap[K]>
    case 'npcs':
      return effectiveNpcs as Record<string, ContentEntityMap[K]>
    case 'quests':
      return effectiveQuests as Record<string, ContentEntityMap[K]>
    case 'dialogues':
      return effectiveDialogues as Record<string, ContentEntityMap[K]>
    case 'items':
      return effectiveItems as Record<string, ContentEntityMap[K]>
    case 'events':
      return effectiveEvents as Record<string, ContentEntityMap[K]>
    case 'recipes':
      return effectiveRecipes as Record<string, ContentEntityMap[K]>
    case 'buildings':
      return effectiveBuildings as Record<string, ContentEntityMap[K]>
    case 'skills':
      return effectiveSkills as Record<string, ContentEntityMap[K]>
    default: {
      const overlay = loadOverlay()
      return mergeMaps({} as Record<string, ContentEntityMap[K]>, overlay, type)
    }
  }
}
