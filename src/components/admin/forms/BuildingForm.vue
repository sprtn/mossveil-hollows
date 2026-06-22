<template>
  <div v-if="form" class="building-form">
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
        <button type="button" class="btn btn-danger" @click="deleteBuilding">Delete</button>
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
          Description <span class="optional">(opt)</span>
          <textarea v-model="form.description" class="field-textarea" rows="2" />
        </label>
      </section>

      <section class="form-section">
        <h3 class="section-title">Production <span class="optional">(opt)</span></h3>
        <div class="form-grid-2">
          <label class="field-label">
            Output Material
            <RefPicker
              :model-value="form.production?.outputMaterialId ?? ''"
              :options="refOptions?.materials ?? []"
              placeholder="Select material…"
              allow-empty
              allow-custom
              @update:model-value="setProd('outputMaterialId', $event)"
            />
          </label>
          <label class="field-label">
            Output per Day
            <input
              type="number"
              class="field-input"
              min="0"
              :value="form.production?.outputPerDay ?? ''"
              @input="setProd('outputPerDay', Number(($event.target as HTMLInputElement).value))"
            />
          </label>
          <label class="field-label">
            Labour Gold/Day
            <input
              type="number"
              class="field-input"
              min="0"
              :value="form.production?.labourGoldPerDay ?? ''"
              @input="setProd('labourGoldPerDay', Number(($event.target as HTMLInputElement).value))"
            />
          </label>
          <label class="field-label">
            Min Level
            <input
              type="number"
              class="field-input"
              min="0"
              :value="form.production?.minLevel ?? ''"
              @input="setProd('minLevel', Number(($event.target as HTMLInputElement).value))"
            />
          </label>
          <label class="field-label">
            Fair Wage Gold <span class="optional">(opt)</span>
            <input
              type="number"
              class="field-input"
              min="0"
              :value="form.production?.fairWageGold ?? ''"
              @input="setProd('fairWageGold', Number(($event.target as HTMLInputElement).value))"
            />
          </label>
          <label class="field-label">
            Max Labour Gold <span class="optional">(opt)</span>
            <input
              type="number"
              class="field-input"
              min="0"
              :value="form.production?.maxLabourGold ?? ''"
              @input="setProd('maxLabourGold', Number(($event.target as HTMLInputElement).value))"
            />
          </label>
        </div>
      </section>

      <section class="form-section">
        <h3 class="section-title">Levels</h3>
        <RepeatableList
          v-model="form.levels"
          add-label="+ Add Level"
          :make-item="makeLevel"
        >
          <template #default="{ item, index, update }">
            <div class="level-card">
              <div class="level-header">
                <span class="level-label">Level {{ index + 1 }}</span>
              </div>
              <div class="form-grid-2">
                <label class="field-label">
                  Gold Cost
                  <input
                    type="number"
                    class="field-input"
                    min="0"
                    :value="(item as BuildingLevelDef).cost.gold"
                    @input="updateLevel(item as BuildingLevelDef, update, 'gold', Number(($event.target as HTMLInputElement).value))"
                  />
                </label>
                <label class="field-label">
                  Unlocks Text <span class="optional">(opt)</span>
                  <input
                    type="text"
                    class="field-input"
                    :value="(item as BuildingLevelDef).unlocksText ?? ''"
                    @input="update({ ...(item as BuildingLevelDef), unlocksText: ($event.target as HTMLInputElement).value || undefined })"
                  />
                </label>
              </div>
              <div class="field-label">
                Materials Cost
                <MaterialMapEditor
                  :materials="(item as BuildingLevelDef).cost.materials"
                  :material-options="refOptions?.materials ?? []"
                  @update="update({ ...(item as BuildingLevelDef), cost: { ...(item as BuildingLevelDef).cost, materials: $event } })"
                />
              </div>
              <div class="field-label">
                Effects
                <RepeatableList
                  :model-value="(item as BuildingLevelDef).effects"
                  add-label="+ Add Effect"
                  :make-item="makeEffect"
                  @update:model-value="update({ ...(item as BuildingLevelDef), effects: $event as OutcomeEffect[] })"
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
    <p class="empty-msg">Select a building to edit or create a new one.</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { BuildingDef, BuildingLevelDef } from '@/engine/ContentSchemas'
import type { OutcomeEffect } from '@/engine/Outcomes'
import { makeDefaultEffect } from '@/engine/admin/outcomeFormMeta'
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
import MaterialMapEditor from './MaterialMapEditor.vue'
import RefPicker from './RefPicker.vue'
import type { AdminRefOptions } from '@/engine/admin/contentIndexes'

