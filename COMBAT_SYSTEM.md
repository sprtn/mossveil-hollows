# Turn-Based Combat System

## Overview

A **simple, deterministic turn-based combat system** for 1v1 to 1v3 battles:
- Player always acts first
- Enemies follow in order (no random turn order)
- No complex AI (enemies always attack)
- No animations
- Combat is interruptible (flee mechanic)

## State Machine

```
┌─────────────────────────────────────────────────┐
│           COMBAT_SETUP                          │
│  Initialize combat, set up turn order           │
│  (Player first, then enemies in order)          │
└────────────────┬────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────┐
│         PLAYER_TURN_START                       │
│  Player selects action (attack/defend/item/flee)│
└────────┬──────────────────┬──────────────────────┘
         │                  │
         ↓                  ↓
    [attack/           [flee?]
     defend/item]         │
         │         ┌──────┴──────┐
         │         ↓             ↓
         │      Success        Failed
         │         │             │
         ↓         ↓             ↓
┌──────────────────────────────────────────────────┐
│        PLAYER_ACTION                             │
│  Damage/heal/defend applied to player/enemies    │
└──────────┬─────────────────────┬──────────────────┘
           │                     │
           ↓                     ↓
      [normal path]        [fled successfully]
           │                     │
           ↓                     ↓
┌──────────────────────┐   COMBAT_END (Victory)
│    ENEMY_TURNS       │
│ Each alive enemy     │
│ attacks player       │
└──────────┬───────────┘
           │
           ↓
┌──────────────────────────────────────────────────┐
│       CHECK_VICTORY                              │
│  All enemies defeated? Player KO'd?              │
└──┬──────────────────┬──────────────┬─────────────┘
   │                  │              │
   ↓                  ↓              ↓
Player Won         Combat          Player Lost
   │            Continues           │
   │                │               │
   ↓                ↓               ↓
COMBAT_END ──→ PLAYER_TURN_START   COMBAT_END
(Victory)                        (Defeat)
```

## Core Interfaces

### CombatState

Active combat instance:

```typescript
interface CombatState {
  id: string                 // Unique combat ID
  phase: CombatPhase         // Current state (setup, player_turn_start, etc.)
  player: CombatParticipant  // Player stats + current HP
  enemies: CombatEnemy[]     // 1-3 enemies
  turnOrder: TurnIndex[]     // [Player, Enemy1, Enemy2, Enemy3] (deterministic)
  currentTurnIndex: number   // Index into turnOrder
  round: number              // Combat round (1+)
  playerDefending: boolean   // Is player defending this round?
  playerDefenseBonus: number // +5 defense if defending
  combatLog: CombatLogEntry[]// Action history
}
```

### CombatParticipant

Player or enemy stats:

```typescript
interface CombatParticipant {
  id: string
  name: string
  maxHp: number
  currentHp: number
  strength: number    // Damage output
  defense: number     // Damage reduction
  speed: number       // Currently unused (reserved for future)
}
```

### PlayerAction

What player decides to do:

```typescript
interface PlayerAction {
  actionType: 'attack' | 'defend' | 'use_item' | 'flee'
  targetId?: string  // Not used yet (auto-target first enemy)
  itemId?: string    // For use_item action
}
```

### CombatResult

Outcome after combat ends:

```typescript
interface CombatResult {
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

## Mechanics

### Turn Order

**Deterministic, no RNG:**
1. Player always acts first
2. Enemies act in order of their ID
3. Each round, repeat

Example with 2 enemies:
```
Round 1: Player → Enemy1 → Enemy2
Round 2: Player → Enemy1 → Enemy2
Round 3: ...
```

### Damage Calculation

**Formula:**
```
baseDamage = attacker.strength
targetDefense = defender.defense * (defending ? 0.5 : 1.0)
variance = random(-2, +2)
finalDamage = max(1, baseDamage - targetDefense + variance)
```

**Example 1: Player attacks Goblin**
```
Player: strength=10
Goblin: defense=2, not defending

