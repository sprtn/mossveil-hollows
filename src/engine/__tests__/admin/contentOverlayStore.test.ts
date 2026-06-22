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
  setRoomLayout,
  resetRoomLayouts,
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

  it('stores and exports room layouts', () => {
    let state = setRoomLayout(createEmptyOverlay(), 'town_hub', { x: 42, y: 84 })
    saveOverlay(state)
    expect(isOverlayDirty()).toBe(true)
    const bundle = exportBundle()
    expect(bundle.roomLayouts?.town_hub).toEqual({ x: 42, y: 84 })

    state = resetRoomLayouts(loadOverlay())
    saveOverlay(state)
    expect(loadOverlay().roomLayouts).toEqual({})
    expect(exportBundle().roomLayouts).toBeUndefined()
  })

  it('import merges room layouts', () => {
    importBundle({
      version: 1,
      roomLayouts: { town_hub: { x: 1, y: 2 } },
      upserts: {},
      deletedIds: {},
    })
    expect(loadOverlay().roomLayouts?.town_hub).toEqual({ x: 1, y: 2 })
  })
})
