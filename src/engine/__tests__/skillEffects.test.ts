import { describe, it, expect } from 'vitest'
import { enterRoom, initGame, triggerEncounter, useCombatConsumable } from '../GameLoop'
import {
  createDefaultPlayer,
  resolvePlayerCombatAction,
} from '../CombatEngine'
import { getSkill, getSkillEnergyCost } from '../SkillSystem'
import type { Enemy, Room } from '../GameLoopDesign'

const testRoom: Room = {
  id: 'room_1',
  name: 'Forest',
  description: 'Test',
  encounters: [],
  exits: [],
}

function testEnemy(overrides: Partial<Enemy> = {}): Enemy {
  return {
    id: 'enemy_1',
    name: 'Goblin',
    hp: 80,
    maxHp: 80,
    level: 1,
    stats: { strength: 5, defense: 2, constitution: 6, dexterity: 4, agility: 4 },
    loot: [],
    goldReward: 5,
    xpReward: 10,
    ...overrides,
  }
}

function combatState(
  opts: {
    knownSkills?: string[]
    energy?: number
    stats?: Enemy['stats']
    playerStats?: ReturnType<typeof createDefaultPlayer>['stats']
    rngState?: number
    enemies?: Enemy[]
    poison?: boolean
    combatBuffs?: NonNullable<ReturnType<typeof triggerEncounter>['currentEncounter']>['combatBuffs']
    playerHp?: number
    inventory?: ReturnType<typeof createDefaultPlayer>['inventory']
  } = {}
) {
  const player = createDefaultPlayer({
    knownSkills: opts.knownSkills ?? [],
    energy: opts.energy ?? 20,
    hp: opts.playerHp,
    inventory: opts.inventory,
    stats: opts.playerStats ?? {
      strength: 14,
      defense: 10,
      constitution: 10,
      dexterity: 10,
      agility: 8,
    },
    statusEffects: opts.poison
      ? [{ type: 'poison', turnsRemaining: 3, power: 2 }]
      : [],
  })
  let state = triggerEncounter(
    enterRoom(initGame(player, testRoom), testRoom),
    opts.enemies ?? [testEnemy()]
  )
  state = {
    ...state,
    currentEncounter: {
      ...state.currentEncounter!,
      rngState: opts.rngState ?? 100,
      combatBuffs: opts.combatBuffs ?? [],
    },
  }
  return state
}

