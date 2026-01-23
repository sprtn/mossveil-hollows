# Inventory & Items System

## Overview

A **data-driven inventory system** with support for:
- **Stackable items** (consumables, crafting materials) - multiple quantities
- **Non-stackable items** (weapons, armor, unique items) - one per slot
- **Equipment system** - weapons and armor modify combat stats
- **Consumables** - potions that apply effects
- **Quest/Key items** - unlock doors, advance quests

## Architecture

### Item Types

| Type | Stackable | Purpose | Example |
|------|-----------|---------|---------|
| **Consumable** | Yes (max 10) | Restore health, cure effects | Health Potion |
| **Weapon** | No | Increase damage | Iron Sword (+5 STR) |
| **Armor** | No | Increase defense | Leather Armor (+3 DEF) |
| **Crafting** | Yes (max 20) | Materials for future crafting | Iron Ore |
| **Key/Quest** | Usually No | Unlock doors, advance quests | Forest Key |

### Rarity Tiers

```
Common     → Basic items, drop frequently
Uncommon   → Improved items, medium rarity
Rare       → Strong items, uncommon drops
Epic       → Powerful items, rare drops
Legendary  → Unique/powerful, boss drops only
```

## Data Structures

### ItemTemplate (Database)

Each item in the game is defined by a template:

```typescript
interface ItemTemplate {
  id: string                  // Unique ID (health_potion)
  name: string                // Display name
  description: string         // Flavor text
  type: ItemType             // weapon, armor, consumable, etc.
  rarity: ItemRarity         // common, uncommon, rare, etc.
  stackable: boolean         // Can multiple exist in one slot?
  maxStackSize?: number      // If stackable, max per stack (default 99)
  weight: number             // For encumbrance (future)
}
```

### WeaponTemplate

```typescript
interface WeaponTemplate extends ItemTemplate {
  type: 'weapon'
  damageBonus: number        // e.g., +5 damage
  statBonus?: {
    strength?: number        // e.g., +2 STR
  }
}
```

**Example: Iron Sword**
```json
{
  "id": "iron_sword",
  "name": "Iron Sword",
  "description": "Increases damage by 5.",
  "type": "weapon",
  "rarity": "common",
  "stackable": false,
  "weight": 1.5,
  "damageBonus": 5,
  "statBonus": { "strength": 2 }
}
```

### ArmorTemplate

```typescript
interface ArmorTemplate extends ItemTemplate {
  type: 'armor'
  slot: 'head' | 'body' | 'hands' | 'feet'
  defenseBonus: number       // e.g., +3 defense
  statBonus?: {
    defense?: number         // e.g., +2 DEF
  }
}
```

**Example: Leather Armor**
```json
{
  "id": "leather_armor",
  "name": "Leather Armor",
  "type": "armor",
  "rarity": "common",
  "stackable": false,
  "weight": 2.0,
  "slot": "body",
  "defenseBonus": 3,
  "statBonus": { "defense": 2 }
}
```

### ConsumableTemplate

```typescript
interface ConsumableTemplate extends ItemTemplate {
  type: 'consumable'
  stackable: true            // Always stackable
  effect: ConsumableEffect   // heal_health, restore_mana, etc.
  power: number              // Effect power (30 for heal amount)
  duration?: number          // Turns (null for instant effects)
}
```

**Example: Health Potion**
```json
{
  "id": "health_potion",
  "name": "Health Potion",
  "type": "consumable",
  "rarity": "common",
  "stackable": true,
  "maxStackSize": 10,
  "weight": 0.2,
  "effect": "heal_health",
  "power": 30,
  "duration": null
}
```

### InventoryItem (Runtime)

Instance of an item in the player's inventory:

```typescript
interface InventoryItem {
  id: string              // Unique instance ID
  templateId: string      // Reference to ItemTemplate
  quantity: number        // 1 for non-stackable, 1+ for stackable
  equipped?: boolean      // Is this item equipped?
  durability?: number     // Future: item degradation
}
```

### Inventory

Player's complete item collection:

```typescript
interface Inventory {
  items: InventoryItem[]  // List of items owned
  maxSlots: number        // Inventory limit (e.g., 20 slots)
  gold: number            // Currency
}
```

### EquipmentSlots

Currently equipped items:

```typescript
interface EquipmentSlots {
  weapon?: InventoryItem   // Equipped weapon
  armor?: InventoryItem    // Equipped armor
}
```

## Operations

### Adding Items

**Function:** `addItem(inventory, templateId, quantity, itemDatabase)`

**Rules:**
- If stackable and exists: add to existing stack (up to max)
- If stackable and full: create new stack
- If non-stackable: create one item per quantity
- If inventory full: fail

