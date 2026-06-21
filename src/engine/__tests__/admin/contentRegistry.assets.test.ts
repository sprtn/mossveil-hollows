import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  initContentRegistry,
  getItemTemplate,
  getAllItems,
  getEvent,
  getAllEvents,
  getRecipe,
  getAllRecipes,
  getBuilding,
  getAllBuildings,
  getSkill,
  getAllSkills,
  getEncounterTemplate,
  getAllEncounterTemplates,
  refreshContentRegistry,
} from '../../admin/ContentRegistry'
import { refreshItemDatabase, getItemTemplate as getItemFromDatabase } from '../../ItemDatabase'
import {
  upsertEntity,
  saveOverlay,
  createEmptyOverlay,
  markDeleted,
  OVERLAY_STORAGE_KEY,
} from '../../admin/ContentOverlayStore'

describe('ContentRegistry items, events, recipes, buildings, skills', () => {
  const storage = new Map<string, string>()

  beforeEach(() => {
    storage.clear()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value)
      },
      removeItem: (key: string) => {
        storage.delete(key)
      },
    })
    localStorage.removeItem(OVERLAY_STORAGE_KEY)
    initContentRegistry()
    refreshItemDatabase()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads shipped health_potion item', () => {
    expect(getItemTemplate('health_potion')?.name).toBe('Health Potion')
  })

  it('overlay upsert overrides base item name', () => {
    let overlay = upsertEntity(createEmptyOverlay(), 'items', {
      ...getItemTemplate('health_potion')!,
      name: 'Overlay Potion',
    })
    saveOverlay(overlay)
    refreshContentRegistry()
    refreshItemDatabase()
    expect(getItemTemplate('health_potion')?.name).toBe('Overlay Potion')
    expect(getItemFromDatabase('health_potion')?.name).toBe('Overlay Potion')
  })

  it('deleted id hides base item', () => {
    let overlay = markDeleted(createEmptyOverlay(), 'items', 'health_potion')
    saveOverlay(overlay)
    refreshContentRegistry()
    refreshItemDatabase()
    expect(getAllItems().some(i => i.id === 'health_potion')).toBe(false)
  })

  it('loads shipped wounded_traveler event', () => {
    expect(getEvent('wounded_traveler')?.title).toBe('Wounded Traveler')
  })

  it('overlay upsert overrides base event title', () => {
    let overlay = upsertEntity(createEmptyOverlay(), 'events', {
      ...getEvent('wounded_traveler')!,
      title: 'Overlay Traveler',
    })
    saveOverlay(overlay)
    refreshContentRegistry()
    expect(getEvent('wounded_traveler')?.title).toBe('Overlay Traveler')
  })

  it('loads shipped oak_spear recipe', () => {
    expect(getRecipe('oak_spear')?.name).toBe('Oak Spear')
  })

  it('overlay upsert overrides base recipe name', () => {
    let overlay = upsertEntity(createEmptyOverlay(), 'recipes', {
      ...getRecipe('oak_spear')!,
      name: 'Overlay Spear',
    })
    saveOverlay(overlay)
    refreshContentRegistry()
    expect(getRecipe('oak_spear')?.name).toBe('Overlay Spear')
  })

  it('loads shipped logging_camp building', () => {
    expect(getBuilding('logging_camp')?.name).toBe('Logging Camp')
  })

  it('overlay upsert overrides base building name', () => {
    let overlay = upsertEntity(createEmptyOverlay(), 'buildings', {
      ...getBuilding('logging_camp')!,
      name: 'Overlay Camp',
    })
    saveOverlay(overlay)
    refreshContentRegistry()
    expect(getBuilding('logging_camp')?.name).toBe('Overlay Camp')
  })

  it('loads shipped empowered_strike skill', () => {
    expect(getSkill('skill_empowered_strike')?.name).toBe('Empowered Strike')
  })

  it('overlay upsert overrides base skill name', () => {
    let overlay = upsertEntity(createEmptyOverlay(), 'skills', {
      ...getSkill('skill_empowered_strike')!,
      name: 'Overlay Strike',
    })
    saveOverlay(overlay)
    refreshContentRegistry()
    expect(getSkill('skill_empowered_strike')?.name).toBe('Overlay Strike')
  })

  it('loads shipped forest_ambush encounter template', () => {
    const enemies = getEncounterTemplate('forest_ambush')
    expect(enemies?.length).toBe(1)
    expect(enemies?.[0]?.name).toBe('Bandit Scout')
  })

  it('overlay upsert overrides base encounter template enemy name', () => {
    const base = getEncounterTemplate('forest_ambush')!
    const overlayEnemies = base.map((e, i) => (i === 0 ? { ...e, name: 'Overlay Bandit' } : e))
    let overlay = createEmptyOverlay()
    overlay = {
      ...overlay,
      upserts: {
        ...overlay.upserts,
        encounterTemplates: { forest_ambush: overlayEnemies },
      },
    }
    saveOverlay(overlay)
    refreshContentRegistry()
    expect(getEncounterTemplate('forest_ambush')?.[0]?.name).toBe('Overlay Bandit')
  })

  it('deleted id hides base encounter template', () => {
    let overlay = markDeleted(createEmptyOverlay(), 'encounterTemplates', 'forest_ambush')
    saveOverlay(overlay)
    refreshContentRegistry()
    expect(getAllEncounterTemplates().some((t) => t.id === 'forest_ambush')).toBe(false)
  })

  it('getAll* return base content counts', () => {
    expect(getAllItems().length).toBeGreaterThanOrEqual(39)
    expect(getAllEvents().length).toBeGreaterThanOrEqual(8)
    expect(getAllRecipes().length).toBeGreaterThanOrEqual(8)
    expect(getAllBuildings().length).toBeGreaterThanOrEqual(3)
    expect(getAllSkills().length).toBeGreaterThanOrEqual(19)
    expect(getAllEncounterTemplates().length).toBeGreaterThanOrEqual(1)
  })
})
