/** Emoji icon map for compact UI labels */

export const resourceIcons = {
  hp: '❤️',
  energy: '⚡',
  stamina: '🏃',
  gold: '🪙',
} as const

export const statIcons = {
  strength: '💪',
  constitution: '🫀',
  dexterity: '🎯',
  agility: '💨',
  defense: '🛡️',
} as const

export const statDescriptions: Record<keyof typeof statIcons, string> = {
  strength: 'Attack damage dealt in combat.',
  constitution: 'Max HP — each point adds 3 HP.',
  dexterity: 'Raises your critical hit chance and accuracy (hit chance).',
  agility: 'Raises evasion (chance enemies miss you), turn order, and extra-action chance.',
  defense: 'Damage reduction from enemy attacks.',
}

export const materialIcons: Record<string, string> = {
  oak_wood: '🪵',
  wolf_pelt: '🐺',
  canine_tooth: '🦷',
  boar_hide: '🐗',
  boar_tusk: '🦴',
  spider_silk: '🕸️',
  spider_fang: '🕷️',
  bat_wing: '🦇',
  crystal_sliver: '💎',
  troll_tusk: '🦣',
  tarnished_coin: '🪙',
  cloth_scrap: '🧵',
  corrupted_sap: '🧪',
  iron_ore: '⛏️',
}

export function materialIcon(id: string): string {
  return materialIcons[id] ?? '📦'
}

import type { ItemTemplate } from '@/engine/GameLoopDesign'

const consumableEffectLabels: Record<string, string> = {
  heal_health: `${resourceIcons.hp} HP`,
  restore_energy: `${resourceIcons.energy} Energy`,
  remove_poison: 'Cure Poison',
}

/** Human-readable stat summary for an item, with icons. Empty string if no notable stats. */
export function itemStatSummary(template: ItemTemplate | undefined): string {
  if (!template) return ''
  const parts: string[] = []

  if (template.type === 'weapon' && template.damageBonus) {
    parts.push(`${statIcons.strength} +${template.damageBonus} ATK`)
  }
  if (template.type === 'armor' && template.defenseBonus) {
    parts.push(`${statIcons.defense} +${template.defenseBonus} DEF`)
  }

  if (template.statBonus) {
    for (const [stat, value] of Object.entries(template.statBonus)) {
      if (!value) continue
      const icon = statIcons[stat as keyof typeof statIcons] ?? ''
      const abbr = stat.slice(0, 3).toUpperCase()
      parts.push(`${icon} ${value > 0 ? '+' : ''}${value} ${abbr}`)
    }
  }

  if (template.type === 'consumable' && template.effect) {
    const label = consumableEffectLabels[template.effect] ?? template.effect.replace(/_/g, ' ')
    parts.push(template.power ? `+${template.power} ${label}` : label)
  }

  return parts.join('  ')
}
