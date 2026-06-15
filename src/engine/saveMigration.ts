/**
 * Save version migrations — incremental upgrades without wiping player progress.
 */

import type { EquipmentRef, EquipmentSlots, GameState, InventoryItem, Player } from './GameLoopDesign'
import { DEFAULT_QUALITY, normalizeQuality } from './Quality'

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

export function migrateParsedSave(
  parsed: Record<string, unknown>,
  fromVersion: number
): Record<string, unknown> {
  let current = { ...parsed }

  if (fromVersion < 6) {
    const migrated = migrateSaveV6(current as LegacyPlayer & Record<string, unknown>)
    current = { ...current, player: migrated.player }
  }

  return current
}
