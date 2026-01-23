# Encounter System Design

## Overview

The Encounter System manages all non-combat and combat interactions the player experiences:
- **Static encounters**: Scripted, hand-authored (boss fights, story events)
- **Random encounters**: Weighted probability tables (wilderness monster spawns, loot boxes)
- **Outcomes**: Combat, dialogue, loot, status effects, special events

## Architecture

### Encounter Types

#### Static Encounters
- Hand-authored in JSON (`src/assets/encounters/static/*.json`)
- Always trigger when encountered (scripted story beats)
- Examples: Boss fights, NPC dialogue, quest events
- Best for: Critical story moments, unique mechanics

#### Random Encounters
- Defined in weighted tables (`src/assets/encounters/tables/*.json`)
- Probabilistic triggering (30% chance to encounter wolf pack)
- Difficulty-scaled (higher rooms = tougher enemies)
- Best for: Wilderness exploration, loot discovery

### Core Types

#### EncounterDef (Union Type)

Either `StaticEncounter` or `RandomEncounter`:

```typescript
type EncounterDef = StaticEncounter | RandomEncounter

interface StaticEncounter {
  id: string
  type: 'static'
  name: string
  description: string
  outcome: EncounterOutcome  // 'combat' | 'dialogue' | 'loot' | 'status_effect' | 'boss' | 'event'
  
  // Outcome-specific data (only one populated)
  combat?: CombatEncounter
  dialogue?: DialogueEncounter
  loot?: LootEncounter
  statusEffect?: StatusEffectEncounter
  event?: EventEncounter
}

interface RandomEncounter extends StaticEncounter {
  type: 'random'
  triggerChance: number  // 0-1 probability (e.g., 0.35 = 35%)
}
```

#### Outcome Types

**Combat Encounter**
```typescript
interface CombatEncounter {
  enemies: EnemyTemplate[]
  minGroupSize?: number      // Vary enemy count
  maxGroupSize?: number
  scaling?: number           // 0-1, how much difficulty scales enemies (0.5 = 50% per difficulty level)
}
```

**Dialogue Encounter**
```typescript
interface DialogueEncounter {
  npcName: string
  lines: DialogueLine[]      // Conversation flow
  onComplete?: string        // Event trigger (quest_accept, door_unlock, etc.)
}

interface DialogueLine {
  speaker: string            // 'npc' or player name
  text: string
  choices?: DialogueChoice[] // Player decisions
  requiresItem?: string      // Gate dialogue by inventory
}
```

**Loot Encounter**
```typescript
interface LootEncounter {
  items: ItemDrop[]          // Weighted item table
  gold?: number
  minItems?: number
  maxItems?: number
}

interface ItemDrop {
  id: string
  weight: number             // Probability weight
  quantity?: number
}
```

**Status Effect Encounter**
```typescript
interface StatusEffectEncounter {
  effect: string             // 'poison', 'bleed', 'blessing', 'curse'
  severity: number           // 1-10 intensity
  description: string
  duration?: number          // Turns (null = permanent)
}
```

**Event Encounter**
```typescript
interface EventEncounter {
  eventType: string          // 'bridge_collapse', 'door_unlock', 'npc_spawn'
  description: string
  consequence?: string       // How it affects game
  unlockedRoom?: string      // Room ID to unlock
  requiredItem?: string      // Item to consume/use
}
```

## Data Files

### Static Encounters

**File**: `src/assets/encounters/static/forest_bandits.json`

```json
{
  "id": "forest_bandits",
  "type": "static",
  "name": "Bandit Ambush",
  "description": "A group of bandits blocks the road.",
  "outcome": "combat",
  "combat": {
    "enemies": [
      {
        "id": "bandit_leader",
        "name": "Bandit Leader",
        "hp": 45,
        "baseStrength": 12,
        "baseDefense": 8,
        "baseSpeed": 10,
        "loot": [
          { "id": "gold_pouch", "weight": 0.8 },
          { "id": "iron_sword", "weight": 0.3 }
        ],
        "minCount": 1,
        "maxCount": 1
      },
      {
        "id": "bandit_thug",
        "name": "Bandit Thug",
        "hp": 25,
        "baseStrength": 8,
        "baseDefense": 5,
        "baseSpeed": 8,
        "loot": [{ "id": "leather_pouch", "weight": 0.5 }],
        "minCount": 2,
        "maxCount": 3
      }
    ],
    "scaling": 0.6
  }
}
```

**File**: `src/assets/encounters/static/wizard_dialogue.json`

