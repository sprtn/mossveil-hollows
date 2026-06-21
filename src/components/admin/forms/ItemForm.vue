<template>
  <div v-if="form" class="item-form">
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
        <button type="button" class="btn btn-danger" @click="deleteItem">Delete</button>
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
            Type
            <select v-model="form.type" class="field-select">
              <option v-for="t in ITEM_TYPES" :key="t" :value="t">{{ t }}</option>
            </select>
          </label>
          <label class="field-label">
            Effect
            <select v-model="form.effect" class="field-select">
              <option value="">— none —</option>
              <option v-for="e in ITEM_EFFECTS" :key="e" :value="e">{{ e }}</option>
            </select>
          </label>
        </div>
        <div class="form-flags">
          <label class="flag-label">
            <input v-model="form.stackable" type="checkbox" />
            Stackable
          </label>
        </div>
        <label v-if="form.stackable" class="field-label">
          Max Stack Size
          <input v-model.number="form.maxStackSize" type="number" class="field-input" min="1" />
        </label>
      </section>

      <section class="form-section">
        <h3 class="section-title">Combat Stats</h3>
        <div class="form-grid-3">
          <label class="field-label">
            Power
            <input v-model.number="form.power" type="number" class="field-input" />
          </label>
          <label class="field-label">
            Damage Bonus
            <input v-model.number="form.damageBonus" type="number" class="field-input" />
          </label>
          <label class="field-label">
            Defense Bonus
            <input v-model.number="form.defenseBonus" type="number" class="field-input" />
          </label>
        </div>
        <label class="field-label">
          Slot
          <select v-model="form.slot" class="field-select">
            <option value="">— none —</option>
            <option value="weapon">weapon</option>
            <option value="armor">armor</option>
            <option value="body">body</option>
          </select>
        </label>
      </section>

      <section class="form-section">
        <h3 class="section-title">Stat Bonuses</h3>
        <div class="form-grid-3">
          <label v-for="stat in STAT_KEYS" :key="stat" class="field-label">
            {{ stat }}
            <input
              type="number"
              class="field-input"
              :value="form.statBonus?.[stat] ?? ''"
              @input="setStatBonus(stat, ($event.target as HTMLInputElement).value)"
            />
          </label>
        </div>
      </section>

      <section class="form-section">
        <h3 class="section-title">Economy</h3>
        <div class="form-grid-2">
          <label class="field-label">
            Buy Price
            <input v-model.number="form.buyPrice" type="number" class="field-input" min="0" />
          </label>
          <label class="field-label">
            Sell Price
            <input v-model.number="form.sellPrice" type="number" class="field-input" min="0" />
          </label>
        </div>
      </section>
    </div>
  </div>

  <div v-else class="form-empty">
    <p class="empty-msg">Select an item to edit or create a new one.</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ItemTemplate, ItemType, ItemEffect, PlayerStatKey } from '@/engine/GameLoopDesign'
import {
  loadOverlay,
  saveOverlay,
  upsertEntity,
  markDeleted,
  removeUpsert,
} from '@/engine/admin/ContentOverlayStore'
import { refreshContentRegistry } from '@/engine/admin/ContentRegistry'
import { refreshItemDatabase } from '@/engine/ItemDatabase'

const ITEM_TYPES: ItemType[] = ['weapon', 'armor', 'consumable', 'key', 'quest', 'crafting']
const ITEM_EFFECTS: ItemEffect[] = ['heal_health', 'restore_energy', 'remove_poison', 'boost_damage', 'boost_defense']
const STAT_KEYS: PlayerStatKey[] = ['strength', 'constitution', 'dexterity', 'agility', 'defense']

const props = defineProps<{
  itemId: string | null
  baseIds: Set<string>
  overlayIds: Set<string>
  allItems: ItemTemplate[]
}>()

const emit = defineEmits<{
  (e: 'saved'): void
  (e: 'deleted'): void
}>()

const form = ref<ItemTemplate | null>(null)
const saving = ref(false)
const statusMsg = ref('')
const statusType = ref<'ok' | 'error'>('ok')

const isNew = computed(() => !!form.value && !props.baseIds.has(form.value.id) && !props.overlayIds.has(form.value.id))
const isOverlayOnly = computed(() => !!form.value && !props.baseIds.has(form.value.id) && props.overlayIds.has(form.value.id))
const isModified = computed(() => !!form.value && props.baseIds.has(form.value.id) && props.overlayIds.has(form.value.id))

watch(
  () => props.itemId,
  (id) => {
    statusMsg.value = ''
    if (!id) { form.value = null; return }
    const item = props.allItems.find((i) => i.id === id)
    form.value = item ? (JSON.parse(JSON.stringify(item)) as ItemTemplate) : null
  },
  { immediate: true }
)

function setStatBonus(stat: PlayerStatKey, raw: string) {
  if (!form.value) return
  const n = parseFloat(raw)
  if (!form.value.statBonus) form.value.statBonus = {}
  if (raw === '' || isNaN(n)) {
    delete form.value.statBonus[stat]
  } else {
    form.value.statBonus[stat] = n
  }
}

function save() {
  if (!form.value) return
  saving.value = true
  statusMsg.value = ''
  try {
    const overlay = loadOverlay()
    const next = upsertEntity(overlay, 'items', form.value)
    saveOverlay(next)
    refreshContentRegistry()
    refreshItemDatabase()
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

function deleteItem() {
  if (!form.value) return
  const id = form.value.id
  if (!window.confirm(`Delete item "${id}"? This cannot be undone.`)) return
  const overlay = loadOverlay()
  let next = overlay
  if (isOverlayOnly.value) {
    next = removeUpsert(overlay, 'items', id)
  } else {
    next = markDeleted(overlay, 'items', id)
  }
  saveOverlay(next)
  refreshContentRegistry()
  refreshItemDatabase()
  form.value = null
  emit('deleted')
}

function loadItem(item: ItemTemplate) {
  form.value = JSON.parse(JSON.stringify(item)) as ItemTemplate
  statusMsg.value = ''
}

function createNew() {
  const id = `item_${Date.now()}`
  form.value = {
    id,
    name: '',
    description: '',
    type: 'consumable',
    stackable: false,
  }
  statusMsg.value = ''
}

defineExpose({ loadItem, createNew })
</script>

<style scoped>
.item-form {
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
.badge-base { background: rgba(95,143,80,.15); color: var(--color-accent); border: 1px solid rgba(95,143,80,.3); }
.badge-overlay { background: rgba(70,130,200,.15); color: #6ab0f5; border: 1px solid rgba(70,130,200,.3); }
.badge-modified { background: rgba(212,168,75,.15); color: var(--color-warning,#d4a84b); border: 1px solid rgba(212,168,75,.3); }
.badge-new { background: rgba(140,100,200,.15); color: #c3a0f0; border: 1px solid rgba(140,100,200,.3); }

.form-status {
  padding: 6px 14px;
  font-size: 12px;
  flex-shrink: 0;
}
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
.field-input:disabled { opacity: 0.6; cursor: not-allowed; }

.form-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.form-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }

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
</style>
