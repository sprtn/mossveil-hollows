/**
 * Local market supply/demand and dynamic pricing.
 */

import type { GameState } from './GameLoopDesign'
import type { MarketCategoryState } from './ContentSchemas'
import {
  getItemCategory,
  MARKET_CATEGORIES,
  MARKET_TUNING,
  type MarketCategory,
} from './MarketCatalog'
import { getItemTemplate, getItemName } from './ItemDatabase'
import { getMaterialCount } from './Materials'

function defaultCategoryState(): MarketCategoryState {
  return {
    priceMultiplier: 1,
    shortTermSold: 0,
    longTermSold: 0,
    localSupply: 0,
    lastTradeDay: 0,
  }
}

export function ensureMarketState(state: GameState): GameState {
  const existing = state.marketState ?? {}
  const marketState: Record<string, MarketCategoryState> = { ...existing }
  for (const cat of MARKET_CATEGORIES) {
    if (!marketState[cat]) {
      marketState[cat] = defaultCategoryState()
    }
  }
  return { ...state, marketState }
}

const DEFAULT_MARKET_STOCK: Record<string, number> = {
  oak_wood: 6,
  cloth_scrap: 3,
}

export function ensureMarketMaterialStock(state: GameState): GameState {
  const stock = { ...DEFAULT_MARKET_STOCK, ...(state.marketMaterialStock ?? {}) }
  return { ...state, marketMaterialStock: stock }
}

function isMarketMaterial(templateId: string): boolean {
  const template = getItemTemplate(templateId)
  return template?.type === 'crafting'
    && template.sellPrice !== undefined
    && getItemCategory(templateId) !== undefined
}

export function getMaterialMarketStock(state: GameState, materialId: string): number {
  return state.marketMaterialStock?.[materialId] ?? 0
}

function adjustMaterialStock(
  state: GameState,
  materialId: string,
  delta: number
): GameState {
  const stock = { ...(state.marketMaterialStock ?? {}) }
  const next = (stock[materialId] ?? 0) + delta
  if (next <= 0) delete stock[materialId]
  else stock[materialId] = next
  return { ...state, marketMaterialStock: stock }
}

function materialBuyBase(templateId: string): number {
  const template = getItemTemplate(templateId)
  if (!template?.sellPrice) return 0
  if (template.buyPrice !== undefined) return template.buyPrice
  return Math.max(2, Math.round(template.sellPrice * MARKET_TUNING.buyMarkup))
}

export function getMarketMaterialBuyPrice(state: GameState, materialId: string): number {
  const base = materialBuyBase(materialId)
  if (!base) return 0
  let price = base * getMarketMultiplier(state, materialId)
  return Math.max(1, Math.round(price))
}

export interface MarketMaterialListing {
  materialId: string
  stock: number
  buyPrice: number
  sellPrice: number
}

export function getMarketMaterialListings(state: GameState): MarketMaterialListing[] {
  const result = ensureMarketMaterialStock(ensureMarketState(state))
  const ids = new Set<string>([
    ...Object.keys(result.marketMaterialStock ?? {}),
    ...Object.keys(result.player.materials ?? {}),
  ])

  return [...ids]
    .filter((id) => isMarketMaterial(id))
    .map((materialId) => ({
      materialId,
      stock: getMaterialMarketStock(result, materialId),
      buyPrice: getMarketMaterialBuyPrice(result, materialId),
      sellPrice: getPrice(result, materialId, 'sell'),
    }))
    .filter((row) => row.stock > 0 || getMaterialCount(result.player, row.materialId) > 0)
    .sort((a, b) => getItemName(a.materialId).localeCompare(getItemName(b.materialId)))
}

function getCategoryState(state: GameState, category: MarketCategory): MarketCategoryState {
  return state.marketState?.[category] ?? defaultCategoryState()
}

function clampPrice(mult: number): number {
  return Math.max(MARKET_TUNING.priceMin, Math.min(MARKET_TUNING.priceMax, mult))
}

function ironFreightMarkup(state: GameState): number {
  const iron = getCategoryState(state, 'iron').localSupply
  const t = MARKET_TUNING.ironSupplyThreshold
  if (iron >= t) return MARKET_TUNING.freightMarkupMin
  const ratio = iron / t
  return MARKET_TUNING.freightMarkupMax
    - (MARKET_TUNING.freightMarkupMax - MARKET_TUNING.freightMarkupMin) * ratio
}

function categoryMultiplier(state: GameState, category: MarketCategory): number {
  const cat = getCategoryState(state, category)
  let mult = cat.priceMultiplier

  if (cat.shortTermSold > MARKET_TUNING.burstThreshold) {
    const excess = cat.shortTermSold - MARKET_TUNING.burstThreshold
    mult -= excess * MARKET_TUNING.burstPenaltyPerUnit
  }

  const longBonus = Math.min(
    cat.longTermSold * MARKET_TUNING.longTermBonusPerUnit,
    MARKET_TUNING.longTermBonusCap
  )
  mult += longBonus

  return clampPrice(mult)
}

