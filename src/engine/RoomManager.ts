/**
 * Room Manager - Loads static rooms and manages the room graph
 */

import type { Room, RoomGraph, RoomExit, ExitDirection } from './RoomSystem'

/**
 * Load a static room from JSON
 */
export async function loadRoom(roomId: string): Promise<Room> {
  try {
    const module = await import(
      /* @vite-ignore */
      `../assets/rooms/${roomId}.json`
    )
    return module.default as Room
  } catch (error) {
    console.error(`Failed to load room ${roomId}:`, error)
    throw error
  }
}

/**
 * Build a room graph from a list of room IDs
 * Validates that all exits point to valid rooms
 */
export async function buildRoomGraph(roomIds: string[]): Promise<RoomGraph> {
  const rooms = new Map<string, Room>()
  const adjacency = new Map<string, string[]>()

  // Load all rooms
  for (const roomId of roomIds) {
    const room = await loadRoom(roomId)
    rooms.set(roomId, room)
  }

  // Build adjacency list
  for (const [roomId, room] of rooms) {
    const neighbors: string[] = []

    for (const exit of room.exits) {
      if (rooms.has(exit.targetRoomId)) {
        neighbors.push(exit.targetRoomId)
      } else {
        console.warn(`Exit from ${roomId} points to non-existent room ${exit.targetRoomId}`)
      }
    }

    adjacency.set(roomId, neighbors)
  }

  // Identify critical path (rooms you must visit to complete the game)
  const startRoomId = roomIds[0]
  if (!startRoomId) {
    throw new Error('No rooms provided to build graph')
  }
  const criticalPath = findCriticalPath(adjacency, startRoomId)

  // Identify optional rooms (can be skipped)
  const optional = new Set<string>()
  for (const roomId of roomIds) {
    if (!criticalPath.includes(roomId)) {
      optional.add(roomId)
    }
  }

  return {
    rooms,
    adjacency,
    criticalPath,
    optional,
  }
}

/**
 * Find critical path from start to end
 * Uses BFS to find shortest path (rooms on this path are mandatory)
 */
export function findCriticalPath(
  adjacency: Map<string, string[]>,
  startRoomId: string,
  endRoomId?: string
): string[] {
  if (!adjacency.has(startRoomId)) {
    return [startRoomId]
  }

  // If no end specified, find room with no exits (dead end = goal)
  const actualEnd =
    endRoomId ||
    Array.from(adjacency.entries()).find(([_, neighbors]) => neighbors.length === 0)?.[0] ||
    startRoomId

  const queue: string[] = [startRoomId]
  const visited = new Set<string>([startRoomId])
  const parent = new Map<string, string>()

  // BFS
  while (queue.length > 0) {
    const current = queue.shift()!

    if (current === actualEnd) {
      // Reconstruct path
      const path: string[] = []
      let node: string | undefined = actualEnd

      while (node !== undefined) {
        path.unshift(node)
        node = parent.get(node)
      }

      return path
    }

    const neighbors = adjacency.get(current) || []
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        parent.set(neighbor, current)
        queue.push(neighbor)
      }
    }
  }

  // No path found, return just start
  return [startRoomId]
}

/**
 * Get available exits from a room (excluding locked/hidden)
 */
export function getAvailableExits(
  room: Room,
  inventory?: string[] // Item IDs in inventory
): RoomExit[] {
  return room.exits.filter((exit) => {
    // Hidden exits are not available
    if (exit.hidden) return false

    // Locked exits require an item
    if (exit.locked && exit.requiresItem) {
      return inventory?.includes(exit.requiresItem) ?? false
    }

    return true
  })
}

/**
 * Move from one room to another
 * Returns true if move is valid
 */
export function canMove(
  from: Room,
  direction: ExitDirection,
  inventory?: string[]
): boolean {
  const availableExits = getAvailableExits(from, inventory)
  return availableExits.some((exit) => exit.direction === direction)
}

/**
 * Get the next room ID from current room in a direction
 */
export function getNextRoom(
  from: Room,
  direction: ExitDirection,
  inventory?: string[]
): string | null {
  const availableExits = getAvailableExits(from, inventory)
  const exit = availableExits.find((e) => e.direction === direction)
  return exit?.targetRoomId || null
}
