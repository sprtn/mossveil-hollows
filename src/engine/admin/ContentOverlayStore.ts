import { GAME_VERSION } from '../gameConfig'
import {
  OVERLAY_BUNDLE_VERSION,
  OVERLAY_STORAGE_KEY,
  type ContentEntityMap,
  type ContentOverlayBundle,
  type ContentOverlayState,
  type ContentType,
} from './ContentOverlayTypes'

export { OVERLAY_STORAGE_KEY }

const CONTENT_TYPES: ContentType[] = [
  'rooms',
  'npcs',
  'quests',
  'questlines',
  'dialogues',
  'items',
  'events',
  'recipes',
  'buildings',
  'skills',
  'encounterTemplates',
]

function getStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

type UpsertsByType = ContentOverlayState['upserts']
type DeletedIdsByType = ContentOverlayState['deletedIds']

function setUpsertsSlice(
  upserts: UpsertsByType,
  type: ContentType,
  value: UpsertsByType[ContentType],
): void {
  ;(upserts as Record<ContentType, UpsertsByType[ContentType]>)[type] = value
}

export function createEmptyOverlay(): ContentOverlayState {
  const upserts = {} as UpsertsByType
  const deletedIds = {} as DeletedIdsByType
  for (const type of CONTENT_TYPES) {
    upserts[type] = {}
    deletedIds[type] = []
  }
  return { upserts, deletedIds }
}

function normalizeOverlayState(raw: Partial<ContentOverlayState> | null | undefined): ContentOverlayState {
  const empty = createEmptyOverlay()
  if (!raw) return empty

  for (const type of CONTENT_TYPES) {
    if (raw.upserts?.[type]) {
      setUpsertsSlice(empty.upserts, type, { ...raw.upserts[type] } as UpsertsByType[ContentType])
    }
    if (raw.deletedIds?.[type]) {
      empty.deletedIds[type] = [...raw.deletedIds[type]]
    }
  }
  return empty
}

export function loadOverlay(): ContentOverlayState {
  const storage = getStorage()
  if (!storage) return createEmptyOverlay()
  try {
    const raw = storage.getItem(OVERLAY_STORAGE_KEY)
    if (!raw) return createEmptyOverlay()
    return normalizeOverlayState(JSON.parse(raw) as Partial<ContentOverlayState>)
  } catch {
    return createEmptyOverlay()
  }
}

export function saveOverlay(state: ContentOverlayState): void {
  const storage = getStorage()
  if (!storage) return
  try {
    storage.setItem(OVERLAY_STORAGE_KEY, JSON.stringify(state))
  } catch (e) {
    console.warn('Failed to save content overlay:', e)
  }
}

export function upsertEntity<K extends ContentType>(
  state: ContentOverlayState,
  type: K,
  entity: ContentEntityMap[K] & { id: string },
): ContentOverlayState {
  const next = normalizeOverlayState(state)
  next.upserts[type] = {
    ...next.upserts[type],
    [entity.id]: entity,
  } as ContentOverlayState['upserts'][K]
  next.deletedIds[type] = next.deletedIds[type].filter((id) => id !== entity.id)
  return next
}

export function markDeleted(
  state: ContentOverlayState,
  type: ContentType,
  id: string,
): ContentOverlayState {
  const next = normalizeOverlayState(state)
  if (!next.deletedIds[type].includes(id)) {
    next.deletedIds[type] = [...next.deletedIds[type], id]
  }
  return next
}

export function removeUpsert(
  state: ContentOverlayState,
  type: ContentType,
  id: string,
): ContentOverlayState {
  const next = normalizeOverlayState(state)
  const upsertsForType = next.upserts[type] as Record<string, ContentEntityMap[typeof type]>
  const { [id]: _removed, ...rest } = upsertsForType
  setUpsertsSlice(next.upserts, type, rest as UpsertsByType[ContentType])
  return next
}

export function resetOverlay(type?: ContentType): void {
  if (type) {
    const state = loadOverlay()
    setUpsertsSlice(state.upserts, type, {})
    state.deletedIds[type] = []
    saveOverlay(state)
    return
  }
  saveOverlay(createEmptyOverlay())
}

export function exportBundle(): ContentOverlayBundle {
  const state = loadOverlay()
  return {
    version: OVERLAY_BUNDLE_VERSION,
    exportedAt: new Date().toISOString(),
    gameVersion: GAME_VERSION,
    upserts: state.upserts,
    deletedIds: state.deletedIds,
  }
}

export function importBundle(bundle: ContentOverlayBundle): void {
  if (bundle.version !== OVERLAY_BUNDLE_VERSION) {
    throw new Error(`Unsupported overlay bundle version: ${bundle.version}`)
  }

  const current = loadOverlay()
  const merged = createEmptyOverlay()

  for (const type of CONTENT_TYPES) {
    setUpsertsSlice(merged.upserts, type, {
      ...current.upserts[type],
      ...(bundle.upserts?.[type] ?? {}),
    } as UpsertsByType[ContentType])
    merged.deletedIds[type] = [
      ...new Set([...current.deletedIds[type], ...(bundle.deletedIds?.[type] ?? [])]),
    ]
  }

  saveOverlay(merged)
}
