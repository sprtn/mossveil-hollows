# Copilot Instructions for Strat Project

## Project Overview

**Strat** is a turn-based, room-based RPG built with Vue 3 + TypeScript + Vite. Players navigate rooms, encounter enemies, manage inventory, and make strategic decisions. The architecture separates pure game logic (testable) from Vue UI components (reactive).

## Tech Stack & Key Files

- **UI Framework**: Vue 3 with `<script setup>` SFC syntax (reactive UI, menus, HUD)
- **Rendering**: DOM-based (no Canvas) — Vue handles all rendering
- **Build Tool**: Vite (HMR enabled for local dev)
- **Language**: TypeScript with strict mode enabled
- **State Management**: Vue Composition API (provide/inject for global state)
- **Entry Point**: [src/main.ts](src/main.ts)
- **Game Logic**: Pure functions in [src/engine/GameLoop.ts](src/engine/GameLoop.ts) (testable, no Vue dependency)
- **Type Definitions**: [src/engine/GameLoopDesign.ts](src/engine/GameLoopDesign.ts)

## Development Workflow

- **`npm run dev`** – Start Vite dev server (HMR active for Vue components)
- **`npm run build`** – Compile TypeScript (`vue-tsc -b`) then bundle with Vite
- **`npm run preview`** – Preview production build locally

**TypeScript Check**: `vue-tsc -b` runs before build. Ensure all `.vue` and `.ts` files pass type checking.

## Core Game Loop

### Flow (State Machine)

```
ROOM_ENTER → ROOM_EXPLORING ──┬─→ ENCOUNTER_ACTION ──┬─→ ENCOUNTER_END ─→ ROOM_EXPLORING
                              │                       └─→ FLEE ──────────→ ROOM_EXPLORING
                              └─→ NEXT_ROOM ─────────────────────────────→ ROOM_ENTER
```

### Combat Subsystem

**Combat State Machine** (during encounter_action phase):
```
COMBAT_SETUP → PLAYER_TURN_START → EXECUTE_PLAYER_ACTION → ENEMY_TURNS → CHECK_VICTORY → COMBAT_END
```

**Simple mechanics:**
- Player always acts first (no random turn order)
- Enemies attack in order (deterministic AI)
- Damage = `strength - defense + variance(-2 to +2)`, min 1
- Actions: attack, defend (+5 defense), use item (heal 30 HP), flee (50% success)
- No animations, no complex AI

See [COMBAT_SYSTEM.md](COMBAT_SYSTEM.md) for detailed rules.

Key files:
- [src/engine/CombatSystem.ts](src/engine/CombatSystem.ts) – Types, damage calc, state helpers
- [src/engine/CombatResolver.ts](src/engine/CombatResolver.ts) – Action execution, flow control

### Logic & UI Separation

**Game Logic** ([src/engine/GameLoop.ts](src/engine/GameLoop.ts))
- Pure TypeScript functions with no Vue dependency
- All logic is testable, deterministic
- Takes `GameState` as input, returns new state (immutable)
- Examples: `playerAction()`, `resolveAttack()`, `endEncounter()`

**Vue Components** ([src/components/](src/components/))
- Subscribe to game state via provide/inject
- Dispatch actions back to game loop
- Reactive rendering (buttons, HP bars, inventory lists)
- No direct game logic—only reads state and triggers actions

### Example: Action Flow

```
Player clicks "Attack" (Vue)
  → Calls dispatch('playerAction', 'attack')
  → GameLoop.playerAction() executes
  → New GameState returned
  → Vue component re-renders with updated HP/turns
```

### Game State Interface

```typescript
interface GameState {
  phase: 'room_enter' | 'room_exploring' | 'encounter_action' | 'game_over'
  player: Player
  currentRoom: Room
  currentEncounter?: Encounter
  roomHistory: string[]
  turnCount: number
}
```

See [src/engine/GameLoopDesign.ts](src/engine/GameLoopDesign.ts) for full type definitions.

## Component Structure & Conventions

### Vue Components

Use `<script setup lang="ts">` with read-only game state:

