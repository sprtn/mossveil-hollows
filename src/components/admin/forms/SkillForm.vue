<template>
  <div v-if="form" class="skill-form">
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
        <button type="button" class="btn btn-danger" @click="deleteSkill">Delete</button>
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
        <div class="form-grid-2">
          <label class="field-label">
            Branch
            <select v-model="form.branch" class="field-select">
              <option value="might">might</option>
              <option value="survival">survival</option>
              <option value="hunter">hunter</option>
            </select>
          </label>
          <label class="field-label">
            Energy Cost
            <input v-model.number="form.energyCost" type="number" class="field-input" min="0" />
          </label>
        </div>
        <label class="field-label">
          Required Skills
          <RepeatableList
            :model-value="form.requires"
            add-label="+ Add required skill"
            :make-item="() => ''"
            @update:model-value="form.requires = $event as string[]"
          >
            <template #default="{ item, update }">
              <RefPicker
                :model-value="item as string"
                :options="refOptions?.skills ?? []"
                placeholder="Select skill…"
                @update:model-value="update($event)"
              />
            </template>
          </RepeatableList>
        </label>
      </section>

      <section class="form-section">
        <h3 class="section-title">
          Training
          <label class="toggle-label">
            <input type="checkbox" :checked="!!form.training" @change="toggleTraining" />
            Enabled
          </label>
        </h3>
        <template v-if="form.training">
          <div class="form-grid-3">
            <label class="field-label">
              Governing Stat
              <select
                class="field-select"
                :value="form.training.governingStat"
                @change="setTraining('governingStat', ($event.target as HTMLSelectElement).value)"
              >
                <option v-for="s in STAT_KEYS" :key="s" :value="s">{{ s }}</option>
              </select>
            </label>
            <label class="field-label">
              Min Stat
              <input
                type="number"
                class="field-input"
                :value="form.training.minStat"
                @input="setTraining('minStat', Number(($event.target as HTMLInputElement).value))"
              />
            </label>
            <label class="field-label">
              Max Stat
              <input
                type="number"
                class="field-input"
                :value="form.training.maxStat"
                @input="setTraining('maxStat', Number(($event.target as HTMLInputElement).value))"
              />
            </label>
          </div>
          <label class="field-label">
            Gold Cost
            <input
              type="number"
              class="field-input"
              min="0"
              :value="form.training.goldCost"
              @input="setTraining('goldCost', Number(($event.target as HTMLInputElement).value))"
            />
          </label>
          <label class="flag-label">
            <input
              type="checkbox"
              :checked="!!form.training.provisional"
              @change="setTraining('provisional', ($event.target as HTMLInputElement).checked)"
            />
            Provisional (placeholder data)
          </label>
        </template>
      </section>

      <section class="form-section">
        <h3 class="section-title">
          Combat
          <label class="toggle-label">
            <input type="checkbox" :checked="!!form.combat" @change="toggleCombat" />
            Enabled
          </label>
        </h3>
        <template v-if="form.combat">
          <div class="form-grid-2">
            <label class="field-label">
              Target Mode
              <select
                class="field-select"
                :value="form.combat.targetMode"
                @change="setCombat('targetMode', ($event.target as HTMLSelectElement).value)"
              >
                <option value="self">self</option>
                <option value="single_enemy">single_enemy</option>
                <option value="all_enemies">all_enemies</option>
                <option value="all_enemies_single_roll">all_enemies_single_roll</option>
              </select>
            </label>
            <label class="flag-label" style="align-self: flex-end;">
              <input
                type="checkbox"
                :checked="form.combat.activatable"
                @change="setCombat('activatable', ($event.target as HTMLInputElement).checked)"
              />
              Activatable
            </label>
          </div>
          <label class="flag-label">
            <input
              type="checkbox"
              :checked="!!form.combat.requireLivingTarget"
              @change="setCombat('requireLivingTarget', ($event.target as HTMLInputElement).checked)"
            />
            Require Living Target
          </label>

          <div class="field-label">
            Combat Log
            <div class="combat-log-grid" v-if="form.combat.log">
              <label class="field-label">
                Event Type
                <input
                  type="text"
                  class="field-input"
                  :value="form.combat.log.eventType"
                  @input="setCombatLog('eventType', ($event.target as HTMLInputElement).value)"
                />
              </label>
              <label class="field-label">
                Message
                <input
                  type="text"
                  class="field-input"
                  :value="form.combat.log.message"
                  @input="setCombatLog('message', ($event.target as HTMLInputElement).value)"
                />
              </label>
              <label class="field-label">
                Crit Message <span class="optional">(opt)</span>
                <input
                  type="text"
                  class="field-input"
                  :value="form.combat.log.messageCrit ?? ''"
                  @input="setCombatLog('messageCrit', ($event.target as HTMLInputElement).value || undefined)"
                />
              </label>
              <label class="field-label">
                Miss Message <span class="optional">(opt)</span>
                <input
                  type="text"
                  class="field-input"
                  :value="form.combat.log.messageMiss ?? ''"
                  @input="setCombatLog('messageMiss', ($event.target as HTMLInputElement).value || undefined)"
                />
              </label>
              <label class="flag-label">
                <input
                  type="checkbox"
                  :checked="!!form.combat.log.aggregate"
                  @change="setCombatLog('aggregate', ($event.target as HTMLInputElement).checked || undefined)"
                />
                Aggregate
              </label>
            </div>
          </div>

          <div class="field-label">
            Effects
            <RepeatableList
              :model-value="form.combat.effects"
              add-label="+ Add Effect"
              :make-item="makeSkillEffect"
              @update:model-value="setCombat('effects', $event)"
            >
              <template #default="{ item, update }">
                <SkillEffectEditor
                  :model-value="item as SkillEffect"
                  @update:model-value="update($event)"
                />
              </template>
            </RepeatableList>
          </div>
        </template>
      </section>

      <section class="form-section">
        <h3 class="section-title">
          Out-of-Combat Hook <span class="optional">(opt)</span>
        </h3>
        <div class="form-grid-2">
          <label class="field-label">
            Hook
            <select
              class="field-select"
              :value="form.outOfCombat?.hook ?? ''"
              @change="setOutOfCombat('hook', ($event.target as HTMLSelectElement).value)"
            >
              <option value="">— none —</option>
              <option value="make_camp">make_camp</option>
              <option value="forager">forager</option>
              <option value="treasure_sense">treasure_sense</option>
            </select>
          </label>
          <label class="flag-label" style="align-self: flex-end;">
            <input
              type="checkbox"
              :checked="!!form.outOfCombat?.implemented"
              @change="setOutOfCombat('implemented', ($event.target as HTMLInputElement).checked)"
            />
            Implemented
          </label>
        </div>
      </section>
    </div>
  </div>

  <div v-else class="form-empty">
    <p class="empty-msg">Select a skill to edit or create a new one.</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { SkillDef, SkillEffect, SkillCombatDef, SkillTrainingDef } from '@/engine/ContentSchemas'
