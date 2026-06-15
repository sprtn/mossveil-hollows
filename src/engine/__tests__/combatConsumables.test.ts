import { describe, it, expect } from 'vitest'
import { enterRoom, initGame, playerAction, triggerEncounter, useCombatConsumable } from '../GameLoop'
import { createDefaultPlayer } from '../CombatEngine'
import type { Enemy, Room } from '../GameLoopDesign'

const testRoom: Room = {
  id: 'room_1',
  name: 'Forest',
  description: 'Test',
  encounters: [],
  exits: [],
}

const testEnemy = (): Enemy => ({
  id: 'enemy_1',
  name: 'Goblin',
  hp: 50,
  maxHp: 50,
  level: 1,
  stats: { strength: 5, defense: 2, constitution: 6, dexterity: 4, agility: 4 },
  loot: [],
  goldReward: 5,
  xpReward: 10,
})

import type { InventoryItem } from '../GameLoopDesign'

function combatWithInventory(inventory: InventoryItem[]) {
  const player = createDefaultPlayer({ inventory })
  let state = triggerEncounter(enterRoom(initGame(player, testRoom), testRoom), [testEnemy()])
  return state
}

describe('combat consumables', () => {
  it('using a stake adds a buff without ending the turn', () => {
    let state = combatWithInventory([{ templateId: 'wooden_stake', quantity: 2, quality: 'common' }])
    const roundBefore = state.currentEncounter!.roundNumber
    const enemyHpBefore = state.currentEncounter!.enemies[0]!.hp

    state = useCombatConsumable(state, 'wooden_stake')

    expect(state.currentEncounter!.consumableUsedThisTurn).toBe(true)
    expect(state.currentEncounter!.combatBuffs).toHaveLength(1)
    expect(state.currentEncounter!.combatBuffs![0]!.label).toBe('+50% next attack')
    expect(state.currentEncounter!.roundNumber).toBe(roundBefore)
    expect(state.currentEncounter!.enemies[0]!.hp).toBe(enemyHpBefore)
    expect(state.player.inventory.find((i) => i.templateId === 'wooden_stake')?.quantity).toBe(1)
  })

  it('allows only one consumable per player turn', () => {
    let state = combatWithInventory([
      { templateId: 'wooden_stake', quantity: 1, quality: 'common' },
      { templateId: 'health_potion', quantity: 1, quality: 'common' },
    ])
    state = useCombatConsumable(state, 'wooden_stake')
    const afterStake = state
    state = useCombatConsumable(state, 'health_potion')
    expect(state).toBe(afterStake)
  })

  it('consumes stake buff on the next attack', () => {
    let state = combatWithInventory([{ templateId: 'wooden_stake', quantity: 1, quality: 'common' }])
    const enemyId = state.currentEncounter!.enemies[0]!.id
    state = useCombatConsumable(state, 'wooden_stake')
    state = playerAction(state, 'attack', { targetId: enemyId })
    const events = state.currentEncounter?.lastEvents ?? state.combatResults?.events ?? []
    const attackEvent = events.find((e) => e.type === 'attack' || e.message.includes('attack'))
    expect(state.currentEncounter?.combatBuffs ?? []).toHaveLength(0)
    expect(attackEvent?.message).toContain('empowered')
  })

  it('keeps stake buff after defend until an attack', () => {
    let state = combatWithInventory([{ templateId: 'wooden_stake', quantity: 1, quality: 'common' }])
    state = useCombatConsumable(state, 'wooden_stake')
    state = playerAction(state, 'defend')
    expect(state.currentEncounter!.combatBuffs).toHaveLength(1)

    const enemyId = state.currentEncounter!.enemies[0]!.id
    state = playerAction(state, 'attack', { targetId: enemyId })
    expect(state.currentEncounter?.combatBuffs ?? []).toHaveLength(0)
  })

  it('applies stake multiplier to power strike', () => {
    let state = combatWithInventory([{ templateId: 'wooden_stake', quantity: 1, quality: 'common' }])
    state = {
      ...state,
      player: {
        ...state.player,
        knownSkills: ['skill_power_strike'],
        energy: 20,
      },
    }
    const enemyId = state.currentEncounter!.enemies[0]!.id

    const baseline = playerAction(state, 'skill_power_strike', { targetId: enemyId })
    const baselineDmg =
      baseline.currentEncounter?.lastEvents?.find((e) => e.type === 'skill')?.amount ?? 0

    let buffed = combatWithInventory([{ templateId: 'wooden_stake', quantity: 1, quality: 'common' }])
    buffed = {
      ...buffed,
      player: { ...buffed.player, knownSkills: ['skill_power_strike'], energy: 20 },
    }
    buffed = useCombatConsumable(buffed, 'wooden_stake')
    buffed = playerAction(buffed, 'skill_power_strike', { targetId: enemyId })
    const buffedDmg =
      buffed.currentEncounter?.lastEvents?.find((e) => e.type === 'skill')?.amount ?? 0

    expect(buffedDmg).toBeGreaterThan(baselineDmg)
  })
})
