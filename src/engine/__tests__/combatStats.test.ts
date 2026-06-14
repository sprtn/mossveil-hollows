import { describe, it, expect } from 'vitest'
import { SeededRandom, rollDamage, splitEnemiesByInitiative, getEffectiveAgility } from '../CombatEngine'
import type { Enemy } from '../GameLoopDesign'

describe('combat stats', () => {
  it('rollDamage produces varying crit outcomes across advancing RNG', () => {
    const rng = new SeededRandom(42)
    const results: boolean[] = []
    for (let i = 0; i < 50; i++) {
      const { crit } = rollDamage(10, 2, 15, 8, false, rng)
      results.push(crit)
    }
    expect(results.some((c) => c)).toBe(true)
    expect(results.some((c) => !c)).toBe(true)
  })

  it('higher agility increases miss chance for attacker', () => {
    const rng1 = new SeededRandom(100)
    const rng2 = new SeededRandom(100)
    let missesLowAgi = 0
    let missesHighAgi = 0
    for (let i = 0; i < 100; i++) {
      if (rollDamage(10, 2, 8, 8, false, rng1).missed) missesLowAgi++
      if (rollDamage(10, 2, 8, 20, false, rng2).missed) missesHighAgi++
    }
    expect(missesHighAgi).toBeGreaterThan(missesLowAgi)
  })

  it('splitEnemiesByInitiative separates fast and slow enemies', () => {
    const enemies: Enemy[] = [
      {
        id: 'fast_wolf',
        name: 'Wolf',
        hp: 10,
        maxHp: 10,
        level: 1,
        stats: { strength: 5, defense: 2, constitution: 6, dexterity: 6, agility: 15 },
      },
      {
        id: 'slow_boar',
        name: 'Boar',
        hp: 20,
        maxHp: 20,
        level: 1,
        stats: { strength: 8, defense: 4, constitution: 10, dexterity: 4, agility: 5 },
      },
    ]
    const { fast, slow } = splitEnemiesByInitiative(10, enemies)
    expect(fast.map((e) => e.id)).toContain('fast_wolf')
    expect(slow.map((e) => e.id)).toContain('slow_boar')
  })

  it('slow status reduces effective agility', () => {
    const agi = getEffectiveAgility(
      { strength: 5, defense: 2, constitution: 6, dexterity: 6, agility: 12 },
      [{ type: 'slow', turnsRemaining: 2, power: 4 }]
    )
    expect(agi).toBe(8)
  })
})
