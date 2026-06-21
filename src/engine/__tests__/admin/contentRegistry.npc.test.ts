import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  initContentRegistry,
  getNpc,
  getAllNpcs,
  getQuest,
  getAllQuests,
  getDialogue,
  getAllDialogues,
  refreshContentRegistry,
} from '../../admin/ContentRegistry'
import {
  upsertEntity,
  saveOverlay,
  createEmptyOverlay,
  markDeleted,
  OVERLAY_STORAGE_KEY,
} from '../../admin/ContentOverlayStore'

describe('ContentRegistry npcs, quests, dialogues', () => {
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

  it('loads shipped captain_bryn npc', () => {
    expect(getNpc('captain_bryn')?.name).toBe('Captain Bryn')
  })

  it('overlay upsert overrides base npc name', () => {
    let overlay = upsertEntity(createEmptyOverlay(), 'npcs', {
      ...getNpc('captain_bryn')!,
      name: 'Overlay Bryn',
    })
    saveOverlay(overlay)
    refreshContentRegistry()
    expect(getNpc('captain_bryn')?.name).toBe('Overlay Bryn')
  })

  it('deleted id hides base npc', () => {
    let overlay = markDeleted(createEmptyOverlay(), 'npcs', 'captain_bryn')
    saveOverlay(overlay)
    refreshContentRegistry()
    expect(getAllNpcs().some(n => n.id === 'captain_bryn')).toBe(false)
  })

  it('loads shipped tainted_grove quest', () => {
    expect(getQuest('tainted_grove')?.name).toBe('The Tainted Grove')
  })

  it('overlay upsert overrides base quest name', () => {
    let overlay = upsertEntity(createEmptyOverlay(), 'quests', {
      ...getQuest('tainted_grove')!,
      name: 'Overlay Grove',
    })
    saveOverlay(overlay)
    refreshContentRegistry()
    expect(getQuest('tainted_grove')?.name).toBe('Overlay Grove')
  })

  it('loads shipped captain_bryn dialogue', () => {
    expect(getDialogue('captain_bryn_dialogue')?.npcId).toBe('captain_bryn')
  })

  it('overlay upsert overrides dialogue npcId', () => {
    let overlay = upsertEntity(createEmptyOverlay(), 'dialogues', {
      ...getDialogue('captain_bryn_dialogue')!,
      npcId: 'overlay_npc',
    })
    saveOverlay(overlay)
    refreshContentRegistry()
    expect(getDialogue('captain_bryn_dialogue')?.npcId).toBe('overlay_npc')
  })

  it('getAllQuests and getAllDialogues return base content', () => {
    expect(getAllQuests().length).toBeGreaterThanOrEqual(3)
    expect(getAllDialogues().length).toBeGreaterThanOrEqual(8)
  })
})
