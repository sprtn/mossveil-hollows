import { describe, it, expect, vi } from 'vitest'
import type { CombatEvent } from '@/engine/GameLoopDesign'
import {
  COMBAT_LOG_CAP,
  combatEventsToPinnedEntries,
  partitionCombatEvents,
  runCombatResolveCycle,
  trimCombatLog,
} from '../combatLog'

const PLAYER_ID = 'player_1'

function enemyEvent(i: number): CombatEvent {
  return {
    type: 'attack',
    source: `enemy_${i}`,
    sourceName: `Enemy ${i}`,
    message: `Enemy ${i} attacks you for ${i} damage!`,
  }
}

describe('combatLog', () => {
  it('partitions player events from enemy/system events', () => {
    const events: CombatEvent[] = [
      { type: 'attack', source: PLAYER_ID, sourceName: 'Hero', message: 'You attack!' },
      enemyEvent(1),
      { type: 'stun_skip', source: 'status', sourceName: 'Stun', message: 'Stunned!' },
    ]
    const { playerEvents, otherEvents } = partitionCombatEvents(events, PLAYER_ID)
    expect(playerEvents).toHaveLength(1)
    expect(otherEvents).toHaveLength(2)
  })

  it('pins player lines separately from capped scroll log', () => {
    const playerLine = combatEventsToPinnedEntries([
      { type: 'skill', source: PLAYER_ID, sourceName: 'Hero', message: 'You defend.' },
    ])
    const scrollLog = Array.from({ length: COMBAT_LOG_CAP + 5 }, (_, i) =>
      enemyEvent(i)
    ).map((e) => ({
      message: e.message,
      type: 'enemy' as const,
    }))

    const trimmed = trimCombatLog(scrollLog)
    expect(trimmed).toHaveLength(COMBAT_LOG_CAP)
    expect(playerLine[0]!.message).toBe('You defend.')
    expect(playerLine[0]!.pinned).toBe(true)
  })

  it('player action line survives when many enemy events would overflow the cap', () => {
    const events: CombatEvent[] = [
      { type: 'defend', source: PLAYER_ID, sourceName: 'Hero', message: 'You take a defensive stance.' },
      ...Array.from({ length: 20 }, (_, i) => enemyEvent(i)),
    ]
    const { playerEvents, otherEvents } = partitionCombatEvents(events, PLAYER_ID)
    const pinned = combatEventsToPinnedEntries(playerEvents)
    let scrollLog: ReturnType<typeof trimCombatLog> = []
    for (const event of otherEvents) {
      scrollLog.unshift({ message: event.message, type: 'enemy' })
      scrollLog = trimCombatLog(scrollLog)
    }
    expect(pinned).toHaveLength(1)
    expect(pinned[0]!.message).toContain('defensive stance')
    expect(scrollLog).toHaveLength(COMBAT_LOG_CAP)
    expect(scrollLog.some((e) => e.message.includes('defensive stance'))).toBe(false)
  })

  it('runCombatResolveCycle clears busy synchronously even when log animation is pending', () => {
    let busy = false
    const animateLog = vi.fn((events: CombatEvent[]) => {
      events.forEach((_, i) => {
        setTimeout(() => undefined, (i + 1) * 10_000)
      })
    })

    runCombatResolveCycle(
      () => busy,
      (v) => {
        busy = v
      },
      () => undefined,
      animateLog,
      Array.from({ length: 15 }, (_, i) => enemyEvent(i))
    )

    expect(busy).toBe(false)
    expect(animateLog).toHaveBeenCalledOnce()
  })

  it('runCombatResolveCycle clears busy after an induced resolve error', () => {
    let busy = false
    expect(() =>
      runCombatResolveCycle(
        () => busy,
        (v) => {
          busy = v
        },
        () => {
          throw new Error('resolve failed')
        },
        () => undefined,
        []
      )
    ).toThrow('resolve failed')
    expect(busy).toBe(false)
  })
})