```vue
<script setup lang="ts">
import { inject, computed } from 'vue'
import type { GameState } from '@/engine/GameLoopDesign'

const gameState = inject<GameState>('gameState')!
const dispatch = inject<(action: string, payload?: any) => void>('dispatch')!

const canAttack = computed(() => gameState.phase === 'encounter_action')

const handleAttack = () => {
  dispatch('playerAction', 'attack')
}
</script>

<template>
  <button v-if="canAttack" @click="handleAttack">Attack</button>
</template>

<style scoped>
button { padding: 8px 16px; }
</style>
```

**Conventions**:
- Components are **read-only** views of game state
- Dispatch actions, don't mutate state directly
- No game logic in components—call dispatch()
- Use `computed()` for derived UI state

### File Organization

- **[src/engine/](src/engine/)** – Pure game logic (testable)
  - `GameLoop.ts` – All state transitions and actions
  - `GameLoopDesign.ts` – Type definitions
  - `CombatSystem.ts` – Combat types, damage calculation
  - `CombatResolver.ts` – Combat action execution
  - `RoomSystem.ts` – Room type definitions
  - `RoomManager.ts` – Room loading and graph algorithms
  - `RoomGenerator.ts` – Procedural room generation
  - `EncounterSystem.ts` – Encounter type definitions
  - `EncounterManager.ts` – Encounter loading and resolution
  - `GameLoop.test.ts` – Unit tests (excluded from build)
- **[src/components/](src/components/)** – Vue UI (reactive)
  - `RoomView.vue` – Current room display
  - `EncounterPanel.vue` – Battle/encounter UI (to be created)
  - `Inventory.vue` – Item management (to be created)
- **[src/assets/](src/assets/)** – Game data (JSON)
  - `rooms/` – Room definitions
  - `encounters/` – Static and random encounter tables
  - `enemies.json` – Enemy templates (to be created)

## Data-Driven Design

### Room Data (JSON)

```json
{
  "id": "room_1",
  "name": "Forest Entrance",
  "description": "A dense forest path",
  "nodeCount": 3,
  "encounters": [
    {
      "id": "random_goblins",
      "type": "random",
      "triggerChance": 0.4,
      "enemies": [
        { "id": "goblin_1", "name": "Goblin", "hp": 20 }
      ]
    }
  ],
  "nextRoomId": "room_2"
}
```

**Why JSON?**: Easy to author, no recompilation, live editing possible.

## Common Tasks

### Adding a New Room

1. Create JSON file in [src/assets/rooms/room_2.json](src/assets/rooms/room_2.json)
2. Define `id`, `name`, `encounters`, `nextRoomId`
3. Import in room manager
4. Encounter data references enemies—no code changes needed

### Adding an Enemy Type

1. Define in [src/assets/enemies.json](src/assets/enemies.json) or `enemies.ts`
2. Reference by ID in room encounters
3. Stats auto-apply to combat calculations

### Adding a Vue Component

1. Create in [src/components/MyComponent.vue](src/components/MyComponent.vue)
2. Inject `gameState` and `dispatch`
3. Listen to phase changes via `computed()`
4. Dispatch actions on user interaction
5. Test pure logic first ([src/engine/GameLoop.test.ts](src/engine/GameLoop.test.ts))

## Important Constraints

- **Game logic is pure TypeScript** – no Vue, no side effects
- **Immutable state updates** – GameLoop returns new state, never mutates input
- **No external game engines** – keep it minimal
- **Data-driven design** – game content lives in JSON, not code
- **TypeScript strict mode** – all unused code and type issues must pass `npm run build`
- **Test game logic first** – write tests before Vue components

## Architecture Decision Records

- **Why pure TypeScript for game logic?** Testability + reusability. Can swap UI without touching core.
- **Why immutable state updates?** Easier to debug, replay, and reason about.
- **Why data-driven design?** Content creators can edit JSON without touching code.
- **Why avoid Redux/Pinia?** Simple dispatch() is enough for turn-based games.
- **Why avoid Canvas for UI?** Vue's DOM is simpler and faster for turn-based games.

## When in Doubt

- **Adding a feature?** Write pure function in GameLoop.ts first, then test it, then wire Vue component
- **Game logic broken?** Check [src/engine/GameLoop.test.ts](src/engine/GameLoop.test.ts) and add a test case
- **UI not updating?** Ensure dispatch() calls gameState setter in provide/inject
- **TypeScript errors?** Run `npm run build` — strict mode catches everything
