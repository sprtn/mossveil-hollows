import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  createEmptyOverlay,
  upsertEntity,
  markDeleted,
  exportBundle,
  importBundle,
  isOverlayDirty,
  loadOverlay,
  saveOverlay,
  resetOverlay,
  OVERLAY_STORAGE_KEY,
} from '../../admin/ContentOverlayStore'

describe('ContentOverlayStore', () => {
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
    localStorage.removeItem(OVERLAY_STORAGE_KEY)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('starts empty', () => {
    expect(loadOverlay()).toEqual(createEmptyOverlay())
  })

  it('isOverlayDirty is false when empty', () => {
    expect(isOverlayDirty()).toBe(false)
  })

  it('isOverlayDirty is true when upserts or deletions exist', () => {
    saveOverlay(
      upsertEntity(createEmptyOverlay(), 'rooms', {
        id: 'test_room',
        type: 'static',
        name: 'Test',
        description: 'Desc',
        exits: [],
      }),
    )
    expect(isOverlayDirty()).toBe(true)
    resetOverlay()
    expect(isOverlayDirty()).toBe(false)

    saveOverlay(markDeleted(createEmptyOverlay(), 'rooms', 'town_hub'))
    expect(isOverlayDirty()).toBe(true)
  })

  it('upserts and exports a room', () => {
    let state = createEmptyOverlay()
    state = upsertEntity(state, 'rooms', {
      id: 'test_room',
      type: 'static',
      name: 'Test',
      description: 'Desc',
      exits: [],
    })
    saveOverlay(state)
    const bundle = exportBundle()
    expect(bundle.upserts.rooms.test_room.name).toBe('Test')
  })

  it('marks deleted ids', () => {
    let state = upsertEntity(createEmptyOverlay(), 'rooms', {
      id: 'gone_room', type: 'static', name: 'G', description: 'D', exits: [],
    })
    state = markDeleted(state, 'rooms', 'town_hub')
    expect(state.deletedIds.rooms).toContain('town_hub')
  })

  it('import merges upserts and deletedIds', () => {
    const bundle = exportBundle()
    bundle.upserts.npcs = {
      new_npc: { id: 'new_npc', name: 'N', role: 'R', dialogueId: 'd1' },
    }
    bundle.deletedIds.quests = ['tainted_grove']
    importBundle(bundle)
    const loaded = loadOverlay()
    expect(loaded.upserts.npcs.new_npc).toBeDefined()
    expect(loaded.deletedIds.quests).toContain('tainted_grove')
  })
})
