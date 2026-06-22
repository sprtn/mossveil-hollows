<template>
  <div v-if="form" class="room-form">
    <div class="form-header">
      <div class="form-header-info">
        <span class="form-id">{{ form.id }}</span>
        <span v-if="isNew" class="badge badge-new">New</span>
        <span v-else-if="isOverlayOnly" class="badge badge-overlay">Overlay</span>
        <span v-else-if="isModified" class="badge badge-modified">Modified</span>
        <span v-else class="badge badge-base">Base</span>
      </div>
      <div class="form-header-actions">
        <button type="button" class="btn btn-primary" :disabled="saving" @click="save">
          {{ saving ? 'Saving…' : 'Save' }}
        </button>
        <button type="button" class="btn btn-danger" @click="deleteRoom">Delete</button>
      </div>
    </div>

    <div v-if="statusMsg" class="form-status" :class="statusType">{{ statusMsg }}</div>

    <div class="form-scroll">
      <section class="form-section">
        <h3 class="section-title">Basic</h3>
        <label class="field-label">
          ID
          <input v-model="form.id" type="text" class="field-input" :disabled="!isNew" />
        </label>
        <label class="field-label">
          Name
          <input v-model="form.name" type="text" class="field-input" />
        </label>
        <label class="field-label">
          Description
          <textarea v-model="form.description" class="field-textarea" rows="3" />
        </label>
        <div class="form-grid-3">
          <label class="field-label">
            Zone
            <RefPicker
              :model-value="form.zoneId ?? ''"
              :options="refOptions?.zones ?? []"
              placeholder="Select zone…"
              allow-empty
              allow-custom
              @update:model-value="form.zoneId = $event || undefined"
            />
          </label>
          <label class="field-label">
            Difficulty
            <input v-model.number="form.difficulty" type="number" class="field-input" min="0" max="10" />
          </label>
          <label class="field-label">
            Picture URL
            <input v-model="form.picture" type="text" class="field-input" placeholder="https://…" />
          </label>
        </div>
        <div class="form-flags">
          <label class="flag-label">
            <input v-model="form.isHub" type="checkbox" />
            Is Hub
          </label>
          <label class="flag-label">
            <input v-model="form.isFinalBoss" type="checkbox" />
            Final Boss
          </label>
        </div>
      </section>

      <section class="form-section">
        <h3 class="section-title">Flavor</h3>
        <label class="field-label">
          On Enter
          <input v-model="flavor.onEnter" type="text" class="field-input" placeholder="Flavor text on enter…" />
        </label>
        <label class="field-label">
          On Exit
          <input v-model="flavor.onExit" type="text" class="field-input" placeholder="Flavor text on exit…" />
        </label>
        <label class="field-label">
          Atmosphere
          <input v-model="flavor.atmosphere" type="text" class="field-input" placeholder="dark, damp…" />
        </label>
      </section>

      <section class="form-section">
        <h3 class="section-title">Exits</h3>
        <RoomExitEditor v-model="form.exits" :ref-options="refOptions" />
      </section>

      <section class="form-section">
        <h3 class="section-title">Encounters</h3>
        <EncounterEditor v-model="formEncounters" />
      </section>

      <section class="form-section">
        <h3 class="section-title">Gather Nodes</h3>
        <GatherNodeEditor v-model="form.gatherNodes" :material-options="refOptions?.materials ?? []" />
      </section>
    </div>
  </div>

  <div v-else class="room-form-empty">
    <p class="empty-msg">Select a room to edit or create a new one.</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Room } from '@/engine/RoomSystem'
import type { EncounterDef } from '@/engine/GameLoopDesign'
import {
  loadOverlay,
  saveOverlay,
  upsertEntity,
  markDeleted,
  removeUpsert,
} from '@/engine/admin/ContentOverlayStore'
import { refreshContentRegistry } from '@/engine/admin/ContentRegistry'
import RoomExitEditor from './RoomExitEditor.vue'
import EncounterEditor from './EncounterEditor.vue'
import GatherNodeEditor from './GatherNodeEditor.vue'
import RefPicker from './RefPicker.vue'
import type { AdminRefOptions } from '@/engine/admin/contentIndexes'

const props = defineProps<{
  roomId: string | null
  baseIds: Set<string>
  overlayIds: Set<string>
  roomOptions: { id: string; label: string }[]
  allRooms: Room[]
  refOptions?: Partial<AdminRefOptions>
}>()

const emit = defineEmits<{
  (e: 'saved'): void
  (e: 'deleted'): void
}>()

const form = ref<Room | null>(null)
const saving = ref(false)
const statusMsg = ref('')
const statusType = ref<'ok' | 'error'>('ok')

