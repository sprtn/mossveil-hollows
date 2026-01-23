/**
 * Core game loop - pure logic, no Vue dependencies
 * 
 * Philosophy: Each function is testable in isolation.
 * Side effects (UI updates) happen outside this module.
 */

import type {
  GameState,
  Player,
  Room,
  Encounter,
  EncounterResult,
  PlayerAction,
  Enemy,
  InventoryItem,
  CombatResults,
} from './GameLoopDesign'
import { checkLevelUp, calculateMaxHp, calculateStrength, calculateDefense, calculateSpeed } from './ProgressionSystem'
import { loadRoom as loadRoomFromManager } from './RoomManager'
import type { Room as RoomSystemRoom } from './RoomSystem'

/**
 * Seeded random number generator (matches EncounterSystem)
 */
class SeededRandom {
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

  nextInRange(min: number, max: number): number {
    return min + this.nextInt(Math.max(0, max - min + 1))
  }
}

/**
 * Convert RoomSystem Room to GameLoopDesign Room
 */
function convertRoom(roomSystemRoom: RoomSystemRoom): Room {
  // Extract picture from room if it exists (JSON files have picture field)
  const picture = (roomSystemRoom as any).picture as string | undefined
  
  return {
    id: roomSystemRoom.id,
    name: roomSystemRoom.name,
    description: roomSystemRoom.description,
    nodeCount: 3, // Default node count for compatibility
    encounters: roomSystemRoom.encounters || [],
    exits: roomSystemRoom.exits,
    picture: picture,
  }
}

/**
 * Load a room and convert it to GameLoopDesign format
 */
async function loadRoom(roomId: string): Promise<Room> {
  const roomSystemRoom = await loadRoomFromManager(roomId)
  return convertRoom(roomSystemRoom)
}

/**
 * Generate a deterministic seed from room ID and turn count
 */
