import { describe, it, expect } from 'vitest'
import type { SkillDef } from '../ContentSchemas'
import {
  createDefaultPlayer,
  resolvePlayerCombatAction,
  rollDamage,
  SeededRandom,
  addStatus,
  tickStun,
  isStunned,
  tickBleedAtTurnStart,
  tryPassiveHooks,
} from '../CombatEngine'
import { resolveSkillEffects } from '../SkillEffects'
import { getPlayerDamageTakenMultiplier, getPlayerEvasionBonus } from '../combatBuffs'
import { enterRoom, initGame, triggerEncounter } from '../GameLoop'
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
    ...overrides,
  }
}

function combatState(opts: {
  enemies?: Enemy[]
  rngState?: number
  playerStats?: ReturnType<typeof createDefaultPlayer>['stats']
  knownSkills?: string[]
  combatBuffs?: NonNullable<ReturnType<typeof triggerEncounter>['currentEncounter']>['combatBuffs']
} = {}) {
  const player = createDefaultPlayer({
    knownSkills: opts.knownSkills ?? [],
    stats: opts.playerStats ?? {
      strength: 20,
      defense: 10,
      constitution: 12,
      dexterity: 16,
      agility: 12,
    },
  })
  let state = triggerEncounter(
    enterRoom(initGame(player, testRoom), testRoom),
    opts.enemies ?? [testEnemy()]
  )
  state = {
    ...state,
    currentEncounter: {
      ...state.currentEncounter!,
      rngState: opts.rngState ?? 50,
      combatBuffs: opts.combatBuffs ?? [],
    },
  }
  return state
}

function synthSkill(partial: SkillDef): SkillDef {
  return {
    requires: [],
    energyCost: 1,
    branch: 'might',
    description: 'test',
    ...partial,
  }
}

