/**
 * Data-driven combat skill effect resolution.
 */

import type {
  CombatEvent,
  Enemy,
  GameState,
  PlayerActionOptions,
  PlayerStats,
} from './GameLoopDesign'
import type {
  SkillCombatDef,
  SkillDef,
  SkillEffect,
  StatScaling,
  StatusPower,
} from './ContentSchemas'
import { getEffectiveStats } from './ItemDatabase'
import {
  addStatus,
  getEffectiveAgility,
  rollDamage,
  type SeededRandom,
} from './CombatEngine'
import { consumeDamageMultiplier } from './combatBuffs'

function empoweredSuffix(multiplier: number): string {
  return multiplier > 1 ? ' (empowered!)' : ''
}

function resolveStatScaling(scaling: StatScaling, stats: PlayerStats): number {
  switch (scaling.mode) {
    case 'stat':
      return stats[scaling.stat]
    case 'stat_times':
      return Math.floor(stats[scaling.stat] * scaling.multiplier)
    case 'stat_plus_bonus':
      return stats[scaling.stat] + Math.floor(stats[scaling.bonusStat] * scaling.bonusScale)
  }
}

function resolveStatusPower(power: StatusPower, stats: PlayerStats): number {
  if (power.kind === 'fixed') return power.value
  return power.flat + Math.floor(stats[power.stat] * power.scale)
}

function formatSkillMessage(
  template: string,
  vars: {
    target?: string
    targetName?: string
    damage?: number
    heal?: number
    empowered?: string
  }
): string {
  return template
    .replace(/\{target\}/g, vars.targetName ?? vars.target ?? '')
    .replace(/\{targetName\}/g, vars.targetName ?? '')
    .replace(/\{damage\}/g, String(vars.damage ?? 0))
    .replace(/\{heal\}/g, String(vars.heal ?? 0))
    .replace(/\{empowered\}/g, vars.empowered ?? '')
}

function findSingleTarget(
  enc: NonNullable<GameState['currentEncounter']>,
  options: PlayerActionOptions,
  requireLiving: boolean
): Enemy | undefined {
  const targetId = options.targetId ?? enc.enemies.find((e) => e.hp > 0)?.id
  if (!targetId) return undefined
  const target = enc.enemies.find((e) => e.id === targetId)
  if (!target) return undefined
  if (requireLiving && target.hp <= 0) return undefined
  return target
}

function applyDamageToEnemy(
  enc: NonNullable<GameState['currentEncounter']>,
  targetId: string,
  damage: number
): Enemy[] {
  return enc.enemies.map((e) =>
    e.id === targetId ? { ...e, hp: Math.max(0, e.hp - damage) } : e
  )
}

function applyDamageEffect(
  effect: Extract<SkillEffect, { kind: 'damage' }>,
  ctx: {
    state: GameState
    combat: SkillCombatDef
    options: PlayerActionOptions
    rng: SeededRandom
    playerStats: PlayerStats
    events: CombatEvent[]
    damageMultiplier: number
    buffConsumed: boolean
    hasFollowUpStatus: boolean
  }
): { state: GameState; damageMultiplier: number; buffConsumed: boolean; lastDamage: number; lastTarget?: Enemy } {
  let { state, damageMultiplier, buffConsumed } = ctx
  const enc = state.currentEncounter!
  const player = state.player
  const attackerStr = resolveStatScaling(effect.scaling, ctx.playerStats)

  if (effect.consumeDamageBuff !== false && !buffConsumed) {
    const { multiplier, encounter: encAfterBuff } = consumeDamageMultiplier(enc)
    damageMultiplier = multiplier
    buffConsumed = true
    state = {
      ...state,
      currentEncounter: { ...enc, ...encAfterBuff },
    }
  }

  const rollOpts = {
    critBonus: effect.critBonus,
    guaranteedHit: effect.guaranteedHit,
    damageMultiplier: damageMultiplier > 1 ? damageMultiplier : undefined,
  }

  if (ctx.combat.targetMode === 'all_enemies') {
    const currentEnc = state.currentEncounter!
    const enemies = currentEnc.enemies.map((e) => {
      if (e.hp <= 0) return e
      const { damage } = rollDamage(
        attackerStr,
        e.stats.defense,
        ctx.playerStats.dexterity,
        getEffectiveAgility(e.stats, e.statusEffects),
        false,
        ctx.rng,
        rollOpts
      )
      return { ...e, hp: Math.max(0, e.hp - damage) }
    })
    state = {
      ...state,
      currentEncounter: { ...currentEnc, enemies },
    }

    if (ctx.combat.log.aggregate) {
      ctx.events.push({
        type: ctx.combat.log.eventType,
        source: player.id,
        sourceName: player.name,
        message: formatSkillMessage(ctx.combat.log.message, {
          empowered: empoweredSuffix(damageMultiplier),
        }),
      })
    }

    return { state, damageMultiplier, buffConsumed, lastDamage: 0 }
  }

  const requireLiving = ctx.combat.requireLivingTarget !== false
  const target = findSingleTarget(state.currentEncounter!, ctx.options, requireLiving)
  if (!target) return { state, damageMultiplier, buffConsumed, lastDamage: 0 }

  const { damage, crit } = rollDamage(
    attackerStr,
    target.stats.defense,
    ctx.playerStats.dexterity,
    getEffectiveAgility(target.stats, target.statusEffects),
    false,
    ctx.rng,
    rollOpts
  )

  const updatedEnemies = applyDamageToEnemy(state.currentEncounter!, target.id, damage)
  state = {
    ...state,
    currentEncounter: { ...state.currentEncounter!, enemies: updatedEnemies },
  }

  if (!ctx.hasFollowUpStatus && !ctx.combat.log.aggregate) {
    const template = crit && ctx.combat.log.messageCrit
      ? ctx.combat.log.messageCrit
      : ctx.combat.log.message
    ctx.events.push({
      type: ctx.combat.log.eventType,
      source: player.id,
      sourceName: player.name,
      target: target.id,
      targetName: target.name,
      amount: damage,
      crit,
      message: formatSkillMessage(template, {
        target: target.name,
        targetName: target.name,
        damage,
        empowered: empoweredSuffix(damageMultiplier),
      }),
    })
  }

  return { state, damageMultiplier, buffConsumed, lastDamage: damage, lastTarget: target }
}

