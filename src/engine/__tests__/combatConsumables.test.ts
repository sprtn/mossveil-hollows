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
    const playerId = state.player.id
    const hpBefore = state.currentEncounter!.enemies[0]!.hp
    state = useCombatConsumable(state, 'wooden_stake')
    state = {
      ...state,
      currentEncounter: { ...state.currentEncounter!, rngState: 100 },
    }
    state = playerAction(state, 'attack', { targetId: enemyId })
    const events = state.currentEncounter?.lastEvents ?? state.combatResults?.events ?? []
    expect(state.currentEncounter?.combatBuffs ?? []).toHaveLength(0)
    const hpAfter = state.currentEncounter?.enemies[0]?.hp ?? hpBefore
    if (hpAfter < hpBefore) {
      const attackEvent = events.find((e) => e.type === 'attack' && e.source === playerId)
      expect(attackEvent?.message).toContain('empowered')
    }
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

  it('applies stake multiplier to empowered strike', () => {
    const pinRng = (s: ReturnType<typeof combatWithInventory>) => ({
      ...s,
      currentEncounter: { ...s.currentEncounter!, rngState: 100 },
    })

    let baseline = pinRng(combatWithInventory([{ templateId: 'wooden_stake', quantity: 1, quality: 'common' }]))
    const enemyId = baseline.currentEncounter!.enemies[0]!.id
    baseline = {
      ...baseline,
      player: {
        ...baseline.player,
        knownSkills: ['skill_empowered_strike'],
        energy: 20,
      },
    }
    const hpBeforeBaseline = baseline.currentEncounter!.enemies[0]!.hp
    baseline = playerAction(baseline, 'use_skill', { skillId: 'skill_empowered_strike', targetId: enemyId })
    const baselineDmg = hpBeforeBaseline - baseline.currentEncounter!.enemies[0]!.hp

    let buffed = pinRng(combatWithInventory([{ templateId: 'wooden_stake', quantity: 1, quality: 'common' }]))
    const buffedEnemyId = buffed.currentEncounter!.enemies[0]!.id
    buffed = {
      ...buffed,
      player: { ...buffed.player, knownSkills: ['skill_empowered_strike'], energy: 20 },
    }
    const hpBeforeBuffed = buffed.currentEncounter!.enemies[0]!.hp
    buffed = useCombatConsumable(buffed, 'wooden_stake')
    buffed = playerAction(buffed, 'use_skill', { skillId: 'skill_empowered_strike', targetId: buffedEnemyId })
    const buffedDmg = hpBeforeBuffed - buffed.currentEncounter!.enemies[0]!.hp

    expect(baselineDmg).toBeGreaterThan(0)
    expect(buffedDmg).toBeGreaterThan(baselineDmg)
  })
})
