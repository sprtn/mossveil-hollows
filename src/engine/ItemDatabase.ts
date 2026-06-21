/**
 * Item database - loads and resolves item templates from ContentRegistry
 */

import type {
  EquipmentRef,
  InventoryItem,
  ItemTemplate,
  EquipmentSlots,
  Player,
  PlayerStats,
} from './GameLoopDesign'
import {
  applyQualityToStat,
  compareQuality,
  DEFAULT_QUALITY,
  normalizeQuality,
  type Quality,
} from './Quality'
import { addMaterial } from './Materials'
import {
  getItemTemplate as getItemTemplateFromRegistry,
  getAllItems as getAllItemsFromRegistry,
} from './admin/ContentRegistry'

const itemMap = new Map<string, ItemTemplate>()

export function refreshItemDatabase(): void {
  itemMap.clear()
  for (const item of getAllItemsFromRegistry()) {
    itemMap.set(item.id, item)
  }
}

refreshItemDatabase()

export function getItemTemplate(id: string): ItemTemplate | undefined {
  return itemMap.get(id) ?? getItemTemplateFromRegistry(id)
}

export function getItemName(id: string): string {
  return itemMap.get(id)?.name ?? id
}

/** Consumable gather yields go to inventory; crafting materials use the materials bag. */
export function grantGatherResource(player: Player, resourceId: string, qty: number): Player {
  const template = getItemTemplate(resourceId)
  if (template?.type === 'consumable') {
    return {
      ...player,
      inventory: addItemToInventory(player.inventory, resourceId, qty, DEFAULT_QUALITY),
    }
  }
  return addMaterial(player, resourceId, qty)
}

export function equipmentRefKey(ref: EquipmentRef): string {
  return `${ref.templateId}::${ref.quality}`
}

export function inventoryItemKey(item: Pick<InventoryItem, 'templateId' | 'quality'>): string {
  return `${item.templateId}::${item.quality}`
}

function stackMatches(
  item: InventoryItem,
  templateId: string,
  quality?: Quality
): boolean {
  if (item.templateId !== templateId) return false
  if (quality !== undefined) return item.quality === quality
  return true
}

/** Sum quantity across all quality stacks unless a specific quality is given. */
export function hasItem(player: Player, templateId: string, quality?: Quality): boolean {
  return getInventoryQuantity(player, templateId, quality) > 0
}

export function getInventoryQuantity(
  player: Player,
  templateId: string,
  quality?: Quality
): number {
  return player.inventory
    .filter((i) => stackMatches(i, templateId, quality))
    .reduce((sum, i) => sum + i.quantity, 0)
}

export function findInventoryStacks(
  inventory: InventoryItem[],
  templateId: string,
  quality?: Quality
): InventoryItem[] {
  return inventory.filter((i) => stackMatches(i, templateId, quality))
}

/** When quality omitted, prefer highest tier (best gear to equip). */
export function pickBestQualityStack(
  inventory: InventoryItem[],
  templateId: string
): Quality | undefined {
  const stacks = findInventoryStacks(inventory, templateId)
  if (stacks.length === 0) return undefined
  return stacks.reduce((best, s) =>
    compareQuality(s.quality, best) > 0 ? s.quality : best
  , stacks[0]!.quality)
}

/**
 * When quality omitted, consume from lowest tier first (use worst items first).
 * Used by removeItemFromInventory and consumable use.
 */
export function pickWorstQualityStack(
  inventory: InventoryItem[],
  templateId: string
): Quality | undefined {
  const stacks = findInventoryStacks(inventory, templateId).filter((s) => s.quantity > 0)
  if (stacks.length === 0) return undefined
  return stacks.reduce((worst, s) =>
    compareQuality(s.quality, worst) < 0 ? s.quality : worst
  , stacks[0]!.quality)
}

export function addItemToInventory(
  inventory: InventoryItem[],
  templateId: string,
  quantity: number,
  quality: Quality = DEFAULT_QUALITY
): InventoryItem[] {
  const template = itemMap.get(templateId)
  if (!template || quantity <= 0) return inventory

  const q = normalizeQuality(quality)
  const max = template.stackable ? template.maxStackSize ?? 99 : Infinity
  const updated = inventory.map((i) => ({ ...i, quality: normalizeQuality(i.quality) }))
  const existing = updated.find((i) => i.templateId === templateId && i.quality === q)
  if (existing) {
    existing.quantity = Math.min(max, existing.quantity + quantity)
    return updated
  }
  updated.push({ templateId, quantity: Math.min(max, quantity), quality: q })
  return updated
}

