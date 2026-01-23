/**
 * Item System Type Definitions
 *
 * Supports:
 * - Stackable items (potions, ammo, crafting materials)
 * - Non-stackable items (weapons, armor, unique items)
 * - Consumables (restore health, apply effects)
 * - Equipment (modify combat stats)
 */

/**
 * Item type classification
 */
export type ItemType =
  | 'weapon' // Melee/ranged weapons
  | 'armor' // Protective gear
  | 'consumable' // Potions, food, etc.
  | 'crafting' // Materials for crafting
  | 'key' // Quest/door keys
  | 'quest' // Quest items

/**
 * Rarity tier (affects drop rates, effectiveness)
 */
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

/**
 * Consumable effect types
 */
export type ConsumableEffect =
  | 'heal_health'
  | 'restore_mana'
  | 'remove_poison'
  | 'grant_blessing'
  | 'boost_damage'
  | 'boost_defense'

/**
 * Base item template (from item database)
 */
export interface ItemTemplate {
  id: string
  name: string
  description: string
  type: ItemType
  rarity: ItemRarity
  stackable: boolean
  maxStackSize?: number // For stackable items (default 99)
  weight: number // For future encumbrance system
}

/**
 * Weapon item template
 */
export interface WeaponTemplate extends ItemTemplate {
  type: 'weapon'
  damageBonus: number // +2, +5, etc.
  statBonus?: {
    strength?: number
  }
}

/**
 * Armor item template
 */
export interface ArmorTemplate extends ItemTemplate {
  type: 'armor'
  slot: 'head' | 'body' | 'hands' | 'feet'
  defenseBonus: number // +2, +5, etc.
  statBonus?: {
    defense?: number
  }
}

/**
 * Consumable item template
 */
export interface ConsumableTemplate extends ItemTemplate {
  type: 'consumable'
  stackable: true
  effect: ConsumableEffect
  power: number // 10 (heal amount), 30 (heal amount), etc.
  duration?: number // Turns (if applicable)
}

/**
 * Crafting material template
 */
export interface CraftingMaterialTemplate extends ItemTemplate {
  type: 'crafting'
  stackable: true
}

/**
 * Quest/Key item template
 */
export interface QuestItemTemplate extends ItemTemplate {
  type: 'quest' | 'key'
  stackable: boolean
  questId?: string // Which quest this is for
  unlocksRoom?: string // Which room this key unlocks
}

/**
 * Union of all item templates
 */
export type AnyItemTemplate =
  | WeaponTemplate
  | ArmorTemplate
  | ConsumableTemplate
  | CraftingMaterialTemplate
  | QuestItemTemplate

/**
 * Runtime inventory item (instance of a template)
 */
export interface InventoryItem {
  id: string // Unique instance ID
  templateId: string // Reference to ItemTemplate
  quantity: number // 1 for non-stackable, 1+ for stackable
  equipped?: boolean // For weapons/armor
  durability?: number // For equipment (future feature)
}

/**
 * Player inventory (collection of items)
 */
export interface Inventory {
  items: InventoryItem[]
  maxSlots: number // Slot limit (not quantity limit)
  gold: number
}

/**
 * Equipment slots (what's currently equipped)
 */
export interface EquipmentSlots {
  weapon?: InventoryItem
  armor?: InventoryItem // Could expand to head/body/hands/feet
}

/**
 * Item use result
 */
export interface ItemUseResult {
  success: boolean
  message: string
  effectApplied?: {
    type: ConsumableEffect
    power: number
    duration?: number
  }
}

/**
 * Item query result
 */
export interface ItemLookup {
  item: InventoryItem | null
  template: AnyItemTemplate | null
}

/**
 * Add item result
 */
export interface AddItemResult {
  success: boolean
  message: string
  quantityAdded: number
  itemInstance: InventoryItem | null
}

/**
 * Remove item result
 */
export interface RemoveItemResult {
  success: boolean
  message: string
  quantityRemoved: number
}

/**
 * Item database (loaded from JSON)
 */
export interface ItemDatabase {
  items: Map<string, AnyItemTemplate>
}

/**
 * Stat modifiers from equipped items
 */
export interface ItemStatModifiers {
  strengthBonus: number
  defenseBonus: number
  hpBonus: number
  speedBonus: number
}

/**
 * Calculate total stat bonuses from equipped items
 */
export function calculateItemStatModifiers(
  equipment: EquipmentSlots,
  itemDatabase: ItemDatabase
): ItemStatModifiers {
  const modifiers: ItemStatModifiers = {
    strengthBonus: 0,
    defenseBonus: 0,
    hpBonus: 0,
    speedBonus: 0,
  }

  // Apply weapon bonus
  if (equipment.weapon) {
    const weapon = itemDatabase.items.get(equipment.weapon.templateId)
    if (weapon && 'damageBonus' in weapon) {
      modifiers.strengthBonus += weapon.damageBonus
    }
  }

  // Apply armor bonus
  if (equipment.armor) {
    const armor = itemDatabase.items.get(equipment.armor.templateId)
    if (armor && 'defenseBonus' in armor) {
      modifiers.defenseBonus += armor.defenseBonus
    }
  }

  return modifiers
}

/**
 * Check if item is consumable
 */
export function isConsumable(template: AnyItemTemplate): template is ConsumableTemplate {
  return template.type === 'consumable'
}

/**
 * Check if item is equipment
 */
export function isEquipment(template: AnyItemTemplate): template is WeaponTemplate | ArmorTemplate {
  return template.type === 'weapon' || template.type === 'armor'
}

/**
 * Check if item is stackable
 */
export function isStackable(template: AnyItemTemplate): boolean {
  return template.stackable
}

/**
 * Get max stack size
 */
export function getMaxStackSize(template: AnyItemTemplate): number {
  if (!template.stackable) {
    return 1
  }
  return template.maxStackSize || 99
}
