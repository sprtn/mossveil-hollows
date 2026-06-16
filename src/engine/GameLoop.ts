/**
 * Core game loop - pure logic, no Vue dependencies
 */

import type {
  CombatEvent,
  CombatResults,
  Encounter,
  EncounterResult,
  GameState,
  InventoryItem,
  Player,
  PlayerAction,
  PlayerActionOptions,
  Room,
  Enemy,
} from './GameLoopDesign'
import {
  checkLevelUp,
  calculateMaxHp,
  calculateStrength,
  calculateDefense,
  calculateConstitution,
  calculateDexterity,
  calculateAgility,
} from './ProgressionSystem'
import { loadRoom as loadRoomFromManager } from './RoomManager'
import type { Room as RoomSystemRoom } from './RoomSystem'
import {
  addItemToInventory,
  applyConsumableEffect,
  getItemTemplate,
  hasItem,
  pickBestQualityStack,
  pickWorstQualityStack,
  removeItemFromInventory,
} from './ItemDatabase'
import { DEFAULT_QUALITY, type Quality } from './Quality'
import { itemTypeRollsQuality, rollLootQuality } from './QualityRoll'
import {
  executeEnemyTurns,
  resolvePlayerCombatAction,
  SeededRandom,
  eventToLogMessage,
  generateCombatSeed,
  splitEnemiesByInitiative,
  getEffectiveAgility,
  rollExtraActionChance,
  trySecondWind,
} from './CombatEngine'
import { addCombatBuff, createCombatBuffFromItem } from './combatBuffs'
import { getEffectiveStats } from './ItemDatabase'
import {
  FINAL_BOSS_ENEMY_ID,
  ZONE_BOSS_IDS,
  ZONE_SHARD_IDS,
  STAMINA_PER_ENCOUNTER,
  STAMINA_PER_MOVE,
  ENERGY_PER_WIN,
  EVENT_CHANCE_ON_EXPLORE,
  START_ROOM_ID,
  type ZoneId,
} from './gameConfig'
import { saveGame, clearSave } from './saveGame'
import { getDefaultGameMeta } from './Outcomes'
import { getEffectiveMaxHp, applyWounded, clampPlayerHp } from './PlayerStats'
import { addMaterial } from './Materials'
import { pickRandomEvent, startEvent, pickGatherHazardEvent } from './EventSystem'
import { resolvePendingGatherAfterCombat, forfeitPendingGather, type PendingGather } from './GatherDanger'
import {
  gatherDangerSeed,
  pickGatherEncounter,
  rollGatherDangerKind,
  GATHER_DANGER_TRIGGER_MESSAGE,
} from './GatherDanger'
import { gatherFromNode as gatherFromNodeCore } from './GatherNodes'
import { checkAndAdvanceQuests } from './QuestSystem'

export function gatherFromNode(state: GameState, nodeId: string): GameState {
  let next = gatherFromNodeCore(state, nodeId)
  if (!next.gatherDangerInterrupt || !next.pendingGather) {
    return next
  }
  return triggerGatherDanger(next, next.pendingGather, nodeId)
}

export function triggerGatherDanger(
  state: GameState,
  pending: PendingGather,
  nodeId: string
): GameState {
  const rng = new SeededRandom(gatherDangerSeed(state, nodeId))
  const hazardEvent = pickGatherHazardEvent(state, state.currentRoom.zoneId ?? 'forest')
  const withPending: GameState = {
    ...state,
    gatherDangerInterrupt: undefined,
    statusMessage: GATHER_DANGER_TRIGGER_MESSAGE,
  }

  const useHazard =
    hazardEvent !== null && rollGatherDangerKind(rng) === 'hazard'

  if (useHazard && hazardEvent) {
    return startEvent(
      { ...withPending, pendingGather: { ...pending, source: 'hazard' } },
      hazardEvent
    )
  }

  const enemies = pickGatherEncounter(state.currentRoom, rng)
  return triggerEncounter(
    { ...withPending, pendingGather: { ...pending, source: 'combat' }, forcedEncounter: true },
    enemies
  )
}

function convertRoom(roomSystemRoom: RoomSystemRoom): Room {
  const r = roomSystemRoom
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    encounters: r.encounters || [],
    exits: r.exits,
    picture: r.picture,
    isHub: r.isHub,
    isFinalBoss: r.isFinalBoss,
    zoneId: r.zoneId,
    difficulty: r.difficulty ?? 0,
    gatherNodes: r.gatherNodes ?? [],
  }
}

