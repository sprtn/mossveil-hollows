# Text-First UI/UX Design

## Design Philosophy

**Text-First Approach:**
- Rich text descriptions drive immersion
- Minimal visual clutter (no complex animations)
- Clear typography hierarchy
- Button-based interactions (no drag/drop)
- Combat log as primary feedback mechanism
- Inventory as simple list with use buttons

---

## Screen Breakdown

### 1. **Game Start Screen**
**Purpose:** Initial setup, character creation (if any), or "New Game" button

**Content:**
```
┌─────────────────────────────────────┐
│         STRAT RPG                    │
│                                     │
│    [New Game]                       │
│    [Load Game] (future)             │
│    [Settings] (future)              │
└─────────────────────────────────────┘
```

**State:** `phase === 'game_start'`

---

### 2. **Room Exploring Screen** (Main Gameplay)
**Purpose:** Primary exploration interface - room description, movement, actions

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ HP: ████████░░ 80/100  |  Level: 3  |  Gold: 150      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Forest Entrance                                        │
│                                                         │
│  You stand at the edge of a dense forest. Ancient      │
│  trees tower above, their branches intertwined. The     │
│  air is cool and smells of moss and earth. A worn      │
│  path leads deeper into the woods.                     │
│                                                         │
│  ───────────────────────────────────────────────────   │
│                                                         │
│  Actions:                                              │
│  [Move Forward] [Explore Area] [Check Inventory]      │
│  [Rest]                                                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Key Elements:**
- **Header Bar:** Player stats (HP, Level, Gold) - always visible
- **Room Title:** Large, clear heading
- **Room Description:** Flowing text, 3-5 sentences
- **Action Buttons:** Primary actions for current phase
- **Status Indicators:** Subtle hints (e.g., "You feel tired..." if low HP)

**State:** `phase === 'room_exploring'`

**Actions:**
- `moveInRoom(newNode)` - Move to next node
- `enterRoom(room)` - Transition to new room
- Open inventory modal
- Rest (if implemented)

---

