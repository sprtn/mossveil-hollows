import { describe, it, expect } from 'vitest'
import {
  OUTCOME_EFFECT_META,
  OUTCOME_REQUIREMENT_META,
  makeDefaultEffect,
  makeDefaultRequirement,
} from '../../admin/outcomeFormMeta'
import type { OutcomeEffect, OutcomeRequirement } from '../../Outcomes'

const EFFECT_KINDS: OutcomeEffect['kind'][] = [
  'give_item', 'take_item', 'give_gold', 'take_gold',
  'give_material', 'take_material', 'heal', 'damage',
  'apply_status', 'set_flag', 'advance_quest', 'learn_skill',
  'unlock_area', 'clear_wounded', 'set_wounded',
  'restore_stamina', 'restore_energy', 'start_quest', 'start_combat',
  'increment_counter', 'give_vendor_xp', 'record_market_sale',
  'open_hub_panel', 'resolve_gather', 'unlock_profession_tier', 'purchase_recipe',
]

const REQUIREMENT_KINDS: OutcomeRequirement['kind'][] = [
  'has_item', 'has_material', 'has_flag', 'not_has_flag', 'has_skill',
  'stat_at_least', 'gold_at_least', 'quest_stage', 'has_active_quest',
  'not_has_quest', 'quest_completed', 'counter_at_least',
  'building_level', 'building_below', 'has_craft_orders',
  'vendor_tier_at_least', 'market_supply_at_least', 'market_supply_below',
  'area_unlocked', 'profession_at_least',
]

describe('OUTCOME_EFFECT_META', () => {
  it('has metadata for every OutcomeEffect kind', () => {
    for (const kind of EFFECT_KINDS) {
      expect(OUTCOME_EFFECT_META[kind], `missing meta for effect kind: ${kind}`).toBeDefined()
    }
  })

  it('every entry has a non-empty label', () => {
    for (const kind of EFFECT_KINDS) {
      expect(OUTCOME_EFFECT_META[kind].label.length, `empty label for effect kind: ${kind}`).toBeGreaterThan(0)
    }
  })

  it('every entry has a fields array', () => {
    for (const kind of EFFECT_KINDS) {
      expect(Array.isArray(OUTCOME_EFFECT_META[kind].fields), `fields not array for: ${kind}`).toBe(true)
    }
  })

  it('every select field has at least one option', () => {
    for (const kind of EFFECT_KINDS) {
      for (const field of OUTCOME_EFFECT_META[kind].fields) {
        if (field.type === 'select') {
          expect(
            field.options && field.options.length > 0,
            `select field ${field.key} in ${kind} has no options`
          ).toBe(true)
        }
      }
    }
  })

  it('every ref field has a refType', () => {
    for (const kind of EFFECT_KINDS) {
      for (const field of OUTCOME_EFFECT_META[kind].fields) {
        if (field.type === 'ref') {
          expect(field.refType, `ref field ${field.key} in ${kind} missing refType`).toBeDefined()
        }
      }
    }
  })
})

describe('OUTCOME_REQUIREMENT_META', () => {
  it('has metadata for every OutcomeRequirement kind', () => {
    for (const kind of REQUIREMENT_KINDS) {
      expect(OUTCOME_REQUIREMENT_META[kind], `missing meta for requirement kind: ${kind}`).toBeDefined()
    }
  })

  it('every entry has a non-empty label', () => {
    for (const kind of REQUIREMENT_KINDS) {
      expect(OUTCOME_REQUIREMENT_META[kind].label.length, `empty label for: ${kind}`).toBeGreaterThan(0)
    }
  })

  it('every select field has at least one option', () => {
    for (const kind of REQUIREMENT_KINDS) {
      for (const field of OUTCOME_REQUIREMENT_META[kind].fields) {
        if (field.type === 'select') {
          expect(
            field.options && field.options.length > 0,
            `select field ${field.key} in ${kind} has no options`
          ).toBe(true)
        }
      }
    }
  })

  it('every ref field has a refType', () => {
    for (const kind of REQUIREMENT_KINDS) {
      for (const field of OUTCOME_REQUIREMENT_META[kind].fields) {
        if (field.type === 'ref') {
          expect(field.refType, `ref field ${field.key} in ${kind} missing refType`).toBeDefined()
        }
      }
    }
  })
})

describe('makeDefaultEffect', () => {
  it('creates a valid object with correct kind for every effect kind', () => {
    for (const kind of EFFECT_KINDS) {
      const effect = makeDefaultEffect(kind)
      expect(effect.kind).toBe(kind)
    }
  })

  it('fills required number fields with 0', () => {
    const effect = makeDefaultEffect('give_gold') as { kind: string; amount: number }
    expect(effect.amount).toBe(0)
  })

  it('fills required text/ref fields with empty string', () => {
    const effect = makeDefaultEffect('give_item') as { kind: string; itemId: string; qty: number }
    expect(effect.itemId).toBe('')
    expect(effect.qty).toBe(0)
  })

  it('does not include optional fields', () => {
    const effect = makeDefaultEffect('increment_counter') as Record<string, unknown>
    expect(effect.counter).toBe('')
    expect('amount' in effect).toBe(false)
  })
})

describe('makeDefaultRequirement', () => {
  it('creates a valid object with correct kind for every requirement kind', () => {
    for (const kind of REQUIREMENT_KINDS) {
      const req = makeDefaultRequirement(kind)
      expect(req.kind).toBe(kind)
    }
  })

  it('fills required number fields with 0', () => {
    const req = makeDefaultRequirement('gold_at_least') as { kind: string; amount: number }
    expect(req.amount).toBe(0)
  })

  it('does not include optional qty', () => {
    const req = makeDefaultRequirement('has_item') as Record<string, unknown>
    expect(req.itemId).toBe('')
    expect('qty' in req).toBe(false)
  })
})
