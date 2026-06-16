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
  strength: 'Strength — damage dealt with weapons and skills.',
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
  stone: '🪨',
  green_herb: '🌿',
  moonshade_herb: '🌙',
  raw_fish: '🐟',
  fresh_produce: '🥬',
}

export function materialIcon(id: string): string {
  return materialIcons[id] ?? '📦'
}

import type { ItemTemplate } from '@/engine/GameLoopDesign'
import { applyQualityToStat, DEFAULT_QUALITY, getQualityTier, type Quality } from '@/engine/Quality'

const consumableEffectLabels: Record<string, string> = {
  heal_health: `${resourceIcons.hp} HP`,
  restore_energy: `${resourceIcons.energy} Energy`,
  remove_poison: 'Cure Poison',
}

export function qualityLabel(quality: Quality = DEFAULT_QUALITY): string {
  return getQualityTier(quality).label
}

export function qualityColor(quality: Quality = DEFAULT_QUALITY): string {
  return getQualityTier(quality).color
}

export function formatItemName(
  name: string,
  quality: Quality = DEFAULT_QUALITY
): string {
  if (quality === DEFAULT_QUALITY) return name
  return `${name} (${qualityLabel(quality)})`
}

/** Human-readable stat summary for an item at a given quality, with icons. */
export function itemStatSummary(
  template: ItemTemplate | undefined,
  quality: Quality = DEFAULT_QUALITY
): string {
  if (!template) return ''
  const parts: string[] = []

  if (template.type === 'weapon' && template.damageBonus) {
    const val = applyQualityToStat(template.damageBonus, quality)
    parts.push(`${statIcons.strength} +${val} Strength`)
  }
  if (template.type === 'armor' && template.defenseBonus) {
    const val = applyQualityToStat(template.defenseBonus, quality)
    parts.push(`${statIcons.defense} +${val} DEF`)
  }

  if (template.statBonus) {
    const statNames: Record<string, string> = {
      strength: 'Strength',
      constitution: 'Constitution',
      dexterity: 'Dexterity',
      agility: 'Agility',
      defense: 'Defense',
    }
    for (const [stat, value] of Object.entries(template.statBonus)) {
      if (!value) continue
      const scaled = applyQualityToStat(value, quality)
      if (scaled === 0) continue
      const icon = statIcons[stat as keyof typeof statIcons] ?? ''
      const name = statNames[stat] ?? stat
      parts.push(`${icon} ${scaled > 0 ? '+' : ''}${scaled} ${name}`)
    }
  }

  if (template.type === 'consumable' && template.effect) {
    if (template.effect === 'boost_damage') {
      const pct = applyQualityToStat(template.power ?? 0, quality)
      parts.push(`On use: +${pct}% next attack`)
    } else if (template.effect === 'remove_poison') {
      parts.push(consumableEffectLabels.remove_poison ?? 'Cure Poison')
    } else {
      const label = consumableEffectLabels[template.effect] ?? template.effect.replace(/_/g, ' ')
      const power = applyQualityToStat(template.power ?? 0, quality)
      parts.push(power ? `+${power} ${label}` : label)
    }
  }

  return parts.join('  ')
}
