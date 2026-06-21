<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="admin-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Content admin"
      @click.self="close"
    >
      <div class="admin-shell panel" @click.stop>
        <header class="admin-topbar">
          <div class="admin-topbar-left">
            <h2 class="admin-title">Content Admin</h2>
            <span v-if="dirty" class="dirty-badge">Unsaved changes</span>
          </div>
          <div class="admin-topbar-actions">
            <input
              ref="importInput"
              type="file"
              accept="application/json,.json"
              class="import-input"
              @change="handleImport"
            />
            <button type="button" class="btn btn-secondary" @click="triggerImport">Import</button>
            <button type="button" class="btn btn-secondary" @click="handleExport">Export</button>
            <button type="button" class="btn btn-danger" @click="handleReset">Reset overlay</button>
            <button type="button" class="btn close-btn" aria-label="Close admin overlay" @click="close">
              ×
            </button>
          </div>
        </header>

        <div class="admin-body">
          <nav class="admin-tabs panel-inset" aria-label="Content types">
            <button
              v-for="tab in contentTabs"
              :key="tab.type"
              type="button"
              class="admin-tab"
              :class="{ active: selectedType === tab.type }"
              @click="selectedType = tab.type"
            >
              {{ tab.label }}
            </button>
          </nav>

          <section class="admin-center panel-inset">
            <AdminEntityList
              ref="entityList"
              :content-type="selectedType"
              @select="onSelectRoom"
              @create="onCreateRoom"
            />
          </section>

          <aside class="admin-detail panel-inset">
            <template v-if="selectedType === 'rooms'">
              <RoomForm
                ref="roomForm"
                :room-id="selectedRoomId"
                :base-ids="roomBaseIds"
                :overlay-ids="roomOverlayIds"
                :room-options="roomOptions"
                :all-rooms="allRooms"
                @saved="onRoomSaved"
                @deleted="onRoomDeleted"
              />
            </template>
            <template v-else>
              <p v-if="!selectedType" class="empty">Select a type to edit</p>
              <p v-else class="empty">Detail form stub ({{ selectedType }})</p>
            </template>
          </aside>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
import {
  exportBundle,
  importBundle,
  isOverlayDirty,
  loadOverlay,
  resetOverlay,
} from '@/engine/admin/ContentOverlayStore'
import { OVERLAY_BUNDLE_VERSION, type ContentOverlayBundle, type ContentType } from '@/engine/admin/ContentOverlayTypes'
import { getAllRooms, refreshContentRegistry } from '@/engine/admin/ContentRegistry'
import type { Room } from '@/engine/RoomSystem'
import AdminEntityList from './AdminEntityList.vue'
import RoomForm from './forms/RoomForm.vue'

const open = defineModel<boolean>('open', { default: false })

const selectedType = ref<ContentType | null>(null)
const importInput = useTemplateRef<HTMLInputElement>('importInput')
const dirtyTick = ref(0)
const entityList = useTemplateRef<InstanceType<typeof AdminEntityList>>('entityList')
const roomForm = useTemplateRef<InstanceType<typeof RoomForm>>('roomForm')

const selectedRoomId = ref<string | null>(null)
const allRooms = ref<Room[]>([])
const roomBaseIds = ref<Set<string>>(new Set())
const roomOverlayIds = ref<Set<string>>(new Set())

const roomOptions = computed<{ id: string; label: string }[]>(() =>
  allRooms.value.map((r) => ({ id: r.id, label: r.name || r.id }))
)

function syncRoomData() {
  refreshContentRegistry()
  allRooms.value = getAllRooms()
  const overlay = loadOverlay()
  const oIds = new Set(Object.keys(overlay.upserts.rooms))
  roomOverlayIds.value = oIds
  const bIds = new Set<string>()
  for (const r of allRooms.value) {
    if (!oIds.has(r.id)) bIds.add(r.id)
  }
  roomBaseIds.value = bIds
}

function onSelectRoom(id: string) {
  selectedRoomId.value = id
}

