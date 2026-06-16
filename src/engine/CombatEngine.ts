/**
 * Combat engine - structured events, skills, status effects, enemy AI
 */

import type {
  CombatEvent,
  Encounter,
  Enemy,
  EnemyArchetype,
  GameState,
  Player,
  PlayerAction,
  PlayerActionOptions,
  StatusEffect,
  StatusType,
} from './GameLoopDesign'
import { getEffectiveStats } from './ItemDatabase'
import { DEFAULT_MAX_ENERGY, DEFAULT_MAX_STAMINA } from './gameConfig'
import { calculateMaxHp, getBaseStatsForLevel } from './ProgressionSystem'
import { consumeDamageMultiplier } from './combatBuffs'
import { resolveSkillEffects } from './SkillEffects'
import { getSkillByAction } from './SkillSystem'
import { DEFAULT_QUALITY } from './Quality'
import { createDefaultProfessions } from './Professions'
import { createDefaultUnlockedProfessionTiers } from './ProfessionTraining'

export class SeededRandom {
  seed: number
  constructor(seed: number) {
    this.seed = seed
  }
  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280
    return this.seed / 233280
  }
  nextInt(max: number): number {
    return Math.floor(this.next() * max)
  }
}

export function generateCombatSeed(state: GameState, extra = 0): number {
  const enc = state.currentEncounter
  if (!enc) return state.seed ?? 0
  return Math.abs(
    ((state.seed ?? 0) * 73856093) ^
      (enc.roundNumber * 19349663) ^
      (extra * 83492791)
  )
}

export function eventToLogMessage(event: CombatEvent): string {
  return event.message
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val))
}

/** Crit chance from Dexterity (0..0.5). */
export function critChanceFor(dex: number, bonus = 0): number {
  return Math.min(0.5, 0.05 + dex * 0.015 + bonus)
}

/** Miss chance for an attacker with `dex` striking a defender with `agi`. */
export function missChanceFor(attackerDex: number, defenderAgi: number): number {
  return clamp(0.1 - attackerDex * 0.006 + defenderAgi * 0.012, 0.05, 0.45)
}

/** Hit chance (accuracy) vs a neutral (agility 0) target, from Dexterity. */
export function accuracyFor(dex: number): number {
  return 1 - missChanceFor(dex, 0)
}

/** Evasion: how much this Agility raises an attacker's miss chance against you (0..0.45). */
export function evasionFor(agi: number): number {
  return Math.min(0.45, Math.max(0, agi * 0.012))
}

export function getEffectiveAgility(
  stats: { agility: number },
  statusEffects: StatusEffect[] = []
): number {
  let agi = stats.agility
  for (const effect of statusEffects) {
    if (effect.type === 'slow' && effect.turnsRemaining > 0) {
      agi -= effect.power
    }
  }
  return Math.max(1, agi)
}

export function splitEnemiesByInitiative(
  playerAgi: number,
  enemies: Enemy[]
): { fast: Enemy[]; slow: Enemy[] } {
  const fast: Enemy[] = []
  const slow: Enemy[] = []
  for (const enemy of enemies) {
    if (enemy.hp <= 0) continue
    const agi = getEffectiveAgility(enemy.stats, enemy.statusEffects ?? [])
    if (agi > playerAgi) fast.push(enemy)
    else slow.push(enemy)
  }
  return { fast, slow }
}

export function rollExtraActionChance(selfAgi: number, opponentAgi: number, rng: SeededRandom): boolean {
  const extraChance = clamp((selfAgi - opponentAgi) * 0.03, 0, 0.4)
  return extraChance > 0 && rng.next() < extraChance
}

function createRngFromEncounter(encounter: Encounter): SeededRandom {
  return new SeededRandom(encounter.rngState)
}

function saveRngToEncounter(encounter: Encounter, rng: SeededRandom): Encounter {
  return { ...encounter, rngState: rng.seed }
}

export interface DamageResult {
  damage: number
  crit: boolean
  missed: boolean
}

