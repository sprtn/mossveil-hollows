/**
 * Procedural Room Generator
 * 
 * Generates rooms with deterministic seeding for:
 * - Name generation
 * - Description generation
 * - Encounter generation
 * - Exit connectivity (guaranteed paths)
 */

import type { ProceduralRoom, RoomGenConfig, RoomExit, ExitDirection } from './RoomSystem'
import { ROOM_NAMES } from './RoomSystem'

/**
 * Seeded random number generator (deterministic)
 * Ensures same seed produces same results
 */
class SeededRandom {
  seed: number

  constructor(seed: number) {
    this.seed = seed
  }

  next(): number {
    // Linear congruential generator
    this.seed = (this.seed * 9301 + 49297) % 233280
    return this.seed / 233280
  }

  nextInt(max: number): number {
    return Math.floor(this.next() * max)
  }

  nextInRange(min: number, max: number): number {
    return min + this.nextInt(Math.max(0, max - min + 1))
  }

  pick<T>(arr: T[]): T {
    if (arr.length === 0) {
      throw new Error('Cannot pick from empty array')
    }
    const idx = this.nextInt(arr.length)
    const element = arr[idx]
    if (element === undefined) {
      throw new Error('Array element is undefined')
    }
    return element
  }
}

/**
 * Generate a single procedural room
 */
export function generateProceduralRoom(
  id: string,
  x: number,
  y: number,
  config: RoomGenConfig,
  width: number,
  height: number
): ProceduralRoom {
  const seed = hashCoordinates(x, y) // Deterministic seed from position

  const rng = new SeededRandom(seed)
  const biome = rng.pick(config.biomes)
  const difficulty = rng.nextInRange(config.minDifficulty, config.maxDifficulty)

  const name = generateRoomName(seed, biome)
  const description = generateRoomDescription(seed, biome, difficulty)

  // Generate exits (cardinal directions that don't go out of bounds)
  const exits: RoomExit[] = []
  const directions: Array<{ dx: number; dy: number; dir: ExitDirection }> = [
    { dx: 1, dy: 0, dir: 'east' },
    { dx: -1, dy: 0, dir: 'west' },
    { dx: 0, dy: 1, dir: 'south' },
    { dx: 0, dy: -1, dir: 'north' },
  ]

  for (const { dx, dy, dir } of directions) {
    const nx = x + dx
    const ny = y + dy

    // Check bounds
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue

    // Add exit with probability based on connectedness
    if (rng.next() < config.connectedness) {
      exits.push({
        direction: dir,
        targetRoomId: `room_proc_${nx}_${ny}`,
      })
    }
  }

  // Ensure at least one exit (connectivity)
  if (exits.length === 0) {
    const validDirs = directions.filter(({ dx, dy }) => {
      const nx = x + dx
      const ny = y + dy
      return nx >= 0 && nx < width && ny >= 0 && ny < height
    })

    if (validDirs.length > 0) {
      const { dx, dy, dir } = rng.pick(validDirs)
      const nx = x + dx
      const ny = y + dy
      exits.push({
        direction: dir,
        targetRoomId: `room_proc_${nx}_${ny}`,
      })
    }
  }

  return {
    id,
    type: 'procedural',
    seed,
    name,
    description,
    exits,
    difficulty,
    biome,
    // Encounters generated separately based on difficulty
  }
}

/**
 * Generate a procedural dungeon (set of connected rooms)
 */
export function generateDungeon(config: RoomGenConfig): ProceduralRoom[] {
  const rooms: ProceduralRoom[] = []

  for (let y = 0; y < config.height; y++) {
    for (let x = 0; x < config.width; x++) {
      const roomId = `room_proc_${x}_${y}`
      const room = generateProceduralRoom(roomId, x, y, config, config.width, config.height)
      rooms.push(room)
    }
  }

  // Ensure connectivity: create spanning tree to guarantee path from start to end
  ensureConnectivity(rooms, config.width, config.height)

  return rooms
}

/**
 * Ensure all rooms are connected (spanning tree)
 */
