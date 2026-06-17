/**
 * Data-driven combat skill effect resolution.
 */

import type {
  CombatEvent,
  Enemy,
  GameState,
  PlayerActionOptions,
  PlayerStats,
  StatusType,
} from './GameLoopDesign'
import type {
  SkillCombatDef,
  SkillDef,
  SkillEffect,
  StatScaling,
  StatusApplyChance,
  StatusPower,
} from './ContentSchemas'
import { getEffectiveStats } from './ItemDatabase'
import {
  addStatus,
  countStatusStacks,
  getEffectiveAgility,
  getEffectiveDexterity,
  rollDamage,
  type SeededRandom,
} from './CombatEngine'
import { addCombatBuff, consumeDamageMultiplier } from './combatBuffs'

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

function resolveStatusChance(chance: StatusApplyChance, stats: PlayerStats): number {
  let value = chance.base
  if (chance.perStat) {
    value += stats[chance.perStat.stat] * chance.perStat.scale
  }
  if (chance.max !== undefined) value = Math.min(chance.max, value)
  return value
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

function buildRollOpts(
  effect: Extract<SkillEffect, { kind: 'damage' }>,
  damageMultiplier: number
) {
  return {
    critBonus: effect.critBonus,
    guaranteedHit: effect.guaranteedHit,
    hitModifier: effect.hitModifier,
    ignoreDefense: effect.ignoreDefense,
    damageMultiplier: damageMultiplier > 1 ? damageMultiplier : undefined,
  }
}

function scaledAttackerStr(
  effect: Extract<SkillEffect, { kind: 'damage' }>,
  baseStr: number,
  target?: Enemy
): number {
  let str = baseStr
  if (effect.bonusPerTargetStatus && target) {
    const stacks = countStatusStacks(
      target.statusEffects ?? [],
      effect.bonusPerTargetStatus.status
    )
    str = Math.floor(str * (1 + effect.bonusPerTargetStatus.scale * stacks))
  }
  return str
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
): {
  state: GameState
  damageMultiplier: number
  buffConsumed: boolean
  lastDamage: number
  lastTarget?: Enemy
  lastMissed?: boolean
} {
  let { state, damageMultiplier, buffConsumed } = ctx
  const enc = state.currentEncounter!
  const player = state.player
  const attackerDex = getEffectiveDexterity(ctx.playerStats, player.statusEffects)

  if (effect.consumeDamageBuff !== false && !buffConsumed) {
    const { multiplier, encounter: encAfterBuff } = consumeDamageMultiplier(enc)
    damageMultiplier = multiplier
    buffConsumed = true
    state = {
      ...state,
      currentEncounter: { ...enc, ...encAfterBuff },
    }
  }

  const baseStr = resolveStatScaling(effect.scaling, ctx.playerStats)
  const rollOpts = buildRollOpts(effect, damageMultiplier)

  if (ctx.combat.targetMode === 'all_enemies_single_roll') {
    const currentEnc = state.currentEncounter!
    const living = currentEnc.enemies.filter((e) => e.hp > 0)
    if (living.length === 0) {
      return { state, damageMultiplier, buffConsumed, lastDamage: 0 }
    }

    const proxy = findSingleTarget(currentEnc, ctx.options, true) ?? living[0]!
    const proxyStr = scaledAttackerStr(effect, baseStr, proxy)
    const { missed } = rollDamage(
      proxyStr,
      proxy.stats.defense,
      attackerDex,
      getEffectiveAgility(proxy.stats, proxy.statusEffects),
      false,
      ctx.rng,
      rollOpts
    )

    if (missed) {
      const missMsg = ctx.combat.log.messageMiss ?? ctx.combat.log.message
      ctx.events.push({
        type: 'miss',
        source: player.id,
        sourceName: player.name,
        message: formatSkillMessage(missMsg, { empowered: empoweredSuffix(damageMultiplier) }),
      })
      return { state, damageMultiplier, buffConsumed, lastDamage: 0, lastMissed: true }
    }

    let updatedEnemies = currentEnc.enemies
    for (const enemy of living) {
      const str = scaledAttackerStr(effect, baseStr, enemy)
      const { damage, crit } = rollDamage(
        str,
        enemy.stats.defense,
        attackerDex,
        getEffectiveAgility(enemy.stats, enemy.statusEffects),
        false,
        ctx.rng,
        { ...rollOpts, guaranteedHit: true }
      )
      updatedEnemies = applyDamageToEnemy(
        { ...currentEnc, enemies: updatedEnemies },
        enemy.id,
        damage
      )

      if (ctx.combat.log.perTargetMessages && ctx.combat.log.perTargetMessage) {
        const template = crit && ctx.combat.log.messageCrit
          ? ctx.combat.log.messageCrit
          : ctx.combat.log.perTargetMessage
        ctx.events.push({
          type: ctx.combat.log.eventType,
          source: player.id,
          sourceName: player.name,
          target: enemy.id,
          targetName: enemy.name,
          amount: damage,
          crit,
          message: formatSkillMessage(template, {
            target: enemy.name,
            targetName: enemy.name,
            damage,
            empowered: empoweredSuffix(damageMultiplier),
          }),
        })
      }
    }

    state = {
      ...state,
      currentEncounter: { ...currentEnc, enemies: updatedEnemies },
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

  if (ctx.combat.targetMode === 'all_enemies') {
    const currentEnc = state.currentEncounter!
    const enemies = currentEnc.enemies.map((e) => {
      if (e.hp <= 0) return e
      const str = scaledAttackerStr(effect, baseStr, e)
      const { damage } = rollDamage(
        str,
        e.stats.defense,
        attackerDex,
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

  const attackerStr = scaledAttackerStr(effect, baseStr, target)
  const hpPct = target.hp / target.maxHp
  const shouldExecute =
    effect.executeMode === 'kill' &&
    effect.executeBelowHpPct !== undefined &&
    hpPct <= effect.executeBelowHpPct

  if (shouldExecute) {
    const damage = target.hp
    const updatedEnemies = applyDamageToEnemy(state.currentEncounter!, target.id, damage)
    state = {
      ...state,
      currentEncounter: { ...state.currentEncounter!, enemies: updatedEnemies },
    }
    if (!ctx.hasFollowUpStatus && !ctx.combat.log.aggregate) {
      ctx.events.push({
        type: ctx.combat.log.eventType,
        source: player.id,
        sourceName: player.name,
        target: target.id,
        targetName: target.name,
        amount: damage,
        crit: true,
        message: formatSkillMessage(ctx.combat.log.messageCrit ?? ctx.combat.log.message, {
          target: target.name,
          targetName: target.name,
          damage,
          empowered: empoweredSuffix(damageMultiplier),
        }),
      })
    }
    const updatedTarget = updatedEnemies.find((e) => e.id === target.id)!
    return {
      state,
      damageMultiplier,
      buffConsumed,
      lastDamage: damage,
      lastTarget: updatedTarget,
      lastMissed: false,
    }
  }

  const damageRollOpts = {
    ...rollOpts,
    critBonus: effect.critBonus ?? rollOpts.critBonus,
  }

  const { damage, crit, missed } = rollDamage(
    attackerStr,
    target.stats.defense,
    attackerDex,
    getEffectiveAgility(target.stats, target.statusEffects),
    false,
    ctx.rng,
    damageRollOpts
  )

  if (missed) {
    const missMsg = ctx.combat.log.messageMiss ?? `You miss {target}!`
    ctx.events.push({
      type: 'miss',
      source: player.id,
      sourceName: player.name,
      target: target.id,
      targetName: target.name,
      message: formatSkillMessage(missMsg, { target: target.name, targetName: target.name }),
    })
    return { state, damageMultiplier, buffConsumed, lastDamage: 0, lastTarget: target, lastMissed: true }
  }

  let updatedEnemies = applyDamageToEnemy(state.currentEncounter!, target.id, damage)
  let updatedTarget = updatedEnemies.find((e) => e.id === target.id)!

  if (effect.defenseDebuffOnHit && damage > 0) {
    const debuff = effect.defenseDebuffOnHit
    const power = resolveStatusPower(debuff.power, ctx.playerStats)
    updatedEnemies = updatedEnemies.map((e) =>
      e.id === target.id
        ? {
            ...e,
            statusEffects: addStatus(e.statusEffects ?? [], debuff.status, debuff.turns, power),
          }
        : e
    )
    updatedTarget = updatedEnemies.find((e) => e.id === target.id)!
  }

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

  return {
    state,
    damageMultiplier,
    buffConsumed,
    lastDamage: damage,
    lastTarget: updatedTarget,
    lastMissed: false,
  }
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
    rng: SeededRandom
  }
): GameState {
  const power = resolveStatusPower(effect.power, ctx.playerStats)
  const targetMode = effect.target ?? 'enemy'

  if (targetMode === 'self') {
    const player = ctx.state.player
    const statusEffects = addStatus(player.statusEffects, effect.status, effect.turns, power, {
      stackMode: effect.stackMode,
      stackCount: effect.stackCount,
    })
    ctx.events.push({
      type: 'status_apply',
      source: player.id,
      sourceName: player.name,
      status: effect.status,
      message: formatSkillMessage(ctx.combat.log.message, {}),
    })
    return {
      ...ctx.state,
      player: { ...player, statusEffects },
    }
  }

  const target = ctx.primaryTarget
  if (!target) return ctx.state

  if (effect.chance) {
    const chance = resolveStatusChance(effect.chance, ctx.playerStats)
    if (ctx.rng.next() >= chance) {
      return ctx.state
    }
  }

  const stackCount =
    effect.stackCount ??
    (effect.stackStat && effect.stackStatScale != null
      ? 1 + Math.floor(ctx.playerStats[effect.stackStat] * effect.stackStatScale)
      : undefined)

  const enc = ctx.state.currentEncounter!
  const enemies = enc.enemies.map((e) => {
    if (e.id !== target.id) return e
    const statusEffects = addStatus(e.statusEffects ?? [], effect.status, effect.turns, power, {
      stackMode: effect.stackMode,
      stackCount,
    })
    return { ...e, statusEffects }
  })

  const player = ctx.state.player
  const hasDamageLog = ctx.lastDamage > 0

  ctx.events.push({
    type: hasDamageLog ? 'skill' : 'status_apply',
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

const CLEANSEABLE_STATUSES: StatusType[] = ['poison', 'bleed', 'slow', 'accuracy_down']

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

  if (combat.targetMode === 'single_enemy' || combat.targetMode === 'all_enemies_single_roll') {
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
  let lastMissed = false

  if (combat.targetMode === 'single_enemy' || combat.targetMode === 'all_enemies_single_roll') {
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
        lastMissed = outcome.lastMissed ?? false
        if (outcome.lastTarget) primaryTarget = outcome.lastTarget
        break
      }
      case 'heal': {
        const heal =
          effect.flat +
          (effect.stat && effect.statScale != null
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
        if (!lastMissed || effect.target === 'self') {
          result = applyStatusEffect(effect, {
            state: result,
            combat,
            playerStats,
            events,
            primaryTarget,
            lastDamage,
            damageMultiplier,
            rng,
          })
        }
        break
      case 'remove_status': {
        const hadPoison = result.player.statusEffects.some((s) => s.type === 'poison')
        const toRemove = effect.status
          ? [effect.status]
          : CLEANSEABLE_STATUSES
        const remaining = result.player.statusEffects.filter((s) => !toRemove.includes(s.type))
        let bonusHeal = 0
        if (hadPoison && effect.bonusHealStat && effect.bonusHealScale != null) {
          bonusHeal = Math.floor(playerStats[effect.bonusHealStat] * effect.bonusHealScale)
        }
        const newHp = Math.min(result.player.maxHp, result.player.hp + bonusHeal)
        result = {
          ...result,
          player: { ...result.player, statusEffects: remaining, hp: newHp },
        }
        events.push({
          type: combat.log.eventType,
          source: result.player.id,
          sourceName: result.player.name,
          amount: bonusHeal > 0 ? bonusHeal : undefined,
          message: combat.log.message,
        })
        break
      }
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
      case 'add_combat_buff': {
        if (!result.currentEncounter) break
        const buff = {
          id: `skill_buff_${skill.id}_${Date.now()}`,
          label: effect.label,
          evasionBonus: effect.evasionBonus,
          damageTakenMultiplier: effect.damageTakenMultiplier,
          damageMultiplier: effect.damageMultiplier,
        }
        result = {
          ...result,
          currentEncounter: addCombatBuff(result.currentEncounter, buff),
        }
        events.push({
          type: 'skill',
          source: result.player.id,
          sourceName: result.player.name,
          message: formatSkillMessage(combat.log.message, {}),
        })
        break
      }
      case 'revive':
        break
    }
  }

  return result
}
