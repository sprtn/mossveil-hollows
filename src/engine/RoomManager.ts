/**
 * Room Manager - loads static rooms from JSON.
 */

import type { Room } from './RoomSystem'

const roomModules = import.meta.glob<{ default: Room }>('../assets/rooms/*.json')

export async function loadRoom(roomId: string): Promise<Room> {
  const path = `../assets/rooms/${roomId}.json`
  const loader = roomModules[path]
  if (!loader) {
    const err = new Error(`Room not found: ${roomId}`)
    console.error(err.message)
    throw err
  }
  try {
    const module = await loader()
    return module.default
  } catch (error) {
    console.error(`Failed to load room ${roomId}:`, error)
    throw error
  }
}