const isNew = computed(() => !!form.value && !props.baseIds.has(form.value.id) && !props.overlayIds.has(form.value.id))
const isOverlayOnly = computed(() => !!form.value && !props.baseIds.has(form.value.id) && props.overlayIds.has(form.value.id))
const isModified = computed(() => !!form.value && props.baseIds.has(form.value.id) && props.overlayIds.has(form.value.id))

const flavor = computed(() => {
  if (!form.value) return { onEnter: '', onExit: '', atmosphere: '' }
  if (!form.value.flavor) form.value.flavor = {}
  return form.value.flavor
})

const formEncounters = computed<EncounterDef[]>({
  get() {
    return form.value?.encounters ?? []
  },
  set(v) {
    if (form.value) form.value.encounters = v
  },
})

watch(
  () => props.roomId,
  (id) => {
    statusMsg.value = ''
    if (!id) {
      form.value = null
      return
    }
    const room = props.allRooms.find((r) => r.id === id)
    if (room) {
      form.value = JSON.parse(JSON.stringify(room)) as Room
    } else {
      form.value = null
    }
  },
  { immediate: true }
)

function save() {
  if (!form.value) return
  saving.value = true
  statusMsg.value = ''
  try {
    const overlay = loadOverlay()
    const next = upsertEntity(overlay, 'rooms', form.value)
    saveOverlay(next)
    refreshContentRegistry()
    statusMsg.value = 'Saved.'
    statusType.value = 'ok'
    emit('saved')
  } catch (e) {
    statusMsg.value = e instanceof Error ? e.message : 'Save failed.'
    statusType.value = 'error'
  } finally {
    saving.value = false
  }
}

function deleteRoom() {
  if (!form.value) return
  const id = form.value.id
  if (!window.confirm(`Delete room "${id}"? This cannot be undone.`)) return
  const overlay = loadOverlay()
  let next = overlay
  if (isOverlayOnly.value) {
    next = removeUpsert(overlay, 'rooms', id)
  } else {
    next = markDeleted(overlay, 'rooms', id)
  }
  saveOverlay(next)
  refreshContentRegistry()
  form.value = null
  emit('deleted')
}

function loadRoom(room: Room) {
  form.value = JSON.parse(JSON.stringify(room)) as Room
  statusMsg.value = ''
}

function createNew() {
  const id = `room_${Date.now()}`
  form.value = {
    id,
    type: 'static',
    name: '',
    description: '',
    exits: [],
    encounters: [],
    difficulty: 0,
  }
  statusMsg.value = ''
}

defineExpose({ loadRoom, createNew })
</script>

<style scoped>
.room-form {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.room-form-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.empty-msg {
  color: var(--color-text-soft);
  font-style: italic;
  font-size: 13px;
}

.form-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-elevated);
  flex-shrink: 0;
}

.form-header-info {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.form-id {
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  color: var(--color-accent);
  overflow: hidden;
  text-overflow: ellipsis;
}

.form-header-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.badge {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 2px 7px;
  border-radius: var(--radius-sm);
}

.badge-base {
  background: rgba(95, 143, 80, 0.15);
  color: var(--color-accent);
  border: 1px solid rgba(95, 143, 80, 0.3);
}

.badge-overlay {
  background: rgba(70, 130, 200, 0.15);
  color: #6ab0f5;
  border: 1px solid rgba(70, 130, 200, 0.3);
}

.badge-modified {
  background: rgba(212, 168, 75, 0.15);
  color: var(--color-warning, #d4a84b);
  border: 1px solid rgba(212, 168, 75, 0.3);
}

.badge-new {
  background: rgba(140, 100, 200, 0.15);
  color: #c3a0f0;
  border: 1px solid rgba(140, 100, 200, 0.3);
}

.form-status {
  padding: 6px 14px;
  font-size: 12px;
  flex-shrink: 0;
}

.form-status.ok {
  color: var(--color-accent);
  background: rgba(95, 143, 80, 0.1);
}

.form-status.error {
  color: var(--color-danger, #c0392b);
  background: rgba(192, 57, 43, 0.1);
}

.form-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-title {
  margin: 0 0 4px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-soft);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 4px;
}

.field-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-soft);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.field-input,
.field-textarea {
  padding: 5px 8px;
  font-family: var(--font-body);
  font-size: 13px;
  color: var(--color-text);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  resize: vertical;
}

.field-input:focus,
.field-textarea:focus {
  outline: none;
  border-color: var(--color-accent);
}

.field-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-grid-3 {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
}

.form-flags {
  display: flex;
  gap: 16px;
}

.flag-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--color-text-soft);
  cursor: pointer;
}
</style>