export function getMarketMultiplier(state: GameState, templateId: string): number {
  const category = getItemCategory(templateId)
  if (!category) return 1
  let mult = categoryMultiplier(state, category)

  if (category === 'iron_products') {
    mult *= ironFreightMarkup(state)
  }

  return clampPrice(mult)
}

export function getPrice(
  state: GameState,
  templateId: string,
  mode: 'buy' | 'sell',
  modifiers?: { buyDiscount?: number; sellBonus?: number }
): number {
  const template = getItemTemplate(templateId)
  if (!template) return 0

  const base = mode === 'buy' ? template.buyPrice : template.sellPrice
  if (base === undefined) return 0

  let price = base * getMarketMultiplier(state, templateId)

  if (mode === 'buy') {
    price *= 1 - (modifiers?.buyDiscount ?? 0)
  } else {
    price *= 1 + (modifiers?.sellBonus ?? 0)
  }

  return Math.max(1, Math.round(price))
}

export function recordTrade(
  state: GameState,
  templateId: string,
  qty: number,
  mode: 'buy' | 'sell'
): GameState {
  const category = getItemCategory(templateId)
  if (!category) return state

  let result = ensureMarketMaterialStock(ensureMarketState(state))
  const day = result.day ?? 1
  const cat = { ...getCategoryState(result, category) }

  if (mode === 'sell') {
    cat.shortTermSold += qty
    cat.longTermSold += qty * 0.5
    cat.localSupply += qty * MARKET_TUNING.localSupplyPerSell
    if (category === 'wood' || category === 'iron') {
      cat.localSupply += qty * MARKET_TUNING.localSupplyPerMaterialSell
    }
    if (category === 'iron' || category === 'iron_products') {
      const iron = { ...getCategoryState(result, 'iron') }
      iron.localSupply += qty * (category === 'iron' ? 1.5 : 0.5)
      result = {
        ...result,
        marketState: { ...result.marketState!, iron },
      }
    }
    if (isMarketMaterial(templateId)) {
      result = adjustMaterialStock(result, templateId, qty)
    }
  } else {
    cat.localSupply = Math.max(0, cat.localSupply - qty * 0.25)
    if (isMarketMaterial(templateId)) {
      result = adjustMaterialStock(result, templateId, -qty)
    }
  }

  cat.lastTradeDay = day
  cat.priceMultiplier = categoryMultiplier(
    { ...result, marketState: { ...result.marketState!, [category]: cat } },
    category
  )

  return {
    ...result,
    marketState: { ...result.marketState!, [category]: cat },
  }
}

/** Record leather market impact from Sera dialogue bundle trades. */
export function recordMaterialSale(
  state: GameState,
  materialId: string,
  qty: number
): GameState {
  return recordTrade(state, materialId, qty, 'sell')
}

export function decayMarkets(state: GameState): GameState {
  let result = ensureMarketState(state)
  const marketState = { ...result.marketState! }

  for (const catId of MARKET_CATEGORIES) {
    const cat = { ...marketState[catId]! }
    cat.shortTermSold *= 1 - MARKET_TUNING.shortDecayPerDay
    cat.longTermSold *= 1 - MARKET_TUNING.longDecayPerDay
    if (cat.shortTermSold < 0.01) cat.shortTermSold = 0
    if (cat.longTermSold < 0.01) cat.longTermSold = 0
    cat.priceMultiplier = categoryMultiplier(
      { ...result, marketState: { ...marketState, [catId]: cat } },
      catId
    )
    marketState[catId] = cat
  }

  return { ...result, marketState }
}

export function getIronLocalSupply(state: GameState): number {
  return getCategoryState(ensureMarketState(state), 'iron').localSupply
}

export function getWoodMarketPrice(state: GameState): number {
  return getPrice(state, 'oak_wood', 'sell')
}

/**
 * Camp payroll circulating in town — workers spend wages at local traders,
 * easing timber gluts and lifting demand for goods.
 */
export function circulateCampPayroll(state: GameState, gold: number): GameState {
  if (gold <= 0) return state

  let result = ensureMarketState(state)
  const marketState = { ...result.marketState! }

  const wood = { ...getCategoryState(result, 'wood') }
  wood.shortTermSold = Math.max(0, wood.shortTermSold - gold * 0.2)
  wood.priceMultiplier = categoryMultiplier(
    { ...result, marketState: { ...marketState, wood } },
    'wood'
  )
  marketState.wood = wood

  const leather = { ...getCategoryState(result, 'leather') }
  leather.longTermSold += gold * 0.05
  leather.priceMultiplier = categoryMultiplier(
    { ...result, marketState: { ...marketState, leather } },
    'leather'
  )
  marketState.leather = leather

  const consumables = { ...getCategoryState(result, 'consumables') }
  consumables.longTermSold += gold * 0.08
  consumables.priceMultiplier = categoryMultiplier(
    { ...result, marketState: { ...marketState, consumables } },
    'consumables'
  )
  marketState.consumables = consumables

  return { ...result, marketState }
}
