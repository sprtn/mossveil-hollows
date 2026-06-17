/**
 * NPC hub section resolution — testable logic for people-first town UI.
 */

import type { GameState } from './GameLoopDesign'
import type { NpcDef } from './ContentSchemas'
import { getRecipeCatalogForNpc } from './CraftingSystem'
import { getNpc } from './NpcData'
import { PROFESSIONS } from './Professions'
import { getTrainerProfession } from './ProfessionTraining'
import { getAvailableVendors } from './VendorSystem'

export type HubSection =
  | 'talk'
  | 'heal'
  | 'craft'
  | 'shop'
  | 'train'
  | 'profession_train'

export const NPC_PORTRAIT_PLACEHOLDER = '/images/npcs/_placeholder.png'

export function getNpcPortraitSrc(npc: NpcDef): string {
  return npc.portrait ?? `/images/npcs/${npc.id}.png`
}

export function isNpcShopAvailable(npcId: string, state: GameState): boolean {
  return getAvailableVendors(state).includes(npcId)
}

export function getNpcDisplayProfession(npc: NpcDef): string {
  if (npc.profession) {
    return PROFESSIONS[npc.profession]?.name ?? npc.role
  }
  return npc.role
}

export function getNpcHubSections(npcId: string, state: GameState): HubSection[] {
  const npc = getNpc(npcId)
  if (!npc) return []

  const sections: HubSection[] = ['talk']

  if (npc.services?.includes('healer')) {
    sections.push('heal')
  }

  const hasCraftService = npc.services?.includes('crafting')
  const hasRecipes = getRecipeCatalogForNpc(state, npcId).length > 0
  if (hasCraftService || hasRecipes) {
    sections.push('craft')
  }

  if (npc.services?.includes('shop')) {
    sections.push('shop')
  }

  if (npc.services?.includes('training')) {
    sections.push('train')
  }

  if (npc.services?.includes('profession_training') || getTrainerProfession(npcId)) {
    sections.push('profession_train')
  }

  return sections
}

export function getNpcOfferingHints(npcId: string, state: GameState): string[] {
  const npc = getNpc(npcId)
  if (!npc) return []

  const hints: string[] = []
  const sections = getNpcHubSections(npcId, state)

  if (sections.includes('heal')) hints.push('Heal')

  if (sections.includes('craft')) {
    hints.push(npc.profession ? (PROFESSIONS[npc.profession]?.name ?? 'Craft') : 'Craft')
  }

  if (sections.includes('shop')) {
    hints.push(
      isNpcShopAvailable(npcId, state) ? 'Shop' : 'Shop (needs workbench)'
    )
  }

  if (sections.includes('train')) hints.push('Training')

  if (sections.includes('profession_train')) {
    const prof = getTrainerProfession(npcId)
    hints.push(prof ? (PROFESSIONS[prof]?.name ?? 'Recipes') : 'Recipes')
  }

  return hints
}

export function resolvePendingHubNavigation(pending: {
  panel: 'train' | 'craft' | 'shop' | 'profession_train'
  npcId: string
}): { selectedNpcId: string; focusSection: HubSection } {
  return {
    selectedNpcId: pending.npcId,
    focusSection: pending.panel,
  }
}

/** Town-level features — never returned by getNpcHubSections. */
export const TOWN_LEVEL_FEATURES = [
  'rest',
  'inn',
  'sleep_home',
  'save',
  'market',
  'buildings',
  'quests',
] as const
