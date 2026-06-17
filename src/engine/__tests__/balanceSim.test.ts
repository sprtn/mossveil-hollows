/**
 * Balance simulation harness — tune combat/economy via seeded runs.
 */

import { describe, it, expect } from 'vitest'
import {
  initGame,
  enterRoom,
  triggerEncounter,
  playerAction,
} from '../GameLoop'
import { createDefaultPlayer } from '../CombatEngine'
import { equipItemAction } from '../GameLoop'
import type { Enemy, Room } from '../GameLoopDesign'
import { getEffectiveStats } from '../ItemDatabase'

const forestRoom: Room = {
  id: 'zone_forest_entrance',
  name: 'Forest',
  description: 'Test',
  encounters: [],
  exits: [],
  zoneId: 'forest',
}

const forestWolf: Enemy = {
  id: 'forest_wolf_1',
  name: 'Forest Wolf',
  hp: 20,
  maxHp: 20,
  level: 1,
  stats: { strength: 11, defense: 2, constitution: 6, dexterity: 5, agility: 6 },
  archetype: 'attacker',
  xpReward: 30,
  goldReward: 0,
}

const forestGuardian: Enemy = {
  id: 'forest_guardian',
  name: 'Forest Guardian',
  hp: 90,
  maxHp: 90,
  level: 3,
  stats: { strength: 16, defense: 6, constitution: 10, dexterity: 5, agility: 6 },
  archetype: 'defender',
  isBoss: true,
  xpReward: 200,
  goldReward: 0,
}

interface SimResult {
  won: boolean
  rounds: number
  hpLostPct: number
  died: boolean
}

function simulateFight(
  playerOverrides: Parameters<typeof createDefaultPlayer>[0],
  enemy: Enemy,
  seed = 42,
  policy: 'attack' | 'smart' = 'smart'
): SimResult {
  const player = createDefaultPlayer(playerOverrides)
  let state = initGame(player, forestRoom, seed)
  state = enterRoom(state, forestRoom)
  state = triggerEncounter(state, [{ ...enemy }])

  const startHp = state.player.hp
  let rounds = 0
  const maxRounds = 50

  while (state.phase === 'encounter_action' && rounds < maxRounds) {
    rounds++
    const enc = state.currentEncounter!
    const alive = enc.enemies.filter((e) => e.hp > 0)
    if (alive.length === 0) break

    const target = alive[0]!
    const hpPct = state.player.hp / state.player.maxHp

    if (policy === 'smart' && hpPct < 0.35 && state.player.energy >= 1
        && (state.player.knownSkills ?? []).includes('skill_field_dressing')) {
      state = playerAction(state, 'use_skill', { skillId: 'skill_field_dressing' })
    } else {
      state = playerAction(state, 'attack', { targetId: target.id })
    }

    if (state.phase === 'combat_results' || state.phase === 'game_over') break
  }

  const hpLostPct = ((startHp - state.player.hp) / startHp) * 100
  const won = state.combatResults?.result === 'win'
  const died = state.phase === 'game_over'

  return { won, rounds, hpLostPct: Math.max(0, hpLostPct), died }
}

function bossWinRate(equipped: boolean, runs = 100): number {
  let wins = 0
  for (let i = 0; i < runs; i++) {
    const overrides = equipped
      ? {
          equipment: {
            weapon: { templateId: 'oak_spear', quality: 'common' as const },
            armor: { templateId: 'hide_jerkin', quality: 'common' as const },
          },
          inventory: [
            { templateId: 'oak_spear', quantity: 1, quality: 'common' as const },
            { templateId: 'hide_jerkin', quantity: 1, quality: 'common' as const },
            { templateId: 'health_potion', quantity: 3, quality: 'common' as const },
          ],
        }
      : { inventory: [{ templateId: 'health_potion', quantity: 2, quality: 'common' as const }] }

    const result = simulateFight(overrides, forestGuardian, 1000 + i)
    if (result.won) wins++
  }
  return wins / runs
}

describe('Balance Simulation', () => {
  it('starter gear vs wolf loses 15-50% HP in 2-6 rounds', () => {
    const results: SimResult[] = []
    for (let i = 0; i < 50; i++) {
      results.push(simulateFight({}, forestWolf, i))
    }
    const avgHpLost = results.reduce((s, r) => s + r.hpLostPct, 0) / results.length
    const avgRounds = results.reduce((s, r) => s + r.rounds, 0) / results.length
    const winRate = results.filter((r) => r.won).length / results.length

    expect(winRate).toBeGreaterThan(0.8)
    expect(avgHpLost).toBeGreaterThan(10)
    expect(avgHpLost).toBeLessThan(55)
    expect(avgRounds).toBeGreaterThan(1)
    expect(avgRounds).toBeLessThan(8)
  })

  it('crafted gear gives meaningful STR/DEF boost', () => {
    const starter = getEffectiveStats(createDefaultPlayer())
    let state = initGame(
      createDefaultPlayer({
        inventory: [
          { templateId: 'oak_spear', quantity: 1, quality: 'common' as const },
          { templateId: 'hide_jerkin', quantity: 1, quality: 'common' as const },
        ],
        equipment: {},
      }),
      forestRoom
    )
    state = equipItemAction(state, 'oak_spear')
    state = equipItemAction(state, 'hide_jerkin')
    const crafted = getEffectiveStats(state.player)

    expect(crafted.strength).toBeGreaterThan(starter.strength)
    expect(crafted.defense).toBeGreaterThan(starter.defense)
  })

  it('boss win-rate higher with crafted gear than without', () => {
    const withGear = bossWinRate(true, 80)
    const without = bossWinRate(false, 80)
    expect(withGear).toBeGreaterThan(without)
  })

  it('default player has stamina and skill fields', () => {
    const p = createDefaultPlayer()
    expect(p.stamina).toBe(10)
    expect(p.maxStamina).toBe(10)
    expect(p.knownSkills).toEqual([])
    expect(p.wounded).toBe(false)
  })
})
