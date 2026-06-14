/**
 * NPC definitions.
 */

import type { NpcDef } from './ContentSchemas'

import captainBryn from '../assets/npcs/captain_bryn.json'
import marenHealer from '../assets/npcs/maren_healer.json'
import garrickSmith from '../assets/npcs/garrick_smith.json'
import seraQuartermaster from '../assets/npcs/sera_quartermaster.json'
import oldPell from '../assets/npcs/old_pell.json'

export const NPCS: NpcDef[] = [
  captainBryn as NpcDef,
  marenHealer as NpcDef,
  garrickSmith as NpcDef,
  seraQuartermaster as NpcDef,
  oldPell as NpcDef,
]

export function getNpc(id: string): NpcDef | undefined {
  return NPCS.find((n) => n.id === id)
}
