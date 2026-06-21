/**
 * Room Manager - loads rooms from ContentRegistry (base JSON + overlay merge).
 */

import type { Room } from './RoomSystem'
import { getRoom as getRoomFromRegistry } from './admin/ContentRegistry'

export async function loadRoom(roomId: string): Promise<Room> {
  const room = getRoomFromRegistry(roomId)
  if (!room) throw new Error(`Room not found: ${roomId}`)
  return room
}
