/**
 * Item database - loads and resolves item templates from JSON
 */

import type { InventoryItem, ItemTemplate, EquipmentSlots, Player, PlayerStats } from './GameLoopDesign'

import healthPotion from '../assets/items/health_potion.json'
import manaPotion from '../assets/items/mana_potion.json'
import antidote from '../assets/items/antidote.json'
import ironSword from '../assets/items/iron_sword.json'
import steelSword from '../assets/items/steel_sword.json'
import legendarySword from '../assets/items/legendary_sword.json'
import leatherArmor from '../assets/items/leather_armor.json'
import ironPlateArmor from '../assets/items/iron_plate_armor.json'
import guardianAmulet from '../assets/items/guardian_amulet.json'
import ironOre from '../assets/items/iron_ore.json'
import forestShard from '../assets/items/forest_shard.json'
import caveShard from '../assets/items/cave_shard.json'
import ruinsShard from '../assets/items/ruins_shard.json'
import rustyShortsword from '../assets/items/rusty_shortsword.json'
import wornTunic from '../assets/items/worn_tunic.json'
import oakSpear from '../assets/items/oak_spear.json'
import hideJerkin from '../assets/items/hide_jerkin.json'
import wolfCloak from '../assets/items/wolf_cloak.json'
import woodenStake from '../assets/items/wooden_stake.json'
import wolfPelt from '../assets/items/wolf_pelt.json'
import boarHide from '../assets/items/boar_hide.json'
import spiderSilk from '../assets/items/spider_silk.json'
import oakWood from '../assets/items/oak_wood.json'
import corruptedSap from '../assets/items/corrupted_sap.json'
import clothScrap from '../assets/items/cloth_scrap.json'
import cleansingDraught from '../assets/items/cleansing_draught.json'

const RAW_ITEMS: ItemTemplate[] = [
  healthPotion as ItemTemplate,
  manaPotion as ItemTemplate,
  antidote as ItemTemplate,
  ironSword as ItemTemplate,
  steelSword as ItemTemplate,
  legendarySword as ItemTemplate,
  leatherArmor as ItemTemplate,
  ironPlateArmor as ItemTemplate,
  guardianAmulet as ItemTemplate,
  ironOre as ItemTemplate,
  forestShard as ItemTemplate,
  caveShard as ItemTemplate,
  ruinsShard as ItemTemplate,
  rustyShortsword as ItemTemplate,
  wornTunic as ItemTemplate,
  oakSpear as ItemTemplate,
  hideJerkin as ItemTemplate,
  wolfCloak as ItemTemplate,
  woodenStake as ItemTemplate,
  wolfPelt as ItemTemplate,
  boarHide as ItemTemplate,
  spiderSilk as ItemTemplate,
  oakWood as ItemTemplate,
  corruptedSap as ItemTemplate,
  clothScrap as ItemTemplate,
  cleansingDraught as ItemTemplate,
]

const itemMap = new Map<string, ItemTemplate>()
for (const item of RAW_ITEMS) {
  itemMap.set(item.id, item)
}

export function getItemTemplate(id: string): ItemTemplate | undefined {
  return itemMap.get(id)
}

export function getItemName(id: string): string {
  return itemMap.get(id)?.name ?? id
}

export function hasItem(player: Player, templateId: string): boolean {
  return player.inventory.some((i) => i.templateId === templateId && i.quantity > 0)
}

export function getInventoryQuantity(player: Player, templateId: string): number {
  return player.inventory
    .filter((i) => i.templateId === templateId)
    .reduce((sum, i) => sum + i.quantity, 0)
}

export function addItemToInventory(
  inventory: InventoryItem[],
  templateId: string,
  quantity: number
): InventoryItem[] {
  const template = itemMap.get(templateId)
  if (!template || quantity <= 0) return inventory

  // Inventory entries are keyed purely by templateId (no per-instance state),
  // so identical items always stack into a single entry. `stackable` only
  // governs the per-stack cap; non-stackable gear has no cap here.
  const max = template.stackable ? template.maxStackSize ?? 99 : Infinity
  const updated = inventory.map((i) => ({ ...i }))
  const existing = updated.find((i) => i.templateId === templateId)
  if (existing) {
    existing.quantity = Math.min(max, existing.quantity + quantity)
    return updated
  }
  updated.push({ templateId, quantity: Math.min(max, quantity) })
  return updated
}

