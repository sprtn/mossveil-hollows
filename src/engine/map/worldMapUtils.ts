import type { GameState } from '../GameLoopDesign'
import type { Room, RoomExit, ExitDirection } from '../RoomSystem'
import { START_ROOM_ID } from '../gameConfig'
import { MAP_COORD_SIZE, type RoomLayoutPoint, type RoomLayoutsMap } from './RoomLayout'

export const UNZONED_KEY = '__unzoned__'
export const HUB_ZONE_KEY = '__hub__'

export function getRoomZoneKey(room: Room): string {
  if (room.isHub) return HUB_ZONE_KEY
  return room.zoneId ?? UNZONED_KEY
}

export function zoneDisplayLabel(zoneKey: string): string {
  if (zoneKey === HUB_ZONE_KEY) return 'Hub / Unzoned'
  if (zoneKey === UNZONED_KEY) return 'Unzoned'
  return zoneKey.charAt(0).toUpperCase() + zoneKey.slice(1)
}

const ZONE_CLUSTER_ORIGINS: Record<string, { x: number; y: number }> = {
  [HUB_ZONE_KEY]: { x: 120, y: 500 },
  forest: { x: 380, y: 450 },
  cave: { x: 700, y: 380 },
  ruins: { x: 600, y: 750 },
  final: { x: 900, y: 500 },
  [UNZONED_KEY]: { x: 200, y: 200 },
}

export function computeDefaultLayout(rooms: Room[]): RoomLayoutsMap {
  const byZone = new Map<string, Room[]>()
  for (const room of rooms) {
    const key = getRoomZoneKey(room)
    const list = byZone.get(key) ?? []
    list.push(room)
    byZone.set(key, list)
  }

  const layouts: RoomLayoutsMap = {}
  for (const [zoneKey, zoneRooms] of byZone) {
    const origin = ZONE_CLUSTER_ORIGINS[zoneKey] ?? { x: 500, y: 500 }
    zoneRooms.forEach((room, i) => {
      const angle = (2 * Math.PI * i) / Math.max(zoneRooms.length, 1) - Math.PI / 2
      const radius = Math.min(80, 30 + zoneRooms.length * 8)
      layouts[room.id] = {
        x: Math.round(origin.x + radius * Math.cos(angle)),
        y: Math.round(origin.y + radius * Math.sin(angle)),
      }
    })
  }
  return layouts
}

export function resolveRoomLayouts(
  rooms: Room[],
  baseLayouts: RoomLayoutsMap,
  overlayLayouts: RoomLayoutsMap = {},
): RoomLayoutsMap {
  const defaults = computeDefaultLayout(rooms)
  const merged: RoomLayoutsMap = { ...defaults, ...baseLayouts, ...overlayLayouts }
  for (const room of rooms) {
    if (!merged[room.id]) {
      merged[room.id] = defaults[room.id] ?? { x: MAP_COORD_SIZE / 2, y: MAP_COORD_SIZE / 2 }
    }
  }
  return merged
}

export interface MapEdge {
  fromId: string
  toId: string
  direction: ExitDirection
  locked: boolean
  hidden: boolean
}

export function buildMapEdges(rooms: Room[]): MapEdge[] {
  const edges: MapEdge[] = []
  for (const room of rooms) {
    for (const exit of room.exits ?? []) {
      edges.push({
        fromId: room.id,
        toId: exit.targetRoomId,
        direction: exit.direction,
        locked: !!exit.locked,
        hidden: !!exit.hidden,
      })
    }
  }
  return edges
}

const DIRECTION_LABEL: Record<ExitDirection, string> = {
  north: 'N',
  south: 'S',
  east: 'E',
  west: 'W',
  up: '↑',
  down: '↓',
}

export function directionLabel(direction: ExitDirection): string {
  return DIRECTION_LABEL[direction]
}

export interface NavigableRoom {
  id: string
  exits?: RoomExit[]
  isHub?: boolean
}

function isExitPassable(
  exit: RoomExit,
  room: NavigableRoom,
  inventoryIds: string[],
  areasUnlocked: string[],
): boolean {
  if (exit.hidden) return false
  if (!room.isHub && exit.targetRoomId === START_ROOM_ID) return false
  if (exit.targetRoomId.startsWith('zone_cave') && !areasUnlocked.includes('cave')) return false
  if (exit.targetRoomId.startsWith('zone_ruins') && !areasUnlocked.includes('ruins')) return false
  if (exit.locked) {
    if (exit.requiresItems?.length) {
      return exit.requiresItems.every((id) => inventoryIds.includes(id))
    }
    if (exit.requiresItem) return inventoryIds.includes(exit.requiresItem)
    return false
  }
  return true
}

/** Target room ids reachable via a passable exit from the current room. */
export function getReachableTargetIds(state: GameState, room: NavigableRoom): Set<string> {
  const inventoryIds = state.player.inventory.map((i) => i.templateId)
  const areas = state.areasUnlocked ?? ['forest']
  const ids = new Set<string>()
  for (const exit of room.exits ?? []) {
    if (isExitPassable(exit, room, inventoryIds, areas)) {
      ids.add(exit.targetRoomId)
    }
  }
  return ids
}

