import type { Room } from '../RoomSystem'
import type { NpcDef, QuestlineDef, DialogueDef } from '../ContentSchemas'
import type { ContentEntityMap, ContentOverlayState, ContentType } from './ContentOverlayTypes'
import type { ContentIndexes } from './contentIndexes'

export type ValidationSeverity = 'error' | 'warning'

export interface ValidationIssue {
  severity: ValidationSeverity
  message: string
  entityType: ContentType
  entityId: string
}

function issue(
  severity: ValidationSeverity,
  entityType: ContentType,
  entityId: string,
  message: string,
): ValidationIssue {
  return { severity, message, entityType, entityId }
}

function isBlank(value: string | undefined | null): boolean {
  return value == null || value.trim() === ''
}

function validateRoomExits(rooms: Record<string, Room>, roomIds: Set<string>): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  for (const room of Object.values(rooms)) {
    for (const exit of room.exits ?? []) {
      if (!roomIds.has(exit.targetRoomId)) {
        issues.push(
          issue(
            'error',
            'rooms',
            room.id,
            `Exit ${exit.direction} references unknown room "${exit.targetRoomId}"`,
          ),
        )
      }
    }
  }
  return issues
}

function validateNpcDialogueRefs(
  npcs: Record<string, NpcDef>,
  dialogueIds: Set<string>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  for (const npc of Object.values(npcs)) {
    if (!isBlank(npc.dialogueId) && !dialogueIds.has(npc.dialogueId)) {
      issues.push(
        issue(
          'error',
          'npcs',
          npc.id,
          `Unknown dialogueId "${npc.dialogueId}"`,
        ),
      )
    }
  }
  return issues
}

function validateDialogueNodes(dialogues: Record<string, DialogueDef>): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  for (const dialogue of Object.values(dialogues)) {
    const nodeIds = new Set(dialogue.nodes.map((n) => n.id))
    const startId = dialogue.nodes[0]?.id

    if (!startId) {
      issues.push(issue('error', 'dialogues', dialogue.id, 'Dialogue has no nodes'))
      continue
    }

    for (const node of dialogue.nodes) {
      for (const response of node.responses) {
        if (response.next && !nodeIds.has(response.next)) {
          issues.push(
            issue(
              'error',
              'dialogues',
              dialogue.id,
              `Node "${node.id}" references unknown next node "${response.next}"`,
            ),
          )
        }
      }
    }

    const reachable = new Set<string>()
    const queue = [startId]
    while (queue.length > 0) {
      const current = queue.shift()!
      if (reachable.has(current)) continue
      reachable.add(current)
      const node = dialogue.nodes.find((n) => n.id === current)
      if (!node) continue
      for (const response of node.responses) {
        if (response.next && !reachable.has(response.next)) {
          queue.push(response.next)
        }
      }
    }

    for (const node of dialogue.nodes) {
      if (!reachable.has(node.id)) {
        issues.push(
          issue(
            'warning',
            'dialogues',
            dialogue.id,
            `Orphan dialogue node "${node.id}" is unreachable from start node "${startId}"`,
          ),
        )
      }
    }
  }

  return issues
}

function validateQuestlineQuestIds(
  questlines: Record<string, QuestlineDef>,
  questIds: Set<string>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  for (const questline of Object.values(questlines)) {
    for (const questId of questline.questIds ?? []) {
      if (!isBlank(questId) && !questIds.has(questId)) {
        issues.push(
          issue(
            'error',
            'questlines',
            questline.id,
            `Unknown questId "${questId}" in questline`,
          ),
        )
      }
    }
    for (const questId of questline.requiredQuestIds ?? []) {
      if (!isBlank(questId) && !questIds.has(questId)) {
        issues.push(
          issue(
            'error',
            'questlines',
            questline.id,
            `Unknown requiredQuestId "${questId}" in questline`,
          ),
        )
      }
    }
  }
  return issues
}

function validateDuplicateIds<K extends ContentType>(
  type: K,
  map: Record<string, ContentEntityMap[K]>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const seen = new Map<string, string[]>()

  for (const [key, entity] of Object.entries(map)) {
    const entityId = (entity as { id?: string }).id ?? key
    if (key !== entityId) {
      issues.push(
        issue(
          'error',
          type,
          key,
          `Storage key "${key}" does not match entity id "${entityId}"`,
        ),
      )
    }
    const bucket = seen.get(entityId) ?? []
    bucket.push(key)
    seen.set(entityId, bucket)
  }

  for (const [entityId, keys] of seen) {
    if (keys.length > 1) {
      issues.push(
        issue(
          'error',
          type,
          entityId,
          `Duplicate id "${entityId}" appears ${keys.length} times within ${type}`,
        ),
      )
    }
  }

  return issues
}

