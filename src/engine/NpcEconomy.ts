/**
 * NPC autonomous economy: town raw supply + crafter daily production.
 */

import type { GameState } from './GameLoopDesign'
import type { NpcEconomicState, RecipeDef } from './ContentSchemas'
import {
  ensureMarketState,
  getMaterialMarketStock,
  recordTrade,
} from './MarketSystem'
import { getRecipesForNpc } from './CraftingSystem'
import { getItemTemplate, getItemName } from './ItemDatabase'
import { ensureVendorState } from './VendorSystem'
import { getNpc } from './NpcData'
import { appendStatus } from './statusMessages'
import { DEFAULT_QUALITY, normalizeQuality, type Quality } from './Quality'

/** Per-day raw injection into shared market board (oak = 0 — logging camp owns it). */
export const TOWN_SUPPLY_RATES: Record<string, number> = {
  iron_ore: 2,
  stone: 1,
  green_herb: 2,
  cloth_scrap: 2,
  spider_silk: 1,
  boar_hide: 1,
  wolf_pelt: 1,
  oak_wood: 0,
}

export const CRAFTER_NPC_IDS = ['garrick_smith', 'maren_healer'] as const

export const NPC_CRAFT_PRODUCTION_PER_DAY: Record<string, number> = {
  garrick_smith: 1,
  maren_healer: 1,
}

export const NPC_CRAFT_OUTPUT_QUALITY: Quality = DEFAULT_QUALITY

/** Max stock per template+quality in a vendor's shop from NPC crafting. */
export const NPC_CRAFT_VENDOR_STOCK_CAP = 3

function defaultNpcEconomicState(): NpcEconomicState {
  return { rotationIndex: 0 }
}

export function ensureNpcEconomicState(state: GameState, npcId: string): GameState {
  const npcEconomicState = { ...(state.npcEconomicState ?? {}) }
  if (!npcEconomicState[npcId]) {
    npcEconomicState[npcId] = defaultNpcEconomicState()
  }
  return { ...state, npcEconomicState }
}

function npcDisplayName(npcId: string): string {
  const npc = getNpc(npcId)
  return npc?.name?.split(' ')[0] ?? npcId
}

function craftVerb(npcId: string): string {
  return npcId === 'maren_healer' ? 'brewed' : 'forged'
}

function isGearOutput(templateId: string): boolean {
  const template = getItemTemplate(templateId)
  return template?.type === 'weapon' || template?.type === 'armor'
}

function hasVendorShop(npcId: string): boolean {
  const npc = getNpc(npcId)
  return npc?.services?.includes('shop') ?? false
}

function findShortMaterial(
  state: GameState,
  materials: Record<string, number>
): string | null {
  for (const [matId, qty] of Object.entries(materials)) {
    if (getMaterialMarketStock(state, matId) < qty) return matId
  }
  return null
}

function consumeMaterials(
  state: GameState,
  materials: Record<string, number>
): GameState {
  let result = state
  for (const [matId, qty] of Object.entries(materials)) {
    result = recordTrade(result, matId, qty, 'buy')
  }
  return result
}

function addGearToVendor(
  state: GameState,
  vendorId: string,
  templateId: string,
  qty: number,
  quality: Quality
): GameState {
  let result = ensureVendorState(state)
  const vendor = result.vendorState?.[vendorId]
  if (!vendor) return result

  const q = normalizeQuality(quality)
  const inventory = vendor.inventory.map((entry) => ({ ...entry }))
  const existingIdx = inventory.findIndex(
    (entry) =>
      entry.templateId === templateId && normalizeQuality(entry.quality) === q
  )

  const totalStock = inventory
    .filter(
      (entry) =>
        entry.templateId === templateId && normalizeQuality(entry.quality) === q
    )
    .reduce((sum, entry) => sum + entry.stock, 0)

  const toAdd = Math.min(qty, Math.max(0, NPC_CRAFT_VENDOR_STOCK_CAP - totalStock))
  if (toAdd <= 0) return result

  if (existingIdx >= 0) {
    inventory[existingIdx] = {
      ...inventory[existingIdx]!,
      stock: inventory[existingIdx]!.stock + toAdd,
    }
  } else {
    inventory.push({ templateId, stock: toAdd, quality: q })
  }

  return {
    ...result,
    vendorState: {
      ...result.vendorState!,
      [vendorId]: { ...vendor, inventory },
    },
  }
}