/** Collapse duplicate (templateId, quality) rows from older saves. */
export function consolidateInventory(inventory: InventoryItem[]): InventoryItem[] {
  const merged: InventoryItem[] = []
  for (const raw of inventory) {
    const item: InventoryItem = {
      templateId: raw.templateId,
      quantity: raw.quantity,
      quality: normalizeQuality(raw.quality),
    }
    const existing = merged.find(
      (i) => i.templateId === item.templateId && i.quality === item.quality
    )
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
  quantity = 1,
  quality?: Quality
): InventoryItem[] {
  let updated = inventory.map((i) => ({ ...i, quality: normalizeQuality(i.quality) }))
  let remaining = quantity

  const sorted = updated
    .filter((i) => stackMatches(i, templateId, quality))
    .sort((a, b) => compareQuality(a.quality, b.quality))

  for (const target of sorted) {
    if (remaining <= 0) break
    const idx = updated.findIndex(
      (i) => i.templateId === target.templateId && i.quality === target.quality
    )
    if (idx === -1) continue
    const stack = updated[idx]!
    if (stack.quantity <= remaining) {
      remaining -= stack.quantity
      updated.splice(idx, 1)
    } else {
      updated[idx] = { ...stack, quantity: stack.quantity - remaining }
      remaining = 0
    }
  }

  return updated
}

export interface EffectiveStats extends PlayerStats {}

function scaledStatBonuses(
  template: ItemTemplate | undefined,
  quality: Quality
): Partial<PlayerStats> {
  if (!template?.statBonus) return {}
  const bonus = template.statBonus
  return {
    strength: applyQualityToStat(bonus.strength ?? 0, quality),
    constitution: applyQualityToStat(bonus.constitution ?? 0, quality),
    dexterity: applyQualityToStat(bonus.dexterity ?? 0, quality),
    agility: applyQualityToStat(bonus.agility ?? 0, quality),
    defense: applyQualityToStat(bonus.defense ?? 0, quality),
  }
}

function applyStatBonuses(
  base: PlayerStats,
  template: ItemTemplate | undefined,
  quality: Quality
): PlayerStats {
  const bonus = scaledStatBonuses(template, quality)
  return {
    strength: base.strength + (bonus.strength ?? 0),
    constitution: base.constitution + (bonus.constitution ?? 0),
    dexterity: base.dexterity + (bonus.dexterity ?? 0),
    agility: base.agility + (bonus.agility ?? 0),
    defense: base.defense + (bonus.defense ?? 0),
  }
}

export function getEquipBonus(
  template: ItemTemplate | undefined,
  quality: Quality = DEFAULT_QUALITY
): number {
  if (!template) return 0
  if (template.type === 'weapon') {
    const dmg = applyQualityToStat(template.damageBonus ?? 0, quality)
    const str = scaledStatBonuses(template, quality).strength ?? 0
    return dmg + str
  }
  if (template.type === 'armor') {
    const def = applyQualityToStat(template.defenseBonus ?? 0, quality)
    const statDef = scaledStatBonuses(template, quality).defense ?? 0
    return def + statDef
  }
  return 0
}

export function getEffectiveStats(player: Player): EffectiveStats {
  let stats = { ...player.stats }

  const weaponRef = player.equipment.weapon
  if (weaponRef) {
    const weapon = itemMap.get(weaponRef.templateId)
    stats = applyStatBonuses(stats, weapon, weaponRef.quality)
    const dmg = applyQualityToStat(weapon?.damageBonus ?? 0, weaponRef.quality)
    if (dmg) stats.strength += dmg
  }

  const armorRef = player.equipment.armor
  if (armorRef) {
    const armor = itemMap.get(armorRef.templateId)
    stats = applyStatBonuses(stats, armor, armorRef.quality)
    const def = applyQualityToStat(armor?.defenseBonus ?? 0, armorRef.quality)
    if (def) stats.defense += def
  }

  return stats
}

export function canEquip(template: ItemTemplate): boolean {
  return template.type === 'weapon' || template.type === 'armor'
}

export function equipItem(
  player: Player,
  templateId: string,
  quality?: Quality
): Player {
  const template = itemMap.get(templateId)
  if (!template || !canEquip(template)) return player

  const q = quality ?? pickBestQualityStack(player.inventory, templateId)
  if (!q || !hasItem(player, templateId, q)) return player

  const ref: EquipmentRef = { templateId, quality: q }
  const equipment: EquipmentSlots = { ...player.equipment }
  if (template.type === 'weapon') {
    equipment.weapon = ref
  } else if (template.type === 'armor') {
    equipment.armor = ref
  }

  return { ...player, equipment }
}

export function unequipItem(player: Player, slot: 'weapon' | 'armor'): Player {
  const equipment = { ...player.equipment }
  delete equipment[slot]
  return { ...player, equipment }
}

export function isEquippedRef(player: Player, ref: EquipmentRef): boolean {
  const w = player.equipment.weapon
  const a = player.equipment.armor
  return (
    (w?.templateId === ref.templateId && w.quality === ref.quality) ||
    (a?.templateId === ref.templateId && a.quality === ref.quality)
  )
}

export function scaledConsumablePower(
  template: ItemTemplate,
  quality: Quality = DEFAULT_QUALITY
): number {
  return applyQualityToStat(template.power ?? 0, quality)
}

export function applyConsumableEffect(
  player: Player,
  template: ItemTemplate,
  quality: Quality = DEFAULT_QUALITY
): { player: Player; message: string } {
  let updated = { ...player, statusEffects: [...player.statusEffects] }
  let message = `Used ${template.name}.`
  const q = normalizeQuality(quality)

  switch (template.effect) {
    case 'heal_health': {
      const heal = scaledConsumablePower(template, q)
      updated.hp = Math.min(updated.maxHp, updated.hp + heal)
      message = `Restored ${heal} HP.`
      break
    }
    case 'restore_energy': {
      const restore = scaledConsumablePower(template, q)
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

export type { Quality }
