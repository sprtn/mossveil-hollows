import { describe, it, expect } from 'vitest'
import {
  enterRoom,
  initGame,
  maybeGrantPlayerBonusAction,
  playerAction,
  triggerEncounter,
} from '../GameLoop'
import { createDefaultPlayer, resolvePlayerCombatAction, rollExtraActionChance, SeededRandom } from '../CombatEngine'
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
  hp: 80,
  maxHp: 80,
  level: 1,
  stats: { strength: 5, defense: 2, constitution: 6, dexterity: 4, agility: 4 },
  loot: [],
  goldReward: 5,
  xpReward: 10,
})

function combatWithBonusAction() {
  const player = createDefaultPlayer({
    knownSkills: ['skill_power_strike'],
    energy: 20,
    stats: { strength: 14, defense: 5, constitution: 10, dexterity: 10, agility: 8 },
  })
  let state = triggerEncounter(enterRoom(initGame(player, testRoom), testRoom), [
    { ...testEnemy(), stats: { ...testEnemy().stats, agility: 24 } },
  ])
  return {
    ...state,
    currentEncounter: {
      ...state.currentEncounter!,
      playerBonusAction: true,
      rngState: 100,
    },
  }
}

function findBonusGrantSeed(playerAgi: number, enemyAgi: number): number {
  for (let seed = 0; seed < 500; seed++) {
    if (rollExtraActionChance(playerAgi, enemyAgi, new SeededRandom(seed))) return seed
  }
  throw new Error('no granting seed found')
}

describe('combat turn state', () => {
  it('clears playerBonusAction on the live encounter after a spread-replace skill', () => {
    const state = combatWithBonusAction()
    const enemyId = state.currentEncounter!.enemies[0]!.id

    const viaResolve = resolvePlayerCombatAction(state, 'skill_power_strike', { targetId: enemyId })
    expect(viaResolve.state.currentEncounter?.playerBonusAction).toBe(false)

    const viaPlayerAction = playerAction(state, 'skill_power_strike', { targetId: enemyId })
    expect(viaPlayerAction.currentEncounter?.playerBonusAction).toBe(false)
  })

  it('bonus grant lastEvents contains only the new message, not prior chain', () => {
    const playerAgi = 24
    const enemyAgi = 4
    const grantSeed = findBonusGrantSeed(playerAgi, enemyAgi)

    const player = createDefaultPlayer({
      stats: { strength: 10, defense: 5, constitution: 10, dexterity: 10, agility: playerAgi },
    })
    let state = triggerEncounter(enterRoom(initGame(player, testRoom), testRoom), [
      { ...testEnemy(), stats: { ...testEnemy().stats, agility: enemyAgi } },
    ])

    state = {
      ...state,
      currentEncounter: {
        ...state.currentEncounter!,
        rngState: grantSeed,
        lastEvents: Array.from({ length: 8 }, (_, i) => ({
          type: 'attack' as const,
          source: `enemy_${i}`,
          sourceName: `Old ${i}`,
          message: `Old event ${i}`,
        })),
      },
    }

    state = maybeGrantPlayerBonusAction(state)
    expect(state.currentEncounter?.playerBonusAction).toBe(true)
    expect(state.currentEncounter?.lastEvents).toHaveLength(1)
    expect(state.currentEncounter?.lastEvents?.[0]?.message).toContain('extra action')
  })
})
