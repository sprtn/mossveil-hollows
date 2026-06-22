<template>
  <div class="admin-entity-list">
    <div class="list-toolbar">
      <input
        v-model="search"
        type="text"
        class="list-search"
        :placeholder="`Search ${contentType ?? ''}…`"
        @input="selectedId = null"
      />
      <button type="button" class="btn btn-primary btn-sm" @click="createNew">+ New</button>
      <button
        type="button"
        class="btn btn-secondary btn-sm"
        :disabled="!selectedId"
        @click="duplicateSelected"
      >
        Duplicate
      </button>
    </div>
    <div v-if="!contentType" class="list-empty">Select a type.</div>
    <div v-else-if="filteredItems.length === 0" class="list-empty">No {{ contentType }} found.</div>
    <div v-else-if="zoneGroups" class="list-zones">
      <section v-for="group in zoneGroups" :key="group.key" class="zone-group">
        <button
          type="button"
          class="zone-header"
          :aria-expanded="!collapsedZones.has(group.key)"
          @click="toggleZone(group.key)"
        >
          <span class="zone-chevron">{{ collapsedZones.has(group.key) ? '▸' : '▾' }}</span>
          {{ group.label }}
          <span class="zone-count">{{ group.items.length }}</span>
        </button>
        <ul v-show="!collapsedZones.has(group.key)" class="list-items" role="listbox">
          <li
            v-for="item in group.items"
            :key="item.id"
            role="option"
            :aria-selected="selectedId === item.id"
            class="list-item"
            :class="{ active: selectedId === item.id }"
            @click="select(item.id)"
          >
            <span class="item-name">{{ item.name || item.id }}</span>
            <span class="item-id">{{ item.id }}</span>
            <span class="badge" :class="`badge-${item.badge}`">{{ item.badge }}</span>
          </li>
        </ul>
      </section>
    </div>
    <ul v-else class="list-items" role="listbox">
      <li
        v-for="item in filteredItems"
        :key="item.id"
        role="option"
        :aria-selected="selectedId === item.id"
        class="list-item"
        :class="{ active: selectedId === item.id }"
        @click="select(item.id)"
      >
        <span class="item-name">{{ item.name || item.id }}</span>
        <span class="item-id">{{ item.id }}</span>
        <span class="badge" :class="`badge-${item.badge}`">{{ item.badge }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ContentType } from '@/engine/admin/ContentOverlayTypes'
import { getEffectiveMap, refreshContentRegistry } from '@/engine/admin/ContentRegistry'
import { loadOverlay, saveOverlay, upsertEntity } from '@/engine/admin/ContentOverlayStore'
import type { Room } from '@/engine/RoomSystem'
import { getRoomZoneKey, zoneDisplayLabel } from '@/engine/map/worldMapUtils'

const props = defineProps<{
  contentType?: ContentType | null
}>()

const emit = defineEmits<{
  (e: 'select', id: string): void
  (e: 'create'): void
  (e: 'duplicated', id: string): void
}>()

const search = ref('')
const selectedId = ref<string | null>(null)
const collapsedZones = ref<Set<string>>(new Set())

interface ZoneGroup {
  key: string
  label: string
  items: EntityItem[]
}

type Badge = 'base' | 'overlay' | 'modified'

interface EntityItem {
  id: string
  name: string
  badge: Badge
}

/** Content types that have base JSON asset files (vs overlay-only types like questlines). */
const HAS_BASE_ASSETS = new Set<ContentType>([
  'rooms', 'npcs', 'quests', 'dialogues', 'encounterTemplates',
])

const entityItems = ref<EntityItem[]>([])

function refreshList() {
  const type = props.contentType
  if (!type) {
    entityItems.value = []
    return
  }

  refreshContentRegistry()
  const overlay = loadOverlay()
  const overlayUpsertIds = new Set(Object.keys(overlay.upserts[type] ?? {}))
  const effectiveMap = getEffectiveMap(type)

  const hasBase = HAS_BASE_ASSETS.has(type)

  const items: EntityItem[] = Object.entries(effectiveMap).map(([id, entity]) => {
    const e = entity as { id: string; name?: string }
    const inOverlay = overlayUpsertIds.has(id)
    let badge: Badge
    if (!inOverlay) {
      badge = 'base'
    } else if (hasBase) {
      badge = 'modified'
    } else {
      badge = 'overlay'
    }
    return { id, name: e.name ?? id, badge }
  })

  entityItems.value = items
}

watch(
  () => props.contentType,
  () => {
    search.value = ''
    selectedId.value = null
    refreshList()
  },
  { immediate: true }
)

