/**
 * Encounter System Type Definitions
 *
 * Supports:
 * - Static encounters (scripted, story-critical)
 * - Random encounters (weighted probability tables)
 * - Outcomes: combat, dialogue, loot, status effects
 */

/**
 * Encounter result type
 */
export type EncounterOutcome = 'combat' | 'dialogue' | 'loot' | 'status_effect' | 'boss' | 'event'

/**
 * Random encounter table entry (one possible encounter)
 */
export interface RandomEncounterEntry {
  id: string
  weight: number // Probability weight (0-1 or relative, will normalize)
  encounter: EncounterDef
}

/**
 * Random encounter table (pool of possible encounters)
 */
export interface RandomEncounterTable {
  id: string
  name: string
  difficulty: number // Min difficulty to encounter this table
  entries: RandomEncounterEntry[]
}

/**
 * Static encounter definition (scripted)
 */
export interface StaticEncounter {
  id: string
  type: 'static'
  name: string
  description: string
  outcome: EncounterOutcome
  triggerChance?: 1 // Always triggers if present (optional field for clarity)
  // Outcome-specific data (discriminated union)
  combat?: CombatEncounter
  dialogue?: DialogueEncounter
  loot?: LootEncounter
  statusEffect?: StatusEffectEncounter
  event?: EventEncounter
}

/**
 * Random encounter definition (triggers by probability)
 */
export interface RandomEncounter {
  id: string
  type: 'random'
  name: string
  description: string
  triggerChance: number // 0-1 probability
  outcome: EncounterOutcome
  // Outcome-specific data
  combat?: CombatEncounter
  dialogue?: DialogueEncounter
  loot?: LootEncounter
  statusEffect?: StatusEffectEncounter
  event?: EventEncounter
}

/**
 * Union type for all encounter definitions
 */
export type EncounterDef = StaticEncounter | RandomEncounter

/**
 * Active encounter (runtime state during battle)
 */
export interface Encounter {
  id: string
  name: string
  description: string
  outcome: EncounterOutcome
  enemies: Enemy[]
  turnOrder: TurnActor[]
  currentTurnIndex: number
  isActive: boolean
}

/**
 * Combat encounter specific data
 */
export interface CombatEncounter {
  enemies: EnemyTemplate[]
  minGroupSize?: number
  maxGroupSize?: number
  scaling?: number // 0-1, how much to scale by room difficulty
}

/**
 * Dialogue encounter specific data
 */
export interface DialogueEncounter {
  npcName: string
  lines: DialogueLine[]
  onComplete?: string // Event trigger (e.g., "quest_accept", "door_unlock")
}

/**
 * Dialogue line (choice or statement)
 */
export interface DialogueLine {
  speaker: string // 'npc' or player name
  text: string
  choices?: DialogueChoice[]
  requiresItem?: string // Only show if player has item
}

/**
 * Player dialogue choice
 */
export interface DialogueChoice {
  text: string
  consequence?: string // What happens (quest_accept, combat_start, flee, etc.)
  requiresItem?: string
}

/**
 * Loot encounter specific data (treasure chest, dropped items)
 */
export interface LootEncounter {
  items: ItemDrop[]
  gold?: number
  minItems?: number
  maxItems?: number
}

/**
 * Item drop with probability
 */
export interface ItemDrop {
  id: string
  weight: number // Probability weight
  quantity?: number
}

/**
 * Status effect encounter (trap, blessing, curse)
 */
export interface StatusEffectEncounter {
  effect: string // 'poison', 'bleed', 'blessing', 'curse', etc.
  severity: number // 1-10
  description: string
  duration?: number // Turns (null = permanent)
}

/**
 * Event encounter (scripted game event)
 */
export interface EventEncounter {
  eventType: string // 'bridge_collapse', 'door_unlock', 'npc_spawn', etc.
  description: string
  consequence?: string // How it affects the game
  unlockedRoom?: string // Room ID to unlock
  requiredItem?: string // Item to consume/use
}

/**
 * Enemy template (for combat encounters)
 */
export interface EnemyTemplate {
  id: string
  name: string
  hp: number
  baseStrength: number
  baseDefense: number
  baseSpeed: number
  loot?: ItemDrop[]
  minCount?: number // Min number in group
  maxCount?: number // Max number in group
}

/**
 * Runtime enemy (actual combat participant)
 */
export interface Enemy extends EnemyTemplate {
  currentHp: number
  turnOrder?: number // Initiative (filled by triggerEncounter)
}

/**
 * Actor in turn order (player or enemy)
 */
export interface TurnActor {
  type: 'player' | 'enemy'
  id: string
  initiative: number // Speed stat + variance
}

/**
 * Encounter resolution result (outcome of combat, dialogue, etc.)
 */
export interface EncounterResolution {
  victoryType: 'combat_win' | 'combat_loss' | 'fled' | 'dialogue_complete' | 'event_triggered'
  goldEarned: number
  itemsLooted: string[]
  experienceEarned: number
  statusEffectsApplied: Array<{
    effect: string
    severity: number
    duration?: number
  }>
}

/**
 * Weighted random selector for encounters
 */
export class EncounterRNG {
  /**
   * Select encounter from random table based on weighted probabilities
   */
  static selectFromTable(table: RandomEncounterTable, seed: number): EncounterDef {
    const rng = new SeededRandom(seed)

    // Normalize weights to 0-1
    const totalWeight = table.entries.reduce((sum, e) => sum + e.weight, 0)
    const normalized = table.entries.map((e) => ({
      ...e,
      probability: e.weight / totalWeight,
    }))

    // Weighted selection
    let roll = rng.next()
    for (const entry of normalized) {
      if (roll < entry.probability) {
        return entry.encounter
      }
      roll -= entry.probability
    }

    // Fallback (shouldn't reach)
    if (table.entries.length === 0) {
      throw new Error('Cannot select from empty encounter table')
    }
    const firstEntry = table.entries[0]
    if (!firstEntry) {
      throw new Error('Cannot select from empty encounter table')
    }
    return firstEntry.encounter
  }

  /**
   * Determine if random encounter triggers
   */
  static shouldTrigger(encounter: RandomEncounter, seed: number): boolean {
    const rng = new SeededRandom(seed)
    return rng.next() < encounter.triggerChance
  }

  /**
   * Scale enemy group size by room difficulty
   */
  static scaleGroupSize(
    template: EnemyTemplate,
    difficulty: number,
    scaling: number = 0.5
  ): number {
    const min = template.minCount || 1
    const max = template.maxCount || 3
    const scaleFactor = 1 + difficulty * scaling * 0.1 // 10% per difficulty level
    const scaled = Math.round((min + max) / 2 * scaleFactor)
    return Math.min(scaled, max + Math.floor(difficulty / 3))
  }
}

/**
 * Seeded random number generator (matches RoomGenerator)
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
