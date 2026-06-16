/**
 * Dialogue system — branching NPC conversations.
 */

import type { GameState } from './GameLoopDesign'
import type { DialogueDef, DialogueState } from './ContentSchemas'
import { applyOutcomes, meetsRequirements } from './Outcomes'
import { checkAndAdvanceQuests } from './QuestSystem'

import brynDialogue from '../assets/dialogue/captain_bryn.json'
import marenDialogue from '../assets/dialogue/maren_healer.json'
import garrickDialogue from '../assets/dialogue/garrick_smith.json'
import seraDialogue from '../assets/dialogue/sera_quartermaster.json'
import pellDialogue from '../assets/dialogue/old_pell.json'
import brannochDialogue from '../assets/dialogue/brannoch.json'
import wrenDialogue from '../assets/dialogue/wren.json'
import yvaneDialogue from '../assets/dialogue/yvane.json'

const DIALOGUES: DialogueDef[] = [
  brynDialogue as DialogueDef,
  marenDialogue as DialogueDef,
  garrickDialogue as DialogueDef,
  seraDialogue as DialogueDef,
  pellDialogue as DialogueDef,
  brannochDialogue as DialogueDef,
  wrenDialogue as DialogueDef,
  yvaneDialogue as DialogueDef,
]

const dialogueMap = new Map(DIALOGUES.map((d) => [d.id, d]))

export function getDialogue(id: string): DialogueDef | undefined {
  return dialogueMap.get(id)
}

export function startDialogue(state: GameState, dialogueId: string): GameState {
  const dialogue = getDialogue(dialogueId)
  if (!dialogue || dialogue.nodes.length === 0) return state

  const activeDialogue: DialogueState = {
    dialogueId,
    npcId: dialogue.npcId,
    currentNodeId: dialogue.nodes[0]!.id,
  }

  return { ...state, phase: 'dialogue', activeDialogue }
}

export function selectDialogueResponse(
  state: GameState,
  responseIndex: number
): GameState {
  const active = state.activeDialogue
  if (!active) return state

  const dialogue = getDialogue(active.dialogueId)
  if (!dialogue) return state

  const node = dialogue.nodes.find((n) => n.id === active.currentNodeId)
  if (!node) return state

  const response = node.responses[responseIndex]
  if (!response || !meetsRequirements(state, response.requires)) return state

  let result: GameState = { ...state }

  if (response.outcomes?.length) {
    result = applyOutcomes(result, response.outcomes)
  }

  result.flags = {
    ...(result.flags ?? {}),
    [`talked_${active.npcId}`]: true,
  }

  if (response.next) {
    result.activeDialogue = { ...active, currentNodeId: response.next }
    return checkAndAdvanceQuests(result)
  }

  result = checkAndAdvanceQuests(result)
  return { ...result, phase: 'room_exploring', activeDialogue: undefined }
}

export function endDialogue(state: GameState): GameState {
  return { ...state, phase: 'room_exploring', activeDialogue: undefined }
}