function onCreateRoom() {
  selectedRoomId.value = null
  roomForm.value?.createNew()
}

function onRoomSaved() {
  syncRoomData()
  entityList.value?.refresh()
  refreshDirty()
}

function onRoomDeleted() {
  selectedRoomId.value = null
  syncRoomData()
  entityList.value?.refresh()
  refreshDirty()
}

const dirty = computed(() => {
  dirtyTick.value
  return isOverlayDirty()
})

function refreshDirty() {
  dirtyTick.value++
}

const contentTabs: { type: ContentType; label: string }[] = [
  { type: 'rooms', label: 'Locations' },
  { type: 'npcs', label: 'NPCs' },
  { type: 'quests', label: 'Quests' },
  { type: 'questlines', label: 'Questlines' },
  { type: 'dialogues', label: 'Dialogue' },
  { type: 'items', label: 'Items' },
  { type: 'events', label: 'Events' },
  { type: 'encounterTemplates', label: 'Encounters' },
  { type: 'recipes', label: 'Recipes' },
  { type: 'buildings', label: 'Buildings' },
  { type: 'skills', label: 'Skills' },
]

function close() {
  open.value = false
}

function handleExport() {
  const json = JSON.stringify(exportBundle(), null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `content-overlay-v1-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function triggerImport() {
  importInput.value?.click()
}

async function handleImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  try {
    const text = await file.text()
    const bundle = JSON.parse(text) as ContentOverlayBundle
    if (bundle.version !== OVERLAY_BUNDLE_VERSION) {
      throw new Error(`Unsupported overlay bundle version: ${bundle.version ?? 'missing'}`)
    }
    importBundle(bundle)
    refreshContentRegistry()
    refreshDirty()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to import overlay bundle'
    window.alert(`Import failed: ${message}`)
  } finally {
    input.value = ''
  }
}

function handleReset() {
  if (!window.confirm('Reset all content overlay changes? This cannot be undone.')) return
  resetOverlay()
  refreshContentRegistry()
  refreshDirty()
}

watch(open, (isOpen) => {
  if (isOpen) {
    refreshDirty()
    syncRoomData()
  }
})

watch(selectedType, (type) => {
  selectedRoomId.value = null
  if (type === 'rooms') syncRoomData()
})
</script>

<style scoped>
.admin-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: stretch;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.78);
}

.admin-shell {
  display: flex;
  flex-direction: column;
  width: min(1400px, 100%);
  max-height: 100%;
  padding: 0;
  overflow: hidden;
}

.admin-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-elevated);
}

.admin-topbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.admin-title {
  margin: 0;
  font-size: 18px;
  letter-spacing: 0.04em;
  color: var(--color-accent-bright);
}

.dirty-badge {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-warning);
  border: 1px solid rgba(212, 168, 75, 0.35);
  border-radius: var(--radius-sm);
  padding: 2px 8px;
  background: rgba(212, 168, 75, 0.1);
}

.admin-topbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.import-input {
  display: none;
}

.close-btn {
  min-width: 36px;
  padding: 4px 10px;
  font-size: 22px;
  line-height: 1;
}

.admin-body {
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr) minmax(280px, 360px);
  gap: 12px;
  flex: 1;
  min-height: 0;
  padding: 12px;
  overflow: hidden;
}

.admin-tabs {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  overflow-y: auto;
}

.admin-tab {
  text-align: left;
  padding: 8px 10px;
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-soft);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.15s;
}

.admin-tab:hover {
  color: var(--color-text);
  background: var(--color-bg-elevated);
  border-color: var(--color-border);
}

.admin-tab.active {
  color: var(--color-text);
  background: rgba(95, 143, 80, 0.15);
  border-color: var(--color-accent);
  box-shadow: var(--shadow-glow);
}

.admin-center,
.admin-detail {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-soft);
  font-style: italic;
  font-size: 13px;
  padding: 24px;
}

.admin-center {
  padding: 0;
}

.admin-detail {
  padding: 0;
  overflow: hidden;
}
</style>
