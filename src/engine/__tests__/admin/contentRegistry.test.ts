import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  initContentRegistry,
  getRoom,
  getAllRooms,
  refreshContentRegistry,
} from '../../admin/ContentRegistry'
import {
  upsertEntity,
  saveOverlay,
  createEmptyOverlay,
  markDeleted,
  OVERLAY_STORAGE_KEY,
} from '../../admin/ContentOverlayStore'

describe('ContentRegistry rooms', () => {
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
    initContentRegistry()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads shipped town_hub', () => {
    expect(getRoom('town_hub')?.name).toBeTruthy()
  })

  it('overlay upsert overrides base room name', () => {
    let overlay = upsertEntity(createEmptyOverlay(), 'rooms', {
      ...getRoom('town_hub')!,
      name: 'Overlay Hub',
    })
    saveOverlay(overlay)
    refreshContentRegistry()
    expect(getRoom('town_hub')?.name).toBe('Overlay Hub')
  })

  it('deleted id hides base room', () => {
    let overlay = markDeleted(createEmptyOverlay(), 'rooms', 'town_hub')
    saveOverlay(overlay)
    refreshContentRegistry()
    expect(getAllRooms().some(r => r.id === 'town_hub')).toBe(false)
  })
})