export function canNavigateToRoom(
  state: GameState,
  fromRoom: NavigableRoom,
  toRoomId: string,
): boolean {
  return getReachableTargetIds(state, fromRoom).has(toRoomId)
}

/** Rooms visible on the player map: current, visited, and directly reachable. */
export function getDiscoveredRoomIds(state: GameState): Set<string> {
  const ids = new Set<string>()
  ids.add(state.currentRoom.id)
  for (const id of state.roomHistory ?? []) ids.add(id)
  for (const id of getReachableTargetIds(state, state.currentRoom)) ids.add(id)
  return ids
}

export function getBoundsForRoomIds(
  roomIds: Iterable<string>,
  layouts: RoomLayoutsMap,
  padding = 110,
): ZoneBounds {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const id of roomIds) {
    const p = layouts[id]
    if (!p) continue
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: MAP_COORD_SIZE, maxY: MAP_COORD_SIZE }
  }
  return {
    minX: Math.max(0, minX - padding),
    minY: Math.max(0, minY - padding),
    maxX: Math.min(MAP_COORD_SIZE, maxX + padding),
    maxY: Math.min(MAP_COORD_SIZE, maxY + padding),
  }
}

/** Room ids sharing an exit edge with the current room (either direction). */
export function getConnectedRoomIds(currentRoomId: string, rooms: Room[]): Set<string> {
  const ids = new Set<string>([currentRoomId])
  const current = rooms.find((r) => r.id === currentRoomId)
  for (const exit of current?.exits ?? []) {
    ids.add(exit.targetRoomId)
  }
  for (const room of rooms) {
    for (const exit of room.exits ?? []) {
      if (exit.targetRoomId === currentRoomId) ids.add(room.id)
    }
  }
  return ids
}

export function expandBoundsToMinSize(b: ZoneBounds, minSize = 200): ZoneBounds {
  const w = b.maxX - b.minX
  const h = b.maxY - b.minY
  if (w >= minSize && h >= minSize) return b
  const cx = (b.minX + b.maxX) / 2
  const cy = (b.minY + b.maxY) / 2
  const halfW = Math.max(minSize / 2, w / 2)
  const halfH = Math.max(minSize / 2, h / 2)
  return {
    minX: Math.max(0, cx - halfW),
    minY: Math.max(0, cy - halfH),
    maxX: Math.min(MAP_COORD_SIZE, cx + halfW),
    maxY: Math.min(MAP_COORD_SIZE, cy + halfH),
  }
}

/** Fit view around the current room and its immediate graph neighbors. */
export function getNeighborhoodBounds(
  currentRoomId: string,
  rooms: Room[],
  layouts: RoomLayoutsMap,
  padding = 110,
  minSize = 200,
): ZoneBounds {
  const ids = getConnectedRoomIds(currentRoomId, rooms)
  return expandBoundsToMinSize(getBoundsForRoomIds(ids, layouts, padding), minSize)
}

export interface ZoneBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export function getZoneBounds(
  rooms: Room[],
  layouts: RoomLayoutsMap,
  zoneKey: string,
  padding = 80,
): ZoneBounds {
  const inZone = rooms.filter((r) => getRoomZoneKey(r) === zoneKey)
  const list = inZone.length > 0 ? inZone : rooms
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const room of list) {
    const p = layouts[room.id]
    if (!p) continue
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: MAP_COORD_SIZE, maxY: MAP_COORD_SIZE }
  }
  return {
    minX: Math.max(0, minX - padding),
    minY: Math.max(0, minY - padding),
    maxX: Math.min(MAP_COORD_SIZE, maxX + padding),
    maxY: Math.min(MAP_COORD_SIZE, maxY + padding),
  }
}

export function boundsToViewBox(b: ZoneBounds): string {
  const w = Math.max(1, b.maxX - b.minX)
  const h = Math.max(1, b.maxY - b.minY)
  return `${b.minX} ${b.minY} ${w} ${h}`
}

export function getWorldBounds(rooms: Room[], layouts: RoomLayoutsMap, padding = 60): ZoneBounds {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const room of rooms) {
    const p = layouts[room.id]
    if (!p) continue
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: MAP_COORD_SIZE, maxY: MAP_COORD_SIZE }
  }
  return {
    minX: Math.max(0, minX - padding),
    minY: Math.max(0, minY - padding),
    maxX: Math.min(MAP_COORD_SIZE, maxX + padding),
    maxY: Math.min(MAP_COORD_SIZE, maxY + padding),
  }
}

export function groupRoomsByZone(rooms: Room[]): Map<string, Room[]> {
  const map = new Map<string, Room[]>()
  for (const room of rooms) {
    const key = getRoomZoneKey(room)
    const list = map.get(key) ?? []
    list.push(room)
    map.set(key, list)
  }
  return map
}

export function clampLayoutPoint(x: number, y: number): RoomLayoutPoint {
  return {
    x: Math.round(Math.max(40, Math.min(MAP_COORD_SIZE - 40, x))),
    y: Math.round(Math.max(40, Math.min(MAP_COORD_SIZE - 40, y))),
  }
}
