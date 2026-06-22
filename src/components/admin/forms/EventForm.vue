<template>
  <div v-if="form" class="event-form">
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
        <button type="button" class="btn btn-danger" @click="deleteEvent">Delete</button>
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
          Title
          <input v-model="form.title" type="text" class="field-input" />
        </label>
        <label class="field-label">
          Text
          <textarea v-model="form.text" class="field-textarea" rows="3" />
        </label>
        <div class="form-grid-2">
          <label class="field-label">
            Zone
            <RefPicker
              v-model="form.zone"
              :options="refOptions?.zones ?? []"
              placeholder="Select zone…"
              allow-custom
            />
          </label>
          <label class="field-label">
            Weight
            <input v-model.number="form.weight" type="number" class="field-input" min="0" />
          </label>
        </div>
        <div class="form-flags">
          <label class="flag-label">
            <input v-model="form.once" type="checkbox" />
            Once (fire once per run)
          </label>
          <label class="flag-label">
            <input v-model="form.gatherHazard" type="checkbox" />
            Gather Hazard
          </label>
        </div>
      </section>

      <section class="form-section">
        <h3 class="section-title">Choices</h3>
        <RepeatableList
          v-model="form.choices"
          add-label="+ Add Choice"
          :make-item="makeChoice"
        >
          <template #default="{ item, index, update }">
            <div class="choice-card">
              <div class="choice-header">
                <span class="choice-label">Choice {{ index + 1 }}</span>
              </div>
              <label class="field-label">
                Text
                <input
                  type="text"
                  class="field-input"
                  :value="(item as EventChoice).text"
                  @input="update({ ...(item as EventChoice), text: ($event.target as HTMLInputElement).value })"
                />
              </label>
              <label class="field-label">
                Result Text
                <textarea
                  class="field-textarea"
                  rows="2"
                  :value="(item as EventChoice).resultText"
                  @input="update({ ...(item as EventChoice), resultText: ($event.target as HTMLTextAreaElement).value })"
                />
              </label>

              <div class="sub-section">
                <div class="sub-section-title">Requirements</div>
                <RepeatableList
                  :model-value="(item as EventChoice).requires ?? []"
                  add-label="+ Add Requirement"
                  :make-item="makeRequirement"
                  @update:model-value="update({ ...(item as EventChoice), requires: $event as OutcomeRequirement[] })"
                >
                  <template #default="{ item: req, update: updReq }">
                    <OutcomeRequirementEditor
                      :model-value="req as OutcomeRequirement"
                      :ref-options="refOptions"
                      @update:model-value="updReq($event)"
                    />
                  </template>
                </RepeatableList>
              </div>

              <div class="sub-section">
                <div class="sub-section-title">Outcomes</div>
                <RepeatableList
                  :model-value="(item as EventChoice).outcomes"
                  add-label="+ Add Outcome"
                  :make-item="makeEffect"
                  @update:model-value="update({ ...(item as EventChoice), outcomes: $event as OutcomeEffect[] })"
                >
                  <template #default="{ item: eff, update: updEff }">
                    <OutcomeEffectEditor
                      :model-value="eff as OutcomeEffect"
                      :ref-options="refOptions"
                      @update:model-value="updEff($event)"
                    />
                  </template>
                </RepeatableList>
              </div>
            </div>
          </template>
        </RepeatableList>
      </section>
    </div>
  </div>

  <div v-else class="form-empty">
    <p class="empty-msg">Select an event to edit or create a new one.</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { EventCard, EventChoice } from '@/engine/ContentSchemas'
import type { OutcomeEffect, OutcomeRequirement } from '@/engine/Outcomes'
import { makeDefaultEffect, makeDefaultRequirement } from '@/engine/admin/outcomeFormMeta'
import {
  loadOverlay,
  saveOverlay,
  upsertEntity,
  markDeleted,
  removeUpsert,
} from '@/engine/admin/ContentOverlayStore'
import { refreshContentRegistry } from '@/engine/admin/ContentRegistry'
import RepeatableList from './RepeatableList.vue'
import OutcomeEffectEditor from './OutcomeEffectEditor.vue'
import OutcomeRequirementEditor from './OutcomeRequirementEditor.vue'
import RefPicker from './RefPicker.vue'
import type { AdminRefOptions } from '@/engine/admin/contentIndexes'

const props = defineProps<{
  eventId: string | null
  baseIds: Set<string>
  overlayIds: Set<string>
  allEvents: EventCard[]
  refOptions?: Partial<AdminRefOptions>
}>()

const emit = defineEmits<{
  (e: 'saved'): void
  (e: 'deleted'): void
}>()

