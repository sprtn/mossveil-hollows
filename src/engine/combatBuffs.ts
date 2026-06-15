/**
 * Combat buffs — conditional effects from consumables and skills.
 */

import type { CombatBuff, Encounter } from './GameLoopDesign'
import type { ItemTemplate } from './GameLoopDesign'
import { scaledConsumablePower } from './ItemDatabase'
import { DEFAULT_QUALITY, type Quality } from './Quality'

export function createCombatBuffFromItem(
  template: ItemTemplate,
  quality: Quality = DEFAULT_QUALITY
): CombatBuff | null {
  if (template.effect === 'boost_damage') {
    const pct = scaledConsumablePower(template, quality)
    return {
      id: `buff_${template.id}_${quality}`,
      label: `+${pct}% next attack`,
      damageMultiplier: 1 + pct / 100,
      sourceItemId: template.id,
    }
  }
  return null
}

/** Consume the first pending damage multiplier buff (one attack). */
export function consumeDamageMultiplier(encounter: Encounter): {
  multiplier: number
  encounter: Encounter
} {
  const buffs = encounter.combatBuffs ?? []
  let multiplier = 1
  let consumed = false
  const remaining: CombatBuff[] = []

  for (const buff of buffs) {
    if (!consumed && buff.damageMultiplier && buff.damageMultiplier > 1) {
      multiplier *= buff.damageMultiplier
      consumed = true
    } else {
      remaining.push(buff)
    }
  }

  return {
    multiplier,
    encounter: { ...encounter, combatBuffs: remaining },
  }
}

export function addCombatBuff(encounter: Encounter, buff: CombatBuff): Encounter {
  return {
    ...encounter,
    combatBuffs: [...(encounter.combatBuffs ?? []), buff],
  }
}
