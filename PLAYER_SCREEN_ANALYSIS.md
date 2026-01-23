# Player Screen Analysis - Pre-Implementation

## 1. Where Player State Currently Lives

### **Primary Location: `GameState.player`**
- **Type:** `Player` interface from `GameLoopDesign.ts`
- **Structure:**
  ```typescript
  {
    id: string
    name: string
    hp: number
    maxHp: number
    level: number
    xp: number
    inventory: InventoryItem[]  // Simple array from GameLoopDesign
    stats: {
      strength: number
      defense: number
      speed: number
    }
  }
  ```

### **State Management:**
- Provided via Vue `provide/inject` in `App.vue`
- Accessed via: `inject<Ref<GameState>>('gameState')`
- Updated via: `inject<(state: GameState) => void>('dispatch')`

### **Note: Two Inventory Systems Exist**
1. **Simple System** (`GameLoopDesign.ts`):
   - `Player.inventory: InventoryItem[]`
   - Simple structure: `{ id, type, name, quantity, effect? }`
   - Currently used in game loop

2. **Advanced System** (`ItemSystem.ts` + `InventoryManager.ts`):
   - `Inventory` type with `items: InventoryItem[]`, `maxSlots`, `gold`
   - `EquipmentSlots` for equipped items
   - Functions: `addItem`, `removeItem`, `useConsumable`, `equipWeapon`, `equipArmor`
   - **NOT currently integrated into GameState**

**Decision:** Use the simple system from `GameLoopDesign.ts` since that's what's actually in the game state.

---

## 2. Existing Inventory / Equipment Actions

### **✅ Implemented Actions:**

#### **Inventory Management:**
- **Adding items:** Done in `endEncounter()` - adds loot to `player.inventory`
- **Reading inventory:** `state.player.inventory` is accessible

#### **Equipment Actions (from InventoryManager.ts - NOT wired):**
- `equipWeapon(inventory, itemId, template, equipment)` - Exists but not used
- `equipArmor(inventory, itemId, template, equipment)` - Exists but not used
- `unequipItem(itemId, equipment)` - Exists but not used

#### **Consumable Actions (from InventoryManager.ts - NOT wired):**
- `useConsumable(inventory, templateId, template, itemDatabase)` - Exists but not used

### **❌ NOT Implemented / Wired:**

#### **In GameLoop.ts:**
- `playerAction('use_item')` - Has TODO comment, not implemented
- No equipment system in `GameState`
- No `EquipmentSlots` in `GameState`
- No item database loading

#### **Missing Integration:**
- `InventoryManager` functions exist but aren't called from game loop
- No way to use items outside combat
- No way to equip items at all

---

## 3. Read-Only vs Interactive Elements

### **✅ Read-Only (Display Only):**

#### **Overview Section:**
- Player name (`player.name`)
- Level (`player.level`)
- Current HP / Max HP (`player.hp`, `player.maxHp`)
- Core stats (`player.stats.strength`, `player.stats.defense`, `player.stats.speed`)
- XP (`player.xp`) - Display only, no manual XP entry

#### **Character Info:**
- Flavor text / description - **DOES NOT EXIST** in Player type (skip this section)
- Status effects - **DOES NOT EXIST** in Player type (skip this section)

#### **Equipment Section:**
- Display equipped weapon/armor - **NOT IMPLEMENTED** (no `equipment` in GameState)
- Show stat bonuses from equipment - **NOT IMPLEMENTED**

### **⚠️ Partially Interactive (Wire to Existing Logic):**

#### **Inventory Section:**
- List items from `player.inventory` - **READ** (exists)
- Show quantity/stack size - **READ** (`item.quantity`)
- "Use" button for consumables - **WRITE** (needs implementation)
  - Currently: `playerAction('use_item')` has TODO
  - Need to: Call inventory manager or implement simple use logic
  - **Decision:** For MVP, implement simple consumable use that:
    - Removes item from inventory
    - Applies `item.effect.hpRestore` if present
    - Updates player HP

### **❌ Not Interactive (Not Implemented):**

#### **Equipment Section:**
- Equip weapon/armor - **NOT IMPLEMENTED**
  - `EquipmentSlots` doesn't exist in `GameState`
  - `equipWeapon`/`equipArmor` functions exist but aren't wired
  - **Decision:** Display as read-only placeholder or skip entirely

---

## 4. Implementation Plan

### **Phase 1: Read-Only Display (MVP)**
1. **Overview Panel:**
   - Player name, level, HP bar, stats
   - All read-only

2. **Inventory Panel:**
   - List items from `player.inventory`
   - Show quantity
   - "Use" button for consumables (wire to new function)

3. **Equipment Panel:**
   - Placeholder: "No equipment system yet"
   - OR: Read-only display if we add minimal equipment tracking

### **Phase 2: Interactive Features (If Time)**
1. **Use Consumables:**
   - Implement `useItem(itemId)` function
   - Remove from inventory
   - Apply `effect.hpRestore` to player HP
   - Update game state

2. **Equipment (Future):**
   - Add `EquipmentSlots` to `GameState`
   - Wire `equipWeapon`/`equipArmor` functions
   - Display equipped items

---

## 5. Component Structure

```
PlayerScreen.vue (Modal/Overlay)
├── PlayerOverview.vue (Read-only stats)
├── PlayerInventory.vue (List + Use buttons)
└── PlayerEquipment.vue (Read-only placeholder)
```

### **Access Point:**
- Add "Player" or "Character" button to `GameHeader.vue`
- Opens modal overlay (similar to removed InventoryModal pattern)
- Does NOT affect game state when opening/closing

---

## 6. Key Constraints

### **Must NOT:**
- Add new game mechanics
- Change combat/room/encounter systems
- Create new global state managers
- Duplicate player data

### **Must:**
- Use `state.player` as source of truth
- Keep components small and composable
- Wire "Use" button to actual item consumption (simple implementation)
- Make it accessible from main UI (GameHeader button)

---

## 7. Data Mapping

### **Player Data Available:**
```typescript
player.name          // ✅ Display
player.level         // ✅ Display
player.hp            // ✅ Display
player.maxHp         // ✅ Display
player.xp            // ✅ Display
player.stats.strength   // ✅ Display
player.stats.defense    // ✅ Display
player.stats.speed      // ✅ Display
player.inventory[]      // ✅ Display + Use buttons
```

### **Player Data NOT Available:**
```typescript
player.description   // ❌ Doesn't exist
player.statusEffects  // ❌ Doesn't exist
player.equipment      // ❌ Doesn't exist
player.gold          // ❌ Doesn't exist (in simple system)
```

---

## 8. Implementation Decision

**For MVP Player Screen:**
1. **Overview:** All read-only (name, level, HP, stats)
2. **Inventory:** Display + "Use" button (implement simple use logic)
3. **Equipment:** Skip or placeholder (not implemented in game state)
4. **Character Info:** Skip (no flavor text or status effects)

**"Use" Button Implementation:**
- Create `useItem(itemId: string)` function in GameLoop.ts
- Remove item from `player.inventory`
- Apply `item.effect.hpRestore` to `player.hp` (if present)
- Update game state via dispatch
- Only works for consumables with `effect.hpRestore`

---

## Ready to Implement

✅ Analysis complete
✅ Data sources identified
✅ Read-only vs interactive mapped
✅ Implementation scope defined
✅ Constraints understood

**Next Step:** Implement PlayerScreen component with Overview + Inventory panels, wire "Use" button to simple item consumption logic.
