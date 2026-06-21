/**
 * NPC definitions.
 */

import type { NpcDef } from './ContentSchemas'
import { getNpc as getNpcFromRegistry, getAllNpcs as getAllNpcsFromRegistry } from './admin/ContentRegistry'

export const NPCS: NpcDef[] = getAllNpcsFromRegistry()

export function getNpc(id: string): NpcDef | undefined {
  return getNpcFromRegistry(id)
}
