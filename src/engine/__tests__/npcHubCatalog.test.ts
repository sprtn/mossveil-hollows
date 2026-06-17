import { describe, it, expect } from 'vitest'
import { createDefaultPlayer } from '../CombatEngine'
import { initGame } from '../GameLoop'
import { NPCS } from '../NpcData'
import {
  getNpcHubSections,
  getNpcOfferingHints,
  getNpcPortraitSrc,
  isNpcShopAvailable,
  resolvePendingHubNavigation,
  TOWN_LEVEL_FEATURES,
  NPC_PORTRAIT_PLACEHOLDER,
} from '../NpcHubCatalog'
import type { Room } from '../GameLoopDesign'

const hubRoom: Room = {
  id: 'town_hub',
  name: 'Hub',
  description: 'Safe',
  isHub: true,
  encounters: [],
  exits: [],
}

function hubState(workbenchLevel = 0) {
  const state = initGame(createDefaultPlayer(), hubRoom)
  return {
    ...state,
    phase: 'room_exploring' as const,
    townBuildings: { workbench: workbenchLevel },
  }
}

describe('NpcHubCatalog', () => {
  it('roster has 8 NPCs with resolvable portrait paths', () => {
    expect(NPCS).toHaveLength(8)
    for (const npc of NPCS) {
      const src = getNpcPortraitSrc(npc)
      expect(src).toMatch(/^\/images\/npcs\//)
      expect(src.endsWith('.png')).toBe(true)
    }
    expect(NPC_PORTRAIT_PLACEHOLDER).toBe('/images/npcs/_placeholder.png')
  })

  it('portrait fallback uses npc id when portrait field omitted', () => {
    const npc = { id: 'test_npc', name: 'Test', role: 'Tester', dialogueId: 'x' }
    expect(getNpcPortraitSrc(npc)).toBe('/images/npcs/test_npc.png')
  })

  it('Garrick hub has craft and shop; shop gated by workbench', () => {
    const noBench = hubState(0)
    const withBench = hubState(1)

    expect(getNpcHubSections('garrick_smith', noBench)).toEqual(
      expect.arrayContaining(['talk', 'craft', 'shop'])
    )
    expect(isNpcShopAvailable('garrick_smith', noBench)).toBe(false)
    expect(isNpcShopAvailable('garrick_smith', withBench)).toBe(true)
  })

  it('Maren hub has heal and craft, no shop', () => {
    const state = hubState()
    const sections = getNpcHubSections('maren_healer', state)
    expect(sections).toContain('heal')
    expect(sections).toContain('craft')
    expect(sections).not.toContain('shop')
  })

  it('Bryn hub has train only beyond talk, not profession_train or quests', () => {
    const state = hubState()
    const sections = getNpcHubSections('captain_bryn', state)
    expect(sections).toContain('talk')
    expect(sections).toContain('train')
    expect(sections).not.toContain('profession_train')
    expect(sections).not.toContain('quests' as never)
  })

  it('profession trainers have profession_train beyond talk', () => {
    const state = hubState()
    for (const id of ['brannoch', 'wren', 'yvane'] as const) {
      const sections = getNpcHubSections(id, state)
      expect(sections).toEqual(['talk', 'profession_train'])
    }
  })

  it('Old Pell hub is talk only', () => {
    const state = hubState()
    expect(getNpcHubSections('old_pell', state)).toEqual(['talk'])
  })

  it('Garrick offering hints show locked shop without workbench', () => {
    const hints = getNpcOfferingHints('garrick_smith', hubState(0))
    expect(hints).toContain('Shop (needs workbench)')
    expect(getNpcOfferingHints('garrick_smith', hubState(1))).toContain('Shop')
  })

  it('resolvePendingHubNavigation maps dialogue handoff', () => {
    expect(
      resolvePendingHubNavigation({ npcId: 'brannoch', panel: 'profession_train' })
    ).toEqual({ selectedNpcId: 'brannoch', focusSection: 'profession_train' })

    expect(
      resolvePendingHubNavigation({ npcId: 'captain_bryn', panel: 'train' })
    ).toEqual({ selectedNpcId: 'captain_bryn', focusSection: 'train' })
  })

  it('hub sections never include town-level features', () => {
    const state = hubState(1)
    for (const npc of NPCS) {
      const sections = getNpcHubSections(npc.id, state)
      for (const feature of TOWN_LEVEL_FEATURES) {
        expect(sections).not.toContain(feature as never)
      }
    }
  })
})
