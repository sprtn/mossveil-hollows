# MVP Simplification Review

## Current State Analysis

### ✅ **Essential for MVP** (Keep)
1. **Game Start Screen** - Need to start the game
2. **Room Exploring Screen** - Core gameplay loop
3. **Encounter Screen** - Core combat mechanic
4. **Game Over Screen** - Need to know when you die
5. **Game Header** - HP display (essential feedback)
6. **Basic State Management** - provide/inject (minimal overhead)

### ❌ **Unnecessary Complexity** (Remove/Simplify)

#### 1. **Inventory Modal** - OVERBUILT
**Current:** Full modal with categories, use buttons, descriptions
**MVP:** Remove entirely OR single list with "Use" buttons
**Reason:** Inventory not essential for playable MVP. Can add later.

#### 2. **Combat Target Selection** - OVERBUILT
**Current:** Dropdown/selector for multiple enemies
**MVP:** Always attack first alive enemy (simplest)
**Reason:** MVP should be 1v1 or simple 1v2. Target selection adds complexity.

#### 3. **Combat Log** - NICE TO HAVE
**Current:** Scrollable log with turn-by-turn history
**MVP:** Remove OR show only last action ("You attack for 12 damage!")
**Reason:** Visual HP bars provide enough feedback. Log is extra.

#### 4. **Status Hints** - NICE TO HAVE
**Current:** "You feel tired..." warnings
**MVP:** Remove
**Reason:** HP bar already shows status. Text hints are redundant.

#### 5. **Game Over Stats** - NICE TO HAVE
**Current:** Final stats screen with multiple metrics
**MVP:** Just "You died" + Restart button
**Reason:** Stats don't affect gameplay. Can add later.

#### 6. **Gold Display** - NOT IMPLEMENTED
**Current:** Shows in header but not in game logic
**MVP:** Remove from header
**Reason:** Not implemented in backend yet. Remove until needed.

#### 7. **Multiple Action Buttons** - NOT IMPLEMENTED
**Current:** "Explore Area", "Rest" buttons
**MVP:** Just "Move Forward" button
**Reason:** These actions don't exist in game logic yet.

#### 8. **Complex Encounter Screen** - OVERBUILT
**Current:** Header, description, enemy list, combat log, actions, target selector
**MVP:** Enemy HP bar, Attack/Defend/Flee buttons, simple message
**Reason:** Too many UI elements. Simplify to essentials.

---

## Simplified MVP Component Tree

```
App.vue (Root)
│
├── GameHeader.vue (HP only - remove Gold, simplify)
│
├── GameScreen.vue
│   │
│   ├── GameStartScreen.vue ✅ Keep
│   │
│   ├── RoomExploringScreen.vue (SIMPLIFIED)
│   │   ├── Room Title
│   │   ├── Room Description
│   │   └── [Move Forward] button (single action)
│   │
│   ├── EncounterScreen.vue (SIMPLIFIED)
│   │   ├── Enemy HP bar
│   │   ├── Simple message ("You are fighting X!")
│   │   └── [Attack] [Defend] [Flee] buttons
│   │
│   └── GameOverScreen.vue (SIMPLIFIED)
│       ├── "You died" message
│       └── [Restart] button
│
└── InventoryModal.vue ❌ REMOVE (or make super minimal)
```

---

## Proposed Changes

### 1. **Remove Inventory Modal** (or make minimal)
- **Decision:** Remove for MVP
- **Impact:** Less code, simpler state
- **Add back:** When inventory system is actually needed

### 2. **Simplify Encounter Screen**
- Remove combat log
- Remove target selection (always attack first enemy)
- Remove encounter description text
- Keep: Enemy HP bar, action buttons, simple status

### 3. **Simplify Room Screen**
- Remove "Explore Area" button (not implemented)
- Remove "Rest" button (not implemented)
- Remove status hints
- Keep: Room description, single "Move Forward" button

### 4. **Simplify Game Header**
- Remove Gold display (not implemented)
- Keep: HP bar, Level
- **Alternative:** Just HP bar for MVP

### 5. **Simplify Game Over**
- Remove final stats
- Keep: Message, Restart button

### 6. **Remove Unused Features**
- Status hints
- Combat log (or minimal)
- Gold tracking
- Multiple action buttons

---

## MVP Feature List (Minimal)

### **Must Have:**
1. ✅ Start game button
2. ✅ Room description display
3. ✅ Move forward button
4. ✅ Encounter triggers on move
5. ✅ Combat: Attack, Defend, Flee
6. ✅ HP display
7. ✅ Enemy HP display
8. ✅ Win/loss detection
9. ✅ Game over screen
10. ✅ Restart button

### **Nice to Have (Remove for MVP):**
- ❌ Inventory system
- ❌ Combat log
- ❌ Target selection
- ❌ Status hints
- ❌ Gold tracking
- ❌ Final stats
- ❌ Multiple action buttons

---

## Implementation Priority

### **Phase 1: Core MVP** (Do This First)
1. Simplify RoomExploringScreen - single "Move Forward" button
2. Simplify EncounterScreen - remove log, target selection
3. Simplify GameHeader - HP only
4. Simplify GameOverScreen - message + restart
5. Remove InventoryModal entirely

### **Phase 2: Polish** (Add Later)
- Add combat log back
- Add inventory when needed
- Add target selection when multiple enemies matter
- Add gold when economy is implemented

---

## Code Reduction Estimate

**Current:** ~8 components, ~1000+ lines
**MVP:** ~5 components, ~400-500 lines
**Reduction:** ~50% less code, much simpler

---

## Recommendation

**Strip down to absolute essentials:**
1. Room → Move → Encounter → Attack → Win/Lose → Restart
2. Remove all "nice to have" features
3. Get it playable first
4. Add complexity incrementally

**MVP = Playable in 30 minutes, not polished in 3 hours**