function applyStatusEffect(
  effect: Extract<SkillEffect, { kind: 'apply_status' }>,
  ctx: {
    state: GameState
    combat: SkillCombatDef
    playerStats: PlayerStats
    events: CombatEvent[]
    primaryTarget?: Enemy
    lastDamage: number
    damageMultiplier: number
  }
): GameState {
  const target = ctx.primaryTarget
  if (!target) return ctx.state

  const power = resolveStatusPower(effect.power, ctx.playerStats)
  const enc = ctx.state.currentEncounter!
  const enemies = enc.enemies.map((e) => {
    if (e.id !== target.id) return e
    const statusEffects = addStatus(e.statusEffects ?? [], effect.status, effect.turns, power)
    return { ...e, statusEffects }
  })

  const player = ctx.state.player

  ctx.events.push({
    type: 'skill',
    source: player.id,
    sourceName: player.name,
    target: target.id,
    targetName: target.name,
    amount: ctx.lastDamage,
    status: effect.status,
    message: formatSkillMessage(ctx.combat.log.message, {
      target: target.name,
      targetName: target.name,
      damage: ctx.lastDamage,
      empowered: empoweredSuffix(ctx.damageMultiplier),
    }),
  })

  return {
    ...ctx.state,
    currentEncounter: { ...enc, enemies },
  }
}

export function resolveSkillEffects(
  state: GameState,
  skill: SkillDef,
  options: PlayerActionOptions,
  rng: SeededRandom,
  events: CombatEvent[]
): GameState {
  const combat = skill.combat
  if (!combat?.activatable || !state.currentEncounter) return state

  if (state.player.energy < skill.energyCost) return state

  if (combat.targetMode === 'single_enemy') {
    const requireLiving = combat.requireLivingTarget !== false
    const target = findSingleTarget(state.currentEncounter, options, requireLiving)
    if (!target) return state
  }

  let result: GameState = {
    ...state,
    player: {
      ...state.player,
      energy: state.player.energy - skill.energyCost,
    },
  }

  const playerStats = getEffectiveStats(result.player)
  let damageMultiplier = 1
  let buffConsumed = false
  let lastDamage = 0
  let primaryTarget: Enemy | undefined

  if (combat.targetMode === 'single_enemy') {
    const requireLiving = combat.requireLivingTarget !== false
    primaryTarget = findSingleTarget(result.currentEncounter!, options, requireLiving)
  }

  for (let i = 0; i < combat.effects.length; i++) {
    const effect = combat.effects[i]!
    switch (effect.kind) {
      case 'damage': {
        const hasFollowUpStatus = combat.effects.slice(i + 1).some((e) => e.kind === 'apply_status')
        const outcome = applyDamageEffect(effect, {
          state: result,
          combat,
          options,
          rng,
          playerStats,
          events,
          damageMultiplier,
          buffConsumed,
          hasFollowUpStatus,
        })
        result = outcome.state
        damageMultiplier = outcome.damageMultiplier
        buffConsumed = outcome.buffConsumed
        lastDamage = outcome.lastDamage
        if (outcome.lastTarget) primaryTarget = outcome.lastTarget
        break
      }
      case 'heal': {
        const heal = effect.flat + (effect.stat && effect.statScale != null
          ? Math.floor(playerStats[effect.stat] * effect.statScale)
          : 0)
        result = {
          ...result,
          player: {
            ...result.player,
            hp: Math.min(result.player.maxHp, result.player.hp + heal),
          },
        }
        events.push({
          type: combat.log.eventType,
          source: result.player.id,
          sourceName: result.player.name,
          amount: combat.log.eventType === 'heal' ? heal : undefined,
          message: formatSkillMessage(combat.log.message, { heal }),
        })
        break
      }
      case 'apply_status':
        result = applyStatusEffect(effect, {
          state: result,
          combat,
          playerStats,
          events,
          primaryTarget,
          lastDamage,
          damageMultiplier,
        })
        break
      case 'remove_status':
        result = {
          ...result,
          player: {
            ...result.player,
            statusEffects: result.player.statusEffects.filter((s) => s.type !== effect.status),
          },
        }
        events.push({
          type: combat.log.eventType,
          source: result.player.id,
          sourceName: result.player.name,
          message: combat.log.message,
        })
        break
      case 'set_encounter_flag':
        if (effect.flag === 'playerBracing' && result.currentEncounter) {
          result = {
            ...result,
            currentEncounter: {
              ...result.currentEncounter,
              playerBracing: effect.value,
            },
          }
        }
        break
    }
  }

  return result
}
