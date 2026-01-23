# Combat System Summary

## Overview

A **simple, deterministic turn-based combat system** designed for the Strat RPG.

## State Machine

```
COMBAT_SETUP
    ↓
PLAYER_TURN_START ← ─────────────────┐
    ↓                                 │
PLAYER_ACTION                         │
    ├─→ [attack/defend/item]         │
    │   (apply damage/effects)        │
    │                                 │
    └─→ [flee attempt]                │
        ├─ Success → COMBAT_END       │
        └─ Fail ──→ (continue)        │
    ↓                                 │
ENEMY_TURNS                          │
    (each alive enemy attacks)        │
    ↓                                 │
CHECK_VICTORY                        │
    ├─ Player won → COMBAT_END        │
    ├─ Player lost → COMBAT_END       │
    └─ Continue ──→ (next round) ────┘
    ↓
COMBAT_END
    (terminal state)
```

## Core Mechanics

### Turn Order (Deterministic)
- **Player always first**
- **Enemies follow in order** (by ID)
- No randomness in turn ordering
- Example: Player → Goblin1 → Goblin2 → Goblin3 → (repeat)

### Damage Formula
```
baseDamage = attacker.strength
defense = target.defense * (defending ? 0.5 : 1.0)
variance = random(-2, +2)
finalDamage = max(1, baseDamage - defense + variance)
```

**Example:**
- Player (STR 10) attacks Goblin (DEF 2)
- Roll: variance = +1
- Damage = 10 - 2 + 1 = 9

### Actions

| Action | Effect | Notes |
|--------|--------|-------|
| **Attack** | Deal damage to first alive enemy | Damage = STR - DEF + variance(-2 to +2) |
| **Defend** | +5 defense bonus this round | Reduces incoming damage by ~50% calc |
| **Use Item** | Heal 30 HP (placeholder) | Future: consume from inventory |
| **Flee** | 50% chance to escape | Success: combat ends, no rewards |

### Defense Mechanics
- Normal defense: `damage - defense`
- Defending: `damage - (defense * 0.5)` (approximately 50% reduction)
- Defense resets after enemy turn

**Example:**
```
Player defense: 5, not defending
Enemy (STR 8) attacks: 8 - 5 + (-1) = 2 damage

Player defense: 5, defending (+5 bonus = 10 effective)
Enemy (STR 8) attacks: 8 - (10 * 0.5) + (-1) = 3 damage
```

## Types

### CombatState
```typescript
{
  id: string
  phase: CombatPhase
  player: CombatParticipant
  enemies: CombatEnemy[]
  turnOrder: TurnIndex[]
  currentTurnIndex: number
  round: number
  playerDefending: boolean
  playerDefenseBonus: number
  combatLog: CombatLogEntry[]
}
```

### PlayerAction
```typescript
{
  actionType: 'attack' | 'defend' | 'use_item' | 'flee'
  targetId?: string  // (reserved, auto-targets first enemy)
  itemId?: string    // for 'use_item'
}
```

### CombatResult
```typescript
{
  victoryType: 'win' | 'loss' | 'fled'
  round: number
  playerHp: number
  playerMaxHp: number
  enemiesDefeated: number
  goldEarned: number
  itemsLooted: string[]
  experienceEarned: number
}
```

## Key Files

| File | Purpose |
|------|---------|
| [src/engine/CombatSystem.ts](src/engine/CombatSystem.ts) | Type definitions, damage calculation, state helpers |
| [src/engine/CombatResolver.ts](src/engine/CombatResolver.ts) | Action execution, state transitions, combat logic |
| [COMBAT_SYSTEM.md](COMBAT_SYSTEM.md) | Full documentation with examples |

## API

### Initialization
- `initializeCombatState(id, player, enemies)` - Create combat

### State Transitions
- `nextCombatPhase(state)` - Advance state machine
- `advanceTurn(state)` - Move to next actor

### Action Execution
- `executePlayerAction(state, action)` - Apply player action
- `executeEnemyTurn(state, enemyId)` - Single enemy acts
- `executeAllEnemyTurns(state)` - All enemies act

### Queries
- `isPlayerAlive(state)` - Check player HP > 0
- `isCombatOver(state)` - Check if combat ended
- `getCombatResult(state)` - Get final outcome + rewards
- `getCombatSummary(state)` - Formatted UI data
- `getAliveEnemies(state)` - Filter living enemies

### Utilities
- `calculateDamage(attacker, defender, defending)` - Damage roll
- `applyDamage(target, damage)` - Reduce HP
- `applyHealing(target, healing)` - Increase HP
- `formatCombatLog(state)` - Text log for display

## Design Decisions

| Decision | Why |
|----------|-----|
| Player always goes first | Removes RNG, deterministic gameplay |
| Enemies in order | Consistent, predictable AI |
| Simple AI (always attack) | No complex decision trees |
| Min 1 damage | Prevents infinite stalling |
| Defend halves defense calc | Makes defending meaningful |
| Flee always 50% | Gives escape option without guarantee |
| No targeting UI yet | Auto-target first enemy, implement UI later |
| Combat log all actions | Educational, shows exactly what happened |

## Integration with GameLoop

**Not yet wired** — when ready:

```typescript
// In GameLoop: handle combat phase
if (state.phase === 'encounter_action') {
  // Player took action
  state.combatState = executePlayerAction(
    state.combatState,
    { actionType: 'attack' }
  )
  
  // Enemies respond
  if (!isCombatOver(state.combatState)) {
    state.combatState = executeAllEnemyTurns(state.combatState)
  }
  
  // Advance phase
  state.combatState.phase = nextCombatPhase(state.combatState)
}
```

## Example Combat

**Setup:**
- Player: 30 HP, STR 10, DEF 5
- Goblin: 15 HP, STR 5, DEF 2

**Round 1:**
1. Player attacks Goblin
   - Damage: 10 - 2 + (1) = 9
   - Goblin: 15 - 9 = 6 HP
2. Goblin attacks Player
   - Damage: 5 - 5 + (-2) = -2 → 1 (min)
   - Player: 30 - 1 = 29 HP

**Round 2:**
1. Player attacks Goblin
   - Damage: 10 - 2 + (0) = 8
   - Goblin: 6 - 8 = 0 HP (defeated)
2. No enemy turn (all dead)

**Result:** Victory in 2 rounds, 0 damage taken

## Build Status

✅ TypeScript strict mode passes
✅ All types correctly defined
✅ Ready for GameLoop integration
✅ No external dependencies

## Next Steps

1. **Wire to GameLoop**: Implement combat phase handling in game loop
2. **UI Component**: Create EncounterPanel.vue with action buttons
3. **Item System**: Link use_item to actual inventory items
4. **Enemy AI**: Add variations (defensive, aggressive, etc.)
5. **Speed Integration**: Use speed stat for turn order variance
6. **Status Effects**: Poison, bleed, stun, blessing mechanics
