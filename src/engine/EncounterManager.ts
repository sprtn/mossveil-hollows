/**
 * Encounter Manager - Loads encounters and manages resolution
 */

import type {
  EncounterDef,
  RandomEncounterTable,
  StaticEncounter,
  CombatEncounter,
  DialogueEncounter,
  LootEncounter,
  StatusEffectEncounter,
  EncounterResolution,
  EnemyTemplate,
} from './EncounterSystem'
import { EncounterRNG } from './EncounterSystem'
import type { GameState, InventoryItem } from './GameLoopDesign'

/**
 * Load a static encounter JSON
 */
export async function loadStaticEncounter(encounterId: string): Promise<StaticEncounter> {
  const module = await import(`../assets/encounters/static/${encounterId}.json`)
  return module.default as StaticEncounter
}

/**
 * Load a random encounter table JSON
 */
export async function loadRandomEncounterTable(tableId: string): Promise<RandomEncounterTable> {
  const module = await import(`../assets/encounters/tables/${tableId}.json`)
  return module.default as RandomEncounterTable
}

/**
 * Get all random encounter tables for a specific biome/region
 */
export async function loadEncounterTables(_biome: string): Promise<RandomEncounterTable[]> {
  // In practice, this would load all tables for a biome
  // For now, return empty array (tables loaded on-demand)
  return []
}

/**
 * Trigger an encounter (select from random table or use static)
 */
export function triggerEncounter(
  encounterDef: EncounterDef,
  roomDifficulty: number,
  _seed: number
): CombatEncounter | null {
  if (encounterDef.combat) {
    const combat = encounterDef.combat
    const scalingFactor = 1 + roomDifficulty * (combat.scaling || 0.5) * 0.1

    // Scale enemy stats by room difficulty
    const scaledEnemies = combat.enemies.map((template) => {
      const groupSize = EncounterRNG.scaleGroupSize(
        template,
        roomDifficulty,
        combat.scaling || 0.5
      )

      // Generate enemy group
      const enemies: Array<EnemyTemplate & { currentHp: number }> = []
      for (let i = 0; i < groupSize; i++) {
        enemies.push({
          ...template,
          id: `${template.id}_${i}`,
          currentHp: Math.ceil(template.hp * scalingFactor),
          baseStrength: Math.ceil(template.baseStrength * scalingFactor),
          baseDefense: Math.ceil(template.baseDefense * (0.8 + roomDifficulty * 0.1)),
        })
      }

      return enemies
    })

    return {
      enemies: scaledEnemies.flat(),
      scaling: combat.scaling || 0.5,
    }
  }

  return null
}

/**
 * Resolve combat encounter into game state changes
 */
export function resolveCombatEncounter(
  outcome: 'win' | 'loss' | 'fled',
  lootTables: EnemyTemplate[],
  roomDifficulty: number,
  seed: number = Date.now() // Default to timestamp for backward compatibility, but should be provided
): EncounterResolution {
  let goldEarned = 0
  let itemsLooted: string[] = []
  let experienceEarned = 0

  if (outcome === 'win') {
    const rng = new SeededRandom(seed)

    // Calculate rewards based on defeated enemies
    for (const enemy of lootTables) {
      goldEarned += Math.ceil(enemy.baseStrength * 2) + roomDifficulty * 5
      experienceEarned += 10 + roomDifficulty * 5

      // Generate loot drops using weighted selection (deterministic)
      if (enemy.loot && enemy.loot.length > 0) {
        // Use weighted selection similar to resolveLootEncounter
        const totalWeight = enemy.loot.reduce((sum, drop) => sum + drop.weight, 0)
        if (totalWeight > 0) {
          let roll = rng.next() * totalWeight
          for (const drop of enemy.loot) {
            roll -= drop.weight
            if (roll <= 0) {
              // Add the selected item (with quantity if specified)
              const quantity = drop.quantity || 1
              for (let i = 0; i < quantity; i++) {
                itemsLooted.push(drop.id)
              }
              break // Only one drop per enemy
            }
          }
        }
      }
    }
  } else if (outcome === 'fled') {
    experienceEarned = Math.ceil((10 + roomDifficulty * 5) * 0.25) // 25% of victory xp
  }

  return {
    victoryType: outcome === 'win' ? 'combat_win' : outcome === 'fled' ? 'fled' : 'combat_loss',
    goldEarned,
    itemsLooted,
    experienceEarned,
    statusEffectsApplied: [],
  }
}