function executeCraft(
  state: GameState,
  npcId: string,
  recipe: RecipeDef
): GameState {
  let result = consumeMaterials(state, recipe.requires.materials)
  const outputId = recipe.output.itemId
  const outputQty = recipe.output.qty * (NPC_CRAFT_PRODUCTION_PER_DAY[npcId] ?? 1)

  result = recordTrade(result, outputId, outputQty, 'sell')

  if (isGearOutput(outputId) && hasVendorShop(npcId)) {
    result = addGearToVendor(
      result,
      npcId,
      outputId,
      outputQty,
      NPC_CRAFT_OUTPUT_QUALITY
    )
  }

  return result
}

export function processTownSupply(state: GameState): GameState {
  let result = ensureMarketState(state)
  let injected = false

  for (const [materialId, qty] of Object.entries(TOWN_SUPPLY_RATES)) {
    if (qty <= 0) continue
    result = recordTrade(result, materialId, qty, 'sell')
    injected = true
  }

  if (injected) {
    result = {
      ...result,
      statusMessage: appendStatus(
        result.statusMessage ?? '',
        'Townsfolk restocked the market.'
      ),
    }
  }

  return result
}

export function processNpcCrafters(state: GameState): GameState {
  let result = ensureMarketState(state)
  const activityLines: string[] = []

  for (const npcId of CRAFTER_NPC_IDS) {
    result = ensureNpcEconomicState(result, npcId)
    const recipes = getRecipesForNpc(result, npcId)
    const npcEconomicState = { ...(result.npcEconomicState ?? {}) }
    let npcState = { ...(npcEconomicState[npcId] ?? defaultNpcEconomicState()) }
    const day = result.day ?? 1

    if (recipes.length === 0) {
      npcState = {
        ...npcState,
        lastRunDay: day,
        lastSkipReason: `${npcDisplayName(npcId)} idle — no recipes available.`,
      }
      npcEconomicState[npcId] = npcState
      result = { ...result, npcEconomicState }
      continue
    }

    const startIdx = npcState.rotationIndex % recipes.length
    let crafted = false
    let lastShortMat: string | null = null

    for (let attempt = 0; attempt < Math.min(2, recipes.length); attempt++) {
      const recipeIdx = (startIdx + attempt) % recipes.length
      const recipe = recipes[recipeIdx]!
      const shortMat = findShortMaterial(result, recipe.requires.materials)

      if (shortMat) {
        lastShortMat = shortMat
        continue
      }

      result = executeCraft(result, npcId, recipe)
      npcState = {
        ...npcState,
        rotationIndex: (recipeIdx + 1) % recipes.length,
        lastRunDay: day,
        lastProducedItemId: recipe.output.itemId,
        lastProducedQty:
          recipe.output.qty * (NPC_CRAFT_PRODUCTION_PER_DAY[npcId] ?? 1),
        lastConsumed: { ...recipe.requires.materials },
        lastSkipReason: undefined,
      }
      activityLines.push(
        `${npcDisplayName(npcId)} ${craftVerb(npcId)} ${getItemName(recipe.output.itemId)}`
      )
      crafted = true
      break
    }

    if (!crafted) {
      npcState = {
        ...npcState,
        rotationIndex: (startIdx + 1) % recipes.length,
        lastRunDay: day,
        lastProducedItemId: undefined,
        lastProducedQty: undefined,
        lastConsumed: undefined,
        lastSkipReason: lastShortMat
          ? `${npcDisplayName(npcId)} idle — not enough ${lastShortMat} in the market.`
          : `${npcDisplayName(npcId)} idle — not enough materials in the market.`,
      }
    }

    npcEconomicState[npcId] = npcState
    result = { ...result, npcEconomicState }
  }

  if (activityLines.length > 0) {
    result = {
      ...result,
      statusMessage: appendStatus(result.statusMessage ?? '', activityLines.join('; ')),
    }
  }

  return result
}
