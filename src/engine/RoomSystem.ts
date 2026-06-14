/**
 * Room System types — hand-authored static rooms loaded from JSON.
 */

import type { EncounterDef } from './GameLoopDesign'

export type ExitDirection = 'north' | 'south' | 'east' | 'west' | 'up' | 'down'

export interface RoomExit {
  direction: ExitDirection
  targetRoomId: string
  locked?: boolean
  requiresItem?: string
  requiresItems?: string[]
  hidden?: boolean
}

export interface Room {
  id: string
  type: 'static'
  name: string
  description: string
  exits: RoomExit[]
  encounters?: EncounterDef[]
  picture?: string
  zoneId?: string
  isHub?: boolean
  isFinalBoss?: boolean
  flavor?: {
    onEnter?: string
    onExit?: string
    atmosphere?: string
  }
  difficulty?: number
}
