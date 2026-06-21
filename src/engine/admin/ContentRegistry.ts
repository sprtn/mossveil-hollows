import type { Room } from '../RoomSystem'
import { loadOverlay } from './ContentOverlayStore'
import type { ContentEntityMap, ContentOverlayState, ContentType } from './ContentOverlayTypes'

const roomModules = import.meta.glob<{ default: Room }>('../../assets/rooms/*.json', { eager: true })

function loadBaseRooms(): Record<string, Room> {
  const map: Record<string, Room> = {}
  for (const mod of Object.values(roomModules)) {
    const room = mod.default
    map[room.id] = room
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
let effectiveRooms: Record<string, Room> = {}
let initialized = false

export function initContentRegistry(): void {
  baseRooms = loadBaseRooms()
  initialized = true
  refreshContentRegistry()
}

export function refreshContentRegistry(): void {
  if (!initialized) {
    baseRooms = loadBaseRooms()
    initialized = true
  }
  const overlay = loadOverlay()
  effectiveRooms = mergeMaps(baseRooms, overlay, 'rooms')
}

export function getRoom(id: string): Room | undefined {
  if (!initialized) initContentRegistry()
  return effectiveRooms[id]
}

export function getAllRooms(): Room[] {
  if (!initialized) initContentRegistry()
  return Object.values(effectiveRooms)
}

export function getEffectiveMap<K extends ContentType>(type: K): Record<string, ContentEntityMap[K]> {
  if (!initialized) initContentRegistry()
  if (type === 'rooms') {
    return effectiveRooms as Record<string, ContentEntityMap[K]>
  }
  const overlay = loadOverlay()
  return mergeMaps({} as Record<string, ContentEntityMap[K]>, overlay, type)
}
