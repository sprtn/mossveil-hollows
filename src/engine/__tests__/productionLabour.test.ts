import { describe, it, expect } from 'vitest'
import {
  clampLabourPay,
  computeMoralePercent,
  computeBonusLogChance,
  rollMoraleSuccess,
  expectedOutputPerRun,
  LABOUR_PAY_MAX,
  LABOUR_FAIR_WAGE,
} from '../productionLabour'

describe('productionLabour', () => {
  it('clamps pay to 0–10', () => {
    expect(clampLabourPay(-3)).toBe(0)
    expect(clampLabourPay(7.6)).toBe(8)
    expect(clampLabourPay(99)).toBe(LABOUR_PAY_MAX)
  })

  it('grants 20% morale per gold up to 100%', () => {
    expect(computeMoralePercent(0)).toBe(0)
    expect(computeMoralePercent(1)).toBe(20)
    expect(computeMoralePercent(4)).toBe(80)
    expect(computeMoralePercent(5)).toBe(100)
    expect(computeMoralePercent(10)).toBe(100)
  })

  it('adds 10% bonus log chance per gold above fair wage', () => {
    expect(computeBonusLogChance(5)).toBe(0)
    expect(computeBonusLogChance(6)).toBeCloseTo(0.1)
    expect(computeBonusLogChance(10)).toBeCloseTo(0.5)
  })

  it('blocks work at 0 morale', () => {
    expect(rollMoraleSuccess(() => 0.99, 0)).toBe(false)
  })

  it('always works at fair wage', () => {
    expect(rollMoraleSuccess(() => 0, LABOUR_FAIR_WAGE)).toBe(true)
  })

  it('estimates expected output with bonus chance', () => {
    expect(expectedOutputPerRun(2, 5)).toBe(2)
    expect(expectedOutputPerRun(2, 10)).toBe(2.5)
  })
})