### 3. **Encounter Screen** (Combat)
**Purpose:** Turn-based combat interface with clear action choices

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ HP: ████████░░ 80/100  |  Level: 3  |  Gold: 150      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ⚔️  ENCOUNTER: Goblin Scouts                          │
│                                                         │
│  A small band of goblins emerges from the trees!        │
│  They brandish crude weapons and snarl menacingly.      │
│                                                         │
│  ───────────────────────────────────────────────────   │
│                                                         │
│  Enemies:                                               │
│  • Goblin Scout #1  [HP: ████░░░░░░ 20/50]            │
│  • Goblin Scout #2  [HP: ████████░░ 40/50]            │
│                                                         │
│  ───────────────────────────────────────────────────   │
│                                                         │
│  Combat Log:                                            │
│  > Round 1                                              │
│  > You attack Goblin Scout #1 for 12 damage!           │
│  > Goblin Scout #1 attacks you for 5 damage.          │
│  > Goblin Scout #2 attacks you for 6 damage.          │
│                                                         │
│  ───────────────────────────────────────────────────   │
│                                                         │
│  Your Turn:                                             │
│  [Attack] [Defend] [Use Item] [Flee]                   │
│                                                         │
│  Target: [Goblin Scout #1 ▼]                           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Key Elements:**
- **Encounter Header:** Clear "ENCOUNTER" label with enemy name
- **Enemy List:** Each enemy with HP bar (visual + text)
- **Combat Log:** Scrollable text log of all actions
- **Action Buttons:** Combat actions (Attack, Defend, Use Item, Flee)
- **Target Selection:** Dropdown or button group for selecting enemy

**State:** `phase === 'encounter_action'`

**Actions:**
- `playerAction('attack', targetId)`
- `playerAction('defend')`
- `playerAction('use_item', itemId)`
- `playerAction('flee')`

---

### 4. **Inventory Screen** (Modal/Overlay)
**Purpose:** View and manage items, use consumables

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│                    INVENTORY                    [Close X] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Consumables:                                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Health Potion          x3    [Use]              │   │
│  │ Restores 30 HP                                  │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Mana Potion           x1    [Use]              │   │
│  │ Restores 20 MP                                  │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Weapons:                                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Iron Sword            x1                        │   │
│  │ +5 Strength                                    │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Armor:                                                 │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Leather Armor         x1                        │   │
│  │ +3 Defense                                      │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Keys & Misc:                                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Forest Key            x1                        │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Key Elements:**
- **Categorized Items:** Consumables, Weapons, Armor, Keys
- **Item Cards:** Name, quantity, description, use button
- **Use Buttons:** Only for consumables (context-aware)
- **Close Button:** Return to previous screen

**State:** Modal overlay (doesn't change game phase)

**Actions:**
- `useItem(itemId)` - Use consumable
- Close modal

---

### 5. **Game Over Screen**
**Purpose:** Show victory/defeat message, stats, restart option

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│              ⚔️  GAME OVER  ⚔️                         │
│                                                         │
│  You have been defeated...                             │
│                                                         │
│  ───────────────────────────────────────────────────   │
│                                                         │
│  Final Stats:                                           │
│  • Rooms Explored: 5                                    │
│  • Enemies Defeated: 12                                │
│  • Gold Collected: 450                                 │
│  • Level Reached: 3                                    │
│                                                         │
│  ───────────────────────────────────────────────────   │
│                                                         │
│  [Try Again] [Main Menu]                               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**State:** `phase === 'game_over'`

**Actions:**
- `initGame()` - Restart
- Return to main menu

---

## UI State Flow

```
┌─────────────┐
│ Game Start  │
└──────┬──────┘
       │ [New Game]
       ▼
┌─────────────────┐
│ Room Exploring  │◄──────────────┐
│                 │                │
│ [Move] [Inv]    │                │
└────┬───────┬────┘                │
     │       │                      │
     │       │ [Check Inventory]    │
     │       ▼                      │
     │  ┌──────────┐                │
     │  │Inventory │                │
     │  │  Modal   │                │
     │  └────┬─────┘                │
     │       │ [Close]              │
     │       │                      │
     │       └──────────────────────┘
     │
     │ [Move Forward] → Random Encounter?
     │                    │
     │                    ▼
     │              ┌──────────────┐
     │              │  Encounter   │
     │              │              │
     │              │ [Attack]... │
     │              └──────┬───────┘
     │                     │
     │              ┌───────┴───────┐
     │              │              │
     │         [Win]│              │[Loss]
     │              │              │
     │              ▼              ▼
     │         ┌────────┐    ┌──────────┐
     │         │Rewards  │    │Game Over │
     │         └────┬────┘    └──────────┘
     │              │
     │              └──────────┐
     │                         │
     └─────────────────────────┘
```

**Key Transitions:**
1. **Game Start → Room Exploring:** `initGame()` → `enterRoom()`
2. **Room Exploring → Encounter:** `moveInRoom()` triggers encounter → `triggerEncounter()`
3. **Encounter → Room Exploring:** `endEncounter('win')` → return to exploring
4. **Encounter → Game Over:** `endEncounter('loss')` → game over screen
5. **Any → Inventory:** Modal overlay (doesn't change phase)

---

## Minimal Vue Component Tree

```
App.vue (Root)
│
├── GameHeader.vue (HP, Level, Gold - always visible)
│
├── GameScreen.vue (Router/Phase-based rendering)
│   │
│   ├── GameStartScreen.vue (phase === 'game_start')
│   │   └── NewGameButton.vue
│   │
│   ├── RoomExploringScreen.vue (phase === 'room_exploring')
│   │   ├── RoomDescription.vue
│   │   ├── RoomActions.vue
│   │   │   ├── MoveButton.vue
│   │   │   ├── ExploreButton.vue
│   │   │   └── InventoryButton.vue
│   │   └── StatusIndicator.vue (optional hints)
│   │
│   ├── EncounterScreen.vue (phase === 'encounter_action')
│   │   ├── EncounterHeader.vue
│   │   ├── EnemyList.vue
│   │   │   └── EnemyCard.vue (HP bar, name)
│   │   ├── CombatLog.vue (scrollable text)
│   │   ├── CombatActions.vue
│   │   │   ├── AttackButton.vue
│   │   │   ├── DefendButton.vue
│   │   │   ├── UseItemButton.vue
│   │   │   └── FleeButton.vue
│   │   └── TargetSelector.vue (dropdown/buttons)
│   │
│   └── GameOverScreen.vue (phase === 'game_over')
│       ├── GameOverMessage.vue
│       ├── FinalStats.vue
│       └── RestartButton.vue
│
└── InventoryModal.vue (Overlay - shown when inventoryOpen === true)
    ├── InventoryCategory.vue (Consumables, Weapons, etc.)
    │   └── InventoryItem.vue (name, quantity, use button)
    └── CloseButton.vue
```

---

## Component Responsibilities

### **App.vue**
- Provides game state via `provide()`
- Provides dispatch function for actions
- Manages global UI state (inventory modal open/closed)
- Renders GameHeader + GameScreen

### **GameHeader.vue**
- Displays: `player.hp`, `player.level`, `player.gold`
- Always visible (sticky header)
- Simple stat bar with text

### **RoomExploringScreen.vue**
- Reads: `state.currentRoom`, `state.phase`
- Renders room name + description
- Shows action buttons based on available exits/actions
- Dispatches: `moveInRoom()`, `enterRoom()`

### **EncounterScreen.vue**
- Reads: `state.currentEncounter`, `state.player`
- Renders enemy list with HP bars
- Shows combat log (scrollable)
- Dispatches: `playerAction(action, targetId)`
- Manages target selection state

### **CombatLog.vue**
- Displays turn-by-turn combat history
- Scrolls to bottom on new messages
- Format: "> Round X", "> You attack...", "> Enemy attacks..."

### **InventoryModal.vue**
- Reads: `state.player.inventory`
- Groups items by type (consumables, weapons, armor)
- Dispatches: `useItem(itemId)` when "Use" clicked
- Closes on backdrop click or Close button

---

## Styling Guidelines (Text-First)

### **Typography**
- **Room Title:** 24px, bold, serif (atmosphere)
- **Room Description:** 16px, line-height 1.6, readable font
- **Combat Log:** 14px, monospace (code-like feel)
- **Buttons:** 16px, clear labels, adequate padding

### **Colors** (Minimal Palette)
- **Background:** Off-white or dark theme (#1a1a1a / #f5f5f5)
- **Text:** High contrast (#ffffff / #000000)
- **HP Bar:** Green (high) → Yellow (medium) → Red (low)
- **Buttons:** Subtle background, clear hover state

### **Spacing**
- Generous padding (16-24px)
- Clear section separators (horizontal rules)
- Comfortable line-height for readability

### **Interactions**
- Buttons: Clear hover state, disabled state for invalid actions
- No animations (text-first = instant feedback)
- Modal: Backdrop overlay (semi-transparent)
- Combat log: Auto-scroll to bottom

---

## Implementation Notes

### **State Management**
```typescript
// In App.vue
const gameState = ref<GameState>(initGame(player, firstRoom))
const inventoryOpen = ref(false)

provide('gameState', gameState)
provide('dispatch', (action: string, payload?: any) => {
  // Update gameState based on action
  gameState.value = handleAction(gameState.value, action, payload)
})
provide('inventoryOpen', inventoryOpen)
```

### **Component Example**
```vue
<!-- RoomExploringScreen.vue -->
<script setup lang="ts">
import { inject, computed } from 'vue'
import type { GameState } from '@/engine/GameLoopDesign'

const gameState = inject<Ref<GameState>>('gameState')!
const dispatch = inject<(action: string, payload?: any) => void>('dispatch')!

const room = computed(() => gameState.value.currentRoom)

function handleMove() {
  dispatch('moveInRoom', 1) // Move to next node
}
</script>

<template>
  <div class="room-screen">
    <h1>{{ room.name }}</h1>
    <p class="description">{{ room.description }}</p>
    <div class="actions">
      <button @click="handleMove">Move Forward</button>
      <button @click="inventoryOpen = true">Check Inventory</button>
    </div>
  </div>
</template>
```

---

## Next Steps

1. **Create base components:** GameHeader, GameScreen wrapper
2. **Implement RoomExploringScreen** (simplest, good starting point)
3. **Add InventoryModal** (overlay system)
4. **Build EncounterScreen** (most complex, needs combat log)
5. **Wire up state management** (provide/inject in App.vue)
6. **Add styling** (text-first, readable, minimal)

This design prioritizes **readability** and **clarity** over visual complexity, perfect for a text-first RPG experience.