**Example:**
```typescript
// Add 3 health potions
const result = addItem(inventory, 'health_potion', 3, itemDatabase)
// If stack exists with quantity 8 (max 10):
//   → Add 2 to existing (now 10), create new stack with 1
```

### Removing Items

**Function:** `removeItem(inventory, templateId, quantity)`

**Rules:**
- Reduce quantity if stackable
- Remove entirely if quantity reaches 0
- Fail if insufficient quantity

**Example:**
```typescript
// Use 1 health potion
const result = removeItem(inventory, 'health_potion', 1)
// If had 5 → now has 4
// If had 1 → removed from inventory
```

### Using Consumables

**Function:** `useConsumable(inventory, templateId, template, itemDatabase)`

**Effect:**
- Remove 1 from inventory
- Return effect to apply (heal, cure poison, etc.)

**Example - Combat Integration:**
```typescript
// Player uses health potion in combat
const effect = useConsumable(inventory, 'health_potion', healthPotionTemplate, itemDatabase)
// effect: { type: 'heal_health', power: 30 }
// → In combat: player.currentHp += 30
```

### Equipping Items

**Function:** `equipWeapon(inventory, itemId, template, equipment)`

**Rules:**
- Unequip previous weapon
- Equip new weapon
- Item stays in inventory but marked equipped

**Example:**
```typescript
equipWeapon(inventory, 'iron_sword_123', ironSwordTemplate, equipment)
// equipment.weapon = item
// Combat damage now increased by 5
```

### Checking Inventory

**Function:** `hasItem(inventory, templateId, quantity)`

**Returns:** true if player has enough

**Example:**
```typescript
if (hasItem(inventory, 'forest_key', 1)) {
  // Can unlock door
}
```

## Stat Modifiers

### Equipment Bonuses

Equipped items modify combat stats:

**Function:** `calculateItemStatModifiers(equipment, itemDatabase)`

**Returns:**
```typescript
{
  strengthBonus: 5,    // From weapon
  defenseBonus: 3,     // From armor
  hpBonus: 0,
  speedBonus: 0
}
```

**Example: Combat Integration**
```typescript
// Player stats: STR 10, DEF 5
// Equipped: Iron Sword (+5 STR), Leather Armor (+3 DEF)
const bonuses = calculateItemStatModifiers(equipment, itemDatabase)
const effectiveSTR = 10 + 5 = 15
const effectiveDEF = 5 + 3 = 8
// Damage calculation uses effective stats
```

## Consumable Effects

### Effect Types

| Effect | Power | Duration | Use |
|--------|-------|----------|-----|
| `heal_health` | 30 | - | Restore HP |
| `restore_mana` | 20 | - | Restore mana (future) |
| `remove_poison` | 1 | - | Cure poison |
| `grant_blessing` | - | 5 | +2 DEF for 5 turns |
| `boost_damage` | - | 3 | +3 STR for 3 turns |
| `boost_defense` | - | 3 | +3 DEF for 3 turns |

### Applying Effects (Combat Integration)

```typescript
// Player uses health potion
const effect = useConsumable(...)
// effect: { type: 'heal_health', power: 30 }

// In combat:
if (effect.type === 'heal_health') {
  player.currentHp = Math.min(
    player.maxHp,
    player.currentHp + effect.power
  )
}
```

## Key Items

### Quest Keys

Unlock doors or progress quests:

```json
{
  "id": "forest_key",
  "name": "Forest Key",
  "type": "key",
  "unlocksRoom": "forest_locked_chamber"
}
```

**Integration - Room Navigation:**
```typescript
// Check if can enter locked room
const nextRoomId = getRoomByDirection(currentRoom, 'north')
const exit = currentRoom.exits.find(e => e.targetRoomId === nextRoomId)

if (exit.requiresItem === 'forest_key') {
  if (hasItem(inventory, 'forest_key', 1)) {
    // Can enter
  } else {
    // Blocked
  }
}
```

## Inventory Limits

### Slot-Based System

```typescript
inventory = {
  items: [
    { templateId: 'health_potion', quantity: 5 },    // 1 slot
    { templateId: 'iron_sword', quantity: 1 },       // 1 slot
    { templateId: 'leather_armor', quantity: 1 },    // 1 slot
    { templateId: 'iron_ore', quantity: 15 }         // 1 slot
  ],
  maxSlots: 20,                                       // 4/20 slots used
  gold: 100
}
```

**Rules:**
- Each stack/item = 1 slot (regardless of quantity)
- Max 20 slots (configurable per playthrough)
- When full: cannot pick up items

**Weight System (Future):**
```typescript
const weight = getInventoryWeight(inventory, itemDatabase)
// Iron Plate Armor (5kg) + 10 Iron Ore (3kg) + etc.
// Could add weight limit for slower movement
```