/** Collapse any duplicate inventory entries (from older saves) into single stacks. */
export function consolidateInventory(inventory: InventoryItem[]): InventoryItem[] {
  const merged: InventoryItem[] = []
  for (const item of inventory) {
    const existing = merged.find((i) => i.templateId === item.templateId)
    if (existing) {
      existing.quantity += item.quantity
    } else {
      merged.push({ ...item })
    }
  }
  return merged
}

export function removeItemFromInventory(
  inventory: InventoryItem[],
  templateId: string,
  quantity = 1
): InventoryItem[] {
  const updated = [...inventory]
  let remaining = quantity
  for (let i = updated.length - 1; i >= 0 && remaining > 0; i--) {
    const item = updated[i]
    if (!item || item.templateId !== templateId) continue
    if (item.quantity <= remaining) {
      remaining -= item.quantity
      updated.splice(i, 1)
    } else {
      item.quantity -= remaining
      remaining = 0
    }
  }
  return updated
}

export interface EffectiveStats extends PlayerStats {}

function applyStatBonuses(base: PlayerStats, template: ItemTemplate | undefined): PlayerStats {
  if (!template?.statBonus) return base
  const bonus = template.statBonus
  return {
    strength: base.strength + (bonus.strength ?? 0),
    constitution: base.constitution + (bonus.constitution ?? 0),
    dexterity: base.dexterity + (bonus.dexterity ?? 0),
    agility: base.agility + (bonus.agility ?? 0),
    defense: base.defense + (bonus.defense ?? 0),
  }
}

export function getEquipBonus(template: ItemTemplate | undefined): number {
  if (!template) return 0
  if (template.type === 'weapon') {
    return (template.damageBonus ?? 0) + (template.statBonus?.strength ?? 0)
  }
  if (template.type === 'armor') {
    return (template.defenseBonus ?? 0) + (template.statBonus?.defense ?? 0)
  }
  return 0
}

export function getEffectiveStats(player: Player): EffectiveStats {
  let stats = { ...player.stats }

  if (player.equipment.weapon) {
    stats = applyStatBonuses(stats, itemMap.get(player.equipment.weapon))
    const weapon = itemMap.get(player.equipment.weapon)
    if (weapon?.damageBonus) stats.strength += weapon.damageBonus
  }
  if (player.equipment.armor) {
    stats = applyStatBonuses(stats, itemMap.get(player.equipment.armor))
    const armor = itemMap.get(player.equipment.armor)
    if (armor?.defenseBonus) stats.defense += armor.defenseBonus
  }

  return stats
}

export function canEquip(template: ItemTemplate): boolean {
  return template.type === 'weapon' || template.type === 'armor'
}

export function equipItem(player: Player, templateId: string): Player {
  const template = itemMap.get(templateId)
  if (!template || !canEquip(template)) return player
  if (!hasItem(player, templateId)) return player

  const equipment: EquipmentSlots = { ...player.equipment }
  if (template.type === 'weapon') {
    equipment.weapon = templateId
  } else if (template.type === 'armor') {
    equipment.armor = templateId
  }

  return { ...player, equipment }
}

export function unequipItem(player: Player, slot: 'weapon' | 'armor'): Player {
  const equipment = { ...player.equipment }
  delete equipment[slot]
  return { ...player, equipment }
}

export function applyConsumableEffect(
  player: Player,
  template: ItemTemplate
): { player: Player; message: string } {
  let updated = { ...player, statusEffects: [...player.statusEffects] }
  let message = `Used ${template.name}.`

  switch (template.effect) {
    case 'heal_health': {
      const heal = template.power ?? 0
      updated.hp = Math.min(updated.maxHp, updated.hp + heal)
      message = `Restored ${heal} HP.`
      break
    }
    case 'restore_energy': {
      const restore = template.power ?? 0
      updated.energy = Math.min(updated.maxEnergy, updated.energy + restore)
      message = `Restored ${restore} energy.`
      break
    }
    case 'remove_poison': {
      updated.statusEffects = updated.statusEffects.filter((s) => s.type !== 'poison')
      message = 'Poison cured.'
      break
    }
    default:
      break
  }

  return { player: updated, message }
}