export function roomFromAsset(roomSystemRoom: RoomSystemRoom): Room {
  return convertRoom(roomSystemRoom)
}

async function loadRoom(roomId: string): Promise<Room> {
  const roomSystemRoom = await loadRoomFromManager(roomId)
  return convertRoom(roomSystemRoom)
}

function generateSeed(roomId: string, turnCount: number, extra = 0): number {
  let hash = 0
  for (let i = 0; i < roomId.length; i++) {
    const char = roomId.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs((hash * 73856093) ^ (turnCount * 19349663) ^ (extra * 83492791))
}

function getStateSeed(state: GameState, extra = 0): number {
  return generateSeed(state.currentRoom.id, state.turnCount, extra)
}

function drainStamina(player: Player, amount: number): Player {
  return { ...player, stamina: Math.max(0, player.stamina - amount) }
}

function isAreaAccessible(state: GameState, areaId: string): boolean {
  return (state.areasUnlocked ?? ['forest']).includes(areaId)
}

function getRoomAreaId(roomId: string): string | null {
  if (roomId.startsWith('zone_forest')) return 'forest'
  if (roomId.startsWith('zone_cave')) return 'cave'
  if (roomId.startsWith('zone_ruins')) return 'ruins'
  if (roomId === 'final_gate' || roomId === 'final_boss_chamber') return 'final_gate'
  return null
}

export function initGame(player: Player, firstRoom: Room, seed?: number): GameState {
  const meta = getDefaultGameMeta()
  return {
    phase: 'room_enter',
    player: clampPlayerHp(player),
    currentRoom: firstRoom,
    roomHistory: [firstRoom.id],
    turnCount: 0,
    seed: seed ?? generateSeed(firstRoom.id, 0),
    encounterChainCount: 0,
    lastHealingOpportunity: 0,
    moveCount: 0,
    zonesCleared: [],
    finalBossDefeated: false,
    ...meta,
  }
}

export function enterRoom(state: GameState, room: Room, previousRoomId?: string): GameState {
  let updatedState: GameState = {
    ...state,
    phase: 'room_exploring',
    currentRoom: room,
    currentEncounter: undefined,
    previousRoomId,
    moveCount: 0,
    statusMessage: undefined,
  }

  if (!state.roomHistory.includes(room.id)) {
    updatedState.roomHistory = [...state.roomHistory, room.id]
  }

  // Drain stamina on room move (not when entering hub from outside — hub is safe)
  if (!room.isHub && previousRoomId) {
    updatedState.player = drainStamina(updatedState.player, STAMINA_PER_MOVE)
  }

  const autoEncounter = room.encounters.find((e) => e.onTrigger === 'auto')
  if (autoEncounter) {
    return triggerEncounter(updatedState, autoEncounter.enemies)
  }

  if (room.isHub) {
    saveGame(updatedState)
    updatedState = {
      ...updatedState,
      flags: { ...(updatedState.flags ?? {}), second_wind_used: false },
    }
  }

  updatedState = checkAndAdvanceQuests(updatedState)
  return updatedState
}

function shouldProvideHealingOpportunity(state: GameState): boolean {
  const chainCount = state.encounterChainCount || 0
  const lastHealing = state.lastHealingOpportunity || 0
  const turnsSinceHealing = state.turnCount - lastHealing
  const maxHp = getEffectiveMaxHp(state.player)
  const hpPercent = state.player.hp / maxHp
  return chainCount >= 3 || (hpPercent < 0.3 && chainCount >= 2) || turnsSinceHealing >= 5
}

export function exploreRoom(state: GameState): GameState {
  if (state.phase !== 'room_exploring') return state
  if (state.currentRoom.isHub) return state
  if (state.player.stamina <= 0) {
    return { ...state, statusMessage: 'Exhausted — return to town to recover stamina.' }
  }

  const newExploreCount = (state.exploreCount ?? 0) + 1
  const baseState: GameState = { ...state, exploreCount: newExploreCount }
  const seed = getStateSeed(baseState, newExploreCount * 1000)
  const rng = new SeededRandom(seed)
  const needsHealing = shouldProvideHealingOpportunity(baseState)
  const encounterChanceMultiplier = needsHealing ? 0.5 : 1.0

  const randomEncounters = baseState.currentRoom.encounters.filter(
    (e) => e.type === 'random' && e.triggerChance
  )

  for (const enc of randomEncounters) {
    const adjustedChance = (enc.triggerChance || 0) * encounterChanceMultiplier
    if (rng.next() < adjustedChance) {
      return triggerEncounter(baseState, enc.enemies)
    }
  }

  // Event card chance
  const zone = baseState.currentRoom.zoneId ?? 'forest'
  if (rng.next() < EVENT_CHANCE_ON_EXPLORE) {
    const event = pickRandomEvent(baseState, zone)
    if (event) return startEvent(baseState, event)
  }

  return {
    ...baseState,
    statusMessage: 'You search the area but find nothing of note.',
  }
}

export async function goToRoom(state: GameState, targetRoomId: string): Promise<GameState> {
  if (state.phase !== 'room_exploring') return state

  const areaId = getRoomAreaId(targetRoomId)
  if (areaId && areaId !== 'final_gate' && !isAreaAccessible(state, areaId)) {
    return { ...state, statusMessage: 'That area is not yet accessible.' }
  }

  const hasExit = state.currentRoom.exits?.some((exit) => exit.targetRoomId === targetRoomId)
  if (!hasExit) return state

  const exit = state.currentRoom.exits?.find((e) => e.targetRoomId === targetRoomId)
  if (exit) {
    if (exit.hidden) return state
    if (exit.locked) {
      if (exit.requiresItems?.length) {
        const hasAll = exit.requiresItems.every((id) => hasItem(state.player, id))
        if (!hasAll) return state
      } else if (exit.requiresItem) {
        if (!hasItem(state.player, exit.requiresItem)) return state
      } else {
        return state
      }
    }
  }

  // Block deeper travel at 0 stamina unless returning toward hub
  if (state.player.stamina <= 0 && !state.currentRoom.isHub && targetRoomId !== 'town_hub') {
    const goingBack = state.previousRoomId === targetRoomId
    if (!goingBack) {
      return { ...state, statusMessage: 'Exhausted — you can only retreat to safety.' }
    }
  }

  try {
    const targetRoom = await loadRoom(targetRoomId)
    return enterRoom(state, targetRoom, state.currentRoom.id)
  } catch (error) {
    console.error(`Failed to load room ${targetRoomId}:`, error)
    return state
  }
}

export async function goBack(state: GameState): Promise<GameState> {
  if (state.phase !== 'room_exploring' || !state.previousRoomId) return state
  try {
    const previousRoom = await loadRoom(state.previousRoomId)
    return enterRoom(state, previousRoom, state.currentRoom.id)
  } catch (error) {
    console.error(`Failed to load previous room:`, error)
    return state
  }
}

/** Emergency return to town — always available while exploring, even at 0 stamina. */
export async function returnToHub(state: GameState): Promise<GameState> {
  if (state.phase !== 'room_exploring') return state
  if (state.currentRoom.isHub) return state

  try {
    const hubRoom = await loadRoom(START_ROOM_ID)
    const exhausted = state.player.stamina <= 0
    const result = enterRoom(state, hubRoom, state.currentRoom.id)
    return {
      ...result,
      statusMessage: exhausted
        ? 'Exhausted, you limp back to Mossveil Hollow.'
        : 'You return to Mossveil Hollow.',
    }
  } catch (error) {
    console.error('Failed to return to hub:', error)
    return state
  }
}

export function triggerEncounter(state: GameState, enemies: Enemy[]): GameState {
  const seed = getStateSeed(state, state.turnCount)
  const encounterId = `enc_${state.currentRoom.id}_${state.turnCount}_${seed}`
  const rngState = Math.abs(
    generateCombatSeed(state, state.encounterChainCount ?? 0) ^ (Date.now() & 0xffff)
  )

  const encounter: Encounter = {
    id: encounterId,
    enemies: enemies.map((e) => ({ ...e, statusEffects: e.statusEffects ?? [] })),
    roundNumber: 1,
    rngState,
    combatLog: [],
    playerDefending: false,
    playerBracing: false,
    playerBonusAction: false,
    combatBuffs: [],
    consumableUsedThisTurn: false,
  }

  let player = state.player
  if (!state.forcedEncounter) {
    player = drainStamina(player, STAMINA_PER_ENCOUNTER)
  }

  let newState: GameState = {
    ...state,
    phase: 'encounter_action',
    currentEncounter: encounter,
    encounterChainCount: (state.encounterChainCount || 0) + 1,
    player,
    forcedEncounter: undefined,
  }

  const playerAgi = getEffectiveAgility(
    getEffectiveStats(newState.player),
    newState.player.statusEffects
  )
  const { fast } = splitEnemiesByInitiative(playerAgi, encounter.enemies)
  if (fast.length > 0) {
    const fastResult = executeEnemyTurns(newState, [], fast)
    newState = trySecondWind(fastResult.state)
    if (newState.player.hp <= 0) {
      return endEncounter(newState, 'loss', fastResult.events)
    }
  }

  return newState
}

function finishEnemyPhase(
  state: GameState,
  events: CombatEvent[],
  enemies: Enemy[]
): GameState {
  if (enemies.length === 0) return state
  const enemyResult = executeEnemyTurns(state, events, enemies)
  let result = trySecondWind(enemyResult.state)
  if (result.player.hp <= 0) {
    return endEncounter(result, 'loss', enemyResult.events)
  }
  return result
}

function advanceCombatRound(state: GameState, events: CombatEvent[]): GameState {
  if (!state.currentEncounter) return state
  const enc = state.currentEncounter
  const playerAgi = getEffectiveAgility(
    getEffectiveStats(state.player),
    state.player.statusEffects
  )
  const updated: GameState = {
    ...state,
    currentEncounter: {
      ...enc,
      roundNumber: enc.roundNumber + 1,
      playerDefending: false,
      playerBracing: false,
      consumableUsedThisTurn: false,
    },
  }
  const { fast } = splitEnemiesByInitiative(playerAgi, updated.currentEncounter!.enemies)
  return finishEnemyPhase(updated, events, fast)
}

export function maybeGrantPlayerBonusAction(state: GameState): GameState {
  if (!state.currentEncounter) return state
  const enc = state.currentEncounter
  const playerStats = getEffectiveStats(state.player)
  const playerAgi = getEffectiveAgility(playerStats, state.player.statusEffects)
  const aliveEnemies = enc.enemies.filter((e) => e.hp > 0)
  const avgEnemyAgi =
    aliveEnemies.length > 0
      ? aliveEnemies.reduce(
          (sum, e) => sum + getEffectiveAgility(e.stats, e.statusEffects),
          0
        ) / aliveEnemies.length
      : 0
  const rng = new SeededRandom(enc.rngState)
  const granted = rollExtraActionChance(playerAgi, avgEnemyAgi, rng)
  if (!granted) {
    return {
      ...state,
      currentEncounter: { ...enc, rngState: rng.seed },
    }
  }
  return {
    ...state,
    currentEncounter: {
      ...enc,
      rngState: rng.seed,
      playerBonusAction: true,
      consumableUsedThisTurn: false,
      lastEvents: [
        {
          type: 'skill',
          source: state.player.id,
          sourceName: state.player.name,
          message: 'Your agility grants an extra action!',
        },
      ],
    },
  }
}

/** Use a consumable during combat without ending the player's turn. */
export function useCombatConsumable(
  state: GameState,
  templateId: string,
  quality?: Quality
): GameState {
  if (!state.currentEncounter || state.phase !== 'encounter_action') return state
  const enc = state.currentEncounter
  if (enc.consumableUsedThisTurn) return state
  if (!hasItem(state.player, templateId)) return state

  const template = getItemTemplate(templateId)
  if (!template || template.type !== 'consumable') return state

  // Consume lowest-quality stack first when not specified.
  const consumeQuality =
    quality ?? pickWorstQualityStack(state.player.inventory, templateId) ?? DEFAULT_QUALITY
  if (!hasItem(state.player, templateId, consumeQuality)) return state

  let updatedEnc: Encounter = enc
  let updatedPlayer = state.player
  let message: string

  if (template.effect === 'boost_damage') {
    const buff = createCombatBuffFromItem(template, consumeQuality)
    if (!buff) return state
    updatedEnc = addCombatBuff(enc, buff)
    message = `You ready ${template.name} — ${buff.label}.`
  } else {
    const applied = applyConsumableEffect(state.player, template, consumeQuality)
    updatedPlayer = clampPlayerHp(applied.player)
    message = applied.message
  }

  const events: CombatEvent[] = [
    {
      type: 'use_item',
      source: state.player.id,
      sourceName: state.player.name,
      message,
    },
  ]

  return {
    ...state,
    player: {
      ...updatedPlayer,
      inventory: removeItemFromInventory(
        updatedPlayer.inventory,
        templateId,
        1,
        consumeQuality
      ),
    },
    currentEncounter: {
      ...updatedEnc,
      consumableUsedThisTurn: true,
      lastEvents: events,
      combatLog: [message, ...(enc.combatLog ?? [])].slice(0, 50),
    },
  }
}

export function playerAction(
  state: GameState,
  action: PlayerAction,
  options: PlayerActionOptions = {}
): GameState {
  if (!state.currentEncounter) return state

  if (action === 'flee') {
    const fleeResult = resolvePlayerCombatAction(state, 'flee')
    let result = endEncounter(fleeResult.state, 'flee', fleeResult.events)
    result = {
      ...result,
      player: applyWounded(result.player),
    }
    return result
  }

  const combatResult = resolvePlayerCombatAction(state, action, options)
  let result = combatResult.state
  let events = combatResult.events

  const allEnemiesDead = result.currentEncounter?.enemies.every((e) => e.hp <= 0)
  if (allEnemiesDead) return endEncounter(result, 'win', events)

  const playerAgi = getEffectiveAgility(
    getEffectiveStats(result.player),
    result.player.statusEffects
  )
  const { slow } = splitEnemiesByInitiative(playerAgi, result.currentEncounter!.enemies)
  result = finishEnemyPhase(result, events, slow)
  if (result.phase === 'game_over' || result.phase === 'combat_results') return result
  events = result.currentEncounter?.lastEvents ?? events

  if (!result.currentEncounter?.playerBonusAction) {
    result = maybeGrantPlayerBonusAction(result)
    if (result.currentEncounter?.playerBonusAction) return result
  }

  return advanceCombatRound(result, events)
}

export { executeEnemyTurns }

export function useItem(
  state: GameState,
  templateId: string,
  quality?: Quality
): GameState {
  if (state.phase === 'encounter_action') {
    return useCombatConsumable(state, templateId, quality)
  }

  const template = getItemTemplate(templateId)
  if (!template || template.type !== 'consumable' || !hasItem(state.player, templateId)) {
    return state
  }

  const consumeQuality =
    quality ?? pickWorstQualityStack(state.player.inventory, templateId) ?? DEFAULT_QUALITY
  if (!hasItem(state.player, templateId, consumeQuality)) return state

  const { player: updatedPlayer } = applyConsumableEffect(
    state.player,
    template,
    consumeQuality
  )
  return {
    ...state,
    player: clampPlayerHp({
      ...updatedPlayer,
      inventory: removeItemFromInventory(
        updatedPlayer.inventory,
        templateId,
        1,
        consumeQuality
      ),
    }),
  }
}

export function equipItemAction(
  state: GameState,
  templateId: string,
  quality?: Quality
): GameState {
  const template = getItemTemplate(templateId)
  if (!template || !hasItem(state.player, templateId)) return state
  if (template.type !== 'weapon' && template.type !== 'armor') return state

  const q =
    quality ?? pickBestQualityStack(state.player.inventory, templateId) ?? DEFAULT_QUALITY
  if (!hasItem(state.player, templateId, q)) return state

  const equipment = { ...state.player.equipment }
  const ref = { templateId, quality: q }
  if (template.type === 'weapon') equipment.weapon = ref
  else equipment.armor = ref

  return { ...state, player: { ...state.player, equipment } }
}

export function unequipItemAction(state: GameState, slot: 'weapon' | 'armor'): GameState {
  const equipment = { ...state.player.equipment }
  delete equipment[slot]
  return { ...state, player: { ...state.player, equipment } }
}

export function allocateAttributePoint(
  state: GameState,
  stat: 'strength' | 'constitution' | 'dexterity' | 'agility' | 'defense'
): GameState {
  const available = state.player.unallocatedAttributePoints || 0
  if (available <= 0) return state

  const newStats = {
    ...state.player.stats,
    [stat]: state.player.stats[stat] + 1,
  }
  let player = {
    ...state.player,
    unallocatedAttributePoints: available - 1,
    stats: newStats,
  }

  if (stat === 'constitution') {
    const newMaxHp = calculateMaxHp(player.level, newStats.constitution)
    player = {
      ...player,
      maxHp: newMaxHp,
      hp: Math.min(player.hp + 3, newMaxHp),
    }
  }

  return { ...state, player }
}

function detectZoneBossDefeated(enemies: Enemy[], zoneId?: string): ZoneId | null {
  if (!zoneId) return null
  const bossId = ZONE_BOSS_IDS[zoneId as ZoneId]
  const bossDefeated = enemies.some((e) => e.id === bossId || e.isBoss)
  if (bossDefeated) return zoneId as ZoneId
  return null
}

function resolveEnemyLoot(
  enemy: Enemy,
  rng: SeededRandom,
  roomDifficulty = 0
): InventoryItem[] {
  if (!enemy.loot?.length) return []
  const drops: InventoryItem[] = []
  for (const drop of enemy.loot) {
    const chance = drop.chance ?? 1
    if (rng.next() < chance) {
      const template = getItemTemplate(drop.templateId)
      const quality = itemTypeRollsQuality(template?.type)
        ? rollLootQuality(rng, roomDifficulty)
        : DEFAULT_QUALITY
      drops.push({
        templateId: drop.templateId,
        quantity: drop.quantity,
        quality,
      })
    }
  }
  return drops
}

export function endEncounter(
  state: GameState,
  result: EncounterResult,
  events: CombatEvent[] = []
): GameState {
  if (!state.currentEncounter) return state

  let updatedPlayer = { ...state.player }
  let newChainCount = state.encounterChainCount || 0
  let newLastHealing = state.lastHealingOpportunity
  let totalXp = 0
  let totalGold = 0
  const totalLoot: InventoryItem[] = []
  let levelsGained = 0
  let zonesCleared = [...(state.zonesCleared || [])]
  let finalBossDefeated = state.finalBossDefeated ?? false
  let areasUnlocked = [...(state.areasUnlocked ?? ['forest'])]
  let bossesDefeated = [...(state.bossesDefeated ?? [])]
  let flags = { ...(state.flags ?? {}) }
  let phase: GameState['phase'] = result === 'loss' ? 'game_over' : 'combat_results'

  if (result === 'win') {
    const lootRng = new SeededRandom(
      generateCombatSeed(state, state.turnCount) ^ state.currentEncounter.enemies.length
    )
    const roomDifficulty = state.currentRoom.difficulty ?? 0
    for (const enemy of state.currentEncounter.enemies) {
      totalXp += enemy.xpReward || 0
      totalGold += enemy.goldReward ?? 0
      totalLoot.push(...resolveEnemyLoot(enemy, lootRng, roomDifficulty))
      flags[`defeated_${enemy.id}`] = true
    }

    updatedPlayer.xp += totalXp
    updatedPlayer.gold += totalGold
    updatedPlayer.energy = Math.min(
      updatedPlayer.maxEnergy,
      updatedPlayer.energy + ENERGY_PER_WIN
    )

    const oldLevel = updatedPlayer.level
    const newLevel = checkLevelUp(oldLevel, updatedPlayer.xp)
    levelsGained = newLevel - oldLevel

    if (levelsGained > 0) {
      const newMaxHp = calculateMaxHp(newLevel, updatedPlayer.stats.constitution)
      const baseStr = calculateStrength(newLevel)
      const baseDef = calculateDefense(newLevel)
      const baseCon = calculateConstitution(newLevel)
      const baseDex = calculateDexterity(newLevel)
      const baseAgi = calculateAgility(newLevel)
      const oldBaseStr = calculateStrength(oldLevel)
      const oldBaseDef = calculateDefense(oldLevel)
      const oldBaseCon = calculateConstitution(oldLevel)
      const oldBaseDex = calculateDexterity(oldLevel)
      const oldBaseAgi = calculateAgility(oldLevel)

      updatedPlayer.level = newLevel
      updatedPlayer.maxHp = newMaxHp
      updatedPlayer.hp = Math.min(
        updatedPlayer.hp + levelsGained * 6,
        getEffectiveMaxHp({ ...updatedPlayer, maxHp: newMaxHp, wounded: updatedPlayer.wounded })
      )
      updatedPlayer.maxEnergy = Math.min(10, 6 + Math.floor(newLevel / 3))
      updatedPlayer.skillPoints = (updatedPlayer.skillPoints ?? 0) + levelsGained
      updatedPlayer.stats = {
        strength: baseStr + (updatedPlayer.stats.strength - oldBaseStr),
        constitution: baseCon + (updatedPlayer.stats.constitution - oldBaseCon),
        dexterity: baseDex + (updatedPlayer.stats.dexterity - oldBaseDex),
        agility: baseAgi + (updatedPlayer.stats.agility - oldBaseAgi),
        defense: baseDef + (updatedPlayer.stats.defense - oldBaseDef),
      }
      updatedPlayer.unallocatedAttributePoints =
        (updatedPlayer.unallocatedAttributePoints || 0) + levelsGained
    }

    for (const drop of totalLoot) {
      updatedPlayer.inventory = addItemToInventory(
        updatedPlayer.inventory,
        drop.templateId,
        drop.quantity,
        drop.quality
      )
      const template = getItemTemplate(drop.templateId)
      if (template?.type === 'crafting') {
        updatedPlayer = addMaterial(updatedPlayer, drop.templateId, drop.quantity)
      }
    }

    const zoneCleared = detectZoneBossDefeated(
      state.currentEncounter.enemies,
      state.currentRoom.zoneId
    )
    if (zoneCleared && !zonesCleared.includes(zoneCleared)) {
      zonesCleared.push(zoneCleared)
      const shardId = ZONE_SHARD_IDS[zoneCleared]
      updatedPlayer.inventory = addItemToInventory(
        updatedPlayer.inventory,
        shardId,
        1,
        DEFAULT_QUALITY
      )
      totalLoot.push({ templateId: shardId, quantity: 1, quality: DEFAULT_QUALITY })

      if (!bossesDefeated.includes(ZONE_BOSS_IDS[zoneCleared])) {
        bossesDefeated.push(ZONE_BOSS_IDS[zoneCleared])
      }

      if (zoneCleared === 'forest' && !areasUnlocked.includes('cave')) {
        areasUnlocked.push('cave')
        flags.forest_boss_defeated = true
      }
      if (zoneCleared === 'cave' && !areasUnlocked.includes('ruins')) {
        areasUnlocked.push('ruins')
      }
    }

    const finalBossInEncounter = state.currentEncounter.enemies.some(
      (e) => e.id === FINAL_BOSS_ENEMY_ID
    )
    if (finalBossInEncounter || state.currentRoom.isFinalBoss) {
      finalBossDefeated = true
      phase = 'victory'
    }

    const hasHealing = totalLoot.some((d) => d.templateId === 'health_potion')
    if (hasHealing) {
      newLastHealing = state.turnCount + 1
      newChainCount = 0
    }
  } else if (result === 'flee') {
    newChainCount = 0
  }

  updatedPlayer = clampPlayerHp(updatedPlayer)

  const logMessages = events.map(eventToLogMessage)
  const encounterLog = state.currentEncounter.combatLog || []
  const combatLog = [...logMessages, ...encounterLog].slice(0, 50)

  const combatResults: CombatResults = {
    result,
    xpGained: totalXp,
    goldGained: totalGold,
    lootGained: totalLoot.map((d) => ({
      templateId: d.templateId,
      quantity: d.quantity,
      quality: d.quality,
    })),
    combatLog,
    levelsGained,
    events,
  }

  let newState: GameState = {
    ...state,
    phase,
    player: updatedPlayer,
    currentEncounter: undefined,
    combatResults,
    gameOverReason: result === 'loss' ? 'defeat' : undefined,
    turnCount: state.turnCount + 1,
    encounterChainCount: newChainCount,
    lastHealingOpportunity: newLastHealing,
    zonesCleared,
    finalBossDefeated,
    areasUnlocked,
    bossesDefeated,
    flags,
  }

  newState = checkAndAdvanceQuests(newState)

  if (state.pendingGather && result !== 'win') {
    newState = forfeitPendingGather(
      newState,
      result === 'flee' ? 'You fled — the harvest scatters.' : 'Defeated — the harvest is lost.'
    )
  }

  if (phase === 'victory') {
    clearSave()
  } else if (result === 'win' && state.currentRoom.isHub) {
    saveGame(newState)
  }

  return newState
}

export function continueFromCombatResults(state: GameState): GameState {
  if (state.finalBossDefeated) {
    return { ...state, phase: 'victory', combatResults: undefined }
  }
  const resolved = state.pendingGather
    ? resolvePendingGatherAfterCombat(state)
    : state
  return { ...resolved, phase: 'room_exploring', combatResults: undefined }
}

export async function startGameFromRoom(roomId: string, player: Player): Promise<GameState> {
  const room = await loadRoom(roomId)
  const state = initGame(player, room)
  return enterRoom(state, room)
}
