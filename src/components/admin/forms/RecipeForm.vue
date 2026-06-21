<template>
  <div v-if="form" class="recipe-form">
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
        <button type="button" class="btn btn-danger" @click="deleteRecipe">Delete</button>
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
        <div class="form-grid-3">
          <label class="field-label">
            Station
            <select v-model="form.station" class="field-select">
              <option value="workbench">workbench</option>
              <option value="forge">forge</option>
              <option value="alchemy">alchemy</option>
            </select>
          </label>
          <label class="field-label">
            Profession
            <select v-model="form.profession" class="field-select">
              <option v-for="p in PROFESSION_IDS" :key="p" :value="p">{{ p }}</option>
            </select>
          </label>
          <label class="field-label">
            Tier
            <input v-model.number="form.tier" type="number" class="field-input" min="1" max="5" />
          </label>
        </div>
        <label class="field-label">
          NPC ID <span class="optional">(opt)</span>
          <input v-model="form.npcId" type="text" class="field-input" placeholder="npc_smith" />
        </label>
        <label class="field-label">
          Purchase Gold <span class="optional">(opt)</span>
          <input v-model.number="form.purchaseGold" type="number" class="field-input" min="0" />
        </label>
      </section>

      <section class="form-section">
        <h3 class="section-title">Output</h3>
        <div class="form-grid-2">
          <label class="field-label">
            Item ID
            <input v-model="form.output.itemId" type="text" class="field-input" placeholder="item_iron_sword" />
          </label>
          <label class="field-label">
            Quantity
            <input v-model.number="form.output.qty" type="number" class="field-input" min="1" />
          </label>
        </div>
      </section>

      <section class="form-section">
        <h3 class="section-title">Requirements</h3>
        <label class="field-label">
          Gold Cost
          <input v-model.number="form.requires.gold" type="number" class="field-input" min="0" />
        </label>
        <div class="field-label">
          Materials
          <div class="map-editor">
            <div v-for="(entry, i) in materialEntries" :key="i" class="map-row">
              <input
                type="text"
                class="field-input map-key"
                placeholder="material_id"
                :value="entry.key"
                @input="updateMaterialKey(i, ($event.target as HTMLInputElement).value)"
              />
              <input
                type="number"
                class="field-input map-val"
                placeholder="qty"
                min="1"
                :value="entry.val"
                @input="updateMaterialVal(i, Number(($event.target as HTMLInputElement).value))"
              />
              <button type="button" class="btn-icon btn-danger-icon" @click="removeMaterial(i)">✕</button>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" @click="addMaterial">+ Add Material</button>
          </div>
        </div>
      </section>

      <section class="form-section">
        <h3 class="section-title">Unlock Condition <span class="optional">(opt)</span></h3>
        <div class="form-grid-3">
          <label class="field-label">
            Flag
            <input
              type="text"
              class="field-input"
              :value="form.unlockedBy?.flag ?? ''"
              @input="setUnlockedBy('flag', ($event.target as HTMLInputElement).value)"
            />
          </label>
          <label class="field-label">
            Building
            <input
              type="text"
              class="field-input"
              :value="form.unlockedBy?.building ?? ''"
              @input="setUnlockedBy('building', ($event.target as HTMLInputElement).value)"
            />
          </label>
          <label class="field-label">
            Building Level
            <input
              type="number"
              class="field-input"
              min="0"
              :value="form.unlockedBy?.buildingLevel ?? ''"
              @input="setUnlockedBy('buildingLevel', Number(($event.target as HTMLInputElement).value))"
            />
          </label>
        </div>
      </section>
    </div>
  </div>

  <div v-else class="form-empty">
    <p class="empty-msg">Select a recipe to edit or create a new one.</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { RecipeDef } from '@/engine/ContentSchemas'
import { PROFESSION_IDS } from '@/engine/Professions'
import {
  loadOverlay,
  saveOverlay,
  upsertEntity,
  markDeleted,
  removeUpsert,
} from '@/engine/admin/ContentOverlayStore'
import { refreshContentRegistry } from '@/engine/admin/ContentRegistry'

const props = defineProps<{
  recipeId: string | null
  baseIds: Set<string>
  overlayIds: Set<string>
  allRecipes: RecipeDef[]
}>()

const emit = defineEmits<{
  (e: 'saved'): void
  (e: 'deleted'): void
}>()

const form = ref<RecipeDef | null>(null)
const saving = ref(false)
const statusMsg = ref('')
const statusType = ref<'ok' | 'error'>('ok')

