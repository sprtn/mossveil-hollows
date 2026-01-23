# Room System Design

## Overview

The Room System manages game exploration through a graph-based, data-driven architecture. Rooms can be **static** (hand-authored) or **procedurally generated** (deterministic, seeded). The system guarantees:

- **No impossible graphs**: All rooms are connected; players can always progress
- **Critical path**: BFS identifies mandatory rooms for game progression
- **Optional rooms**: Extra content that can be skipped
- **Locked exits**: Rooms can require items to proceed
- **Hidden exits**: Exits can be conditionally revealed

## Architecture

### 1. Room Types

#### Static Rooms
- Hand-authored in JSON (`src/assets/rooms/*.json`)
- Deterministic design by human creator
- Example: Forest Entrance, Bandit Camp
- Best for: Story-critical locations, boss encounters, unique experiences

#### Procedural Rooms
- Generated from seed + coordinates via `RoomGenerator.ts`
- Deterministic (same seed = same room)
- Examples: Procedurally-filled dungeons, wilderness
- Best for: Large explorable areas, infinite scaling

### 2. Data Flow

```
JSON File (Static)  ──┐
                     ├──> RoomManager.loadRoom() ──> Room (Runtime)
RoomGenerator       ──┘
  (Procedural)
         ↓
   Build RoomGraph
   (validate + BFS)
         ↓
   [critical path]
   [optional rooms]
```

### 3. Type System

See [src/engine/RoomSystem.ts](src/engine/RoomSystem.ts) for definitions:

```typescript
interface Room {
  id: string
  type: 'static' | 'procedural'
  name: string
  description: string
  exits: RoomExit[]      // Connections to other rooms
  difficulty: number     // 1-10 enemy difficulty
}

interface RoomExit {
  direction: ExitDirection  // 'north' | 'south' | 'east' | 'west' | 'up' | 'down'
  targetRoomId: string
  requiresItem?: string     // e.g., 'key_1' to unlock
  hidden?: boolean          // Revealed by conditions
}

interface RoomGraph {
  rooms: Map<string, Room>
  adjacency: Map<string, string[]>    // roomId → neighbor roomIds
  criticalPath: string[]              // Mandatory progression path
  optionalRooms: Set<string>          // Can be skipped
}
```

## Core Functions

### Loading & Validation

#### `loadRoom(roomId: string): Promise<Room>`
Async load room definition:
- Vite dynamic import for static rooms (enables HMR in dev)
- Returns Room with exits, encounters, flavor text

#### `buildRoomGraph(roomIds: string[]): Promise<RoomGraph>`
Validates entire room graph:
- All exits point to existing rooms
- No dangling references
- Builds adjacency list
- Finds critical path via BFS
- Identifies optional rooms

### Graph Algorithms

#### `findCriticalPath(adjacency, startRoomId): string[]`
BFS from start room to end of graph:
- Returns shortest path (mandatory rooms)
- Players must visit these to progress
- Example: [room_1, room_2, room_3]

#### `getAvailableExits(room, inventory): RoomExit[]`
Filter room exits based on player state:
- Removes locked exits (missing required item)
- Removes hidden exits (not yet revealed)
- Returns navigable exits

#### `canMove(from, direction, inventory): boolean`
Validate movement before dispatch:
- Check exit exists in that direction
- Check player has required items
- Check exit not hidden

#### `getNextRoom(from, direction, inventory): string | null`
Get target room ID if movement is valid:
- Returns null if can't move
- Used by GameLoop to transition rooms

### Generation

#### `generateProceduralRoom(id, x, y, config): ProceduralRoom`
Generate single room from seed:
- Deterministic: same coordinates = same room
- Name: from biome-specific pool (seeded)
- Description: flavor text by biome + difficulty
- Exits: random connectivity based on config
- Difficulty: randomized within config range

#### `generateDungeon(config): ProceduralRoom[]`
Generate connected dungeon:
- Places rooms in grid
- Connects with probability (connectedness config)
- Ensures all rooms connected (spanning tree)
- Returns array ready for game use

## Configuration

### Procedural Generation Config

```typescript
interface RoomGenConfig {
  width: number              // Grid width (e.g., 10)
  height: number             // Grid height (e.g., 10)
  connectedness: number      // Exit probability (0-1, e.g., 0.3)
  minDifficulty: number      // Minimum enemy level (e.g., 1)
  maxDifficulty: number      // Maximum enemy level (e.g., 10)
  biomes: string[]           // Biomes to use (e.g., ['forest', 'cave'])
  encounterDensity: number   // How many enemies per room (0-1)
}
```

### Example: Small Forest

```typescript
const config: RoomGenConfig = {
  width: 5,
  height: 5,
  connectedness: 0.4,
  minDifficulty: 1,
  maxDifficulty: 5,
  biomes: ['forest', 'ruin'],
  encounterDensity: 0.6,
}

const dungeon = generateDungeon(config)  // 25 rooms
```

