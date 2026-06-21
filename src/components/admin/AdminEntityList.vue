<template>
  <div class="admin-entity-list">
    <template v-if="contentType === 'rooms'">
      <div class="list-toolbar">
        <input
          v-model="search"
          type="text"
          class="list-search"
          placeholder="Search rooms…"
          @input="selectedId = null"
        />
        <button type="button" class="btn btn-primary btn-sm" @click="createNew">+ New</button>
      </div>
      <div v-if="filteredRooms.length === 0" class="list-empty">No rooms found.</div>
      <ul v-else class="list-items" role="listbox">
        <li
          v-for="item in filteredRooms"
          :key="item.room.id"
          role="option"
          :aria-selected="selectedId === item.room.id"
          class="list-item"
          :class="{ active: selectedId === item.room.id }"
          @click="select(item.room.id)"
        >
          <span class="item-name">{{ item.room.name || item.room.id }}</span>
          <span class="item-id">{{ item.room.id }}</span>
          <span class="badge" :class="`badge-${item.badge}`">{{ item.badge }}</span>
        </li>
      </ul>
    </template>
    <template v-else>
      <p v-if="!contentType" class="empty">Select a type</p>
      <p v-else class="empty">Entity list stub ({{ contentType }})</p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ContentType } from '@/engine/admin/ContentOverlayTypes'
import type { Room } from '@/engine/RoomSystem'
import { getAllRooms, refreshContentRegistry } from '@/engine/admin/ContentRegistry'
import { loadOverlay } from '@/engine/admin/ContentOverlayStore'

const props = defineProps<{
  contentType?: ContentType | null
}>()

const emit = defineEmits<{
  (e: 'select', id: string): void
  (e: 'create'): void
}>()

const search = ref('')
const selectedId = ref<string | null>(null)

type RoomBadge = 'base' | 'overlay' | 'modified'

interface RoomItem {
  room: Room
  badge: RoomBadge
}

const roomItems = ref<RoomItem[]>([])
const overlayOnlyIds = ref<Set<string>>(new Set())

function refreshRooms() {
  const overlay = loadOverlay()
  const overlayUpsertIds = new Set(Object.keys(overlay.upserts.rooms))

  refreshContentRegistry()
  const allRooms = getAllRooms()
  const allIds = new Set(allRooms.map((r) => r.id))

  const baseIds = new Set<string>()
  for (const id of allIds) {
    if (!overlayUpsertIds.has(id)) {
      baseIds.add(id)
    }
  }

  overlayOnlyIds.value = new Set<string>()
  for (const id of overlayUpsertIds) {
    if (!baseIds.has(id)) {
      overlayOnlyIds.value.add(id)
    }
  }

  roomItems.value = allRooms.map((room) => {
    let badge: RoomBadge = 'base'
    if (overlayUpsertIds.has(room.id)) {
      if (overlayOnlyIds.value.has(room.id)) {
        badge = 'overlay'
      } else {
        badge = 'modified'
      }
    }
    return { room, badge }
  })
}

watch(() => props.contentType, (type) => {
  if (type === 'rooms') refreshRooms()
}, { immediate: true })

const filteredRooms = computed(() => {
  const q = search.value.toLowerCase()
  if (!q) return roomItems.value
  return roomItems.value.filter(
    (item) =>
      item.room.id.toLowerCase().includes(q) ||
      item.room.name.toLowerCase().includes(q) ||
      (item.room.zoneId ?? '').toLowerCase().includes(q)
  )
})

function select(id: string) {
  selectedId.value = id
  emit('select', id)
}

function createNew() {
  selectedId.value = null
  emit('create')
}

defineExpose({ refresh: refreshRooms, selectedId })
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

.empty {
  padding: 20px;
  text-align: center;
  color: var(--color-text-soft);
  font-style: italic;
  font-size: 13px;
}
</style>
