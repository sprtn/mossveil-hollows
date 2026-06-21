import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  initContentRegistry,
  getDialogue,
  getAllDialogues,
  refreshContentRegistry,
} from '../../admin/ContentRegistry'
import {
  upsertEntity,
  saveOverlay,
  createEmptyOverlay,
  markDeleted,
  removeUpsert,
  loadOverlay,
  OVERLAY_STORAGE_KEY,
} from '../../admin/ContentOverlayStore'
import type { DialogueDef } from '../../ContentSchemas'

describe('DialogueForm store logic', () => {
  const storage = new Map<string, string>()

  beforeEach(() => {
    storage.clear()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value) },
      removeItem: (key: string) => { storage.delete(key) },
    })
    localStorage.removeItem(OVERLAY_STORAGE_KEY)
    initContentRegistry()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('creates a new dialogue via overlay upsert', () => {
    const newDialogue: DialogueDef = {
      id: 'test_dialogue_new',
      npcId: 'test_npc',
      nodes: [
        { id: 'node_1', text: 'Hello traveller!', responses: [] },
      ],
    }
    const overlay = upsertEntity(createEmptyOverlay(), 'dialogues', newDialogue)
    saveOverlay(overlay)
    refreshContentRegistry()

    const loaded = getDialogue('test_dialogue_new')
    expect(loaded).toBeDefined()
    expect(loaded?.npcId).toBe('test_npc')
    expect(loaded?.nodes).toHaveLength(1)
    expect(loaded?.nodes[0].id).toBe('node_1')
  })

  it('saves dialogue with multiple nodes and responses', () => {
    const dialogue: DialogueDef = {
      id: 'multi_node_dialogue',
      npcId: 'merchant_npc',
      nodes: [
        {
          id: 'greet',
          text: 'Welcome to my shop!',
          responses: [
            { text: 'Show me your wares', next: 'shop' },
            { text: 'Goodbye', next: undefined },
          ],
        },
        {
          id: 'shop',
          text: 'Here is what I have.',
          responses: [
            { text: 'Back', next: 'greet' },
          ],
        },
      ],
    }
    const overlay = upsertEntity(createEmptyOverlay(), 'dialogues', dialogue)
    saveOverlay(overlay)
    refreshContentRegistry()

    const loaded = getDialogue('multi_node_dialogue')
    expect(loaded?.nodes).toHaveLength(2)
    expect(loaded?.nodes[0].responses[0].next).toBe('shop')
    expect(loaded?.nodes[1].responses[0].next).toBe('greet')
  })

  it('saves response with requires and outcomes', () => {
    const dialogue: DialogueDef = {
      id: 'conditional_dialogue',
      npcId: 'guard_npc',
      nodes: [
        {
          id: 'start',
          text: 'Halt! Who goes there?',
          responses: [
            {
              text: 'I am the chosen one.',
              requires: [{ kind: 'has_flag', flag: 'hero_chosen' }],
              outcomes: [{ kind: 'give_gold', amount: 10 }],
              next: undefined,
            },
          ],
        },
      ],
    }
    const overlay = upsertEntity(createEmptyOverlay(), 'dialogues', dialogue)
    saveOverlay(overlay)
    refreshContentRegistry()

    const loaded = getDialogue('conditional_dialogue')
    const response = loaded?.nodes[0].responses[0]
    expect(response?.requires).toHaveLength(1)
    expect(response?.requires?.[0].kind).toBe('has_flag')
    expect(response?.outcomes).toHaveLength(1)
    expect(response?.outcomes?.[0].kind).toBe('give_gold')
  })

  it('updates an existing base dialogue via overlay', () => {
    const base = getDialogue('captain_bryn_dialogue')
    expect(base).toBeDefined()

    const updated = { ...base!, npcId: 'new_npc_id' }
    const overlay = upsertEntity(createEmptyOverlay(), 'dialogues', updated)
    saveOverlay(overlay)
    refreshContentRegistry()

    expect(getDialogue('captain_bryn_dialogue')?.npcId).toBe('new_npc_id')
  })

  it('removeUpsert removes overlay-only dialogue from registry', () => {
    const newDialogue: DialogueDef = {
      id: 'ephemeral_dialogue',
      npcId: 'npc_x',
      nodes: [],
    }
    let overlay = upsertEntity(createEmptyOverlay(), 'dialogues', newDialogue)
    saveOverlay(overlay)
    refreshContentRegistry()
    expect(getDialogue('ephemeral_dialogue')).toBeDefined()

    overlay = removeUpsert(loadOverlay(), 'dialogues', 'ephemeral_dialogue')
    saveOverlay(overlay)
    refreshContentRegistry()
    expect(getDialogue('ephemeral_dialogue')).toBeUndefined()
  })

  it('markDeleted hides a base dialogue', () => {
    const overlay = markDeleted(createEmptyOverlay(), 'dialogues', 'captain_bryn_dialogue')
    saveOverlay(overlay)
    refreshContentRegistry()

    expect(getDialogue('captain_bryn_dialogue')).toBeUndefined()
    expect(getAllDialogues().some((d) => d.id === 'captain_bryn_dialogue')).toBe(false)
  })

  it('getAllDialogues reflects overlay additions', () => {
    const before = getAllDialogues().length
    const newDialogue: DialogueDef = {
      id: 'extra_dialogue',
      npcId: 'extra_npc',
      nodes: [],
    }
    const overlay = upsertEntity(createEmptyOverlay(), 'dialogues', newDialogue)
    saveOverlay(overlay)
    refreshContentRegistry()

    expect(getAllDialogues().length).toBe(before + 1)
  })
})