export function rollDamage(
  attackerStr: number,
  defenderDef: number,
  attackerDex: number,
  defenderAgi: number,
  defenderDefending: boolean,
  rng: SeededRandom,
  options: {
    critBonus?: number
    guaranteedHit?: boolean
    defenseMultiplier?: number
    damageMultiplier?: number
  } = {}
): DamageResult {
  const critChance = critChanceFor(attackerDex, options.critBonus ?? 0)
  const crit = rng.next() < critChance
  const missChance = missChanceFor(attackerDex, defenderAgi)
  if (!options.guaranteedHit && rng.next() < missChance) {
    return { damage: 0, crit: false, missed: true }
  }

  const defMult = options.defenseMultiplier ?? (defenderDefending ? 0.5 : 1.0)
  const effectiveDef = Math.floor(defenderDef * defMult)
  const base = Math.max(1, attackerStr - effectiveDef)
  const variance = rng.nextInt(5) - 2
  let damage = Math.max(1, base + variance)
  if (crit) damage = Math.floor(damage * (1.5 + attackerDex * 0.01))
  if (options.damageMultiplier && options.damageMultiplier > 1) {
    damage = Math.max(1, Math.floor(damage * options.damageMultiplier))
  }

  return { damage, crit, missed: false }
}

export function applyStatusTick(
  target: { hp: number; maxHp: number; statusEffects: StatusEffect[] },
  isPlayer: boolean
): { hp: number; statusEffects: StatusEffect[]; events: CombatEvent[] } {
  const events: CombatEvent[] = []
  let hp = target.hp
  const remaining: StatusEffect[] = []

  for (const effect of target.statusEffects) {
    if (effect.type === 'poison' && effect.turnsRemaining > 0) {
      const dmg = effect.power
      hp = Math.max(0, hp - dmg)
      events.push({
        type: 'status_tick',
        source: 'status',
        sourceName: 'Poison',
        target: isPlayer ? 'player' : 'enemy',
        amount: dmg,
        status: 'poison',
        message: `Poison deals ${dmg} damage!`,
      })
    }
    if (effect.type === 'bleed' && effect.turnsRemaining > 0) {
      const dmg = effect.power
      hp = Math.max(0, hp - dmg)
      events.push({
        type: 'status_tick',
        source: 'status',
        sourceName: 'Bleed',
        target: isPlayer ? 'player' : 'enemy',
        amount: dmg,
        status: 'bleed',
        message: `Bleeding deals ${dmg} damage!`,
      })
    }
    if (effect.turnsRemaining > 1) {
      remaining.push({ ...effect, turnsRemaining: effect.turnsRemaining - 1 })
    }
  }

  return { hp, statusEffects: remaining, events }
}

export function addStatus(
  effects: StatusEffect[],
  type: StatusType,
  turns: number,
  power: number
): StatusEffect[] {
  const existing = effects.find((e) => e.type === type)
  if (existing) {
    return effects.map((e) =>
      e.type === type
        ? { type, turnsRemaining: Math.max(e.turnsRemaining, turns), power: Math.max(e.power, power) }
        : e
    )
  }
  return [...effects, { type, turnsRemaining: turns, power }]
}

export function isStunned(effects: StatusEffect[]): boolean {
  return effects.some((e) => e.type === 'stun' && e.turnsRemaining > 0)
}

export function tickStun(effects: StatusEffect[]): StatusEffect[] {
  return effects
    .map((e) => (e.type === 'stun' ? { ...e, turnsRemaining: e.turnsRemaining - 1 } : e))
    .filter((e) => e.turnsRemaining > 0)
}

function getEnemyAction(
  enemy: Enemy,
  state: GameState,
  rng: SeededRandom
): { action: 'attack' | 'defend' | 'poison'; targetId: string } {
  const archetype: EnemyArchetype = enemy.archetype ?? 'attacker'
  const playerHpPct = state.player.hp / state.player.maxHp

  switch (archetype) {
    case 'defender':
      if (enemy.hp / enemy.maxHp < 0.4 && rng.next() < 0.6) {
        return { action: 'defend', targetId: state.player.id }
      }
      break
    case 'caster':
      if (rng.next() < 0.35) {
        return { action: 'poison', targetId: state.player.id }
      }
      break
    case 'attacker':
    default:
      if (playerHpPct < 0.3 && rng.next() < 0.2) {
        return { action: 'defend', targetId: state.player.id }
      }
      break
  }
  return { action: 'attack', targetId: state.player.id }
}