describe('skill effect types (synthetic)', () => {
  it('hitModifier increases miss rate vs baseline', () => {
    const rng = new SeededRandom(42)
    let baselineMisses = 0
    let wildMisses = 0
    for (let i = 0; i < 200; i++) {
      const r = new SeededRandom(i)
      if (rollDamage(10, 5, 8, 8, false, r).missed) baselineMisses++
      if (rollDamage(10, 5, 8, 8, false, r, { hitModifier: -0.25 }).missed) wildMisses++
    }
    expect(wildMisses).toBeGreaterThan(baselineMisses)
    expect(rng.next()).toBeLessThan(1)
  })

  it('ignoreDefense deals more damage vs high-DEF enemy', () => {
    const normal = rollDamage(40, 30, 10, 5, false, new SeededRandom(7))
    const crushing = rollDamage(40, 30, 10, 5, false, new SeededRandom(7), {
      ignoreDefense: 0.35,
    })
    expect(crushing.damage).toBeGreaterThan(normal.damage)
  })

  it('apply_status.chance gates stun application', () => {
    const skill = synthSkill({
      id: 'test_stun',
      name: 'Test Stun',
      combat: {
        activatable: true,
        targetMode: 'single_enemy',
        effects: [
          { kind: 'damage', scaling: { mode: 'stat', stat: 'strength' } },
          {
            kind: 'apply_status',
            status: 'stun',
            turns: 1,
            power: { kind: 'fixed', value: 0 },
            chance: { base: 0, perStat: { stat: 'strength', scale: 0 }, max: 0 },
          },
        ],
        log: { eventType: 'skill', message: 'hit {target} {damage}' },
      },
    })
    const state = combatState({ rngState: 10 })
    const enemyId = state.currentEncounter!.enemies[0]!.id
    const afterFail = resolveSkillEffects(state, skill, { targetId: enemyId }, new SeededRandom(10), [])
    const stunnedFail = afterFail.currentEncounter!.enemies[0]!.statusEffects?.some((s) => s.type === 'stun')
    expect(stunnedFail).toBeFalsy()

    const skillAlways = synthSkill({
      ...skill,
      combat: {
        ...skill.combat!,
        effects: [
          skill.combat!.effects[0]!,
          {
            kind: 'apply_status',
            status: 'stun',
            turns: 1,
            power: { kind: 'fixed', value: 0 },
            chance: { base: 1, max: 1 },
          },
        ],
      },
    })
    const afterOk = resolveSkillEffects(state, skillAlways, { targetId: enemyId }, new SeededRandom(10), [])
    expect(afterOk.currentEncounter!.enemies[0]!.statusEffects?.some((s) => s.type === 'stun')).toBe(true)
  })

  it('stun_immune blocks follow-up stun after first expires', () => {
    let effects = addStatus([], 'stun', 1, 0)
    expect(isStunned(effects)).toBe(true)
    effects = tickStun(effects)
    expect(isStunned(effects)).toBe(false)
    expect(effects.some((e) => e.type === 'stun_immune')).toBe(true)
    effects = addStatus(effects, 'stun', 1, 0)
    expect(effects.some((e) => e.type === 'stun')).toBe(false)
  })

  it('defenseDebuffOnHit applies accuracy_down only on hit', () => {
    const skill = synthSkill({
      id: 'test_slam',
      name: 'Slam',
      combat: {
        activatable: true,
        targetMode: 'single_enemy',
        effects: [
          {
            kind: 'damage',
            scaling: { mode: 'stat', stat: 'strength' },
            guaranteedHit: true,
            defenseDebuffOnHit: {
              status: 'accuracy_down',
              turns: 2,
              power: { kind: 'fixed', value: 4 },
            },
          },
        ],
        log: { eventType: 'skill', message: 'slam {target} {damage}' },
      },
    })
    const state = combatState({ rngState: 5 })
    const enemyId = state.currentEncounter!.enemies[0]!.id
    const after = resolveSkillEffects(state, skill, { targetId: enemyId }, new SeededRandom(5), [])
    expect(after.currentEncounter!.enemies[0]!.statusEffects?.some((s) => s.type === 'accuracy_down')).toBe(
      true
    )
  })

  it('bonusPerTargetStatus scales damage with bleed stacks', () => {
    const skill = synthSkill({
      id: 'test_exploit',
      name: 'Exploit',
      branch: 'hunter',
      combat: {
        activatable: true,
        targetMode: 'single_enemy',
        effects: [
          {
            kind: 'damage',
            scaling: { mode: 'stat', stat: 'dexterity' },
            bonusPerTargetStatus: { status: 'bleed', scale: 0.15 },
            guaranteedHit: true,
          },
        ],
        log: { eventType: 'skill', message: 'exploit {target} {damage}' },
      },
    })
    const enemyBleeding = testEnemy({
      statusEffects: [{ type: 'bleed', turnsRemaining: 3, power: 2, stacks: 3 }],
    })
    const state = combatState({ enemies: [enemyBleeding], rngState: 3 })
    const enemyId = enemyBleeding.id
    const after = resolveSkillEffects(state, skill, { targetId: enemyId }, new SeededRandom(3), [])
    const hpBleed = after.currentEncounter!.enemies[0]!.hp

    const stateNoBleed = combatState({ rngState: 3 })
    const afterNoBleed = resolveSkillEffects(
      stateNoBleed,
      skill,
      { targetId: stateNoBleed.currentEncounter!.enemies[0]!.id },
      new SeededRandom(3),
      []
    )
    expect(hpBleed).toBeLessThan(afterNoBleed.currentEncounter!.enemies[0]!.hp)
  })

  it('execute kills target below HP threshold', () => {
    const skill = synthSkill({
      id: 'test_execute',
      name: 'Execute',
      branch: 'hunter',
      combat: {
        activatable: true,
        targetMode: 'single_enemy',
        effects: [
          {
            kind: 'damage',
            scaling: { mode: 'stat', stat: 'dexterity' },
            executeBelowHpPct: 0.25,
            executeMode: 'kill',
          },
        ],
        log: {
          eventType: 'skill',
          message: 'mark {target} {damage}',
          messageCrit: 'execute {target} {damage}',
        },
      },
    })
    const lowHp = testEnemy({ hp: 10, maxHp: 80 })
    const state = combatState({ enemies: [lowHp], rngState: 1 })
    const after = resolveSkillEffects(
      state,
      skill,
      { targetId: lowHp.id },
      new SeededRandom(1),
      []
    )
    expect(after.currentEncounter!.enemies[0]!.hp).toBe(0)
  })

  it('all_enemies_single_roll: one miss means all miss', () => {
    const skill = synthSkill({
      id: 'test_sweep',
      name: 'Sweep',
      combat: {
        activatable: true,
        targetMode: 'all_enemies_single_roll',
        effects: [
          {
            kind: 'damage',
            scaling: { mode: 'stat', stat: 'strength' },
            hitModifier: -0.9,
          },
        ],
        log: {
          eventType: 'skill',
          message: 'sweep all',
          messageMiss: 'sweep misses',
          aggregate: true,
        },
      },
    })
    const state = combatState({
      enemies: [testEnemy({ id: 'e1' }), testEnemy({ id: 'e2', name: 'Orc' })],
      rngState: 99,
    })
    const log: import('../GameLoopDesign').CombatEvent[] = []
    const after = resolveSkillEffects(state, skill, {}, new SeededRandom(99), log)
    expect(after.currentEncounter!.enemies.every((e) => e.hp === 80)).toBe(true)
    expect(log.some((e) => e.type === 'miss')).toBe(true)
  })

  it('add_combat_buff: reckless increases damage taken; evasive increases miss', () => {
    const enc = combatState().currentEncounter!
    const reckless = {
      ...enc,
      combatBuffs: [{ id: 'r', label: 'reckless', damageTakenMultiplier: 1.25 }],
    }
    expect(getPlayerDamageTakenMultiplier(reckless)).toBe(1.25)

    const evasive = {
      ...enc,
      combatBuffs: [{ id: 'e', label: 'evasive', evasionBonus: 0.12 }],
    }
    expect(getPlayerEvasionBonus(evasive)).toBeCloseTo(0.12)
  })

  it('bleed stacks tick and decay at turn start', () => {
    const tick = tickBleedAtTurnStart(
      {
        hp: 50,
        maxHp: 50,
        statusEffects: [{ type: 'bleed', turnsRemaining: 3, power: 2, stacks: 3 }],
      },
      true
    )
    expect(tick.hp).toBe(44)
    expect(tick.statusEffects[0]?.stacks).toBe(2)
  })

  it('passive revive restores HP once on lethal', () => {
    let state = combatState({ knownSkills: ['skill_second_wind'] })
    state = {
      ...state,
      player: { ...state.player, hp: 0 },
    }
    const after = tryPassiveHooks(state, 'on_lethal')
    expect(after.player.hp).toBeGreaterThan(0)
    expect(after.flags?.second_wind_used).toBe(true)
    const again = tryPassiveHooks({ ...after, player: { ...after.player, hp: 0 } }, 'on_lethal')
    expect(again.player.hp).toBe(0)
  })
})
