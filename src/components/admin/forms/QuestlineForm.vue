<template>
  <div v-if="form" class="questline-form">
    <div class="form-header">
      <div class="form-header-info">
        <span class="form-id">{{ form.id }}</span>
        <span v-if="isNew" class="badge badge-new">New</span>
        <span v-else-if="isOverlayOnly" class="badge badge-overlay">Overlay</span>
        <span v-else class="badge badge-base">Base</span>
      </div>
      <div class="form-header-actions">
        <button type="button" class="btn btn-primary" :disabled="saving" @click="save">
          {{ saving ? 'Saving…' : 'Save' }}
        </button>
        <button type="button" class="btn btn-danger" @click="deleteQuestline">Delete</button>
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
          <textarea v-model="form.description" class="field-textarea" rows="2" />
        </label>
        <label class="field-label">
          Start Flag
          <input v-model="form.startFlag" type="text" class="field-input" placeholder="flag_id (optional)" />
        </label>
      </section>

      <section class="form-section">
        <h3 class="section-title">Quests (ordered)</h3>
        <RepeatableList
          v-model="form.questIds"
          add-label="+ Add Quest"
          :make-item="() => ''"
        >
          <template #default="{ item, update }">
            <RefPicker
              :model-value="item as string"
              :options="questOptions"
              placeholder="Select quest…"
              @update:model-value="update($event)"
            />
          </template>
        </RepeatableList>
      </section>

      <section class="form-section">
        <h3 class="section-title">Required Quests</h3>
        <RepeatableList
          v-model="requiredQuestIds"
          add-label="+ Add Required Quest"
          :make-item="() => ''"
        >
          <template #default="{ item, update }">
            <RefPicker
              :model-value="item as string"
              :options="questOptions"
              placeholder="Select required quest…"
              @update:model-value="update($event)"
            />
          </template>
        </RepeatableList>
      </section>
    </div>
  </div>

  <div v-else class="form-empty">
    <p class="empty-msg">Select a questline to edit or create a new one.</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { QuestlineDef } from '@/engine/ContentSchemas'
import {
  loadOverlay,
  saveOverlay,
  upsertEntity,
  removeUpsert,
} from '@/engine/admin/ContentOverlayStore'
import { refreshContentRegistry } from '@/engine/admin/ContentRegistry'
import RepeatableList from './RepeatableList.vue'
import RefPicker from './RefPicker.vue'

const props = defineProps<{
  questlineId: string | null
  overlayIds: Set<string>
  allQuestlines: QuestlineDef[]
  questOptions: { id: string; label: string }[]
}>()

const emit = defineEmits<{
  (e: 'saved'): void
  (e: 'deleted'): void
}>()

const form = ref<QuestlineDef | null>(null)
const saving = ref(false)
const statusMsg = ref('')
const statusType = ref<'ok' | 'error'>('ok')

const isNew = computed(
  () => !!form.value && !props.overlayIds.has(form.value.id)
)
const isOverlayOnly = computed(
  () => !!form.value && props.overlayIds.has(form.value.id)
)

const requiredQuestIds = computed<string[]>({
  get() {
    return form.value?.requiredQuestIds ?? []
  },
  set(v) {
    if (form.value) form.value.requiredQuestIds = v.length > 0 ? v : undefined
  },
})

watch(
  () => props.questlineId,
  (id) => {
    statusMsg.value = ''
    if (!id) {
      form.value = null
      return
    }
    const ql = props.allQuestlines.find((q) => q.id === id)
    form.value = ql ? (JSON.parse(JSON.stringify(ql)) as QuestlineDef) : null
  },
  { immediate: true }
)

function save() {
  if (!form.value) return
  saving.value = true
  statusMsg.value = ''
  try {
    const overlay = loadOverlay()
    const next = upsertEntity(overlay, 'questlines', form.value)
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

function deleteQuestline() {
  if (!form.value) return
  const id = form.value.id
  if (!window.confirm(`Delete questline "${id}"? This cannot be undone.`)) return
  const overlay = loadOverlay()
  const next = removeUpsert(overlay, 'questlines', id)
  saveOverlay(next)
  refreshContentRegistry()
  form.value = null
  emit('deleted')
}

function loadQuestline(ql: QuestlineDef) {
  form.value = JSON.parse(JSON.stringify(ql)) as QuestlineDef
  statusMsg.value = ''
}

function createNew() {
  const id = `questline_${Date.now()}`
  form.value = {
    id,
    name: '',
    questIds: [],
  }
  statusMsg.value = ''
}

defineExpose({ loadQuestline, createNew })
</script>

<style scoped>
.questline-form {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.form-empty {
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
</style>