baseDamage = 10
targetDefense = 2 * 1.0 = 2
variance = -1
finalDamage = max(1, 10 - 2 - 1) = 7
```

**Example 2: Player defends, Enemy attacks**
```
Player: defense=5, is defending
Enemy: strength=8

baseDamage = 8
targetDefense = 5 * 0.5 = 2.5 → 2 (floored)
variance = +1
finalDamage = max(1, 8 - 2 + 1) = 7
(Reduced from 8-5+1=4 to 8-2+1=7 because defending halves defense calc)
```

### Actions

#### Attack
- Target: First alive enemy (no targeting UI yet)
- Effect: Deal damage = `baseDamage - defense + variance`
- Clears defend flag
- Clears defense bonus

#### Defend
- Target: Self
- Effect: +5 defense bonus on next enemy turn only
- Does not clear flag until enemy attacks
- Reduces incoming damage

**Defense Stacking:**
```
Player defense = 5
Player defends: +5 bonus
Enemy sees effective defense = 5 + 5 = 10
Then bonus resets next turn
```

#### Use Item
- Target: Self
- Effect: Heal player (30 HP by default)
- Item ID tracked for future inventory system
- Clears defend flag

#### Flee
- Target: Self
- Effect: 50% chance to escape combat
- Success: Combat ends immediately, no XP/loot
- Failure: Continue combat, no penalty

## Combat Flow (Pseudocode)

```javascript
// 1. Setup
const combatState = initializeCombatState(player, [enemy1, enemy2])
// combatState.phase = 'combat_setup'

// 2. Start player turn
combatState.phase = nextCombatPhase(combatState) // 'player_turn_start'

// 3. Player chooses action
const playerAction = { actionType: 'attack' }
combatState = executePlayerAction(combatState, playerAction)
// Damage applied, combat log updated

// 4. Check if combat over
if (!isCombatOver(combatState)) {
  // 5. Execute enemy turns
  combatState.phase = nextCombatPhase(combatState) // 'enemy_turns'
  combatState = executeAllEnemyTurns(combatState)
  
  // 6. Check victory
  combatState.phase = nextCombatPhase(combatState) // 'check_victory'
  
  if (!isCombatOver(combatState)) {
    // 7. Next round
    combatState = advanceTurn(combatState)
    combatState.phase = 'player_turn_start'
    // Go back to step 2
  }
}

