import type { QuestDef } from './ContentSchemas'
import { getQuest as getQuestFromRegistry } from './admin/ContentRegistry'

export function getQuestDef(questId: string): QuestDef | undefined {
  return getQuestFromRegistry(questId)
}
