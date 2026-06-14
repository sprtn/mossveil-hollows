import type { QuestDef } from './ContentSchemas'
import taintedGrove from '../assets/quests/tainted_grove.json'
import silkSupply from '../assets/quests/silk_supply.json'
import campSupplies from '../assets/quests/camp_supplies.json'

const QUESTS: QuestDef[] = [
  taintedGrove as QuestDef,
  silkSupply as QuestDef,
  campSupplies as QuestDef,
]
const questMap = new Map(QUESTS.map((q) => [q.id, q]))

export function getQuestDef(questId: string): QuestDef | undefined {
  return questMap.get(questId)
}