function ensureConnectivity(rooms: ProceduralRoom[], width: number, height: number): void {
  const visited = new Set<string>()
  const roomMap = new Map(rooms.map((r) => [r.id, r]))

  // DFS to mark connected component
  function dfs(roomId: string): void {
    if (visited.has(roomId)) return
    visited.add(roomId)

    const room = roomMap.get(roomId)
    if (!room) return

    for (const exit of room.exits) {
      dfs(exit.targetRoomId)
    }
  }

  // Check connectivity from top-left room
  dfs('room_proc_0_0')

  // If not all rooms visited, connect unvisited rooms to visited ones
  if (visited.size < rooms.length) {
    for (const room of rooms) {
      if (!visited.has(room.id)) {
        // Find a visited neighbor
        const directions: Array<{ dx: number; dy: number; dir: ExitDirection }> = [
          { dx: 1, dy: 0, dir: 'east' },
          { dx: -1, dy: 0, dir: 'west' },
          { dx: 0, dy: 1, dir: 'south' },
          { dx: 0, dy: -1, dir: 'north' },
        ]

        for (const { dx, dy, dir } of directions) {
          const [x, y] = parseRoomCoords(room.id)
          const nx = x + dx
          const ny = y + dy

          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const neighborId = `room_proc_${nx}_${ny}`
            if (visited.has(neighborId)) {
              // Connect this room to neighbor
              if (!room.exits.some((e) => e.direction === dir)) {
                room.exits.push({
                  direction: dir,
                  targetRoomId: neighborId,
                })
              }
              dfs(room.id)
              break
            }
          }
        }
      }
    }
  }
}

/**
 * Hash coordinates to deterministic seed
 */
function hashCoordinates(x: number, y: number): number {
  return (x * 73856093) ^ (y * 19349663)
}

/**
 * Parse room coordinates from room ID (e.g., "room_proc_3_5" → [3, 5])
 */
function parseRoomCoords(roomId: string): [number, number] {
  const match = roomId.match(/room_proc_(\d+)_(\d+)/)
  if (!match || match.length < 3) {
    return [0, 0]
  }
  const x = parseInt(match[1] || '0', 10)
  const y = parseInt(match[2] || '0', 10)
  return [x, y]
}

/**
 * Generate room name from seed
 */
function generateRoomName(seed: number, biome: string): string {
  const rng = new SeededRandom(seed)
  const biomeKey = biome as keyof typeof ROOM_NAMES
  const names = ROOM_NAMES[biomeKey]
  if (!names || names.length === 0) {
    return ROOM_NAMES.forest[0] || 'Unknown Room'
  }
  return rng.pick(names)
}

/**
 * Generate room description from seed
 */
function generateRoomDescription(seed: number, biome: string, difficulty: number): string {
  const rng = new SeededRandom(seed)

  const templates: Record<string, string[]> = {
    forest: [
      'A dense forest clearing with towering trees.',
      'Sunlight filters through the canopy above.',
      'The forest floor is covered in moss and ferns.',
      'Ancient trees surround you on all sides.',
      'A narrow path winds through the trees.',
    ],
    cave: [
      'A dark cavern lit by bioluminescent fungi.',
      'Stone walls echo with dripping water.',
      'Stalactites hang from the ceiling above.',
      'The air is cool and damp in this underground chamber.',
      'Crystals glimmer in the shadows.',
    ],
    dungeon: [
      'Crumbling stone walls surround you.',
      'Torches flicker in their holders.',
      'Rubble covers the floor of this forgotten room.',
      'The stench of decay fills the air.',
      'Ornate carvings line the walls.',
    ],
    ruin: [
      'The remnants of an ancient structure.',
      'Broken columns rise from the dust.',
      'Nature is slowly reclaiming this place.',
      'Weathered statues stand guard.',
      'Vines creep across crumbling walls.',
    ],
  }

  const biomeTemplates = templates[biome] ?? templates.forest
  if (!biomeTemplates || biomeTemplates.length === 0) {
    return `A mysterious ${biome} location.`
  }
  let desc = rng.pick(biomeTemplates)

  // Add difficulty descriptor
  if (difficulty >= 8) {
    desc += ' The air feels heavy with danger.'
  } else if (difficulty >= 5) {
    desc += ' Something feels off about this place.'
  } else {
    desc += ' It seems relatively safe here.'
  }

  return desc
}