export interface CombatActionResult {
  state: GameState
  events: CombatEvent[]
}

function empoweredSuffix(multiplier: number): string {
  return multiplier > 1 ? ' (empowered!)' : ''
}

export function trySecondWind(state: GameState): GameState {
  const knows = (state.player.knownSkills ?? []).includes('skill_second_wind')
  if (!knows || state.flags?.second_wind_used) return state
  if (state.player.hp > 0) return state

  const reviveHp = Math.max(1, Math.floor(state.player.maxHp * 0.3))
  return {
    ...state,
    player: { ...state.player, hp: reviveHp },
    flags: { ...(state.flags ?? {}), second_wind_used: true },
    currentEncounter: state.currentEncounter
      ? {
          ...state.currentEncounter,
          combatLog: [
            'Second Wind revives you!',
            ...(state.currentEncounter.combatLog ?? []),
          ].slice(0, 50),
          lastEvents: [
            {
              type: 'heal',
              source: state.player.id,
              sourceName: state.player.name,
              amount: reviveHp,
              message: `Second Wind! You rally with ${reviveHp} HP!`,
            },
            ...(state.currentEncounter.lastEvents ?? []),
          ],
        }
      : undefined,
  }
}

export function resolvePlayerCombatAction(
  state: GameState,
  action: PlayerAction,
  options: PlayerActionOptions = {}
): CombatActionResult {
  if (!state.currentEncounter) return { state, events: [] }

  const events: CombatEvent[] = []
  const encounter = state.currentEncounter
  let result: GameState = {
    ...state,
    currentEncounter: {
      ...encounter,
      playerAction: action,
      playerDefending: false,
      playerBracing: false,
      combatLog: encounter.combatLog ?? [],
    },
  }
  const enc = result.currentEncounter!

  if (isStunned(result.player.statusEffects)) {
    const stunEvents: CombatEvent[] = [
      {
        type: 'stun_skip',
        source: 'status',
        sourceName: 'Stun',
        message: 'You are stunned and cannot act!',
      },
    ]
    result = tickPlayerStunAndRunEnemies(result, stunEvents)
    return { state: result, events: stunEvents }
  }

  const rng = createRngFromEncounter(enc)
  const playerStats = getEffectiveStats(result.player)

  const persistRng = () => {
    if (result.currentEncounter) {
      result.currentEncounter = saveRngToEncounter(result.currentEncounter, rng)
    }
  }

  switch (action) {
    case 'attack': {
      const targetId = options.targetId ?? enc.enemies.find((e) => e.hp > 0)?.id
      if (!targetId) break
      const target = enc.enemies.find((e) => e.id === targetId)
      if (!target || target.hp <= 0) break

      const { multiplier, encounter: encAfterBuff } = consumeDamageMultiplier(enc)
      result.currentEncounter = { ...enc, ...encAfterBuff }

      const { damage, crit, missed } = rollDamage(
        playerStats.strength,
        target.stats.defense,
        playerStats.dexterity,
        getEffectiveAgility(target.stats, target.statusEffects),
        false,
        rng,
        { damageMultiplier: multiplier > 1 ? multiplier : undefined }
      )

      if (missed) {
        events.push({
          type: 'miss',
          source: result.player.id,
          sourceName: result.player.name,
          target: targetId,
          targetName: target.name,
          message: `You miss ${target.name}!`,
        })
      } else {
        const newHp = Math.max(0, target.hp - damage)
        const enemies = enc.enemies.map((e) =>
          e.id === targetId ? { ...e, hp: newHp } : e
        )
        result.currentEncounter!.enemies = enemies
        const suffix = empoweredSuffix(multiplier)
        events.push({
          type: 'attack',
          source: result.player.id,
          sourceName: result.player.name,
          target: targetId,
          targetName: target.name,
          amount: damage,
          crit,
          message: crit
            ? `Critical hit! You strike ${target.name} for ${damage} damage!${suffix}`
            : `You attack ${target.name} for ${damage} damage!${suffix}`,
        })
      }
      break
    }

    case 'defend': {
      enc.playerDefending = true
      events.push({
        type: 'defend',
        source: result.player.id,
        sourceName: result.player.name,
        message: 'You take a defensive stance.',
      })
      break
    }

    case 'flee': {
      events.push({
        type: 'flee',
        source: result.player.id,
        sourceName: result.player.name,
        message: 'You flee from combat!',
      })
      return { state: result, events }
    }

    default: {
      const skill = getSkillByAction(action)
      if (skill?.combat?.activatable) {
        result = resolveSkillEffects(result, skill, options, rng, events)
      }
      break
    }
  }

  persistRng()
  // Clear on the live encounter object (spread-replace skills swap currentEncounter).
  if (result.currentEncounter?.playerBonusAction) {
    result = {
      ...result,
      currentEncounter: {
        ...result.currentEncounter,
        playerBonusAction: false,
      },
    }
  }

  return { state: result, events }
}