const form = ref<EventCard | null>(null)
const saving = ref(false)
const statusMsg = ref('')
const statusType = ref<'ok' | 'error'>('ok')

const isNew = computed(() => !!form.value && !props.baseIds.has(form.value.id) && !props.overlayIds.has(form.value.id))
const isOverlayOnly = computed(() => !!form.value && !props.baseIds.has(form.value.id) && props.overlayIds.has(form.value.id))
const isModified = computed(() => !!form.value && props.baseIds.has(form.value.id) && props.overlayIds.has(form.value.id))

watch(
  () => props.eventId,
  (id) => {
    statusMsg.value = ''
    if (!id) { form.value = null; return }
    const ev = props.allEvents.find((e) => e.id === id)
    form.value = ev ? (JSON.parse(JSON.stringify(ev)) as EventCard) : null
  },
  { immediate: true }
)

function makeChoice(): EventChoice {
  return { text: '', resultText: '', outcomes: [] }
}

function makeEffect(): OutcomeEffect {
  return makeDefaultEffect('give_gold')
}

function makeRequirement(): OutcomeRequirement {
  return makeDefaultRequirement('has_flag')
}

function save() {
  if (!form.value) return
  saving.value = true
  statusMsg.value = ''
  try {
    const overlay = loadOverlay()
    const next = upsertEntity(overlay, 'events', form.value)
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

function deleteEvent() {
  if (!form.value) return
  const id = form.value.id
  if (!window.confirm(`Delete event "${id}"? This cannot be undone.`)) return
  const overlay = loadOverlay()
  let next = overlay
  if (isOverlayOnly.value) {
    next = removeUpsert(overlay, 'events', id)
  } else {
    next = markDeleted(overlay, 'events', id)
  }
  saveOverlay(next)
  refreshContentRegistry()
  form.value = null
  emit('deleted')
}

function loadEvent(ev: EventCard) {
  form.value = JSON.parse(JSON.stringify(ev)) as EventCard
  statusMsg.value = ''
}

function createNew() {
  const id = `event_${Date.now()}`
  form.value = {
    id,
    title: '',
    text: '',
    zone: '',
    weight: 1,
    choices: [],
  }
  statusMsg.value = ''
}

defineExpose({ loadEvent, createNew })
</script>

<style scoped>
.event-form {
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

.form-header-info { display: flex; align-items: center; gap: 8px; min-width: 0; }
.form-id { font-family: var(--font-mono,monospace); font-size: 12px; color: var(--color-accent); overflow: hidden; text-overflow: ellipsis; }
.form-header-actions { display: flex; gap: 8px; flex-shrink: 0; }

.badge { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; padding: 2px 7px; border-radius: var(--radius-sm); }
.badge-base { background: rgba(95,143,80,.15); color: var(--color-accent); border: 1px solid rgba(95,143,80,.3); }
.badge-overlay { background: rgba(70,130,200,.15); color: #6ab0f5; border: 1px solid rgba(70,130,200,.3); }
.badge-modified { background: rgba(212,168,75,.15); color: var(--color-warning,#d4a84b); border: 1px solid rgba(212,168,75,.3); }
.badge-new { background: rgba(140,100,200,.15); color: #c3a0f0; border: 1px solid rgba(140,100,200,.3); }

.form-status { padding: 6px 14px; font-size: 12px; flex-shrink: 0; }
.form-status.ok { color: var(--color-accent); background: rgba(95,143,80,.1); }
.form-status.error { color: var(--color-danger,#c0392b); background: rgba(192,57,43,.1); }

.form-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-section { display: flex; flex-direction: column; gap: 8px; }

.section-title {
  margin: 0 0 4px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .06em;
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
  letter-spacing: .04em;
}

.field-input,
.field-textarea,
.field-select {
  padding: 5px 8px;
  font-family: var(--font-body);
  font-size: 13px;
  color: var(--color-text);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  resize: vertical;
}
.field-input:focus, .field-textarea:focus, .field-select:focus { outline: none; border-color: var(--color-accent); }
.field-input:disabled { opacity: .6; cursor: not-allowed; }

.form-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

.form-flags { display: flex; gap: 16px; }
.flag-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  color: var(--color-text-soft);
  cursor: pointer;
}

.choice-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 10px;
  background: var(--color-bg);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.choice-header { display: flex; align-items: center; gap: 8px; }
.choice-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--color-text-soft);
}

.sub-section { display: flex; flex-direction: column; gap: 6px; margin-top: 4px; }
.sub-section-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--color-text-soft);
  opacity: .7;
}
</style>
