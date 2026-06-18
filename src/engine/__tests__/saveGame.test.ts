import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SAVE_KEY, SAVE_VERSION } from '../gameConfig'
import { loadGame, saveGame, clearSave } from '../saveGame'
import { createDefaultPlayer } from '../CombatEngine'
import { initGame, enterRoom } from '../GameLoop'
import type { Room } from '../GameLoopDesign'

const hubRoom: Room = {
  id: 'town_hub',
  name: 'Town',
  description: 'Hub',
  encounters: [],
  exits: [],
  isHub: true,
}

function minimalSave(overrides: { saveVersion?: number; knownSkills?: string[] } = {}) {
  const player = createDefaultPlayer({
    knownSkills: overrides.knownSkills ?? ['skill_power_strike', 'skill_bandage'],
  })
  const state = enterRoom(initGame(player, hubRoom), hubRoom)
  return {
    ...state,
    saveVersion: overrides.saveVersion ?? SAVE_VERSION,
  }
}

describe('loadGame save version cutoff', () => {
  const storage = new Map<string, string>()

  beforeEach(() => {
    storage.clear()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value)
      },
      removeItem: (key: string) => {
        storage.delete(key)
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    clearSave()
  })

  it('loads a save at the current SAVE_VERSION', () => {
    saveGame(minimalSave())
    const { state, versionMismatch } = loadGame()
    expect(versionMismatch).toBe(false)
    expect(state).not.toBeNull()
    expect(state!.saveVersion).toBe(SAVE_VERSION)
  })

  it('rejects and clears a pre-rework save (version below SAVE_VERSION)', () => {
    storage.set(SAVE_KEY, JSON.stringify(minimalSave({ saveVersion: 9 })))
    const { state, versionMismatch } = loadGame()
    expect(versionMismatch).toBe(true)
    expect(state).toBeNull()
    expect(storage.has(SAVE_KEY)).toBe(false)
  })

  it('rejects and clears v10 save after SAVE_VERSION bump to 11', () => {
    storage.set(SAVE_KEY, JSON.stringify(minimalSave({ saveVersion: 10 })))
    const { state, versionMismatch } = loadGame()
    expect(versionMismatch).toBe(true)
    expect(state).toBeNull()
    expect(storage.has(SAVE_KEY)).toBe(false)
  })

  it('rejects and clears a save from a newer client', () => {
    storage.set(SAVE_KEY, JSON.stringify(minimalSave({ saveVersion: SAVE_VERSION + 1 })))
    const { state, versionMismatch } = loadGame()
    expect(versionMismatch).toBe(true)
    expect(state).toBeNull()
    expect(storage.has(SAVE_KEY)).toBe(false)
  })

  it('does not remap legacy skill ids — pre-bump save is wiped, not migrated', () => {
    storage.set(
      SAVE_KEY,
      JSON.stringify(
        minimalSave({
          saveVersion: 9,
          knownSkills: ['skill_power_strike', 'skill_cleave', 'skill_bandage'],
        })
      )
    )
    const { state } = loadGame()
    expect(state).toBeNull()
    expect(storage.has(SAVE_KEY)).toBe(false)
  })
})