function tickPlayerStunAndRunEnemies(state: GameState, priorEvents: CombatEvent[]): GameState {
  let result = {
    ...state,
    player: {
      ...state.player,
      statusEffects: tickStun(state.player.statusEffects),
    },
  }
  const enemyResult = executeEnemyTurns(result, priorEvents)
  return enemyResult.state
}

export function executeEnemyTurns(
  state: GameState,
  priorEvents: CombatEvent[] = [],
  enemySubset?: Enemy[]
): CombatActionResult {
  if (!state.currentEncounter) return { state, events: priorEvents }

  let result: GameState = { ...state }
  const events = [...priorEvents]
  const enc = result.currentEncounter!
  const playerDefending = enc.playerDefending ?? false
  const playerBracing = enc.playerBracing ?? false
  const defenseMultiplier = playerBracing ? 0.25 : playerDefending ? 0.5 : 1.0
  const playerStats = getEffectiveStats(result.player)
  const playerAgi = getEffectiveAgility(playerStats, result.player.statusEffects)

  const enemiesToAct = enemySubset ?? enc.enemies.filter((e) => e.hp > 0)
  const rng = createRngFromEncounter(enc)

  for (const enemy of enemiesToAct) {
    if (enemy.hp <= 0) continue
    const liveEnemy = enc.enemies.find((e) => e.id === enemy.id)
    if (!liveEnemy || liveEnemy.hp <= 0) continue

    if (isStunned(liveEnemy.statusEffects ?? [])) {
      enc.enemies = enc.enemies.map((e) =>
        e.id === enemy.id ? { ...e, statusEffects: tickStun(e.statusEffects ?? []) } : e
      )
      result.currentEncounter!.enemies = enc.enemies
      events.push({
        type: 'stun_skip',
        source: enemy.id,
        sourceName: enemy.name,
        message: `${enemy.name} is stunned!`,
      })
      continue
    }

    const { action } = getEnemyAction(liveEnemy, result, rng)

    if (action === 'defend') {
      events.push({
        type: 'defend',
        source: enemy.id,
        sourceName: enemy.name,
        message: `${enemy.name} braces for impact.`,
      })
      continue
    }

    if (action === 'poison') {
      result.player = {
        ...result.player,
        statusEffects: addStatus(result.player.statusEffects, 'poison', 3, 4),
      }
      events.push({
        type: 'status_apply',
        source: enemy.id,
        sourceName: enemy.name,
        target: result.player.id,
        targetName: result.player.name,
        status: 'poison',
        message: `${enemy.name} poisons you!`,
      })
    }

    const { damage, crit, missed } = rollDamage(
      liveEnemy.stats.strength,
      playerStats.defense,
      liveEnemy.stats.dexterity,
      playerAgi,
      playerDefending || playerBracing,
      rng,
      { defenseMultiplier }
    )

    if (missed) {
      events.push({
        type: 'miss',
        source: enemy.id,
        sourceName: enemy.name,
        target: result.player.id,
        targetName: result.player.name,
        message: `${enemy.name} misses you!`,
      })
    } else {
      result.player = { ...result.player, hp: Math.max(0, result.player.hp - damage) }
      events.push({
        type: 'attack',
        source: enemy.id,
        sourceName: enemy.name,
        target: result.player.id,
        targetName: result.player.name,
        amount: damage,
        crit,
        message: crit
          ? `${enemy.name} lands a critical hit for ${damage} damage!`
          : `${enemy.name} attacks you for ${damage} damage!`,
      })
    }

    const enemyAgi = getEffectiveAgility(liveEnemy.stats, liveEnemy.statusEffects)
    if (rollExtraActionChance(enemyAgi, playerAgi, rng) && liveEnemy.hp > 0) {
      const { damage: extraDmg, crit: extraCrit, missed: extraMiss } = rollDamage(
        liveEnemy.stats.strength,
        playerStats.defense,
        liveEnemy.stats.dexterity,
        playerAgi,
        playerDefending || playerBracing,
        rng,
        { defenseMultiplier }
      )
      if (!extraMiss) {
        result.player = { ...result.player, hp: Math.max(0, result.player.hp - extraDmg) }
        events.push({
          type: 'attack',
          source: enemy.id,
          sourceName: enemy.name,
          target: result.player.id,
          targetName: result.player.name,
          amount: extraDmg,
          crit: extraCrit,
          message: extraCrit
            ? `${enemy.name} strikes again — critical ${extraDmg} damage!`
            : `${enemy.name} strikes again for ${extraDmg} damage!`,
        })
      }
    }
  }

  const poisonTick = applyStatusTick(
    { hp: result.player.hp, maxHp: result.player.maxHp, statusEffects: result.player.statusEffects },
    true
  )
  result.player = {
    ...result.player,
    hp: poisonTick.hp,
    statusEffects: poisonTick.statusEffects,
  }
  events.push(...poisonTick.events)

  for (const enemy of enc.enemies) {
    if (enemy.hp <= 0) continue
    const tick = applyStatusTick(
      { hp: enemy.hp, maxHp: enemy.maxHp, statusEffects: enemy.statusEffects ?? [] },
      false
    )
    if (tick.hp !== enemy.hp || tick.statusEffects.length !== (enemy.statusEffects?.length ?? 0)) {
      enc.enemies = enc.enemies.map((e) =>
        e.id === enemy.id ? { ...e, hp: tick.hp, statusEffects: tick.statusEffects } : e
      )
      events.push(...tick.events)
    }
  }
  result.currentEncounter!.enemies = enc.enemies

  if (result.currentEncounter) {
    result.currentEncounter = saveRngToEncounter(result.currentEncounter, rng)
    result.currentEncounter.lastEvents = events
    const logMessages = events.map(eventToLogMessage)
    result.currentEncounter.combatLog = [...logMessages, ...(result.currentEncounter.combatLog ?? [])].slice(0, 50)
  }

  return { state: result, events }
}