## Example Scenarios

### Scenario 1: Looting a Chest

```
Player opens chest containing:
- 2 Health Potions
- Iron Sword
- Iron Ore x3

Sequence:
1. addItem(inventory, 'health_potion', 2)      → Slot 1
2. addItem(inventory, 'iron_sword', 1)         → Slot 2
3. addItem(inventory, 'iron_ore', 3)           → Slot 3
→ Total: 3/20 slots used
```

### Scenario 2: Equipment Upgrade

```
Player has:
- Iron Sword (+5 STR) equipped
- Steel Sword (+8 STR) in inventory

Actions:
1. equipWeapon(inventory, steel_sword_id, steelTemplate, equipment)
   → Unequip Iron Sword, equip Steel Sword
   → STR bonus changes from 5 to 8
   → Iron Sword back in inventory

In next combat:
- Damage calculation uses new STR: 10 + 8 = 18
```

### Scenario 3: Boss Loot

```
Defeated Stone Guardian - drops legendary item

loot = [
  { id: 'legendary_sword', weight: 1.0 },
  { id: 'gold_stack', weight: 1.0, quantity: 5 }
]

Weighted selection:
→ Player receives: Legendary Sword + 500 gold

addItem(inventory, 'legendary_sword', 1, itemDatabase)
→ If inventory has space: Success
→ New damage bonus: +15 STR
```

## Files

| File | Purpose |
|------|---------|
| [src/engine/ItemSystem.ts](src/engine/ItemSystem.ts) | Type definitions, stat calculation |
| [src/engine/InventoryManager.ts](src/engine/InventoryManager.ts) | Add/remove/use/equip logic |
| [src/assets/items/](src/assets/items/) | JSON item definitions |

## Item Database

Location: `src/assets/items/*.json`

**Items Defined:**
- **Consumables**: health_potion, mana_potion, antidote
- **Weapons**: iron_sword, steel_sword, legendary_sword
- **Armor**: leather_armor, iron_plate_armor, guardian_amulet
- **Crafting**: iron_ore
- **Keys**: forest_key

## API Reference

### ItemSystem.ts

**Types:**
- `ItemType` - Item classification
- `ItemTemplate` - Base item definition
- `InventoryItem` - Runtime item instance
- `Inventory` - Player's items + gold
- `EquipmentSlots` - Currently equipped items

**Utilities:**
- `calculateItemStatModifiers(equipment, db)` - Get combat bonuses
- `isConsumable(template)` - Type guard
- `isEquipment(template)` - Type guard
- `isStackable(template)` - Type guard
- `getMaxStackSize(template)` - Max stack quantity

### InventoryManager.ts

**Core Operations:**
- `addItem(inventory, templateId, quantity, db)` - Add to inventory
- `removeItem(inventory, templateId, quantity)` - Remove from inventory
- `useConsumable(inventory, templateId, template, db)` - Use potion
- `equipWeapon(inventory, itemId, template, equipment)` - Equip weapon
- `equipArmor(inventory, itemId, template, equipment)` - Equip armor
- `unequipItem(itemId, equipment)` - Remove equipment

**Queries:**
- `findItem(inventory, templateId)` - Get item by template ID
- `findItems(inventory, predicate)` - Search inventory
- `hasItem(inventory, templateId, quantity)` - Check availability
- `getInventoryWeight(inventory, db)` - Total weight
- `getInventoryDisplay(inventory, db)` - Formatted for UI

## Integration with Combat

**Player Uses Potion During Battle:**
```typescript
// In combat UI, player clicks "Use Potion"
const effect = useConsumable(inventory, 'health_potion', template, db)

if (effect.success && effect.effectApplied) {
  // Apply to player
  player.currentHp = Math.min(
    player.maxHp,
    player.currentHp + effect.effectApplied.power
  )
  // Log action
  combatLog.push({ action: 'use_item', result: 'Used health potion' })
}
```

## Integration with Exploration

**Check if Can Use Key:**
```typescript
// Try to open locked door
const exit = room.exits.find(e => e.direction === 'north')

if (exit.requiresItem) {
  if (hasItem(inventory, exit.requiresItem, 1)) {
    // Allow entry
  } else {
    // "You need a key to open this door"
  }
}
```

## Future Enhancements

- [ ] Durability system (weapons/armor degrade)
- [ ] Crafting recipes (combine materials → equipment)
- [ ] Sell items for gold
- [ ] Item sorting/filters
- [ ] Equipped items show visual modifications
- [ ] Weight-based movement penalty
- [ ] Unique/set items with special effects
- [ ] Enchantment system
- [ ] Item comparison UI
