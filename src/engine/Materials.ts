/**
 * Material inventory helpers (separate from item inventory).
 */

import type { Player } from './GameLoopDesign'

export function getMaterialCount(player: Player, materialId: string): number {
  return player.materials?.[materialId] ?? 0
}

export function addMaterial(player: Player, materialId: string, qty: number): Player {
  const materials = { ...(player.materials ?? {}) }
  const current = materials[materialId] ?? 0
  const next = Math.max(0, current + qty)
  if (next === 0) {
    delete materials[materialId]
  } else {
    materials[materialId] = next
  }
  return { ...player, materials }
}

export function hasMaterials(
  player: Player,
  required: Record<string, number>
): boolean {
  return Object.entries(required).every(
    ([id, qty]) => getMaterialCount(player, id) >= qty
  )
}

export function spendMaterials(
  player: Player,
  required: Record<string, number>
): Player {
  let updated = player
  for (const [id, qty] of Object.entries(required)) {
    updated = addMaterial(updated, id, -qty)
  }
  return updated
}