export function createDefaultPlayer(overrides: Partial<Player> = {}): Player {
  const stats = getBaseStatsForLevel(1)
  const maxHp = calculateMaxHp(1, stats.constitution)
  return {
    id: 'player_1',
    name: 'Hero',
    hp: maxHp,
    maxHp,
    level: 1,
    xp: 0,
    gold: 50,
    energy: DEFAULT_MAX_ENERGY,
    maxEnergy: DEFAULT_MAX_ENERGY,
    stamina: DEFAULT_MAX_STAMINA,
    maxStamina: DEFAULT_MAX_STAMINA,
    inventory: [
      { templateId: 'health_potion', quantity: 2, quality: DEFAULT_QUALITY },
      { templateId: 'rusty_shortsword', quantity: 1, quality: DEFAULT_QUALITY },
      { templateId: 'worn_tunic', quantity: 1, quality: DEFAULT_QUALITY },
    ],
    equipment: {
      weapon: { templateId: 'rusty_shortsword', quality: DEFAULT_QUALITY },
      armor: { templateId: 'worn_tunic', quality: DEFAULT_QUALITY },
    },
    stats,
    statusEffects: [],
    unallocatedAttributePoints: 0,
    materials: {},
    knownSkills: [],
    skillPoints: 0,
    wounded: false,
    professions: createDefaultProfessions(),
    unlockedProfessionTiers: createDefaultUnlockedProfessionTiers(),
    purchasedRecipes: [],
    ...overrides,
  }
}
