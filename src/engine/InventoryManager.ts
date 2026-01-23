/**
 * Inventory Manager
 *
 * Handles:
 * - Adding items to inventory
 * - Removing items from inventory
 * - Equipping/unequipping items
 * - Using consumable items
 * - Checking item availability
 */

import type {
  Inventory,
  InventoryItem,
  ItemDatabase,
  AddItemResult,
  RemoveItemResult,
  ItemUseResult,
  ConsumableTemplate,
  WeaponTemplate,
  ArmorTemplate,
  EquipmentSlots,
} from './ItemSystem'
import { isStackable, getMaxStackSize } from './ItemSystem'

/**
 * Find item in inventory by template ID
 */
export function findItem(inventory: Inventory, templateId: string): InventoryItem | null {
  return inventory.items.find((item) => item.templateId === templateId) || null
}

/**
 * Find all items matching a predicate
 */
export function findItems(
  inventory: Inventory,
  predicate: (item: InventoryItem) => boolean
): InventoryItem[] {
  return inventory.items.filter(predicate)
}

/**
 * Add item to inventory
 *
 * - If stackable and exists, add to quantity
 * - If stackable and exceeds max, create new stack
 * - If non-stackable, always create new instance
 * - If inventory full, fail
 */
export function addItem(
  inventory: Inventory,
  templateId: string,
  quantity: number,
  itemDatabase: ItemDatabase
): AddItemResult {
  const template = itemDatabase.items.get(templateId)

  if (!template) {
    return {
      success: false,
      message: `Item template not found: ${templateId}`,
      quantityAdded: 0,
      itemInstance: null,
    }
  }

  if (quantity <= 0) {
    return {
      success: false,
      message: 'Cannot add zero or negative quantity',
      quantityAdded: 0,
      itemInstance: null,
    }
  }

  let quantityAdded = 0
  let itemInstance: InventoryItem | null = null

  if (isStackable(template)) {
    // Try to add to existing stack
    const existingItem = findItem(inventory, templateId)
    const maxStack = getMaxStackSize(template)

    if (existingItem) {
      const spaceInStack = maxStack - existingItem.quantity
      if (spaceInStack > 0) {
        const toAdd = Math.min(quantity, spaceInStack)
        existingItem.quantity += toAdd
        quantityAdded = toAdd
        itemInstance = existingItem

        if (quantityAdded < quantity) {
          // Create new stack with remainder
          return addItem(inventory, templateId, quantity - quantityAdded, itemDatabase)
        }

        return {
          success: true,
          message: `Added ${quantityAdded} x ${template.name}`,
          quantityAdded,
          itemInstance,
        }
      } else {
        // Stack full, create new
        if (inventory.items.length >= inventory.maxSlots) {
          return {
            success: false,
            message: `Inventory full, cannot add ${template.name}`,
            quantityAdded: 0,
            itemInstance: null,
          }
        }

        const newItem: InventoryItem = {
          id: `${templateId}_${Date.now()}`,
          templateId,
          quantity: Math.min(quantity, maxStack),
        }
        inventory.items.push(newItem)

        return {
          success: true,
          message: `Added ${newItem.quantity} x ${template.name}`,
          quantityAdded: newItem.quantity,
          itemInstance: newItem,
        }
      }
    } else {
      // Create new stack
      if (inventory.items.length >= inventory.maxSlots) {
        return {
          success: false,
          message: `Inventory full, cannot add ${template.name}`,
          quantityAdded: 0,
          itemInstance: null,
        }
      }

      const maxStack = getMaxStackSize(template)
      const newItem: InventoryItem = {
        id: `${templateId}_${Date.now()}`,
        templateId,
        quantity: Math.min(quantity, maxStack),
      }
      inventory.items.push(newItem)
      quantityAdded = newItem.quantity

      if (quantityAdded < quantity) {
        // Recursively add remainder
        return addItem(inventory, templateId, quantity - quantityAdded, itemDatabase)
      }

      return {
        success: true,
        message: `Added ${newItem.quantity} x ${template.name}`,
        quantityAdded,
        itemInstance: newItem,
      }
    }
  } else {
    // Non-stackable: create one item per quantity
    if (inventory.items.length + quantity > inventory.maxSlots) {
      return {
        success: false,
        message: `Inventory full, cannot add ${template.name}`,
        quantityAdded: 0,
        itemInstance: null,
      }
    }

    for (let i = 0; i < quantity; i++) {
      const newItem: InventoryItem = {
        id: `${templateId}_${Date.now()}_${i}`,
        templateId,
        quantity: 1,
      }
      inventory.items.push(newItem)
      itemInstance = newItem
      quantityAdded++
    }

    return {
      success: true,
      message: `Added ${quantityAdded} x ${template.name}`,
      quantityAdded,
      itemInstance,
    }
  }
}