function validateOverlayRequiredFields(state: ContentOverlayState): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  for (const [key, room] of Object.entries(state.upserts.rooms)) {
    if (isBlank(room.id)) issues.push(issue('error', 'rooms', key, 'Missing required field: id'))
    if (isBlank(room.name)) issues.push(issue('error', 'rooms', key, 'Missing required field: name'))
    if (isBlank(room.description)) {
      issues.push(issue('error', 'rooms', key, 'Missing required field: description'))
    }
  }

  for (const [key, npc] of Object.entries(state.upserts.npcs)) {
    if (isBlank(npc.id)) issues.push(issue('error', 'npcs', key, 'Missing required field: id'))
    if (isBlank(npc.name)) issues.push(issue('error', 'npcs', key, 'Missing required field: name'))
    if (isBlank(npc.role)) issues.push(issue('error', 'npcs', key, 'Missing required field: role'))
    if (isBlank(npc.dialogueId)) {
      issues.push(issue('error', 'npcs', key, 'Missing required field: dialogueId'))
    }
  }

  for (const [key, quest] of Object.entries(state.upserts.quests)) {
    if (isBlank(quest.id)) issues.push(issue('error', 'quests', key, 'Missing required field: id'))
    if (isBlank(quest.name)) issues.push(issue('error', 'quests', key, 'Missing required field: name'))
    if (!quest.stages?.length) {
      issues.push(issue('error', 'quests', key, 'Missing required field: stages'))
    }
  }

  for (const [key, questline] of Object.entries(state.upserts.questlines)) {
    if (isBlank(questline.id)) issues.push(issue('error', 'questlines', key, 'Missing required field: id'))
    if (isBlank(questline.name)) {
      issues.push(issue('error', 'questlines', key, 'Missing required field: name'))
    }
    if (!questline.questIds?.length) {
      issues.push(issue('error', 'questlines', key, 'Missing required field: questIds'))
    }
  }

  for (const [key, dialogue] of Object.entries(state.upserts.dialogues)) {
    if (isBlank(dialogue.id)) issues.push(issue('error', 'dialogues', key, 'Missing required field: id'))
    if (isBlank(dialogue.npcId)) {
      issues.push(issue('error', 'dialogues', key, 'Missing required field: npcId'))
    }
    if (!dialogue.nodes?.length) {
      issues.push(issue('error', 'dialogues', key, 'Missing required field: nodes'))
    }
  }

  for (const [key, item] of Object.entries(state.upserts.items)) {
    if (isBlank(item.id)) issues.push(issue('error', 'items', key, 'Missing required field: id'))
    if (isBlank(item.name)) issues.push(issue('error', 'items', key, 'Missing required field: name'))
    if (isBlank(item.description)) {
      issues.push(issue('error', 'items', key, 'Missing required field: description'))
    }
  }

  for (const [key, event] of Object.entries(state.upserts.events)) {
    if (isBlank(event.id)) issues.push(issue('error', 'events', key, 'Missing required field: id'))
    if (isBlank(event.title)) issues.push(issue('error', 'events', key, 'Missing required field: title'))
    if (isBlank(event.text)) issues.push(issue('error', 'events', key, 'Missing required field: text'))
  }

  for (const [key, recipe] of Object.entries(state.upserts.recipes)) {
    if (isBlank(recipe.id)) issues.push(issue('error', 'recipes', key, 'Missing required field: id'))
    if (isBlank(recipe.name)) issues.push(issue('error', 'recipes', key, 'Missing required field: name'))
  }

  for (const [key, building] of Object.entries(state.upserts.buildings)) {
    if (isBlank(building.id)) issues.push(issue('error', 'buildings', key, 'Missing required field: id'))
    if (isBlank(building.name)) {
      issues.push(issue('error', 'buildings', key, 'Missing required field: name'))
    }
  }

  for (const [key, skill] of Object.entries(state.upserts.skills)) {
    if (isBlank(skill.id)) issues.push(issue('error', 'skills', key, 'Missing required field: id'))
    if (isBlank(skill.name)) issues.push(issue('error', 'skills', key, 'Missing required field: name'))
    if (isBlank(skill.description)) {
      issues.push(issue('error', 'skills', key, 'Missing required field: description'))
    }
  }

  for (const [key, enemies] of Object.entries(state.upserts.encounterTemplates)) {
    if (!enemies?.length) {
      issues.push(issue('error', 'encounterTemplates', key, 'Encounter template must have at least one enemy'))
    }
  }

  return issues
}

export function validateAll(state: ContentOverlayState, indexes: ContentIndexes): ValidationIssue[] {
  const { snapshot, ids } = indexes
  const issues: ValidationIssue[] = []

  issues.push(...validateRoomExits(snapshot.rooms, ids.rooms))
  issues.push(...validateNpcDialogueRefs(snapshot.npcs, ids.dialogues))
  issues.push(...validateDialogueNodes(snapshot.dialogues))
  issues.push(...validateQuestlineQuestIds(snapshot.questlines, ids.quests))
  issues.push(...validateOverlayRequiredFields(state))

  const typesWithDuplicateCheck: ContentType[] = [
    'rooms',
    'npcs',
    'quests',
    'questlines',
    'dialogues',
    'items',
    'events',
    'recipes',
    'buildings',
    'skills',
    'encounterTemplates',
  ]

  for (const type of typesWithDuplicateCheck) {
    issues.push(...validateDuplicateIds(type, snapshot[type]))
  }

  return issues
}
