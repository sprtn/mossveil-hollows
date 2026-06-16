import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Audit: explore events that grant gatherable materials for free.
 * berry_thicket removed — these remain (flagged, unchanged per spec).
 */
describe('explore event material grants audit', () => {
  const eventsDir = join(process.cwd(), 'src/assets/events')
  const files = readdirSync(eventsDir).filter((f) => f.endsWith('.json'))

  const grants: Array<{ file: string; materialId: string; qty: number }> = []

  for (const file of files) {
    const raw = JSON.parse(readFileSync(join(eventsDir, file), 'utf-8')) as {
      choices?: Array<{ outcomes?: Array<{ kind: string; materialId?: string; qty?: number }> }>
    }
    for (const choice of raw.choices ?? []) {
      for (const outcome of choice.outcomes ?? []) {
        if (outcome.kind === 'give_material' && outcome.materialId) {
          grants.push({
            file,
            materialId: outcome.materialId,
            qty: outcome.qty ?? 1,
          })
        }
      }
    }
  }

  it('documents remaining free give_material explore outcomes', () => {
    expect(grants).toEqual(
      expect.arrayContaining([
        { file: 'fallen_log.json', materialId: 'oak_wood', qty: 3 },
        { file: 'wounded_traveler.json', materialId: 'corrupted_sap', qty: 1 },
      ])
    )
    expect(grants.some((g) => g.file === 'berry_thicket.json')).toBe(false)
  })
})