/**
 * Remove item from inventory
 *
 * - Reduce quantity if stackable
 * - Remove entirely if quantity reaches 0
 * - Cannot remove more than available
 */
export function removeItem(
  inventory: Inventory,
  templateId: string,
  quantity: number
): RemoveItemResult {
  const item = findItem(inventory, templateId)

  if (!item) {
    return {
      success: false,
      message: `Item not found in inventory: ${templateId}`,
      quantityRemoved: 0,
    }
  }

  if (quantity > item.quantity) {
    return {
      success: false,
      message: `Not enough ${templateId} (have ${item.quantity}, need ${quantity})`,
      quantityRemoved: 0,
    }
  }

  item.quantity -= quantity

  if (item.quantity <= 0) {
    // Remove from inventory
    const index = inventory.items.indexOf(item)
    if (index >= 0) {
      inventory.items.splice(index, 1)
    }
  }

  return {
    success: true,
    message: `Removed ${quantity} items`,
    quantityRemoved: quantity,
  }
}

/**
 * Use a consumable item
 *
 * - Remove item from inventory
 * - Return effect to apply
 */
export function useConsumable(
  inventory: Inventory,
  templateId: string,
  template: ConsumableTemplate,
  itemDatabase: ItemDatabase
): ItemUseResult {
  const removeResult = removeItem(inventory, templateId, 1)

  if (!removeResult.success) {
    return {
      success: false,
      message: removeResult.message,
    }
  }

  return {
    success: true,
    message: `Used ${template.name}`,
    effectApplied: {
      type: template.effect,
      power: template.power,
      duration: template.duration,
    },
  }
}

/**
 * Equip weapon
 */
export function equipWeapon(
  inventory: Inventory,
  itemId: string,
  template: WeaponTemplate,
  equipment: { weapon?: InventoryItem; armor?: InventoryItem }
): ItemUseResult {
  const item = inventory.items.find((i) => i.id === itemId)

  if (!item) {
    return {
      success: false,
      message: 'Item not found in inventory',
    }
  }

  // Unequip previous weapon
  if (equipment.weapon) {
    equipment.weapon.equipped = false
  }

  // Equip new weapon
  item.equipped = true
  equipment.weapon = item

  return {
    success: true,
    message: `Equipped ${template.name}`,
  }
}

/**
 * Equip armor
 */
export function equipArmor(
  inventory: Inventory,
  itemId: string,
  template: ArmorTemplate,
  equipment: EquipmentSlots
): ItemUseResult {
  const item = inventory.items.find((i) => i.id === itemId)

  if (!item) {
    return {
      success: false,
      message: 'Item not found in inventory',
    }
  }

  // Unequip previous armor (if same slot)
  if (equipment.armor && 'slot' in equipment.armor) {
    equipment.armor.equipped = false
  }

  // Equip new armor
  item.equipped = true
  equipment.armor = item

  return {
    success: true,
    message: `Equipped ${template.name}`,
  }
}

/**
 * Unequip item
 */
export function unequipItem(
  itemId: string,
  equipment: EquipmentSlots
): ItemUseResult {
  if (equipment.weapon?.id === itemId) {
    equipment.weapon.equipped = false
    equipment.weapon = undefined
    return {
      success: true,
      message: 'Unequipped weapon',
    }
  }

  if (equipment.armor?.id === itemId) {
    equipment.armor.equipped = false
    equipment.armor = undefined
    return {
      success: true,
      message: 'Unequipped armor',
    }
  }

  return {
    success: false,
    message: 'Item not equipped',
  }
}

/**
 * Check if inventory has item
 */
export function hasItem(inventory: Inventory, templateId: string, quantity: number = 1): boolean {
  const item = findItem(inventory, templateId)
  return item !== null && item.quantity >= quantity
}

/**
 * Get inventory total weight
 */
export function getInventoryWeight(
  inventory: Inventory,
  itemDatabase: ItemDatabase
): number {
  return inventory.items.reduce((total, item) => {
    const template = itemDatabase.items.get(item.templateId)
    return total + (template ? template.weight * item.quantity : 0)
  }, 0)
}

/**
 * Get formatted inventory for display
 */
export interface InventoryDisplay {
  items: Array<{
    id: string
    name: string
    quantity: number
    type: string
    rarity: string
    equipped?: boolean
  }>
  totalSlots: number
  usedSlots: number
  gold: number
}

export function getInventoryDisplay(
  inventory: Inventory,
  itemDatabase: ItemDatabase
): InventoryDisplay {
  return {
    items: inventory.items.map((item) => {
      const template = itemDatabase.items.get(item.templateId)
      return {
        id: item.id,
        name: template?.name || item.templateId,
        quantity: item.quantity,
        type: template?.type || 'unknown',
        rarity: template?.rarity || 'common',
        equipped: item.equipped,
      }
    }),
    totalSlots: inventory.maxSlots,
    usedSlots: inventory.items.length,
    gold: inventory.gold,
  }
}
