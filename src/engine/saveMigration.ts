/**
 * Save version migrations — incremental upgrades without wiping player progress.
 */

import type { EquipmentRef, EquipmentSlots, InventoryItem, Player } from './GameLoopDesign'
import { DEFAULT_QUALITY, normalizeQuality } from './Quality'
import { computeMigrationTrainingState } from './ProfessionTraining'
import { getAllRecipes } from './CraftingSystem'
import {
  normalizePurchasedRecipes,
  normalizeUnlockedProfessionTiers,
} from './ProfessionTraining'

type LegacyEquipmentSlot = string | EquipmentRef | undefined

interface LegacyPlayer extends Omit<Player, 'equipment' | 'inventory'> {
  inventory?: Array<Partial<InventoryItem> & { templateId: string; quantity: number }>
  equipment?: {
    weapon?: LegacyEquipmentSlot
    armor?: LegacyEquipmentSlot
  }
}

function migrateEquipmentRef(value: LegacyEquipmentSlot): EquipmentRef | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'string') {
    return { templateId: value, quality: DEFAULT_QUALITY }
  }
  if (typeof value === 'object' && 'templateId' in value) {
    return {
      templateId: value.templateId,
      quality: normalizeQuality(value.quality),
    }
  }
  return undefined
}

function migrateEquipment(equipment: LegacyPlayer['equipment']): EquipmentSlots {
  return {
    weapon: migrateEquipmentRef(equipment?.weapon),
    armor: migrateEquipmentRef(equipment?.armor),
  }
}

function migrateInventoryItem(
  raw: Partial<InventoryItem> & { templateId: string; quantity: number }
): InventoryItem {
  return {
    templateId: raw.templateId,
    quantity: raw.quantity,
    quality: normalizeQuality(raw.quality),
  }
}

/** v5 → v6: per-instance quality on inventory and equipment refs. */
export function migrateSaveV6(parsed: LegacyPlayer & Record<string, unknown>): {
  player: Player
} {
  const inventory = (parsed.inventory ?? []).map(migrateInventoryItem)
  const equipment = migrateEquipment(parsed.equipment)

  const player: Player = {
    ...(parsed as Player),
    inventory,
    equipment,
  }

  return { player }
}

/** v7 → boss respawn timers; backfill from zonesCleared for in-progress saves. */
export function migrateSaveV7(parsed: Record<string, unknown>): {
  bossClearedDay: Record<string, number>
} {
  const bossClearedDay: Record<string, number> = {
    ...((parsed.bossClearedDay as Record<string, number> | undefined) ?? {}),
  }
  const day = (parsed.day as number | undefined) ?? 1
  for (const zone of (parsed.zonesCleared as string[] | undefined) ?? []) {
    if (bossClearedDay[zone] === undefined) {
      bossClearedDay[zone] = day
    }
  }
  return { bossClearedDay }
}

/** v8 → profession tier + recipe purchase gates; preserve legacy craft access. */
export function migrateSaveV8(parsed: Record<string, unknown>): {
  unlockedProfessionTiers: Player['unlockedProfessionTiers']
  purchasedRecipes: Player['purchasedRecipes']
} {
  const player = parsed.player as Player | undefined
  if (player?.purchasedRecipes !== undefined && player?.unlockedProfessionTiers !== undefined) {
    return {
      unlockedProfessionTiers: normalizeUnlockedProfessionTiers(player),
      purchasedRecipes: normalizePurchasedRecipes(player),
    }
  }

  const flags = (parsed.flags as Record<string, boolean> | undefined) ?? {}
  const townBuildings = (parsed.townBuildings as Record<string, number> | undefined) ?? {}
  return computeMigrationTrainingState(flags, townBuildings, getAllRecipes())
}

/** v9 → drop legacy skillPoints; knownSkills preserved. */
export function migrateSaveV9(parsed: Record<string, unknown>): { player: Player } {
  const raw = (parsed.player ?? {}) as Player & { skillPoints?: number }
  const { skillPoints: _dropped, ...rest } = raw
  return { player: rest as Player }
}

export function migrateParsedSave(
  parsed: Record<string, unknown>,
  fromVersion: number
): Record<string, unknown> {
  let current = { ...parsed }

  if (fromVersion < 6) {
    const migrated = migrateSaveV6(current as LegacyPlayer & Record<string, unknown>)
    current = { ...current, player: migrated.player }
  }

  if (fromVersion < 7) {
    const migrated = migrateSaveV7(current)
    current = { ...current, bossClearedDay: migrated.bossClearedDay }
  }

  if (fromVersion < 8) {
    const migrated = migrateSaveV8(current)
    const player = (current.player ?? {}) as Player
    current = {
      ...current,
      player: {
        ...player,
        unlockedProfessionTiers: migrated.unlockedProfessionTiers,
        purchasedRecipes: migrated.purchasedRecipes,
      },
    }
  }

  if (fromVersion < 9) {
    const migrated = migrateSaveV9(current)
    current = { ...current, player: migrated.player }
  }

  return current
}