## Static Room JSON Format

File: `src/assets/rooms/room_1_forest_entrance.json`

```json
{
  "id": "forest_entrance",
  "type": "static",
  "name": "Forest Entrance",
  "description": "The forest path stretches before you, shrouded in mist.",
  "difficulty": 1,
  "exits": [
    {
      "direction": "north",
      "targetRoomId": "forest_path",
      "hidden": false
    }
  ],
  "encounters": [
    {
      "id": "forest_start_encounter",
      "type": "optional",
      "triggerChance": 0.2,
      "enemies": [
        { "id": "goblin_scout", "name": "Goblin Scout", "hp": 15 }
      ]
    }
  ],
  "flavor": {
    "onEnter": "You step into the forest. The air smells of pine and earth.",
    "atmosphere": "Ancient trees tower above, their branches reaching like gnarled fingers."
  }
}
```

## Usage in GameLoop

**Future Integration** (not yet implemented):

```typescript
// In GameLoop.enterRoom()
async function enterRoom(state: GameState, roomId: string): Promise<GameState> {
  const room = await loadRoom(roomId)  // Async load
  
  return {
    ...state,
    currentRoom: room,
    phase: 'room_exploring',
    // ... reset encounter state
  }
}

// In GameLoop (add new function)
function moveInRoom(state: GameState, direction: string): GameState {
  const nextRoomId = getNextRoom(state.currentRoom, direction, state.player.inventory)
  
  if (!nextRoomId) {
    return state  // Can't move, stay in place
  }
  
  return {
    ...state,
    phase: 'room_enter',  // Transition to next room
    nextRoomId,
  }
}
```

## Procedural Generation Algorithm

### Step 1: Grid Placement
Place rooms in a 2D grid, starting at (0, 0)

### Step 2: Random Exits
Each room gets exits with probability = connectedness
- 30% chance for each cardinal direction
- Check bounds (don't exit grid)
- Result: sparse random graph

### Step 3: Ensure Connectivity
DFS to find connected components:
- Start from (0, 0)
- If unvisited room found, connect nearest visited room
- Repeat until all rooms connected
- **Result**: Guaranteed spanning tree (all reachable from start)

### Step 4: Seeded Naming
Hash room coordinates to get deterministic seed:
- `seed = (x * 73856093) ^ (y * 19349663)`
- Use seed with RNG to pick name from biome pool
- Same (x, y) = same name every run

### Example: 5x5 Forest

```
(0,0)──(1,0)  (2,0)
  │      │      │
(0,1)  (1,1)──(2,1)──(3,1)
  │             │
(0,2)  (1,2)  (2,2)  (3,2)

Critical Path: (0,0) → (1,0) → (2,0) → (2,1) → (3,1) → (3,2)
Optional: (0,1), (1,1), (0,2), (1,2), (2,2)
```

## Biome System

Supported biomes with name pools:

- **forest**: "Clearing", "Grove", "Path", "Dense Woods", "Ravine"
- **cave**: "Underground Lake", "Cavern", "Crystal Chamber", "Void", "Abyss"
- **dungeon**: "Guard Tower", "Throne Room", "Dungeon Cell", "Barracks", "Torture Chamber"
- **ruin**: "Broken Temple", "Ancient Library", "Collapsed Hall", "Lost City", "Forgotten Shrine"

Each pool is deterministically seeded by room coordinates.

## Integration Checklist

- [ ] Add `currentRoom: Room` to GameState
- [ ] Add `inventory: Set<string>` to Player
- [ ] Create `moveInRoom(state, direction): GameState` in GameLoop
- [ ] Wire dispatch('move', direction) from RoomView component
- [ ] Integrate RoomManager into game initialization
- [ ] Create Vue components:
  - [ ] `RoomView.vue` - Display current room, exits
  - [ ] `ExitButton.vue` - Clickable exit with lock/reveal indicators
  - [ ] `RoomMap.vue` - Visual map of visited rooms (optional)

## Files

- [src/engine/RoomSystem.ts](src/engine/RoomSystem.ts) - Type definitions
- [src/engine/RoomManager.ts](src/engine/RoomManager.ts) - Loading & graph algorithms
- [src/engine/RoomGenerator.ts](src/engine/RoomGenerator.ts) - Procedural generation
- [src/assets/rooms/](src/assets/rooms/) - Static room JSONs

## Next Steps

1. **Integration**: Wire RoomManager into GameLoop state machine
2. **Inventory**: Add inventory to Player, wire to exit validation
3. **Components**: Build RoomView + ExitButton Vue components
4. **Procedural**: Test dungeon generation with various configs
5. **Encounters**: Generate enemies per room difficulty
