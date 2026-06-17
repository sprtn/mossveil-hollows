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

function useSkill(
  state: ReturnType<typeof combatState>,
  skillId: string,
  targetId?: string
) {
  return resolvePlayerCombatAction(state, 'use_skill', { skillId, targetId })
}

describe('skillEffects characterization', () => {
  it('second wind is passive-only (use_skill no-op)', () => {
    const state = combatState({ knownSkills: ['skill_second_wind'], energy: 20 })
    const energyBefore = state.player.energy
    const { state: after, events } = useSkill(state, 'skill_second_wind')
    expect(after.player.energy).toBe(energyBefore)
    expect(events).toHaveLength(0)
  })

  it('empowered strike spends energy and deals damage (rngState=100)', () => {
    const state = combatState({ knownSkills: ['skill_empowered_strike'], rngState: 100 })
    const enemyId = state.currentEncounter!.enemies[0]!.id
    const hpBefore = state.currentEncounter!.enemies[0]!.hp
    const { state: after, events } = useSkill(state, 'skill_empowered_strike', enemyId)
    expect(after.player.energy).toBe(state.player.energy - getSkillEnergyCost('skill_empowered_strike'))
    expect(after.currentEncounter!.enemies[0]!.hp).toBeLessThan(hpBefore)
    expect(events[0]?.type).toBe('skill')
    expect(events[0]?.message).toContain('Empowered Strike hits')
  })

  it('whirlwind sweep hits all living enemies on success (rngState=100)', () => {
    const state = combatState({
      knownSkills: ['skill_whirlwind_sweep'],
      rngState: 100,
      enemies: [
        testEnemy({ id: 'e1', hp: 60 }),
        testEnemy({ id: 'e2', name: 'Orc', hp: 60 }),
      ],
    })
    const { state: after, events } = useSkill(state, 'skill_whirlwind_sweep')
    expect(after.player.energy).toBe(state.player.energy - getSkillEnergyCost('skill_whirlwind_sweep'))
    expect(after.currentEncounter!.enemies.every((e) => e.hp < 60)).toBe(true)
    expect(events.some((e) => e.message.includes('Whirlwind'))).toBe(true)
  })

  it('field dressing heals self (CON 10 → heal 19)', () => {
    const state = combatState({ knownSkills: ['skill_field_dressing'], rngState: 100, playerHp: 20 })
    const { state: after, events } = useSkill(state, 'skill_field_dressing')
    expect(after.player.hp).toBe(39)
    expect(events[0]?.type).toBe('heal')
    expect(events[0]?.message).toContain('Field Dressing')
    expect(events[0]?.amount).toBe(19)
  })

  it('antidote lore removes poison and grants bonus heal', () => {
    const state = combatState({ knownSkills: ['skill_antidote_lore'], poison: true, rngState: 100 })
    const { state: after, events } = useSkill(state, 'skill_antidote_lore')
    expect(after.player.statusEffects.some((s) => s.type === 'poison')).toBe(false)
    expect(events[0]?.message).toBe('Antidote Lore purges your ailments.')
  })

  it('precise shot deals damage (rngState=100)', () => {
    const state = combatState({ knownSkills: ['skill_precise_shot'], rngState: 100 })
    const enemyId = state.currentEncounter!.enemies[0]!.id
    const hpBefore = state.currentEncounter!.enemies[0]!.hp
    const { state: after, events } = useSkill(state, 'skill_precise_shot', enemyId)
    expect(after.currentEncounter!.enemies[0]!.hp).toBeLessThan(hpBefore)
    expect(events[0]?.message).toMatch(/Precise Shot/)
  })

  it('bleed applies bleed stacks (rngState=100)', () => {
    const state = combatState({ knownSkills: ['skill_bleed'], rngState: 100 })
    const enemyId = state.currentEncounter!.enemies[0]!.id
    const { state: after, events } = useSkill(state, 'skill_bleed', enemyId)
    const enemy = after.currentEncounter!.enemies[0]!
    expect(enemy.statusEffects?.some((s) => s.type === 'bleed')).toBe(true)
    expect(events[0]?.status).toBe('bleed')
    expect(events[0]?.message).toContain('bleeding wound')
  })

  it('hamstring applies slow status (rngState=100)', () => {
    const state = combatState({ knownSkills: ['skill_hamstring'], rngState: 100 })
    const enemyId = state.currentEncounter!.enemies[0]!.id
    const { state: after, events } = useSkill(state, 'skill_hamstring', enemyId)
    const enemy = after.currentEncounter!.enemies[0]!
    expect(enemy.statusEffects?.some((s) => s.type === 'slow')).toBe(true)
    expect(events[0]?.message).toContain('Hamstring')
  })

  it('stake buff increases empowered strike damage at fixed rngState', () => {
    const stakeInv = [
      { templateId: 'wooden_stake', quantity: 1, quality: 'common' as const },
    ]
    const baseline = combatState({
      knownSkills: ['skill_empowered_strike'],
      rngState: 100,
      inventory: stakeInv,
    })
    const enemyId = baseline.currentEncounter!.enemies[0]!.id
    const hpBefore = baseline.currentEncounter!.enemies[0]!.hp
    const baseResult = useSkill(baseline, 'skill_empowered_strike', enemyId)
    const baselineDmg = hpBefore - baseResult.state.currentEncounter!.enemies[0]!.hp

    let buffed = combatState({
      knownSkills: ['skill_empowered_strike'],
      rngState: 100,
      inventory: stakeInv,
    })
    buffed = useCombatConsumable(buffed, 'wooden_stake')
    const buffedHpBefore = buffed.currentEncounter!.enemies[0]!.hp
    const buffResult = useSkill(buffed, 'skill_empowered_strike', enemyId)
    const buffedDmg = buffedHpBefore - buffResult.state.currentEncounter!.enemies[0]!.hp

    expect(baselineDmg).toBeGreaterThan(0)
    expect(buffedDmg).toBeGreaterThan(baselineDmg)
    expect(buffResult.events[0]?.message).toContain('empowered')
  })

  it('getSkill returns combat data for activatable skills', () => {
    expect(getSkill('skill_empowered_strike')?.combat?.activatable).toBe(true)
    expect(getSkill('skill_second_wind')?.combat?.activatable).toBe(false)
    expect(getSkill('skill_second_wind')?.combat?.passive?.hook).toBe('on_lethal')
  })
})
