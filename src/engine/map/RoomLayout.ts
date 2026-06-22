/** Normalized map coordinates (0–1000) for room node positions. */
export interface RoomLayoutPoint {
  x: number
  y: number
}

export const MAP_COORD_SIZE = 1000

export type RoomLayoutsMap = Record<string, RoomLayoutPoint>