const props = defineProps<{
  buildingId: string | null
  baseIds: Set<string>
  overlayIds: Set<string>
  allBuildings: BuildingDef[]
  refOptions?: Partial<AdminRefOptions>
}>()

const emit = defineEmits<{
  (e: 'saved'): void
  (e: 'deleted'): void
}>()

const form = ref<BuildingDef | null>(null)
const saving = ref(false)
const statusMsg = ref('')
const statusType = ref<'ok' | 'error'>('ok')

const isNew = computed(() => !!form.value && !props.baseIds.has(form.value.id) && !props.overlayIds.has(form.value.id))
const isOverlayOnly = computed(() => !!form.value && !props.baseIds.has(form.value.id) && props.overlayIds.has(form.value.id))
const isModified = computed(() => !!form.value && props.baseIds.has(form.value.id) && props.overlayIds.has(form.value.id))

watch(
  () => props.buildingId,
  (id) => {
    statusMsg.value = ''
    if (!id) { form.value = null; return }
    const b = props.allBuildings.find((b) => b.id === id)
    form.value = b ? (JSON.parse(JSON.stringify(b)) as BuildingDef) : null
  },
  { immediate: true }
)

type ProdKey = keyof NonNullable<BuildingDef['production']>

function setProd(key: ProdKey, value: string | number) {
  if (!form.value) return
  if (!form.value.production) {
    form.value.production = {
      outputMaterialId: '',
      outputPerDay: 0,
      labourGoldPerDay: 0,
      minLevel: 1,
    }
  }
  if (value === '' || value === 0 && key !== 'outputMaterialId') {
    (form.value.production as Record<string, unknown>)[key] = value
  } else {
    (form.value.production as Record<string, unknown>)[key] = value
  }
}

function makeLevel(): BuildingLevelDef {
  return { cost: { gold: 0, materials: {} }, effects: [] }
}

function makeEffect(): OutcomeEffect {
  return makeDefaultEffect('give_gold')
}

function updateLevel(
  level: BuildingLevelDef,
  update: (v: unknown) => void,
  key: 'gold',
  value: number,
) {
  update({ ...level, cost: { ...level.cost, [key]: value } })
}

function save() {
  if (!form.value) return
  saving.value = true
  statusMsg.value = ''
  try {
    const overlay = loadOverlay()
    const next = upsertEntity(overlay, 'buildings', form.value)
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

function deleteBuilding() {
  if (!form.value) return
  const id = form.value.id
  if (!window.confirm(`Delete building "${id}"? This cannot be undone.`)) return
  const overlay = loadOverlay()
  let next = overlay
  if (isOverlayOnly.value) {
    next = removeUpsert(overlay, 'buildings', id)
  } else {
    next = markDeleted(overlay, 'buildings', id)
  }
  saveOverlay(next)
  refreshContentRegistry()
  form.value = null
  emit('deleted')
}

function loadBuilding(b: BuildingDef) {
  form.value = JSON.parse(JSON.stringify(b)) as BuildingDef
  statusMsg.value = ''
}

function createNew() {
  const id = `building_${Date.now()}`
  form.value = {
    id,
    name: '',
    levels: [],
  }
  statusMsg.value = ''
}

defineExpose({ loadBuilding, createNew })
</script>

<style scoped>
.building-form {
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

.optional { font-weight: 400; text-transform: none; opacity: .7; letter-spacing: 0; }

.level-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 10px;
  background: var(--color-bg);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.level-header { display: flex; align-items: center; gap: 8px; }
.level-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--color-text-soft);
}

/* passed to inline component via globals */
:deep(.map-editor) { display: flex; flex-direction: column; gap: 6px; margin-top: 2px; }
:deep(.map-row) { display: flex; gap: 6px; align-items: center; }
:deep(.map-key) { flex: 2; }
:deep(.map-val) { flex: 1; }
:deep(.btn-sm) { padding: 4px 10px; font-size: 12px; align-self: flex-start; }
:deep(.btn-icon) { background: none; border: none; cursor: pointer; padding: 2px 6px; font-size: 13px; border-radius: var(--radius-sm); flex-shrink: 0; }
:deep(.btn-danger-icon) { color: var(--color-danger,#c0392b); }
:deep(.btn-danger-icon:hover) { background: rgba(192,57,43,.15); }
</style>