// 8. Combat ends
const result = getCombatResult(combatState)
// { victoryType: 'win', round: 3, goldEarned: 45, ... }
```

## Examples

### Example 1: Simple Combat

**Setup:**
- Player: HP=30, STR=10, DEF=5
- Goblin: HP=15, STR=5, DEF=2

**Turn 1:**
1. Player attacks Goblin
   - Damage: 10 - 2 + (1) = 9
   - Goblin: 15 - 9 = 6 HP
2. Goblin attacks Player
   - Damage: 5 - 5 + (-2) = -2 → 1 (min 1)
   - Player: 30 - 1 = 29 HP

**Turn 2:**
1. Player attacks Goblin
   - Damage: 10 - 2 + (0) = 8
   - Goblin: 6 - 8 = 0 HP (defeated)
2. No enemy turn (all defeated)

**Result:** Victory in 2 rounds

### Example 2: Defend Action

**Setup:**
- Player: HP=25, STR=8, DEF=4
- Orc: HP=20, STR=10, DEF=3

**Turn 1:**
1. Player defends
   - Defense bonus: +5
   - Player.playerDefending = true
2. Orc attacks Player
   - Damage: 10 - (4 + 5) * 0.5 + (2) = 10 - 4.5 + 2 = 7 (floored)
   - Player: 25 - 7 = 18 HP
   - Player.playerDefending = false (reset)

### Example 3: Flee

**Setup:**
- Player: HP=10, STR=5, DEF=3
- Troll: HP=50, STR=12, DEF=6

**Turn 1:**
1. Player flees
   - Flee chance: 50%
   - Roll: 0.45 (success!)
   - Combat ends immediately
   - Result: { victoryType: 'fled', ... }

## Files

- [src/engine/CombatSystem.ts](src/engine/CombatSystem.ts) - Types, damage calc, state helpers
- [src/engine/CombatResolver.ts](src/engine/CombatResolver.ts) - Action execution, flow control

## API Reference

### State Management

**`initializeCombatState(id, player, enemies): CombatState`**
- Initialize combat with player and enemies
- Sets up deterministic turn order

**`nextCombatPhase(state): CombatPhase`**
- Advance state machine to next phase
- Handles phase logic (setup → player turn → enemies → check → end)

**`advanceTurn(state): CombatState`**
- Move to next actor in turn order
- Increment round when all actors have acted

### Action Execution

**`executePlayerAction(state, action): CombatState`**
- Apply player action (attack, defend, use item, flee)
- Update combat log
- Handle damage, healing, defense bonus

**`executeEnemyTurn(state, enemyId): CombatState`**
- Single enemy attacks player (deterministic AI)
- Apply damage (with defense reduction if defending)
- Update combat log

**`executeAllEnemyTurns(state): CombatState`**
- Execute all alive enemies in turn order

### Query Functions

**`isPlayerAlive(state): boolean`**
- Check if player HP > 0

**`areEnemiesAlive(state): boolean`**
- Check if any enemies HP > 0

**`isCombatOver(state): boolean`**
- True if player is dead OR all enemies are dead

**`getCombatResult(state): CombatResult`**
- Get final outcome (win/loss/fled)
- Calculate rewards (gold, XP, loot)

**`getCombatSummary(state): CombatSummary`**
- Get formatted summary for UI display
- HP bars, defending status, last action

### Utilities

**`calculateDamage(attacker, defender, isDefending): DamageRoll`**
- Calculate damage using formula
- Returns base damage, variance, final damage

**`applyDamage(target, damage): number`**
- Apply damage, return remaining HP (min 0)

**`applyHealing(target, healing): number`**
- Apply healing, return new HP (max maxHp)

**`getAliveEnemies(state): CombatEnemy[]`**
- Filter to only living enemies

**`formatCombatLog(state): string[]`**
- Format combat log for display

## Integration with GameLoop

**Proposed wiring** (not yet implemented):

```typescript
// In GameLoop: handle combat phase
if (state.phase === 'encounter_action') {
  // Player chose action
  const playerAction = { actionType: 'attack' }
  state.combatState = executePlayerAction(state.combatState, playerAction)
  
  // Check if combat should continue
  if (!isCombatOver(state.combatState)) {
    state.combatState = executeAllEnemyTurns(state.combatState)
    state.combatState.phase = nextCombatPhase(state.combatState)
  } else {
    // Combat over, get result
    const result = getCombatResult(state.combatState)
    state.phase = 'encounter_end'
  }
}
```

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| Player always goes first | Removes RNG from turn order, deterministic gameplay |
| Enemies in order by ID | Consistent, predictable behavior |
| Simple AI (always attack) | No complex decision-making, clear mechanics |
| Defend halves defense calc | Makes defending meaningful but not OP |
| Minimum 1 damage | Prevents infinite stalling with low-damage builds |
| Flee always 50% success | Gives players escape option without guaranteeing success |
| No targeting UI yet | Future feature, auto-target first enemy for now |
| Combat log tracks all actions | Educational, shows exactly what happened |

## Future Enhancements

- [ ] Player targeting (choose which enemy to attack)
- [ ] Enemy AI variations (some enemies are defensive, aggressive, etc.)
- [ ] Speed stat integration (affects turn order)
- [ ] Critical hits (random chance for 1.5x damage)
- [ ] Status effects (poison, bleed, stun)
- [ ] Multi-action rounds (player acts multiple times)
- [ ] Animation/visual feedback
- [ ] Sound effects
- [ ] Combo system (attack twice if defending last turn)
