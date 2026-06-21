<template>
  <div v-if="form" class="encounter-template-form">
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
        <button type="button" class="btn btn-danger" @click="deleteTemplate">Delete</button>
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
      </section>

      <section class="form-section">
        <div class="enemies-header">
          <h3 class="section-title">Enemies</h3>
          <button type="button" class="btn btn-secondary btn-xs" @click="addEnemy">+ Enemy</button>
        </div>
        <div v-for="(enemy, eni) in form.enemies" :key="eni" class="enemy-row">
          <div class="form-grid-3">
            <label class="field-label">
              ID
              <input v-model="enemy.id" type="text" class="field-input" placeholder="goblin_1" />
            </label>
            <label class="field-label">
              Name
              <input v-model="enemy.name" type="text" class="field-input" placeholder="Goblin" />
            </label>
            <label class="field-label">
              Level
              <input v-model.number="enemy.level" type="number" class="field-input" min="1" />
            </label>
            <label class="field-label">
              HP
              <input v-model.number="enemy.hp" type="number" class="field-input" min="1" />
            </label>
            <label class="field-label">
              Max HP
              <input v-model.number="enemy.maxHp" type="number" class="field-input" min="1" />
            </label>
            <label class="field-label">
              Archetype
              <select v-model="enemy.archetype" class="field-select">
                <option value="">—</option>
                <option value="attacker">attacker</option>
                <option value="defender">defender</option>
                <option value="caster">caster</option>
              </select>
            </label>
            <label class="field-label">
              XP Reward
              <input v-model.number="enemy.xpReward" type="number" class="field-input" min="0" />
            </label>
            <label class="field-label">
              Gold Reward
              <input v-model.number="enemy.goldReward" type="number" class="field-input" min="0" />
            </label>
            <label class="field-label enemy-boss">
              <input v-model="enemy.isBoss" type="checkbox" />
              Boss
            </label>
          </div>
          <button
            type="button"
            class="btn-icon btn-danger-icon enemy-remove"
            @click="removeEnemy(eni)"
          >✕</button>
        </div>
      </section>
    </div>
  </div>

  <div v-else class="form-empty">
    <p class="empty-msg">Select an encounter template to edit or create a new one.</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Enemy } from '@/engine/GameLoopDesign'
import {
  loadOverlay,
  saveOverlay,
  markDeleted,
  removeUpsert,
} from '@/engine/admin/ContentOverlayStore'
import { refreshContentRegistry } from '@/engine/admin/ContentRegistry'

export interface EncounterTemplateEntry {
  id: string
  enemies: Enemy[]
}

const props = defineProps<{
  templateId: string | null
  baseIds: Set<string>
  overlayIds: Set<string>
  allTemplates: EncounterTemplateEntry[]
}>()

const emit = defineEmits<{
  (e: 'saved'): void
  (e: 'deleted'): void
}>()

const form = ref<EncounterTemplateEntry | null>(null)
const saving = ref(false)
const statusMsg = ref('')
const statusType = ref<'ok' | 'error'>('ok')

const isNew = computed(
  () => !!form.value && !props.baseIds.has(form.value.id) && !props.overlayIds.has(form.value.id)
)
const isOverlayOnly = computed(
  () => !!form.value && !props.baseIds.has(form.value.id) && props.overlayIds.has(form.value.id)
)
const isModified = computed(
  () => !!form.value && props.baseIds.has(form.value.id) && props.overlayIds.has(form.value.id)
)

watch(
  () => props.templateId,
  (id) => {
    statusMsg.value = ''
    if (!id) {
      form.value = null
      return
    }
    const template = props.allTemplates.find((t) => t.id === id)
    form.value = template
      ? { id: template.id, enemies: JSON.parse(JSON.stringify(template.enemies)) as Enemy[] }
      : null
  },
  { immediate: true }
)

function makeEnemy(): Enemy {
  return {
    id: `enemy_${Date.now()}`,
    name: '',
    hp: 10,
    maxHp: 10,
    level: 1,
    stats: { strength: 5, constitution: 5, dexterity: 5, agility: 5, defense: 2 },
  }
}

function addEnemy() {
  if (!form.value) return
  form.value.enemies = [...form.value.enemies, makeEnemy()]
}

function removeEnemy(index: number) {
  if (!form.value) return
  form.value.enemies = form.value.enemies.filter((_, i) => i !== index)
}

function upsertEncounterTemplate(id: string, enemies: Enemy[]) {
  const overlay = loadOverlay()
  const next = {
    ...overlay,
    upserts: {
      ...overlay.upserts,
      encounterTemplates: {
        ...overlay.upserts.encounterTemplates,
        [id]: enemies,
      },
    },
    deletedIds: {
      ...overlay.deletedIds,
      encounterTemplates: overlay.deletedIds.encounterTemplates.filter((entryId) => entryId !== id),
    },
  }
  saveOverlay(next)
}

function save() {
  if (!form.value) return
  saving.value = true
  statusMsg.value = ''
  try {
    upsertEncounterTemplate(form.value.id, form.value.enemies)
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

function deleteTemplate() {
  if (!form.value) return
  const id = form.value.id
  if (!window.confirm(`Delete encounter template "${id}"? This cannot be undone.`)) return
  const overlay = loadOverlay()
  let next = overlay
  if (isOverlayOnly.value) {
    next = removeUpsert(overlay, 'encounterTemplates', id)
  } else {
    next = markDeleted(overlay, 'encounterTemplates', id)
  }
  saveOverlay(next)
  refreshContentRegistry()
  form.value = null
  emit('deleted')
}

function createNew() {
  const id = `encounter_${Date.now()}`
  form.value = {
    id,
    enemies: [makeEnemy()],
  }
  statusMsg.value = ''
}

defineExpose({ createNew })
</script>

<style scoped>
.encounter-template-form {
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

.enemies-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.enemies-header .section-title {
  margin: 0;
  border: none;
  padding: 0;
}

.form-grid-3 {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
  flex: 1;
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

.enemy-boss {
  flex-direction: row;
  align-items: center;
  gap: 6px;
  justify-content: flex-start;
  padding-top: 18px;
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

.field-input:focus,
.field-select:focus {
  outline: none;
  border-color: var(--color-accent);
}

.field-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.enemy-row {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 8px;
  background: var(--color-bg-elevated);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
}

.enemy-remove {
  margin-top: 18px;
  flex-shrink: 0;
}

.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 6px;
  font-size: 13px;
  border-radius: var(--radius-sm);
}

.btn-danger-icon {
  color: var(--color-danger, #c0392b);
}

.btn-danger-icon:hover {
  background: rgba(192, 57, 43, 0.15);
}

.btn-xs {
  padding: 3px 8px;
  font-size: 11px;
}
</style>