/**
 * Resolve dialogue encounter
 */
export function resolveDialogueEncounter(
  dialogue: DialogueEncounter,
  chosenLineIndex: number
): EncounterResolution {
  // Find which choice was made
  const line = dialogue.lines[chosenLineIndex]
  if (!line) {
    return {
      victoryType: 'dialogue_complete',
      goldEarned: 0,
      itemsLooted: [],
      experienceEarned: 5,
      statusEffectsApplied: [],
    }
  }

  return {
    victoryType: 'dialogue_complete',
    goldEarned: 0,
    itemsLooted: [],
    experienceEarned: 5, // Small XP for dialogue
    statusEffectsApplied: [],
  }
}

/**
 * Resolve loot encounter (open chest, find items)
 */
export function resolveLootEncounter(
  loot: LootEncounter,
  seed: number
): EncounterResolution {
  const rng = new SeededRandom(seed)

  const items: string[] = []
  const numItems = rng.nextInRange(loot.minItems || 1, loot.maxItems || 3)

  // Pick random items from loot table
  for (let i = 0; i < numItems && loot.items.length > 0; i++) {
    // Weighted selection (similar to encounter selection)
    const totalWeight = loot.items.reduce((sum, item) => sum + item.weight, 0)
    let roll = rng.next() * totalWeight
    for (const item of loot.items) {
      roll -= item.weight
      if (roll <= 0) {
        items.push(item.id)
        break
      }
    }
  }

  return {
    victoryType: 'event_triggered',
    goldEarned: loot.gold || 0,
    itemsLooted: items,
    experienceEarned: 0,
    statusEffectsApplied: [],
  }
}

/**
 * Resolve status effect encounter (trap, blessing, etc.)
 */
export function resolveStatusEffectEncounter(
  effect: StatusEffectEncounter
): EncounterResolution {
  return {
    victoryType: 'event_triggered',
    goldEarned: 0,
    itemsLooted: [],
    experienceEarned: 0,
    statusEffectsApplied: [
      {
        effect: effect.effect,
        severity: effect.severity,
        duration: effect.duration,
      },
    ],
  }
}

/**
 * Apply encounter resolution to game state
 */
export function applyEncounterResolution(
  state: GameState,
  resolution: EncounterResolution
): GameState {
  let newState = { ...state }

  // Add looted items to inventory
  const currentInventory = [...(newState.player.inventory || [])]
  for (const itemId of resolution.itemsLooted) {
    // Check if item already exists in inventory
    const existingItem = currentInventory.find((item) => item.id === itemId)
    if (existingItem) {
      existingItem.quantity += 1
    } else {
      // Create new inventory item
      const newItem: InventoryItem = {
        id: itemId,
        type: 'consumable', // Default type
        name: itemId, // Would be populated from item database in real game
        quantity: 1,
      }
      currentInventory.push(newItem)
    }
  }

  newState.player = {
    ...newState.player,
    inventory: currentInventory,
  }

  // Award gold and experience are applied in GameLoop
  // Status effects would be applied separately

  return newState
}

/**
 * Seeded random number generator (local copy)
 */
class SeededRandom {
  seed: number

  constructor(seed: number) {
    this.seed = seed
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280
    return this.seed / 233280
  }

  nextInt(max: number): number {
    return Math.floor(this.next() * max)
  }

  nextInRange(min: number, max: number): number {
    return min + this.nextInt(Math.max(0, max - min + 1))
  }
}
