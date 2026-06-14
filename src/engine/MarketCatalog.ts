/**
 * Market category mapping and tuning constants.
 */

export type MarketCategory =
  | 'wood'
  | 'wood_products'
  | 'iron'
  | 'iron_products'
  | 'leather'
  | 'consumables'

export const MARKET_CATEGORIES: MarketCategory[] = [
  'wood',
  'wood_products',
  'iron',
  'iron_products',
  'leather',
  'consumables',
]

/** Item/material templateId → market category */
export const ITEM_MARKET_CATEGORY: Record<string, MarketCategory> = {
  oak_wood: 'wood',
  oak_spear: 'wood_products',
  wooden_stake: 'wood_products',
  iron_ore: 'iron',
  rusty_shortsword: 'iron_products',
  iron_sword: 'iron_products',
  steel_sword: 'iron_products',
  iron_plate_armor: 'iron_products',
  worn_tunic: 'leather',
  leather_armor: 'leather',
  hide_jerkin: 'leather',
  wolf_cloak: 'leather',
  wolf_pelt: 'leather',
  boar_hide: 'leather',
  spider_silk: 'leather',
  cloth_scrap: 'leather',
  health_potion: 'consumables',
  antidote: 'consumables',
  mana_potion: 'consumables',
  cleansing_draught: 'consumables',
}

export const MARKET_TUNING = {
  priceMin: 0.4,
  priceMax: 2.5,
  burstThreshold: 3,
  burstPenaltyPerUnit: 0.15,
  longTermBonusPerUnit: 0.03,
  longTermBonusCap: 0.5,
  shortDecayPerDay: 0.5,
  longDecayPerDay: 0.02,
  ironSupplyThreshold: 5,
  freightMarkupMax: 1.8,
  freightMarkupMin: 1.0,
  localSupplyPerSell: 1,
  localSupplyPerMaterialSell: 0.5,
  buyMarkup: 1.8,
}

export const VENDOR_XP_THRESHOLDS = [0, 50, 150, 400] as const

export const VENDOR_TIER_BUY_DISCOUNT = [0, 0.03, 0.06, 0.1] as const
export const VENDOR_TIER_SELL_BONUS = [0, 0.03, 0.06, 0.1] as const

export const VENDOR_IDS = ['sera_quartermaster', 'garrick_smith'] as const
export type VendorId = (typeof VENDOR_IDS)[number]

export function getItemCategory(templateId: string): MarketCategory | undefined {
  return ITEM_MARKET_CATEGORY[templateId]
}

export function vendorAcceptsItem(vendorId: string, templateId: string): boolean {
  const category = getItemCategory(templateId)
  if (!category) return false
  if (vendorId === 'sera_quartermaster') {
    return ['consumables', 'leather', 'iron_products', 'wood_products'].includes(category)
      || templateId === 'worn_tunic'
  }
  if (vendorId === 'garrick_smith') {
    return ['wood_products', 'iron_products', 'iron', 'wood'].includes(category)
  }
  return false
}