import type { PlayerStatKey } from '@/engine/GameLoopDesign'
import {
  loadOverlay,
  saveOverlay,
  upsertEntity,
  markDeleted,
  removeUpsert,
} from '@/engine/admin/ContentOverlayStore'
import { refreshContentRegistry } from '@/engine/admin/ContentRegistry'
import RepeatableList from './RepeatableList.vue'
import RefPicker from './RefPicker.vue'
import type { AdminRefOptions } from '@/engine/admin/contentIndexes'

const STAT_KEYS: PlayerStatKey[] = ['strength', 'constitution', 'dexterity', 'agility', 'defense']

/** Minimal inline skill effect editor — renders JSON for complex effects. */
const SkillEffectEditor = {
  props: { modelValue: { type: Object as () => SkillEffect, required: true } },
  emits: ['update:modelValue'],
  setup(_props: { modelValue: SkillEffect }, { emit }: { emit: (e: string, v: unknown) => void }) {
    const EFFECT_KINDS = ['damage', 'heal', 'apply_status', 'remove_status', 'set_encounter_flag', 'add_combat_buff', 'revive']

    function onKindChange(kind: string) {
      emit('update:modelValue', makeSkillEffectForKind(kind))
    }
    function onJsonChange(raw: string) {
      try {
        emit('update:modelValue', JSON.parse(raw))
      } catch {
        // ignore invalid JSON while typing
      }
    }
    return { EFFECT_KINDS, onKindChange, onJsonChange }
  },
  template: `
    <div class="skill-effect-editor">
      <label class="field-label">
        Kind
        <select class="field-select" :value="modelValue.kind" @change="onKindChange($event.target.value)">
          <option v-for="k in EFFECT_KINDS" :key="k" :value="k">{{ k }}</option>
        </select>
      </label>
      <label class="field-label">
        Effect JSON
        <textarea
          class="field-textarea"
          rows="3"
          :value="JSON.stringify(modelValue, null, 2)"
          @input="onJsonChange($event.target.value)"
        />
      </label>
    </div>
  `,
}

function makeSkillEffectForKind(kind: string): SkillEffect {
  switch (kind) {
    case 'damage': return { kind: 'damage', scaling: { mode: 'stat', stat: 'strength' } }
    case 'heal': return { kind: 'heal', flat: 0, target: 'self' }
    case 'apply_status': return { kind: 'apply_status', status: 'poison', turns: 2, power: { kind: 'fixed', value: 1 } }
    case 'remove_status': return { kind: 'remove_status', target: 'self' }
    case 'set_encounter_flag': return { kind: 'set_encounter_flag', flag: 'playerBracing', value: true }
    case 'add_combat_buff': return { kind: 'add_combat_buff', target: 'self', label: '' }
    case 'revive': return { kind: 'revive', hpPct: 0.25 }
    default: return { kind: 'damage', scaling: { mode: 'stat', stat: 'strength' } }
  }
}

