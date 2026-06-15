/**
 * Per-vendor inventory, hidden XP, and restock.
 */

import type { GameState } from './GameLoopDesign'
import type { VendorInventoryEntry, VendorState } from './ContentSchemas'
import { getBuildingLevel } from './BuildingSystem'
import { getItemTemplate } from './ItemDatabase'
import {
  VENDOR_XP_THRESHOLDS,
  VENDOR_TIER_BUY_DISCOUNT,
  VENDOR_TIER_SELL_BONUS,
  vendorAcceptsItem,
  getItemCategory,
} from './MarketCatalog'
import { getIronLocalSupply, ensureMarketState } from './MarketSystem'
import { getNpc } from './NpcData'
import { DEFAULT_QUALITY, normalizeQuality, type Quality } from './Quality'
import { rollVendorQuality } from './QualityRoll'
import { SeededRandom } from './CombatEngine'

const SEED_INVENTORY: Record<string, VendorInventoryEntry[]> = {
  sera_quartermaster: [
    { templateId: 'health_potion', stock: 6, quality: 'common' },
    { templateId: 'health_potion', stock: 2, quality: 'fine' },
    { templateId: 'antidote', stock: 5, quality: 'common' },
    { templateId: 'worn_tunic', stock: 2, quality: 'common' },
    { templateId: 'rusty_shortsword', stock: 1, quality: 'common' },
    { templateId: 'rusty_shortsword', stock: 1, quality: 'poor' },
  ],
  garrick_smith: [],
}

const RESTOCK_CAPS: Record<string, Record<string, number>> = {
  sera_quartermaster: {
    health_potion: 12,
    antidote: 8,
    worn_tunic: 3,
    rusty_shortsword: 3,
  },
  garrick_smith: {
    oak_spear: 2,
    wooden_stake: 3,
  },
}

function normalizeEntry(entry: VendorInventoryEntry): VendorInventoryEntry {
  return {
    ...entry,
    quality: normalizeQuality(entry.quality ?? DEFAULT_QUALITY),
  }
}

function entryMatches(
  entry: VendorInventoryEntry,
  templateId: string,
  quality: Quality
): boolean {
  return entry.templateId === templateId && normalizeQuality(entry.quality) === quality
}

function vendorEntryKey(entry: VendorInventoryEntry): string {
  const q = normalizeQuality(entry.quality)
  return `${entry.templateId}::${q}`
}

export function getVendorTier(state: GameState, vendorId: string): number {
  const xp = state.vendorState?.[vendorId]?.xp ?? 0
  let tier = 0
  for (let i = VENDOR_XP_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= VENDOR_XP_THRESHOLDS[i]!) {
      tier = i
      break
    }
  }
  return tier
}

export function getVendorBuyDiscount(state: GameState, vendorId: string): number {
  const tier = getVendorTier(state, vendorId)
  return VENDOR_TIER_BUY_DISCOUNT[tier] ?? 0
}

export function getVendorSellBonus(state: GameState, vendorId: string): number {
  const tier = getVendorTier(state, vendorId)
  return VENDOR_TIER_SELL_BONUS[tier] ?? 0
}

function defaultVendorState(vendorId: string): VendorState {
  return {
    xp: 0,
    inventory: (SEED_INVENTORY[vendorId] ?? []).map(normalizeEntry),
  }
}

export function ensureVendorState(state: GameState): GameState {
  const vendorState = { ...(state.vendorState ?? {}) }
  for (const vendorId of Object.keys(SEED_INVENTORY)) {
    if (!vendorState[vendorId]) {
      vendorState[vendorId] = defaultVendorState(vendorId)
    } else {
      vendorState[vendorId] = {
        ...vendorState[vendorId]!,
        inventory: vendorState[vendorId]!.inventory.map(normalizeEntry),
      }
    }
  }
  return { ...state, vendorState }
}

export function getVendorInventory(
  state: GameState,
  vendorId: string
): VendorInventoryEntry[] {
  const ensured = ensureVendorState(state)
  return ensured.vendorState?.[vendorId]?.inventory ?? []
}

export function getVendorStock(
  state: GameState,
  vendorId: string,
  templateId: string,
  quality: Quality = DEFAULT_QUALITY
): number {
  const q = normalizeQuality(quality)
  const entry = getVendorInventory(state, vendorId).find((i) => entryMatches(i, templateId, q))
  return entry?.stock ?? 0
}

export function vendorHasStock(
  state: GameState,
  vendorId: string,
  templateId: string,
  quality: Quality = DEFAULT_QUALITY
): boolean {
  return getVendorStock(state, vendorId, templateId, quality) > 0
}