const filteredItems = computed(() => {
  const q = search.value.toLowerCase()
  if (!q) return entityItems.value
  return entityItems.value.filter(
    (item) => item.id.toLowerCase().includes(q) || item.name.toLowerCase().includes(q)
  )
})

const zoneGroups = computed<ZoneGroup[] | null>(() => {
  if (props.contentType !== 'rooms') return null
  const items = filteredItems.value
  if (items.length === 0) return []

  const effectiveMap = getEffectiveMap('rooms')
  const groups = new Map<string, EntityItem[]>()

  for (const item of items) {
    const room = effectiveMap[item.id] as Room | undefined
    const key = room ? getRoomZoneKey(room) : '__unzoned__'
    const list = groups.get(key) ?? []
    list.push(item)
    groups.set(key, list)
  }

  const sortKey = (key: string) => {
    if (key === '__hub__') return '0'
    if (key === '__unzoned__') return 'z'
    return key
  }

  return [...groups.entries()]
    .sort(([a], [b]) => sortKey(a).localeCompare(sortKey(b)))
    .map(([key, groupItems]) => ({
      key,
      label: zoneDisplayLabel(key),
      items: groupItems.sort((a, b) => a.name.localeCompare(b.name)),
    }))
})

function toggleZone(key: string) {
  const next = new Set(collapsedZones.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  collapsedZones.value = next
}

function select(id: string) {
  selectedId.value = id
  emit('select', id)
}

function createNew() {
  selectedId.value = null
  emit('create')
}

function generateCopyId(sourceId: string, existingIds: Set<string>): string {
  const base = `${sourceId}_copy`
  if (!existingIds.has(base)) return base
  return `${sourceId}_copy_${Date.now()}`
}

function duplicateSelected() {
  const type = props.contentType
  const id = selectedId.value
  if (!type || !id) return

  refreshContentRegistry()
  const effectiveMap = getEffectiveMap(type)
  const source = effectiveMap[id]
  if (!source) return

  const existingIds = new Set(Object.keys(effectiveMap))
  const newId = generateCopyId(id, existingIds)
  const clone = structuredClone(source) as typeof source & { id: string }
  clone.id = newId

  const overlay = loadOverlay()
  const next = upsertEntity(overlay, type, clone)
  saveOverlay(next)
  refreshContentRegistry()
  refreshList()
  select(newId)
  emit('duplicated', newId)
}

defineExpose({ refresh: refreshList, selectedId, select })
</script>

<style scoped>
.admin-entity-list {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.list-toolbar {
  display: flex;
  gap: 8px;
  padding: 8px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.list-search {
  flex: 1;
  padding: 5px 8px;
  font-family: var(--font-body);
  font-size: 13px;
  color: var(--color-text);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.list-search:focus {
  outline: none;
  border-color: var(--color-accent);
}

.btn-sm {
  padding: 4px 10px;
  font-size: 12px;
  white-space: nowrap;
}

.list-empty {
  padding: 20px;
  text-align: center;
  color: var(--color-text-soft);
  font-style: italic;
  font-size: 13px;
}

.list-items {
  flex: 1;
  overflow-y: auto;
  margin: 0;
  padding: 4px;
  list-style: none;
}

.list-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.12s;
}

.list-item:hover {
  background: var(--color-bg-elevated);
  border-color: var(--color-border);
}

.list-item.active {
  background: rgba(95, 143, 80, 0.15);
  border-color: var(--color-accent);
}

.item-name {
  flex: 1;
  font-size: 13px;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-id {
  font-family: var(--font-mono, monospace);
  font-size: 10px;
  color: var(--color-text-soft);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 120px;
}

.badge {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.badge-base {
  background: rgba(95, 143, 80, 0.12);
  color: var(--color-accent);
  border: 1px solid rgba(95, 143, 80, 0.25);
}

.badge-overlay {
  background: rgba(70, 130, 200, 0.12);
  color: #6ab0f5;
  border: 1px solid rgba(70, 130, 200, 0.25);
}

.badge-modified {
  background: rgba(212, 168, 75, 0.12);
  color: var(--color-warning, #d4a84b);
  border: 1px solid rgba(212, 168, 75, 0.25);
}

.list-zones {
  flex: 1;
  overflow-y: auto;
}

.zone-group {
  border-bottom: 1px solid var(--color-border);
}

.zone-header {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 8px 10px;
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-accent);
  background: var(--color-bg-elevated);
  border: none;
  cursor: pointer;
  text-align: left;
}

.zone-header:hover {
  background: rgba(95, 143, 80, 0.08);
}

.zone-chevron {
  font-size: 10px;
  opacity: 0.8;
}

.zone-count {
  margin-left: auto;
  font-size: 10px;
  color: var(--color-text-soft);
  font-weight: 600;
}
</style>