```json
{
  "id": "wizard_dialogue",
  "type": "static",
  "name": "Encounter with the Wizard",
  "description": "An old wizard appears before you.",
  "outcome": "dialogue",
  "dialogue": {
    "npcName": "Aldric the Wise",
    "lines": [
      {
        "speaker": "npc",
        "text": "Ah, a traveler! I sense great potential in you."
      },
      {
        "speaker": "player",
        "text": "I'm searching for a way forward.",
        "choices": [
          {
            "text": "Tell me about the ancient ruins.",
            "consequence": "quest_accept_ruins"
          },
          {
            "text": "Just directions to the next town.",
            "consequence": "quest_skip"
          }
        ]
      }
    ],
    "onComplete": "quest_accepted"
  }
}
```

**File**: `src/assets/encounters/static/boss_encounter.json`

```json
{
  "id": "boss_encounter",
  "type": "static",
  "name": "Ancient Guardian",
  "description": "The chamber trembles as an ancient stone guardian awakens!",
  "outcome": "boss",
  "combat": {
    "enemies": [
      {
        "id": "stone_guardian",
        "name": "Ancient Stone Guardian",
        "hp": 150,
        "baseStrength": 18,
        "baseDefense": 15,
        "baseSpeed": 6,
        "loot": [
          { "id": "guardian_amulet", "weight": 1.0 },
          { "id": "legendary_sword", "weight": 0.8 }
        ]
      }
    ],
    "scaling": 1.0
  }
}
```

### Random Encounter Tables

**File**: `src/assets/encounters/tables/forest_random.json`

```json
{
  "id": "forest_random",
  "name": "Forest Random Encounters",
  "difficulty": 1,
  "entries": [
    {
      "id": "forest_goblins",
      "weight": 0.4,
      "encounter": {
        "id": "forest_goblins",
        "type": "random",
        "name": "Goblin Scouts",
        "description": "A band of goblins emerges from the trees!",
        "outcome": "combat",
        "triggerChance": 0.35,
        "combat": {
          "enemies": [
            {
              "id": "goblin_scout",
              "name": "Goblin Scout",
              "hp": 15,
              "baseStrength": 5,
              "baseDefense": 2,
              "baseSpeed": 7,
              "loot": [
                { "id": "copper_coin", "weight": 0.8 },
                { "id": "tattered_rags", "weight": 0.3 }
              ],
              "minCount": 2,
              "maxCount": 4
            }
          ],
          "scaling": 0.3
        }
      }
    },
    {
      "id": "forest_treasure",
      "weight": 0.15,
      "encounter": {
        "id": "forest_treasure",
        "type": "random",
        "name": "Abandoned Chest",
        "description": "You discover an old chest hidden beneath tree roots.",
        "outcome": "loot",
        "triggerChance": 0.2,
        "loot": {
          "items": [
            { "id": "health_potion", "weight": 0.7 },
            { "id": "mana_potion", "weight": 0.5 },
            { "id": "iron_ore", "weight": 0.6 },
            { "id": "map_fragment", "weight": 0.2 }
          ],
          "gold": 25,
          "minItems": 1,
          "maxItems": 3
        }
      }
    },
    {
      "id": "forest_trap",
      "weight": 0.1,
      "encounter": {
        "id": "forest_trap",
        "type": "random",
        "name": "Hidden Trap",
        "description": "You accidentally trigger an old trap!",
        "outcome": "status_effect",
        "triggerChance": 0.15,
        "statusEffect": {
          "effect": "poison",
          "severity": 2,
          "description": "You've been poisoned! You lose 1 HP each turn.",
          "duration": 5
        }
      }
    }
  ]
}
```

## Game Integration

### Flow Diagram

```
Room Enter
    ↓
Check for Encounters
    ↓
Static? ───Yes──→ Always trigger ───┐
    ↓                                │
    No                               │
    ↓                                │
Random? ──Yes──→ Roll probability ──→ If trigger
    ↓                                │
    No                               ↓
    ↓                         Select from table
No encounter                 (weighted by entry.weight)
                                    ↓
                          Trigger EncounterDef
                                    ↓
                         Resolve by outcome type
                                    ↓
                         Update GameState
```

### Usage in GameLoop

**Proposed integration** (not yet wired):

