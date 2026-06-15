/**
 * Profession system — data model and XP/leveling (gathering & crafting).
 * Gathering/crafting actions are added in later prompts.
 */

import type { Player } from './GameLoopDesign'

// --- Tunable placeholders for playtest tuning ---

/** Max profession level (placeholder — tune during playtest). */
export const MAX_PROFESSION_LEVEL = 10

/** Starting profession level for new characters. */
export const MIN_PROFESSION_LEVEL = 1

/**
 * Cumulative XP required to reach each profession level (placeholder — tune during playtest).
 * Mirrors combat LEVEL_XP_REQUIREMENTS: level 1 starts at 0 XP total.
 */
export const PROFESSION_LEVEL_XP_REQUIREMENTS: Record<number, number> = {
  1: 0,
  2: 50,
  3: 120,
  4: 210,
  5: 330,
  6: 480,
  7: 660,
  8: 870,
  9: 1110,
  10: 1380,
}

// --- Types & registry ---

export type ProfessionId =
  | 'forestry'
  | 'mining'
  | 'herbalism'
  | 'farming_fishing'
  | 'smithing'
  | 'fletching'
  | 'alchemy'

export type ProfessionCategory = 'gathering' | 'crafting'

export interface ProfessionState {
  xp: number
  level: number
}

export interface ProfessionDef {
  id: ProfessionId
  name: string
  category: ProfessionCategory
  description: string
}

export const PROFESSIONS: Record<ProfessionId, ProfessionDef> = {
  forestry: {
    id: 'forestry',
    name: 'Forestry',
    category: 'gathering',
    description: 'Harvest wood and forest materials.',
  },
  mining: {
    id: 'mining',
    name: 'Mining',
    category: 'gathering',
    description: 'Extract ore and stone from deposits.',
  },
  herbalism: {
    id: 'herbalism',
    name: 'Herbalism',
    category: 'gathering',
    description: 'Gather herbs and natural reagents.',
  },
  farming_fishing: {
    id: 'farming_fishing',
    name: 'Farming & Fishing',
    category: 'gathering',
    description: 'Grow crops and catch fish.',
  },
  smithing: {
    id: 'smithing',
    name: 'Smithing',
    category: 'crafting',
    description: 'Forge weapons, armor, and metal goods.',
  },
  fletching: {
    id: 'fletching',
    name: 'Fletching',
    category: 'crafting',
    description: 'Craft bows, arrows, and wooden gear.',
  },
  alchemy: {
    id: 'alchemy',
    name: 'Alchemy',
    category: 'crafting',
    description: 'Brew potions and alchemical items.',
  },
}

export const PROFESSION_IDS: ProfessionId[] = Object.keys(PROFESSIONS) as ProfessionId[]

export const GATHERING_PROFESSION_IDS: ProfessionId[] = PROFESSION_IDS.filter(
  (id) => PROFESSIONS[id].category === 'gathering'
)

export const CRAFTING_PROFESSION_IDS: ProfessionId[] = PROFESSION_IDS.filter(
  (id) => PROFESSIONS[id].category === 'crafting'
)

// --- XP & leveling ---

/** Cumulative XP required to reach `level` (same semantics as combat LEVEL_XP_REQUIREMENTS). */
export function xpForLevel(level: number): number {
  if (level <= MIN_PROFESSION_LEVEL) return PROFESSION_LEVEL_XP_REQUIREMENTS[MIN_PROFESSION_LEVEL] ?? 0
  if (level >= MAX_PROFESSION_LEVEL) {
    return PROFESSION_LEVEL_XP_REQUIREMENTS[MAX_PROFESSION_LEVEL] ?? Infinity
  }
  return PROFESSION_LEVEL_XP_REQUIREMENTS[level] ?? Infinity
}

export function getXpForNextProfessionLevel(level: number): number {
  if (level >= MAX_PROFESSION_LEVEL) return Infinity
  const nextLevel = Math.min(level + 1, MAX_PROFESSION_LEVEL)
  return PROFESSION_LEVEL_XP_REQUIREMENTS[nextLevel] ?? Infinity
}

export function checkProfessionLevelUp(currentLevel: number, currentXp: number): number {
  if (currentLevel >= MAX_PROFESSION_LEVEL) return MAX_PROFESSION_LEVEL
  let newLevel = currentLevel
  while (newLevel < MAX_PROFESSION_LEVEL) {
    const nextLevelXp = PROFESSION_LEVEL_XP_REQUIREMENTS[newLevel + 1]
    if (nextLevelXp !== undefined && currentXp >= nextLevelXp) {
      newLevel++
    } else {
      break
    }
  }
  return newLevel
}

export function createDefaultProfessions(): Record<ProfessionId, ProfessionState> {
  const professions = {} as Record<ProfessionId, ProfessionState>
  for (const id of PROFESSION_IDS) {
    professions[id] = { xp: 0, level: MIN_PROFESSION_LEVEL }
  }
  return professions
}

/** Fill missing professions on legacy saves; preserve existing entries. */
export function normalizePlayerProfessions(
  player: Pick<Player, 'professions'> | { professions?: Partial<Record<ProfessionId, ProfessionState>> }
): Record<ProfessionId, ProfessionState> {
  const defaults = createDefaultProfessions()
  const existing = player.professions ?? {}
  const normalized = { ...defaults }
  for (const id of PROFESSION_IDS) {
    const state = existing[id]
    if (state) {
      normalized[id] = {
        xp: state.xp ?? 0,
        level: Math.min(MAX_PROFESSION_LEVEL, Math.max(MIN_PROFESSION_LEVEL, state.level ?? MIN_PROFESSION_LEVEL)),
      }
    }
  }
  return normalized
}

export function getProfessionLevel(player: Player, professionId: ProfessionId): number {
  return player.professions[professionId]?.level ?? MIN_PROFESSION_LEVEL
}

export interface GrantProfessionXpResult {
  player: Player
  leveledUp: boolean
  newLevel: number
  xpGained: number
}

export function grantProfessionXp(
  player: Player,
  professionId: ProfessionId,
  amount: number
): GrantProfessionXpResult {
  if (amount <= 0) {
    return {
      player,
      leveledUp: false,
      newLevel: getProfessionLevel(player, professionId),
      xpGained: 0,
    }
  }

  const current = player.professions[professionId] ?? {
    xp: 0,
    level: MIN_PROFESSION_LEVEL,
  }
  const oldLevel = current.level

  if (oldLevel >= MAX_PROFESSION_LEVEL) {
    return {
      player,
      leveledUp: false,
      newLevel: MAX_PROFESSION_LEVEL,
      xpGained: 0,
    }
  }

  const newXp = current.xp + amount
  const newLevel = checkProfessionLevelUp(oldLevel, newXp)

  return {
    player: {
      ...player,
      professions: {
        ...player.professions,
        [professionId]: { xp: newXp, level: newLevel },
      },
    },
    leveledUp: newLevel > oldLevel,
    newLevel,
    xpGained: amount,
  }
}
