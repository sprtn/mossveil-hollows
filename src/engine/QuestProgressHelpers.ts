/**
 * Pure quest progress state updates (no Outcomes import to avoid cycles).
 */

import type { GameState } from './GameLoopDesign'
import type { QuestProgress } from './ContentSchemas'
import { getQuestDef } from './QuestData'

export function ensureQuest(state: GameState, questId: string): GameState {
  if (state.quests?.[questId]) return state
  const progress: QuestProgress = {
    questId,
    stageIndex: 0,
    counters: {},
    completed: false,
  }
  return {
    ...state,
    quests: { ...(state.quests ?? {}), [questId]: progress },
  }
}

export function bumpQuestStage(state: GameState, questId: string): GameState {
  const quest = getQuestDef(questId)
  const progress = state.quests?.[questId]
  if (!quest || !progress || progress.completed) return state

  const nextIndex = progress.stageIndex + 1
  if (nextIndex >= quest.stages.length) {
    return {
      ...state,
      quests: {
        ...(state.quests ?? {}),
        [questId]: { ...progress, completed: true, stageIndex: nextIndex },
      },
    }
  }

  return {
    ...state,
    quests: {
      ...(state.quests ?? {}),
      [questId]: { ...progress, stageIndex: nextIndex, counters: {} },
    },
  }
}
