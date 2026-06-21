import type { Room } from '../RoomSystem'
import type { NpcDef, QuestDef, QuestlineDef, DialogueDef } from '../ContentSchemas'
import { loadOverlay } from './ContentOverlayStore'
import type { ContentEntityMap, ContentOverlayState, ContentType } from './ContentOverlayTypes'

const roomModules = import.meta.glob<{ default: Room }>('../../assets/rooms/*.json', { eager: true })
const npcModules = import.meta.glob<{ default: NpcDef }>('../../assets/npcs/*.json', { eager: true })
const questModules = import.meta.glob<{ default: QuestDef }>('../../assets/quests/*.json', { eager: true })
const dialogueModules = import.meta.glob<{ default: DialogueDef }>('../../assets/dialogue/*.json', { eager: true })

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
let effectiveRooms: Record<string, Room> = {}
let effectiveNpcs: Record<string, NpcDef> = {}
let effectiveQuests: Record<string, QuestDef> = {}
let effectiveDialogues: Record<string, DialogueDef> = {}
let initialized = false

export function initContentRegistry(): void {
  baseRooms = loadBaseRooms()
  baseNpcs = loadBaseNpcs()
  baseQuests = loadBaseQuests()
  baseDialogues = loadBaseDialogues()
  initialized = true
  refreshContentRegistry()
}

export function refreshContentRegistry(): void {
  if (!initialized) {
    baseRooms = loadBaseRooms()
    baseNpcs = loadBaseNpcs()
    baseQuests = loadBaseQuests()
    baseDialogues = loadBaseDialogues()
    initialized = true
  }
  const overlay = loadOverlay()
  effectiveRooms = mergeMaps(baseRooms, overlay, 'rooms')
  effectiveNpcs = mergeMaps(baseNpcs, overlay, 'npcs')
  effectiveQuests = mergeMaps(baseQuests, overlay, 'quests')
  effectiveDialogues = mergeMaps(baseDialogues, overlay, 'dialogues')
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
    default: {
      const overlay = loadOverlay()
      return mergeMaps({} as Record<string, ContentEntityMap[K]>, overlay, type)
    }
  }
}