export function addVendorXp(
  state: GameState,
  vendorId: string,
  goldValue: number
): GameState {
  const ensured = ensureVendorState(state)
  const beforeTier = getVendorTier(ensured, vendorId)
  const xpGain = Math.max(1, Math.floor(goldValue * 0.1))
  const vendor = ensured.vendorState![vendorId]!
  const updated: VendorState = {
    ...vendor,
    xp: vendor.xp + xpGain,
  }
  const result: GameState = {
    ...ensured,
    vendorState: { ...ensured.vendorState!, [vendorId]: updated },
  }
  const afterTier = getVendorTier(result, vendorId)
  if (afterTier > beforeTier) {
    const npc = getNpc(vendorId)
    const name = npc?.name?.split(' ')[0] ?? 'The vendor'
    return {
      ...result,
      statusMessage: `${name} nods — you're becoming a familiar face.`,
    }
  }
  return result
}

export function decrementVendorStock(
  state: GameState,
  vendorId: string,
  templateId: string,
  qty = 1,
  quality: Quality = DEFAULT_QUALITY
): GameState {
  const ensured = ensureVendorState(state)
  const vendor = ensured.vendorState![vendorId]!
  const q = normalizeQuality(quality)
  const inventory = vendor.inventory.map((entry) => {
    if (!entryMatches(entry, templateId, q)) return entry
    return { ...entry, stock: Math.max(0, entry.stock - qty) }
  })
  return {
    ...ensured,
    vendorState: {
      ...ensured.vendorState!,
      [vendorId]: { ...vendor, inventory },
    },
  }
}

export function getAvailableVendors(state: GameState): string[] {
  const vendors = ['sera_quartermaster']
  if (getBuildingLevel(state, 'workbench') >= 1) {
    vendors.push('garrick_smith')
  }
  return vendors
}

export function getVendorBuyList(state: GameState, vendorId: string): VendorInventoryEntry[] {
  return getVendorInventory(state, vendorId).filter((entry) => {
    const template = getItemTemplate(entry.templateId)
    return entry.stock > 0 && template?.buyPrice !== undefined
  })
}

export function getVendorSellList(
  state: GameState,
  vendorId: string
): Array<{ templateId: string; quantity: number; quality: Quality }> {
  const player = state.player
  const results: Array<{ templateId: string; quantity: number; quality: Quality }> = []

  for (const item of player.inventory) {
    const template = getItemTemplate(item.templateId)
    if (!template?.sellPrice) continue
    if (!vendorAcceptsItem(vendorId, item.templateId)) continue

    const w = player.equipment.weapon
    const a = player.equipment.armor
    const isThisEquipped =
      (w?.templateId === item.templateId && w.quality === item.quality) ||
      (a?.templateId === item.templateId && a.quality === item.quality)
    const sellable = item.quantity - (isThisEquipped ? 1 : 0)
    if (sellable > 0) {
      results.push({
        templateId: item.templateId,
        quantity: sellable,
        quality: item.quality,
      })
    }
  }

  return results
}

export function restockVendors(state: GameState): GameState {
  let result = ensureVendorState(ensureMarketState(state))
  const vendorState = { ...result.vendorState! }
  const ironSupply = getIronLocalSupply(result)
  const workbench = getBuildingLevel(result, 'workbench')
  const seraTier = getVendorTier(result, 'sera_quartermaster')
  const garrickTier = getVendorTier(result, 'garrick_smith')
  const day = result.day ?? 1

  for (const [vendorId, caps] of Object.entries(RESTOCK_CAPS)) {
    const vendor = { ...vendorState[vendorId]! }
    const inventory = [...vendor.inventory.map(normalizeEntry)]

    for (const [templateId, cap] of Object.entries(caps)) {
      const category = getItemCategory(templateId)
      let maxStock = cap

      if (vendorId === 'sera_quartermaster' && category === 'iron_products') {
        maxStock = ironSupply >= 3 ? Math.min(cap, 1 + seraTier) : Math.min(cap, 2)
      }
      if (vendorId === 'garrick_smith') {
        if (workbench < 1) continue
        if (category === 'wood_products') {
          maxStock = Math.min(cap, 1 + garrickTier)
        }
        if (category === 'iron_products' && ironSupply < 5) {
          continue
        }
      }

      const totalStock = inventory
        .filter((i) => i.templateId === templateId)
        .reduce((s, i) => s + i.stock, 0)
      if (totalStock >= maxStock) continue

      const rng = new SeededRandom(day ^ templateId.length ^ vendorId.length)
      const quality = rollVendorQuality(rng)
      const existing = inventory.find((i) => entryMatches(i, templateId, quality))
      if (existing) {
        existing.stock = Math.min(maxStock, existing.stock + 1)
      } else {
        inventory.push({ templateId, stock: 1, quality })
      }
    }

    vendorState[vendorId] = { ...vendor, inventory }
  }

  if (workbench >= 1 && !vendorState.garrick_smith) {
    vendorState.garrick_smith = defaultVendorState('garrick_smith')
  }

  return { ...result, vendorState }
}

export function giveVendorXp(
  state: GameState,
  vendorId: string,
  amount: number
): GameState {
  const ensured = ensureVendorState(state)
  const vendor = ensured.vendorState![vendorId] ?? defaultVendorState(vendorId)
  return {
    ...ensured,
    vendorState: {
      ...ensured.vendorState!,
      [vendorId]: { ...vendor, xp: vendor.xp + amount },
    },
  }
}

export { vendorEntryKey }
