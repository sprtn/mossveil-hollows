/**
 * Item database - loads and resolves item templates from JSON
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
import canineTooth from '../assets/items/canine_tooth.json'
import boarHide from '../assets/items/boar_hide.json'
import boarTusk from '../assets/items/boar_tusk.json'
import spiderSilk from '../assets/items/spider_silk.json'
import spiderFang from '../assets/items/spider_fang.json'
import batWing from '../assets/items/bat_wing.json'
import crystalSliver from '../assets/items/crystal_sliver.json'
import trollTusk from '../assets/items/troll_tusk.json'
import tarnishedCoin from '../assets/items/tarnished_coin.json'
import oakWood from '../assets/items/oak_wood.json'
import corruptedSap from '../assets/items/corrupted_sap.json'
import clothScrap from '../assets/items/cloth_scrap.json'
import cleansingDraught from '../assets/items/cleansing_draught.json'
import stone from '../assets/items/stone.json'
import greenHerb from '../assets/items/green_herb.json'
import moonshadeHerb from '../assets/items/moonshade_herb.json'
import rawFish from '../assets/items/raw_fish.json'
import freshProduce from '../assets/items/fresh_produce.json'

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
  canineTooth as ItemTemplate,
  boarHide as ItemTemplate,
  boarTusk as ItemTemplate,
  spiderSilk as ItemTemplate,
  spiderFang as ItemTemplate,
  batWing as ItemTemplate,
  crystalSliver as ItemTemplate,
  trollTusk as ItemTemplate,
  tarnishedCoin as ItemTemplate,
  oakWood as ItemTemplate,
  corruptedSap as ItemTemplate,
  clothScrap as ItemTemplate,
  cleansingDraught as ItemTemplate,
  stone as ItemTemplate,
  greenHerb as ItemTemplate,
  moonshadeHerb as ItemTemplate,
  rawFish as ItemTemplate,
  freshProduce as ItemTemplate,
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