function makeSkillEffect(): SkillEffect {
  return { kind: 'damage', scaling: { mode: 'stat', stat: 'strength' } }
}

const props = defineProps<{
  skillId: string | null
  baseIds: Set<string>
  overlayIds: Set<string>
  allSkills: SkillDef[]
  refOptions?: Partial<AdminRefOptions>
}>()

const emit = defineEmits<{
  (e: 'saved'): void
  (e: 'deleted'): void
}>()

const form = ref<SkillDef | null>(null)
const saving = ref(false)
const statusMsg = ref('')
const statusType = ref<'ok' | 'error'>('ok')

const isNew = computed(() => !!form.value && !props.baseIds.has(form.value.id) && !props.overlayIds.has(form.value.id))
const isOverlayOnly = computed(() => !!form.value && !props.baseIds.has(form.value.id) && props.overlayIds.has(form.value.id))
const isModified = computed(() => !!form.value && props.baseIds.has(form.value.id) && props.overlayIds.has(form.value.id))

watch(
  () => props.skillId,
  (id) => {
    statusMsg.value = ''
    if (!id) { form.value = null; return }
    const s = props.allSkills.find((s) => s.id === id)
    form.value = s ? (JSON.parse(JSON.stringify(s)) as SkillDef) : null
  },
  { immediate: true }
)

function toggleTraining(e: Event) {
  if (!form.value) return
  const checked = (e.target as HTMLInputElement).checked
  if (checked) {
    form.value.training = {
      governingStat: 'strength',
      minStat: 1,
      maxStat: 10,
      goldCost: 50,
    }
  } else {
    delete form.value.training
  }
}

function toggleCombat(e: Event) {
  if (!form.value) return
  const checked = (e.target as HTMLInputElement).checked
  if (checked) {
    form.value.combat = {
      activatable: true,
      targetMode: 'single_enemy',
      effects: [],
      log: { eventType: 'skill', message: '' },
    }
  } else {
    delete form.value.combat
  }
}

function setTraining(key: keyof SkillTrainingDef, value: unknown) {
  if (!form.value?.training) return
  (form.value.training as Record<string, unknown>)[key] = value
}

function setCombat(key: keyof SkillCombatDef, value: unknown) {
  if (!form.value?.combat) return
  (form.value.combat as Record<string, unknown>)[key] = value
}

function setCombatLog(key: string, value: unknown) {
  if (!form.value?.combat) return
  form.value.combat.log = { ...form.value.combat.log, [key]: value }
}

function setOutOfCombat(key: 'hook' | 'implemented', value: unknown) {
  if (!form.value) return
  if (key === 'hook' && value === '') {
    delete form.value.outOfCombat
    return
  }
  if (!form.value.outOfCombat) {
    form.value.outOfCombat = { hook: 'make_camp', implemented: false }
  }
  (form.value.outOfCombat as Record<string, unknown>)[key] = value
}

function save() {
  if (!form.value) return
  saving.value = true
  statusMsg.value = ''
  try {
    const overlay = loadOverlay()
    const next = upsertEntity(overlay, 'skills', form.value)
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

function deleteSkill() {
  if (!form.value) return
  const id = form.value.id
  if (!window.confirm(`Delete skill "${id}"? This cannot be undone.`)) return
  const overlay = loadOverlay()
  let next = overlay
  if (isOverlayOnly.value) {
    next = removeUpsert(overlay, 'skills', id)
  } else {
    next = markDeleted(overlay, 'skills', id)
  }
  saveOverlay(next)
  refreshContentRegistry()
  form.value = null
  emit('deleted')
}

function loadSkill(s: SkillDef) {
  form.value = JSON.parse(JSON.stringify(s)) as SkillDef
  statusMsg.value = ''
}

function createNew() {
  const id = `skill_${Date.now()}`
  form.value = {
    id,
    name: '',
    branch: 'might',
    description: '',
    requires: [],
    energyCost: 0,
  }
  statusMsg.value = ''
}

defineExpose({ loadSkill, createNew })
</script>

<style scoped>
.skill-form {
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
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 4px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--color-text-soft);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 4px;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  color: var(--color-text-soft);
  cursor: pointer;
  margin-left: auto;
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
.form-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }

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

.optional { font-weight: 400; text-transform: none; opacity: .7; letter-spacing: 0; }

.combat-log-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 4px;
}

:deep(.skill-effect-editor) {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 8px;
  background: var(--color-bg);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
</style>
