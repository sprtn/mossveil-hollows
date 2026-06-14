/**
 * Room Manager - loads static rooms from JSON.
 */

import type { Room } from './RoomSystem'

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