const isNew = computed(() => !!form.value && !props.baseIds.has(form.value.id) && !props.overlayIds.has(form.value.id))
const isOverlayOnly = computed(() => !!form.value && !props.baseIds.has(form.value.id) && props.overlayIds.has(form.value.id))
const isModified = computed(() => !!form.value && props.baseIds.has(form.value.id) && props.overlayIds.has(form.value.id))

const materialEntries = computed(() => {
  const mats = form.value?.requires.materials ?? {}
  return Object.entries(mats).map(([key, val]) => ({ key, val }))
})

watch(
  () => props.recipeId,
  (id) => {
    statusMsg.value = ''
    if (!id) { form.value = null; return }
    const r = props.allRecipes.find((r) => r.id === id)
    form.value = r ? (JSON.parse(JSON.stringify(r)) as RecipeDef) : null
  },
  { immediate: true }
)

function addMaterial() {
  if (!form.value) return
  form.value.requires.materials[''] = 1
}

function removeMaterial(i: number) {
  if (!form.value) return
  const entries = Object.entries(form.value.requires.materials)
  entries.splice(i, 1)
  form.value.requires.materials = Object.fromEntries(entries)
}

function updateMaterialKey(i: number, newKey: string) {
  if (!form.value) return
  const entries = Object.entries(form.value.requires.materials)
  const entry = entries[i]
  if (!entry) return
  const val = entry[1]
  entries.splice(i, 1, [newKey, val])
  form.value.requires.materials = Object.fromEntries(entries)
}

function updateMaterialVal(i: number, val: number) {
  if (!form.value) return
  const entries = Object.entries(form.value.requires.materials)
  const entry = entries[i]
  if (!entry) return
  entry[1] = val
  form.value.requires.materials = Object.fromEntries(entries)
}

function setUnlockedBy(key: 'flag' | 'building' | 'buildingLevel', value: string | number) {
  if (!form.value) return
  if (!form.value.unlockedBy) form.value.unlockedBy = {}
  if (value === '' || value === 0) {
    delete (form.value.unlockedBy as Record<string, unknown>)[key]
  } else {
    (form.value.unlockedBy as Record<string, unknown>)[key] = value
  }
}

function save() {
  if (!form.value) return
  saving.value = true
  statusMsg.value = ''
  try {
    const overlay = loadOverlay()
    const next = upsertEntity(overlay, 'recipes', form.value)
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

function deleteRecipe() {
  if (!form.value) return
  const id = form.value.id
  if (!window.confirm(`Delete recipe "${id}"? This cannot be undone.`)) return
  const overlay = loadOverlay()
  let next = overlay
  if (isOverlayOnly.value) {
    next = removeUpsert(overlay, 'recipes', id)
  } else {
    next = markDeleted(overlay, 'recipes', id)
  }
  saveOverlay(next)
  refreshContentRegistry()
  form.value = null
  emit('deleted')
}

function loadRecipe(r: RecipeDef) {
  form.value = JSON.parse(JSON.stringify(r)) as RecipeDef
  statusMsg.value = ''
}

function createNew() {
  const id = `recipe_${Date.now()}`
  form.value = {
    id,
    name: '',
    station: 'workbench',
    profession: 'smithing',
    tier: 1,
    requires: { materials: {}, gold: 0 },
    output: { itemId: '', qty: 1 },
  }
  statusMsg.value = ''
}

defineExpose({ loadRecipe, createNew })
</script>

<style scoped>
.recipe-form {
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
.field-select {
  padding: 5px 8px;
  font-family: var(--font-body);
  font-size: 13px;
  color: var(--color-text);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}
.field-input:focus, .field-select:focus { outline: none; border-color: var(--color-accent); }
.field-input:disabled { opacity: .6; cursor: not-allowed; }

.form-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.form-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }

.optional {
  font-weight: 400;
  text-transform: none;
  opacity: .7;
  letter-spacing: 0;
}

.map-editor {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 2px;
}

.map-row {
  display: flex;
  gap: 6px;
  align-items: center;
}

.map-key { flex: 2; }
.map-val { flex: 1; }

.btn-sm { padding: 4px 10px; font-size: 12px; align-self: flex-start; }

.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 6px;
  font-size: 13px;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}
.btn-danger-icon { color: var(--color-danger,#c0392b); }
.btn-danger-icon:hover { background: rgba(192,57,43,.15); }
</style>