function generateSeed(roomId: string, turnCount: number, extra: number = 0): number {
  // Hash room ID to a number
  let hash = 0
  for (let i = 0; i < roomId.length; i++) {
    const char = roomId.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  // Combine with turnCount and extra for unique seeds per action
  return Math.abs((hash * 73856093) ^ (turnCount * 19349663) ^ (extra * 83492791))
}

/**
 * Get or create a seed for the current state
 */
function getStateSeed(state: GameState, extra: number = 0): number {
  if (state.seed !== undefined) {
    // Use existing seed, but advance it for different operations
    return generateSeed(state.currentRoom.id, state.turnCount, extra)
  }
  // Generate new seed from room ID and turn count
  return generateSeed(state.currentRoom.id, state.turnCount, extra)
}

/**
 * Initialize game with player and first room
 */
export function initGame(player: Player, firstRoom: Room, seed?: number): GameState {
  return {
    phase: 'room_enter',
    player,
    currentRoom: firstRoom,
    roomHistory: [firstRoom.id],
    turnCount: 0,
    seed: seed ?? generateSeed(firstRoom.id, 0),
    encounterChainCount: 0,
    lastHealingOpportunity: 0,
    moveCount: 0,
  }
}

/**
 * Enter a room: reset exploration state, check for auto-triggers
 */
export function enterRoom(state: GameState, room: Room, previousRoomId?: string): GameState {
  const updatedState: GameState = {
    ...state,
    phase: 'room_exploring',
    currentRoom: room,
    currentEncounter: undefined,
    previousRoomId: previousRoomId,
    moveCount: 0, // Reset move count when entering a new room
  }

  // Add to room history if not already there
  if (!state.roomHistory.includes(room.id)) {
    updatedState.roomHistory = [...state.roomHistory, room.id]
  }

  // Check for auto-trigger encounters
  const autoEncounter = room.encounters.find((e) => e.onTrigger === 'auto')
  if (autoEncounter) {
    return triggerEncounter(updatedState, autoEncounter.enemies)
  }

  return updatedState
}

/**
 * Check if player needs a healing opportunity (prevent unwinnable states)
 * Returns true if player has had too many consecutive encounters without healing
 */
function shouldProvideHealingOpportunity(state: GameState): boolean {
  const chainCount = state.encounterChainCount || 0
  const lastHealing = state.lastHealingOpportunity || 0
  const turnsSinceHealing = state.turnCount - lastHealing

  // Provide healing opportunity if:
  // 1. Player has had 3+ consecutive encounters, OR
  // 2. Player HP is below 30% and has had 2+ encounters, OR
  // 3. It's been 5+ turns since last healing opportunity
  const hpPercent = state.player.hp / state.player.maxHp
  return (
    chainCount >= 3 ||
    (hpPercent < 0.3 && chainCount >= 2) ||
    turnsSinceHealing >= 5
  )
}

/**
 * Player moves within room - check for encounter triggers
 */
export function moveInRoom(state: GameState, newNode: number): GameState {
  if (state.phase !== 'room_exploring') return state

  // Increment move count to ensure seed varies with each move
  const newMoveCount = (state.moveCount || 0) + 1

  // Use seeded RNG for deterministic testing
  // Include moveCount to ensure seed varies with each move
  const seed = getStateSeed(state, newNode + newMoveCount * 1000)
  const rng = new SeededRandom(seed)

  // Prevent unwinnable states: reduce encounter chance if player needs healing
  const needsHealing = shouldProvideHealingOpportunity(state)
  const encounterChanceMultiplier = needsHealing ? 0.5 : 1.0

  // Check for random encounters (old system - direct encounter definitions)
  const randomEncounters = state.currentRoom.encounters.filter(
    (e) => e.type === 'random' && e.triggerChance
  )

  for (const enc of randomEncounters) {
    // Use seeded RNG for deterministic encounter triggering
    // Reduce chance if player needs healing to prevent unwinnable chains
    const adjustedChance = (enc.triggerChance || 0) * encounterChanceMultiplier
    const roll = rng.next()
    if (roll < adjustedChance) {
      return triggerEncounter(state, enc.enemies)
    }
  }

  // Check if reached next room exit (deprecated - use exits array instead)
  if (state.currentRoom.nodeCount && newNode === state.currentRoom.nodeCount - 1 && state.currentRoom.nextRoomId) {
    return {
      ...state,
      phase: 'room_enter',
      roomHistory: [...state.roomHistory, state.currentRoom.nextRoomId],
      moveCount: 0, // Reset move count when changing rooms
    }
  }

  // Update move count even if no encounter triggered
  return {
    ...state,
    moveCount: newMoveCount,
  }
}

/**
 * Explore current room - attempt to trigger a random encounter
 */
export function exploreRoom(state: GameState): GameState {
  if (state.phase !== 'room_exploring') return state

  // Increment move count to ensure seed varies
  const newMoveCount = (state.moveCount || 0) + 1

  // Use seeded RNG for deterministic encounter triggering
  const seed = getStateSeed(state, newMoveCount * 1000)
  const rng = new SeededRandom(seed)

  // Prevent unwinnable states: reduce encounter chance if player needs healing
  const needsHealing = shouldProvideHealingOpportunity(state)
  const encounterChanceMultiplier = needsHealing ? 0.5 : 1.0

  // Check for random encounters
  const randomEncounters = state.currentRoom.encounters.filter(
    (e) => e.type === 'random' && e.triggerChance
  )

  for (const enc of randomEncounters) {
    // Use seeded RNG for deterministic encounter triggering
    const adjustedChance = (enc.triggerChance || 0) * encounterChanceMultiplier
    const roll = rng.next()
    if (roll < adjustedChance) {
      return triggerEncounter(state, enc.enemies)
    }
  }

  // No encounter triggered, just update move count
  return {
    ...state,
    moveCount: newMoveCount,
  }
}

/**
 * Go to a specific room by ID
 * Validates the room exists in current room's exits
 */
export async function goToRoom(state: GameState, targetRoomId: string): Promise<GameState> {
  if (state.phase !== 'room_exploring') return state

  // Check if targetRoomId exists in current room's exits
  const hasExit = state.currentRoom.exits?.some((exit) => exit.targetRoomId === targetRoomId)
  
  // Also check deprecated nextRoomId for backward compatibility
  const isNextRoom = state.currentRoom.nextRoomId === targetRoomId

  if (!hasExit && !isNextRoom) {
    console.warn(`Cannot go to ${targetRoomId}: not found in current room exits`)
    return state
  }

  // Check if exit is locked or hidden
  const exit = state.currentRoom.exits?.find((e) => e.targetRoomId === targetRoomId)
  if (exit) {
    if (exit.hidden) {
      console.warn(`Cannot go to ${targetRoomId}: exit is hidden`)
      return state
    }
    if (exit.locked && exit.requiresItem) {
      const hasItem = state.player.inventory.some((item) => item.id === exit.requiresItem)
      if (!hasItem) {
        console.warn(`Cannot go to ${targetRoomId}: requires item ${exit.requiresItem}`)
        return state
      }
    }
  }

  try {
    // Load the target room
    const targetRoom = await loadRoom(targetRoomId)
    
    // Enter the new room, setting previousRoomId to current room
    return enterRoom(state, targetRoom, state.currentRoom.id)
  } catch (error) {
    console.error(`Failed to load room ${targetRoomId}:`, error)
    return state
  }
}

/**
 * Go back to the previous room
 */
export async function goBack(state: GameState): Promise<GameState> {
  if (state.phase !== 'room_exploring') return state
  if (!state.previousRoomId) {
    console.warn('Cannot go back: no previous room')
    return state
  }

  try {
    // Load the previous room
    const previousRoom = await loadRoom(state.previousRoomId)
    
    // Enter the previous room, setting previousRoomId to current room (so we can go back again)
    return enterRoom(state, previousRoom, state.currentRoom.id)
  } catch (error) {
    console.error(`Failed to load previous room ${state.previousRoomId}:`, error)
    return state
  }
}

/**
 * Trigger an encounter
 */
export function triggerEncounter(state: GameState, enemies: Enemy[]): GameState {
  const turnOrder = calculateTurnOrder([state.player, ...enemies])

  // Generate deterministic encounter ID from seed
  const seed = getStateSeed(state, state.turnCount)
  const encounterId = `enc_${state.currentRoom.id}_${state.turnCount}_${seed}`
  
  const encounter: Encounter = {
    id: encounterId,
    enemies,
    turnOrder,
    currentTurnIndex: 0,
    roundNumber: 1,
  }

  // Increment encounter chain count (track consecutive encounters)
  const chainCount = (state.encounterChainCount || 0) + 1

  return {
    ...state,
    phase: 'encounter_action',
    currentEncounter: encounter,
    encounterChainCount: chainCount,
  }
}

/**
 * Calculate turn order based on speed stat
 */
export function calculateTurnOrder(combatants: (Player | Enemy)[]): string[] {
  return combatants
    .sort((a, b) => b.stats.speed - a.stats.speed)
    .map((c) => c.id)
}

/**
 * Player takes action in encounter
 */
export function playerAction(state: GameState, action: PlayerAction, targetId?: string): GameState {
  if (!state.currentEncounter) return state

  let result: GameState = {
    ...state,
    currentEncounter: {
      ...state.currentEncounter,
      playerAction: action,
      // Preserve combatLog when updating encounter
      combatLog: state.currentEncounter.combatLog || [],
    },
  }

  // Resolve player action
  switch (action) {
    case 'attack':
      result = resolveAttack(result, state.player.id, targetId || state.currentEncounter?.enemies[0]?.id || '')
      break
    case 'flee':
      return endEncounter(result, 'flee')
    case 'defend':
      // TODO: Apply defense bonus
      break
    case 'use_item':
      // TODO: Consume item and apply effect
      break
  }

  // Check encounter end
  const allEnemiesDead = result.currentEncounter?.enemies.every((e) => e.hp <= 0)
  if (allEnemiesDead) {
    return endEncounter(result, 'win')
  }

  // Enemy turns
  result = executeEnemyTurns(result)

  // Check if player defeated
  if (result.player.hp <= 0) {
    return endEncounter(result, 'loss')
  }

  return result
}

/**
 * Resolve an attack action
 */
export function resolveAttack(state: GameState, attackerId: string, defenderId: string): GameState {
  if (!state.currentEncounter) return state

  const attacker = attackerId === state.player.id ? state.player : 
                   state.currentEncounter.enemies.find((e) => e.id === attackerId)
  const defender = defenderId === state.player.id ? state.player :
                   state.currentEncounter.enemies.find((e) => e.id === defenderId)

  if (!attacker || !defender) return state

  // Simple damage calculation: attacker strength - defender defense
  const baseDamage = Math.max(1, attacker.stats.strength - defender.stats.defense)
  // Use seeded RNG for deterministic damage variance
  const seed = getStateSeed(state, state.currentEncounter.roundNumber || 0)
  const rng = new SeededRandom(seed)
  const variance = Math.floor(rng.next() * 5) - 2 // -2 to +2
  const totalDamage = Math.max(1, baseDamage + variance)

  // Apply damage
  if (attackerId === state.player.id) {
    const updatedEnemies = state.currentEncounter.enemies.map((e) =>
      e.id === defenderId ? { ...e, hp: Math.max(0, e.hp - totalDamage) } : e
    )
    return {
      ...state,
      currentEncounter: {
        ...state.currentEncounter,
        enemies: updatedEnemies,
      },
    }
  } else {
    return {
      ...state,
      player: {
        ...state.player,
        hp: Math.max(0, state.player.hp - totalDamage),
      },
    }
  }
}

/**
 * Execute all enemy turns
 * Returns state with enemy attacks logged individually
 */
export function executeEnemyTurns(state: GameState): GameState {
  if (!state.currentEncounter) return state

  let result = state
  const enemyAttacks: Array<{ enemyId: string; enemyName: string; damage: number }> = []

  // Simple AI: each alive enemy attacks player
  for (const enemy of state.currentEncounter.enemies) {
    if (enemy.hp > 0) {
      const playerHpBefore = result.player.hp
      result = resolveAttack(result, enemy.id, state.player.id)
      const playerHpAfter = result.player.hp
      const damage = playerHpBefore - playerHpAfter
      
      // Always log enemy attacks, even if they deal 0 damage
      enemyAttacks.push({
        enemyId: enemy.id,
        enemyName: enemy.name,
        damage: damage,
      })
      
      // Preserve combatLog through resolveAttack
      if (result.currentEncounter && state.currentEncounter.combatLog) {
        result.currentEncounter.combatLog = state.currentEncounter.combatLog
      }
    }
  }

  // Log enemy attacks to combat log (always log, even if damage is 0)
  if (result.currentEncounter && enemyAttacks.length > 0) {
    const currentLog = result.currentEncounter.combatLog || []
    const attackMessages = enemyAttacks.map(attack => 
      attack.damage > 0 
        ? `${attack.enemyName} attacks you for ${attack.damage} damage!`
        : `${attack.enemyName} attacks you but deals no damage!`
    )
    const updatedLog = [...attackMessages, ...currentLog].slice(0, 50)
    result.currentEncounter.combatLog = updatedLog
  }

  // Increment round
  if (result.currentEncounter) {
    result.currentEncounter.roundNumber += 1
    // Preserve combatLog (already updated above)
  }

  return result
}

/**
 * Use a consumable item from inventory
 * Removes item and applies effect (e.g., heal HP)
 */
export function useItem(state: GameState, itemId: string): GameState {
  const item = state.player.inventory.find((i) => i.id === itemId)
  
  if (!item) {
    return state // Item not found, no change
  }
  
  // Only consumables can be used
  if (item.type !== 'consumable') {
    return state // Not a consumable, no change
  }
  
  // Apply effect if present
  let updatedPlayer = { ...state.player }
  
  if (item.effect?.hpRestore) {
    updatedPlayer.hp = Math.min(
      updatedPlayer.hp + item.effect.hpRestore,
      updatedPlayer.maxHp
    )
  }
  
  // Remove item from inventory (reduce quantity or remove)
  const updatedInventory = [...updatedPlayer.inventory]
  const itemIndex = updatedInventory.findIndex((i) => i.id === itemId)
  
  if (itemIndex !== -1) {
    const inventoryItem = updatedInventory[itemIndex]
    if (inventoryItem && inventoryItem.quantity > 1) {
      // Reduce quantity
      updatedInventory[itemIndex] = {
        ...inventoryItem,
        quantity: inventoryItem.quantity - 1,
      }
    } else if (inventoryItem) {
      // Remove entirely
      updatedInventory.splice(itemIndex, 1)
    }
  }
  
  updatedPlayer.inventory = updatedInventory
  
  return {
    ...state,
    player: updatedPlayer,
  }
}

/**
 * Allocate an attribute point to a stat
 */
export function allocateAttributePoint(state: GameState, stat: 'strength' | 'defense' | 'speed'): GameState {
  const player = state.player
  const availablePoints = player.unallocatedAttributePoints || 0

  if (availablePoints <= 0) {
    return state // No points available
  }

  const updatedPlayer = {
    ...player,
    unallocatedAttributePoints: availablePoints - 1,
    stats: {
      ...player.stats,
      [stat]: player.stats[stat] + 1,
    },
  }

  return {
    ...state,
    player: updatedPlayer,
  }
}

/**
 * End encounter: apply rewards, return to room
 * @param combatLog Optional array of combat log messages to display in results
 */
export function endEncounter(state: GameState, result: EncounterResult, combatLog: string[] = []): GameState {
  if (!state.currentEncounter) return state

  let updatedPlayer = { ...state.player }
  let newLastHealingOpportunity = state.lastHealingOpportunity
  let newChainCount = state.encounterChainCount || 0

  // Collect combat results for display
  let totalXp = 0
  let totalLoot: InventoryItem[] = []
  let levelsGained = 0

  // Apply rewards on win
  if (result === 'win') {
    for (const enemy of state.currentEncounter.enemies) {
      totalXp += enemy.xpReward || 0
      if (enemy.loot) {
        totalLoot.push(...enemy.loot)
      }
    }

    // Add XP to player
    const newXp = updatedPlayer.xp + totalXp
    updatedPlayer.xp = newXp

    // Check for level ups and award attribute points
    const oldLevel = updatedPlayer.level
    const newLevel = checkLevelUp(oldLevel, newXp)
    levelsGained = newLevel - oldLevel
    
    if (levelsGained > 0) {
      // Calculate base stats for new level (automatic scaling)
      const newMaxHp = calculateMaxHp(newLevel)
      const baseStrength = calculateStrength(newLevel)
      const baseDefense = calculateDefense(newLevel)
      const baseSpeed = calculateSpeed(newLevel)
      
      // Calculate how many attribute points have been allocated
      // (current stats - base stats at old level)
      const oldBaseStrength = calculateStrength(oldLevel)
      const oldBaseDefense = calculateDefense(oldLevel)
      const oldBaseSpeed = calculateSpeed(oldLevel)
      
      const allocatedStrength = updatedPlayer.stats.strength - oldBaseStrength
      const allocatedDefense = updatedPlayer.stats.defense - oldBaseDefense
      const allocatedSpeed = updatedPlayer.stats.speed - oldBaseSpeed
      
      // Update player with new level and recalculated stats
      updatedPlayer.level = newLevel
      updatedPlayer.maxHp = newMaxHp
      updatedPlayer.hp = Math.min(updatedPlayer.hp, newMaxHp) // Cap HP to new max
      
      // Apply base stats + previously allocated attribute points
      updatedPlayer.stats = {
        strength: baseStrength + allocatedStrength,
        defense: baseDefense + allocatedDefense,
        speed: baseSpeed + allocatedSpeed,
      }
      
      // Award 1 attribute point per level gained
      updatedPlayer.unallocatedAttributePoints = (updatedPlayer.unallocatedAttributePoints || 0) + levelsGained
    }

    // Add loot to inventory
    for (const item of totalLoot) {
      const existingItem = updatedPlayer.inventory.find((i) => i.id === item.id)
      if (existingItem) {
        existingItem.quantity += item.quantity
      } else {
        updatedPlayer.inventory.push(item)
      }
    }

    // Check if player received healing items (reset healing opportunity tracking)
    const hasHealingItem = totalLoot.some(
      (item) => item.id === 'health_potion' || item.type === 'consumable'
    )
    if (hasHealingItem) {
      newLastHealingOpportunity = state.turnCount + 1
      // Reset chain count when player gets healing opportunity
      newChainCount = 0
    }
  } else if (result === 'flee') {
    // Reset encounter chain on flee (player escaped, gets a break)
    newChainCount = 0
  }
  // On loss, chain count persists (but game is over anyway)

  const gameOverReason = result === 'loss' ? 'defeat' : result === 'win' ? 'victory' : undefined

  // Get combat log from encounter if available
  const encounterCombatLog = state.currentEncounter?.combatLog || combatLog

  // Create combat results for display
  const combatResults: CombatResults = {
    result,
    xpGained: totalXp,
    lootGained: totalLoot,
    combatLog: encounterCombatLog,
    levelsGained,
  }

  return {
    ...state,
    phase: result === 'loss' ? 'game_over' : 'combat_results',
    player: updatedPlayer,
    currentEncounter: undefined,
    combatResults: combatResults,
    gameOverReason: gameOverReason as any,
    turnCount: state.turnCount + 1,
    encounterChainCount: newChainCount,
    lastHealingOpportunity: newLastHealingOpportunity,
  }
}