describe('skillEffects characterization', () => {
  it('second wind action is a no-op (no energy spent, no events)', () => {
    const state = combatState({ knownSkills: ['skill_second_wind'], energy: 20 })
    const energyBefore = state.player.energy
    const { state: after, events } = resolvePlayerCombatAction(state, 'skill_second_wind')
    expect(after.player.energy).toBe(energyBefore)
    expect(events).toHaveLength(0)
  })

  it('power strike spends energy and deals damage (rngState=100)', () => {
    const state = combatState({ knownSkills: ['skill_power_strike'], rngState: 100 })
    const enemyId = state.currentEncounter!.enemies[0]!.id
    const hpBefore = state.currentEncounter!.enemies[0]!.hp
    const { state: after, events } = resolvePlayerCombatAction(state, 'skill_power_strike', {
      targetId: enemyId,
    })
    expect(after.player.energy).toBe(state.player.energy - getSkillEnergyCost('skill_power_strike'))
    expect(after.currentEncounter!.enemies[0]!.hp).toBeLessThan(hpBefore)
    expect(events[0]?.type).toBe('skill')
    expect(events[0]?.message).toContain('Power Strike hits')
  })

  it('cleave spends energy and hits all living enemies (rngState=100)', () => {
    const state = combatState({
      knownSkills: ['skill_cleave'],
      rngState: 100,
      enemies: [
        testEnemy({ id: 'e1', hp: 60 }),
        testEnemy({ id: 'e2', name: 'Orc', hp: 60 }),
      ],
    })
    const { state: after, events } = resolvePlayerCombatAction(state, 'skill_cleave')
    expect(after.player.energy).toBe(state.player.energy - getSkillEnergyCost('skill_cleave'))
    expect(after.currentEncounter!.enemies.every((e) => e.hp < 60)).toBe(true)
    expect(events).toHaveLength(1)
    expect(events[0]?.message).toBe('Cleave sweeps all enemies!')
  })

  it('brace sets playerBracing and heals (defense=10 → heal 11)', () => {
    const state = combatState({ knownSkills: ['skill_brace'], rngState: 100, playerHp: 20 })
    const hpBefore = state.player.hp
    const { state: after, events } = resolvePlayerCombatAction(state, 'skill_brace')
    expect(after.currentEncounter!.playerBracing).toBe(true)
    expect(after.player.hp).toBe(hpBefore + 11)
    expect(events[0]?.type).toBe('defend')
    expect(events[0]?.message).toBe('You brace yourself and recover 11 HP.')
  })

  it('bandage heals self (defense=10 → heal 25, clamped to maxHp)', () => {
    const state = combatState({ knownSkills: ['skill_bandage'], rngState: 100, playerHp: 20 })
    const { state: after, events } = resolvePlayerCombatAction(state, 'skill_bandage')
    expect(after.player.hp).toBe(after.player.maxHp)
    expect(events[0]?.type).toBe('heal')
    expect(events[0]?.message).toBe('Bandage restores 25 HP.')
    expect(events[0]?.amount).toBe(25)
  })

  it('antidote lore removes poison', () => {
    const state = combatState({ knownSkills: ['skill_antidote_lore'], poison: true, rngState: 100 })
    const { state: after, events } = resolvePlayerCombatAction(state, 'skill_antidote_lore')
    expect(after.player.statusEffects.some((s) => s.type === 'poison')).toBe(false)
    expect(events[0]?.message).toBe('Antidote Lore purges the poison from your veins.')
  })

  it('precise shot always hits with guaranteedHit (rngState=100)', () => {
    const state = combatState({ knownSkills: ['skill_precise_shot'], rngState: 100 })
    const enemyId = state.currentEncounter!.enemies[0]!.id
    const hpBefore = state.currentEncounter!.enemies[0]!.hp
    const { state: after, events } = resolvePlayerCombatAction(state, 'skill_precise_shot', {
      targetId: enemyId,
    })
    expect(after.currentEncounter!.enemies[0]!.hp).toBeLessThan(hpBefore)
    expect(events[0]?.message).toMatch(/Precise Shot (hits|crits)/)
  })

  it('bleed applies bleed status (rngState=100)', () => {
    const state = combatState({ knownSkills: ['skill_bleed'], rngState: 100 })
    const enemyId = state.currentEncounter!.enemies[0]!.id
    const { state: after, events } = resolvePlayerCombatAction(state, 'skill_bleed', {
      targetId: enemyId,
    })
    const enemy = after.currentEncounter!.enemies[0]!
    expect(enemy.statusEffects?.some((s) => s.type === 'bleed')).toBe(true)
    expect(events[0]?.status).toBe('bleed')
    expect(events[0]?.message).toContain('bleeding')
  })

  it('hamstring applies slow status (rngState=100)', () => {
    const state = combatState({ knownSkills: ['skill_hamstring'], rngState: 100 })
    const enemyId = state.currentEncounter!.enemies[0]!.id
    const { state: after, events } = resolvePlayerCombatAction(state, 'skill_hamstring', {
      targetId: enemyId,
    })
    const enemy = after.currentEncounter!.enemies[0]!
    expect(enemy.statusEffects?.some((s) => s.type === 'slow')).toBe(true)
    expect(events[0]?.status).toBe('slow')
    expect(events[0]?.message).toContain('Hamstring slows')
  })

  it('stake buff increases power strike damage at fixed rngState', () => {
    const stakeInv = [
      { templateId: 'wooden_stake', quantity: 1, quality: 'common' as const },
    ]
    const baseline = combatState({
      knownSkills: ['skill_power_strike'],
      rngState: 100,
      inventory: stakeInv,
    })
    const enemyId = baseline.currentEncounter!.enemies[0]!.id
    const hpBefore = baseline.currentEncounter!.enemies[0]!.hp
    const baseResult = resolvePlayerCombatAction(baseline, 'skill_power_strike', { targetId: enemyId })
    const baselineDmg = hpBefore - baseResult.state.currentEncounter!.enemies[0]!.hp

    let buffed = combatState({
      knownSkills: ['skill_power_strike'],
      rngState: 100,
      inventory: stakeInv,
    })
    buffed = useCombatConsumable(buffed, 'wooden_stake')
    const buffedHpBefore = buffed.currentEncounter!.enemies[0]!.hp
    const buffResult = resolvePlayerCombatAction(buffed, 'skill_power_strike', { targetId: enemyId })
    const buffedDmg = buffedHpBefore - buffResult.state.currentEncounter!.enemies[0]!.hp

    expect(baselineDmg).toBeGreaterThan(0)
    expect(buffedDmg).toBeGreaterThan(baselineDmg)
    expect(buffResult.events[0]?.message).toContain('empowered')
  })

  it('cleave consumes stake buff once for whole sweep', () => {
    let state = combatState({
      knownSkills: ['skill_cleave'],
      rngState: 100,
      inventory: [{ templateId: 'wooden_stake', quantity: 1, quality: 'common' as const }],
      enemies: [testEnemy({ id: 'e1', hp: 80 }), testEnemy({ id: 'e2', name: 'Orc', hp: 80 })],
    })
    state = useCombatConsumable(state, 'wooden_stake')
    const { state: after, events } = resolvePlayerCombatAction(state, 'skill_cleave')
    expect(after.currentEncounter!.combatBuffs ?? []).toHaveLength(0)
    expect(events[0]?.message).toContain('empowered')
  })

  it('getSkill returns combat data for activatable skills', () => {
    expect(getSkill('skill_power_strike')?.combat?.activatable).toBe(true)
    expect(getSkill('skill_second_wind')?.combat).toBeUndefined()
  })
})