```typescript
// In GameLoop.enterRoom()
async function enterRoom(state: GameState): Promise<GameState> {
  const room = await loadRoom(state.nextRoomId)
  
  // Check for encounters
  let hasEncounter = false
  let encounterDef: EncounterDef | null = null
  
  // Check static encounters first
  if (room.encounters && room.encounters.length > 0) {
    const staticEncounter = room.encounters.find((e) => e.type === 'static')
    if (staticEncounter) {
      encounterDef = staticEncounter
      hasEncounter = true
    }
  }
  
  // Check random encounters if no static
  if (!hasEncounter && room.encounters) {
    for (const encounter of room.encounters) {
      if (encounter.type === 'random') {
        if (EncounterRNG.shouldTrigger(encounter, room.seed)) {
          encounterDef = encounter
          hasEncounter = true
          break
        }
      }
    }
  }
  
  if (hasEncounter && encounterDef?.combat) {
    // Trigger combat
    const combat = triggerEncounter(encounterDef, room.difficulty, room.seed)
    return triggerEncounter(state, encounterDef)
  }
  
  return {
    ...state,
    currentRoom: room,
    phase: 'room_exploring',
    currentEncounter: undefined,
  }
}

// In GameLoop.endEncounter()
function endEncounter(state: GameState, victoryType: 'win' | 'loss' | 'fled'): GameState {
  if (!state.currentEncounter) return state
  
  // Get resolution based on outcome type
  let resolution: EncounterResolution
  
  if (state.currentEncounter.outcome === 'combat') {
    resolution = resolveCombatEncounter(victoryType, state.currentEncounter.enemies, state.currentRoom.difficulty)
  } else if (state.currentEncounter.outcome === 'dialogue') {
    resolution = resolveDialogueEncounter(state.currentEncounter.dialogue!, 0)
  } else if (state.currentEncounter.outcome === 'loot') {
    resolution = resolveLootEncounter(state.currentEncounter.loot!, state.currentRoom.seed)
  } else {
    return state
  }
  
  // Apply resolution to game state
  return applyEncounterResolution(state, resolution)
}
```

## Probability Mechanics

### Random Encounter Selection

**Weighted Selection** - Higher weight = more likely

Table with 4 encounters:
```
Goblins:    weight 0.4 → 40% chance
Wolves:     weight 0.35 → 35% chance
Treasure:   weight 0.15 → 15% chance
Trap:       weight 0.1 → 10% chance
Total:      1.0 (automatically normalized if doesn't sum to 1)
```

**Trigger Chance** - Independent per-encounter roll

```
Random encounter selected: Wolves (35%)
Wolf encounter has triggerChance: 0.3 (30%)
Combined probability: 35% × 30% = 10.5% chance player encounters wolves
```

### Difficulty Scaling

Enemies scale by room difficulty + encounter scaling factor:

```typescript
scalingFactor = 1 + roomDifficulty * scaling * 0.1

// Example: room difficulty 3, scaling 0.5
scalingFactor = 1 + 3 * 0.5 * 0.1 = 1.15 (15% harder)

// Boss encounter: room difficulty 8, scaling 1.0
scalingFactor = 1 + 8 * 1.0 * 0.1 = 1.8 (80% harder)

// Apply to enemy stats:
enemy.hp *= scalingFactor
enemy.baseStrength *= scalingFactor
enemy.baseDefense *= (0.8 + roomDifficulty * 0.1)
```

## Resolution Pipeline

### Combat Resolution

1. Player wins battle
2. `resolveCombatEncounter('win')` returns:
   - `goldEarned`: enemy.strength × 2 + difficulty × 5
   - `experienceEarned`: 10 + difficulty × 5
   - `itemsLooted`: From enemy.loot table
3. `applyEncounterResolution()` adds items to inventory

### Loot Resolution

1. Player opens chest
2. `resolveLootEncounter()` randomly selects items from loot table
3. `applyEncounterResolution()` adds to inventory

### Status Effect Resolution

1. Player triggers trap / receives blessing
2. `resolveStatusEffectEncounter()` creates status effect
3. Effect applied to player for duration (turns)

## Files & API

### Type Definitions
- [src/engine/EncounterSystem.ts](src/engine/EncounterSystem.ts)
  - `EncounterDef`, `StaticEncounter`, `RandomEncounter`
  - `CombatEncounter`, `DialogueEncounter`, `LootEncounter`, `StatusEffectEncounter`
  - `EncounterRNG` class (weighted selection, seeded randomness)

### Manager Functions
- [src/engine/EncounterManager.ts](src/engine/EncounterManager.ts)
  - `loadStaticEncounter(id)` - Async JSON loader
  - `loadRandomEncounterTable(id)` - Async JSON loader
  - `triggerEncounter(def, difficulty, seed)` - Spawn combat
  - `resolveCombatEncounter(outcome, enemies, difficulty)` - Battle rewards
  - `resolveLootEncounter(loot, seed)` - Loot selection
  - `applyEncounterResolution(state, resolution)` - Update GameState

### Data Files
- `src/assets/encounters/static/` - Story encounters
  - `forest_bandits.json`
  - `wizard_dialogue.json`
  - `boss_encounter.json`
- `src/assets/encounters/tables/` - Random encounter pools
  - `forest_random.json` (goblins, wolves, treasure, traps)

## Next Steps

1. **Integration**: Wire EncounterManager into GameLoop.enterRoom()
2. **UI Components**: Build EncounterPanel.vue (combat UI, dialogue choices)
3. **Item Database**: Create items.json with consumable effects
4. **Status Effects**: Implement poison, blessing, curse mechanics
5. **Quest System**: Link dialogue consequences to quest state
6. **Advanced Scaling**: Difficulty curves, boss-specific mechanics
