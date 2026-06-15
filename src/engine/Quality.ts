/**
 * Item quality tiers — per-instance variation on shared templates.
 *
 * Sockets (Superior+ grant socket slots) are reserved for a future pass;
 * do not implement socket logic here.
 */

export type Quality =
  | 'trash'
  | 'poor'
  | 'common'
  | 'fine'
  | 'superior'
  | 'masterwork'
  | 'unique'

export const DEFAULT_QUALITY: Quality = 'common'

export const QUALITY_ORDER: Quality[] = [
  'trash',
  'poor',
  'common',
  'fine',
  'superior',
  'masterwork',
  'unique',
]

export interface QualityTierDef {
  id: Quality
  label: string
  order: number
  /** Multiplier on template stat bonuses (damage, defense, statBonus, consumable power). */
  statMultiplier: number
  /** Multiplier on buy/sell base price. */
  priceMultiplier: number
  color: string
  /** Future: Superior+ items may roll socket slots. Not implemented yet. */
  socketSlots?: number
}

/** Playtest placeholders — tune after crafting/loot feel is in-game. */
export const QUALITY_TIERS: Record<Quality, QualityTierDef> = {
  trash: {
    id: 'trash',
    label: 'Trash',
    order: 0,
    statMultiplier: 0.6,
    priceMultiplier: 0.5,
    color: '#6b6b6b',
  },
  poor: {
    id: 'poor',
    label: 'Poor',
    order: 1,
    statMultiplier: 0.8,
    priceMultiplier: 0.75,
    color: '#9e9e9e',
  },
  common: {
    id: 'common',
    label: 'Common',
    order: 2,
    statMultiplier: 1.0,
    priceMultiplier: 1.0,
    color: '#e0e0e0',
  },
  fine: {
    id: 'fine',
    label: 'Fine',
    order: 3,
    statMultiplier: 1.25,
    priceMultiplier: 1.2,
    color: '#4caf50',
  },
  superior: {
    id: 'superior',
    label: 'Superior',
    order: 4,
    statMultiplier: 1.5,
    priceMultiplier: 1.45,
    color: '#42a5f5',
    socketSlots: 1,
  },
  masterwork: {
    id: 'masterwork',
    label: 'Masterwork',
    order: 5,
    statMultiplier: 1.75,
    priceMultiplier: 1.75,
    color: '#ab47bc',
    socketSlots: 2,
  },
  unique: {
    id: 'unique',
    label: 'Unique',
    order: 6,
    statMultiplier: 2.0,
    priceMultiplier: 2.25,
    color: '#ffb74d',
    socketSlots: 3,
  },
}

/** Minimum scaled stat bonus when template base is non-zero (avoids +1 → 0). */
export const QUALITY_STAT_MIN_FLOOR = 1

export function getQualityTier(quality: Quality = DEFAULT_QUALITY): QualityTierDef {
  return QUALITY_TIERS[quality] ?? QUALITY_TIERS.common
}

export function compareQuality(a: Quality, b: Quality): number {
  return getQualityTier(a).order - getQualityTier(b).order
}

/**
 * Scale a template stat bonus by quality. Zero base stays zero.
 * Non-zero bases floor at QUALITY_STAT_MIN_FLOOR after scaling.
 */
export function applyQualityToStat(base: number, quality: Quality = DEFAULT_QUALITY): number {
  if (base === 0) return 0
  const scaled = base * getQualityTier(quality).statMultiplier
  const rounded = Math.round(scaled)
  if (base > 0) return Math.max(QUALITY_STAT_MIN_FLOOR, rounded)
  if (base < 0) return Math.min(-QUALITY_STAT_MIN_FLOOR, rounded)
  return 0
}

export function applyQualityToPrice(base: number, quality: Quality = DEFAULT_QUALITY): number {
  if (base === 0) return 0
  return Math.max(1, Math.round(base * getQualityTier(quality).priceMultiplier))
}

export function normalizeQuality(value: unknown): Quality {
  if (typeof value === 'string' && value in QUALITY_TIERS) {
    return value as Quality
  }
  return DEFAULT_QUALITY
}

export function inventoryStackKey(templateId: string, quality: Quality = DEFAULT_QUALITY): string {
  return `${templateId}::${quality}`
}

export function parseInventoryStackKey(key: string): { templateId: string; quality: Quality } {
  const sep = key.indexOf('::')
  if (sep === -1) return { templateId: key, quality: DEFAULT_QUALITY }
  return {
    templateId: key.slice(0, sep),
    quality: normalizeQuality(key.slice(sep + 2)),
  }
}
