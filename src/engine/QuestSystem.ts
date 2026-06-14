/**
 * Quest system — multi-stage objectives and progression.
 */

import type { GameState } from './GameLoopDesign'
import type { QuestDef, QuestObjective, QuestProgress } from './ContentSchemas'
import { applyOutcomes, type OutcomeEffect } from './Outcomes'
import { getMaterialCount } from './Materials'
import { getItemName, hasItem } from './ItemDatabase'
import { getQuestDef } from './QuestData'

export function describeRewards(_state: GameState, effects: OutcomeEffect[]): string {
  const parts: string[] = []

  for (const effect of effects) {
    switch (effect.kind) {
      case 'give_gold':
        parts.push(`+${effect.amount} gold`)
        break
      case 'take_gold':
        parts.push(`-${effect.amount} gold`)
        break
      case 'give_material':
        parts.push(`+${effect.qty} ${getItemName(effect.materialId)}`)
        break
      case 'take_material':
        parts.push(`-${effect.qty} ${getItemName(effect.materialId)}`)
        break
      case 'give_item':
        parts.push(`+${effect.qty} ${getItemName(effect.itemId)}`)
        break
      case 'take_item':
        parts.push(`-${effect.qty} ${getItemName(effect.itemId)}`)
        break
      case 'give_skill_point':
        parts.push(`+${effect.amount} skill point${effect.amount === 1 ? '' : 's'}`)
        break
      case 'heal':
        parts.push(`+${effect.amount} HP`)
        break
      case 'restore_stamina':
        parts.push(`+${effect.amount} stamina`)
        break
      case 'restore_energy':
        parts.push(`+${effect.amount} energy`)
        break
      case 'learn_skill':
        parts.push(`learned ${effect.skillId.replace('skill_', '').replace(/_/g, ' ')}`)
        break
      default:
        break
    }
  }

  return parts.join(', ')
}

function buildQuestStatusMessage(questName: string, isFinal: boolean, rewards: OutcomeEffect[]): string {
  const rewardText = describeRewards({} as GameState, rewards)
  if (isFinal) {
    return rewardText
      ? `Quest "${questName}" complete! ${rewardText}`
      : `Quest "${questName}" complete!`
  }
  return rewardText
    ? `Quest "${questName}" — ${rewardText}`
    : `Quest "${questName}" advanced.`
}

export function advanceQuestStage(
  state: GameState,
  questId: string,
  stageId?: string
): GameState {
  const quest = getQuestDef(questId)
  const progress = state.quests?.[questId]
  if (!quest || !progress || progress.completed) return state

  const currentStage = quest.stages[progress.stageIndex]
  if (stageId && currentStage?.id !== stageId) return state

  const nextIndex = progress.stageIndex + 1
  if (nextIndex >= quest.stages.length) {
    const rewards = currentStage?.rewards ?? []
    let result = applyOutcomes(state, rewards)
    return {
      ...result,
      statusMessage: buildQuestStatusMessage(quest.name, true, rewards),
      quests: {
        ...(result.quests ?? {}),
        [questId]: { ...progress, completed: true, stageIndex: nextIndex },
      },
    }
  }

  const rewards = currentStage?.rewards ?? []
  let result = applyOutcomes(state, rewards)
  return {
    ...result,
    statusMessage: buildQuestStatusMessage(quest.name, false, rewards),
    quests: {
      ...(result.quests ?? {}),
      [questId]: { ...progress, stageIndex: nextIndex, counters: {} },
    },
  }
}

export function isObjectiveMet(state: GameState, objective: QuestObjective): boolean {
  switch (objective.type) {
    case 'talk_npc':
      return !!state.flags?.[`talked_${objective.target}`]
    case 'collect_material':
      return getMaterialCount(state.player, objective.target) >= (objective.count ?? 1)
    case 'collect_item':
      return hasItem(state.player, objective.target)
    case 'craft_item':
      return !!state.flags?.[`crafted_${objective.target}`]
    case 'defeat_boss':
      return (state.bossesDefeated ?? []).includes(objective.target)
    case 'defeat_enemy':
      return !!state.flags?.[`defeated_${objective.target}`]
    case 'visit_room':
      return state.roomHistory.includes(objective.target)
    case 'set_flag':
      return !!state.flags?.[objective.target]
    default:
      return false
  }
}

export function checkAndAdvanceQuests(state: GameState): GameState {
  let result = state
  const quests = result.quests ?? {}

  for (const [questId, progress] of Object.entries(quests)) {
    if (progress.completed) continue
    const quest = getQuestDef(questId)
    if (!quest) continue
    const stage = quest.stages[progress.stageIndex]
    if (!stage) continue
    if (isObjectiveMet(result, stage.objective)) {
      result = advanceQuestStage(result, questId, stage.id)
    }
  }

  return result
}

export function getActiveQuestStages(state: GameState): Array<{
  quest: QuestDef
  progress: QuestProgress
  stage: QuestDef['stages'][number]
  progressText: string
}> {
  const results: Array<{
    quest: QuestDef
    progress: QuestProgress
    stage: QuestDef['stages'][number]
    progressText: string
  }> = []

  for (const progress of Object.values(state.quests ?? {})) {
    if (progress.completed) continue
    const quest = getQuestDef(progress.questId)
    if (!quest) continue
    const stage = quest.stages[progress.stageIndex]
    if (stage) {
      results.push({
        quest,
        progress,
        stage,
        progressText: getObjectiveProgressText(state, stage.objective),
      })
    }
  }

  return results
}

export function getObjectiveProgressText(state: GameState, objective: QuestObjective): string {
  switch (objective.type) {
    case 'collect_material': {
      const have = getMaterialCount(state.player, objective.target)
      const need = objective.count ?? 1
      return `${have}/${need}`
    }
    case 'defeat_boss':
      return (state.bossesDefeated ?? []).includes(objective.target) ? '1/1' : '0/1'
    case 'defeat_enemy':
      return state.flags?.[`defeated_${objective.target}`] ? '1/1' : '0/1'
    case 'craft_item':
      return state.flags?.[`crafted_${objective.target}`] ? '1/1' : '0/1'
    case 'visit_room':
      return state.roomHistory.includes(objective.target) ? '1/1' : '0/1'
    case 'talk_npc':
      return state.flags?.[`talked_${objective.target}`] ? '1/1' : '0/1'
    case 'set_flag':
      return state.flags?.[objective.target] ? '1/1' : '0/1'
    default:
      return ''
  }
}
