/**
 * Town building upgrades.
 */

import type { GameState } from './GameLoopDesign'
import type { BuildingDef } from './ContentSchemas'
import { applyOutcomes } from './Outcomes'
import { hasMaterials, spendMaterials } from './Materials'

import loggingCamp from '../assets/buildings/logging_camp.json'
import workbench from '../assets/buildings/workbench.json'
import house from '../assets/buildings/house.json'

const BUILDINGS: BuildingDef[] = [
  loggingCamp as BuildingDef,
  workbench as BuildingDef,
  house as BuildingDef,
]

export function getAllBuildings(): BuildingDef[] {
  return BUILDINGS
}

export function getBuilding(id: string): BuildingDef | undefined {
  return BUILDINGS.find((b) => b.id === id)
}

export function getBuildingLevel(state: GameState, buildingId: string): number {
  return state.townBuildings?.[buildingId] ?? 0
}

export function canUpgradeBuilding(state: GameState, buildingId: string): boolean {
  const building = getBuilding(buildingId)
  if (!building) return false
  const currentLevel = getBuildingLevel(state, buildingId)
  const nextLevel = building.levels[currentLevel]
  if (!nextLevel) return false
  if (state.player.gold < nextLevel.cost.gold) return false
  return hasMaterials(state.player, nextLevel.cost.materials)
}

export function upgradeBuilding(state: GameState, buildingId: string): GameState {
  const building = getBuilding(buildingId)
  if (!building || !canUpgradeBuilding(state, buildingId)) return state

  const currentLevel = getBuildingLevel(state, buildingId)
  const levelDef = building.levels[currentLevel]!

  let player = spendMaterials(state.player, levelDef.cost.materials)
  player = { ...player, gold: player.gold - levelDef.cost.gold }

  let result: GameState = {
    ...state,
    player,
    townBuildings: {
      ...(state.townBuildings ?? {}),
      [buildingId]: currentLevel + 1,
    },
  }

  return applyOutcomes(result, levelDef.effects)
}
