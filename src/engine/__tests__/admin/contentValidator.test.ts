import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Room } from '../../RoomSystem'
import type { NpcDef, QuestDef, QuestlineDef, DialogueDef } from '../../ContentSchemas'
import type { ContentRegistrySnapshot } from '../../admin/contentIndexes'
import { buildContentIndexesFromSnapshot } from '../../admin/contentIndexes'
import { validateAll } from '../../admin/ContentValidator'
import { createEmptyOverlay } from '../../admin/ContentOverlayStore'

function emptySnapshot(): ContentRegistrySnapshot {
  return {
    rooms: {},
    npcs: {},
    quests: {},
    questlines: {},
    dialogues: {},
    items: {},
    events: {},
    recipes: {},
    buildings: {},
    skills: {},
    encounterTemplates: {},
  }
}

function makeRoom(id: string, exits: Room['exits'] = []): Room {
  return {
    id,
    type: 'static',
    name: id,
    description: 'test room',
    exits,
  }
}

describe('ContentValidator', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('flags broken room exit reference', () => {
    const snapshot = emptySnapshot()
    snapshot.rooms = {
      broken_room: makeRoom('broken_room', [
        { direction: 'north', targetRoomId: 'missing_room' },
      ]),
    }
    const indexes = buildContentIndexesFromSnapshot(snapshot)
    const issues = validateAll(createEmptyOverlay(), indexes)

    expect(issues).toContainEqual(
      expect.objectContaining({
        severity: 'error',
        entityType: 'rooms',
        entityId: 'broken_room',
        message: expect.stringContaining('missing_room'),
      }),
    )
  })

  it('flags unknown dialogueId on npc', () => {
    const snapshot = emptySnapshot()
    snapshot.npcs = {
      test_npc: {
        id: 'test_npc',
        name: 'Test NPC',
        role: 'merchant',
        dialogueId: 'nonexistent_dialogue',
      } satisfies NpcDef,
    }
    const indexes = buildContentIndexesFromSnapshot(snapshot)
    const issues = validateAll(createEmptyOverlay(), indexes)

    expect(issues).toContainEqual(
      expect.objectContaining({
        severity: 'error',
        entityType: 'npcs',
        entityId: 'test_npc',
        message: expect.stringContaining('nonexistent_dialogue'),
      }),
    )
  })

  it('flags orphan dialogue nodes unreachable from start', () => {
    const snapshot = emptySnapshot()
    snapshot.dialogues = {
      test_dialogue: {
        id: 'test_dialogue',
        npcId: 'test_npc',
        nodes: [
          {
            id: 'start',
            text: 'Hello',
            responses: [{ text: 'Bye' }],
          },
          {
            id: 'orphan',
            text: 'Unreachable',
            responses: [{ text: 'Ok' }],
          },
        ],
      } satisfies DialogueDef,
    }
    const indexes = buildContentIndexesFromSnapshot(snapshot)
    const issues = validateAll(createEmptyOverlay(), indexes)

    expect(issues).toContainEqual(
      expect.objectContaining({
        severity: 'warning',
        entityType: 'dialogues',
        entityId: 'test_dialogue',
        message: expect.stringContaining('orphan'),
      }),
    )
  })

  it('flags broken dialogue next node reference', () => {
    const snapshot = emptySnapshot()
    snapshot.dialogues = {
      test_dialogue: {
        id: 'test_dialogue',
        npcId: 'test_npc',
        nodes: [
          {
            id: 'start',
            text: 'Hello',
            responses: [{ text: 'Go', next: 'missing_node' }],
          },
        ],
      } satisfies DialogueDef,
    }
    const indexes = buildContentIndexesFromSnapshot(snapshot)
    const issues = validateAll(createEmptyOverlay(), indexes)

    expect(issues).toContainEqual(
      expect.objectContaining({
        severity: 'error',
        entityType: 'dialogues',
        entityId: 'test_dialogue',
        message: expect.stringContaining('missing_node'),
      }),
    )
  })

  it('flags unknown questIds on questline', () => {
    const snapshot = emptySnapshot()
    snapshot.quests = {
      existing_quest: { id: 'existing_quest', name: 'Existing', stages: [] },
    }
    snapshot.questlines = {
      main_arc: {
        id: 'main_arc',
        name: 'Main Arc',
        questIds: ['existing_quest', 'ghost_quest'],
      } satisfies QuestlineDef,
    }
    const indexes = buildContentIndexesFromSnapshot(snapshot)
    const issues = validateAll(createEmptyOverlay(), indexes)

    expect(issues).toContainEqual(
      expect.objectContaining({
        severity: 'error',
        entityType: 'questlines',
        entityId: 'main_arc',
        message: expect.stringContaining('ghost_quest'),
      }),
    )
  })

  it('flags duplicate ids within a content type', () => {
    const snapshot = emptySnapshot()
    snapshot.quests = {
      quest_a: { id: 'shared_id', name: 'Quest A', stages: [] } as QuestDef,
      quest_b: { id: 'shared_id', name: 'Quest B', stages: [] } as QuestDef,
    }
    const indexes = buildContentIndexesFromSnapshot(snapshot)
    const issues = validateAll(createEmptyOverlay(), indexes)

    expect(issues).toContainEqual(
      expect.objectContaining({
        severity: 'error',
        entityType: 'quests',
        entityId: 'shared_id',
        message: expect.stringContaining('Duplicate id'),
      }),
    )
  })

  it('flags empty required fields on overlay upserts', () => {
    const snapshot = emptySnapshot()
    const indexes = buildContentIndexesFromSnapshot(snapshot)
    const overlay = createEmptyOverlay()
    overlay.upserts.npcs = {
      draft_npc: {
        id: 'draft_npc',
        name: '',
        role: '',
        dialogueId: '',
      },
    }
    const issues = validateAll(overlay, indexes)

    expect(issues).toContainEqual(
      expect.objectContaining({
        severity: 'error',
        entityType: 'npcs',
        entityId: 'draft_npc',
        message: expect.stringContaining('name'),
      }),
    )
    expect(issues).toContainEqual(
      expect.objectContaining({
        severity: 'error',
        entityType: 'npcs',
        entityId: 'draft_npc',
        message: expect.stringContaining('dialogueId'),
      }),
    )
  })

  it('returns no issues for valid merged content', () => {
    const snapshot = emptySnapshot()
    snapshot.rooms = {
      room_a: makeRoom('room_a', [{ direction: 'north', targetRoomId: 'room_b' }]),
      room_b: makeRoom('room_b'),
    }
    snapshot.dialogues = {
      npc_talk: {
        id: 'npc_talk',
        npcId: 'shopkeeper',
        nodes: [{ id: 'start', text: 'Welcome', responses: [{ text: 'Thanks' }] }],
      },
    }
    snapshot.npcs = {
      shopkeeper: {
        id: 'shopkeeper',
        name: 'Shopkeeper',
        role: 'merchant',
        dialogueId: 'npc_talk',
      },
    }
    const indexes = buildContentIndexesFromSnapshot(snapshot)
    const issues = validateAll(createEmptyOverlay(), indexes)

    expect(issues).toHaveLength(0)
  })
})
