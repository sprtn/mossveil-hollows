<template>
  <div class="map-editor">
    <div v-for="(entry, i) in entries" :key="i" class="map-row">
      <RefPicker
        class="map-key"
        :model-value="entry.key"
        :options="materialOptions"
        placeholder="Select material…"
        allow-custom
        @update:model-value="updateKey(i, $event)"
      />
      <input
        type="number"
        class="field-input map-val"
        placeholder="qty"
        min="1"
        :value="entry.val"
        @input="updateVal(i, Number(($event.target as HTMLInputElement).value))"
      />
      <button type="button" class="btn-icon btn-danger-icon" @click="remove(i)">✕</button>
    </div>
    <button type="button" class="btn btn-secondary btn-sm" @click="add">+ Add Material</button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import RefPicker from './RefPicker.vue'

const props = defineProps<{
  materials: Record<string, number>
  materialOptions: { id: string; label: string }[]
}>()

const emit = defineEmits<{
  update: [materials: Record<string, number>]
}>()

const entries = computed(() => Object.entries(props.materials).map(([key, val]) => ({ key, val })))

function add() {
  emit('update', { ...props.materials, '': 1 })
}

function remove(i: number) {
  const nextEntries = [...entries.value]
  nextEntries.splice(i, 1)
  emit('update', Object.fromEntries(nextEntries.map((e) => [e.key, e.val])))
}

function updateKey(i: number, newKey: string) {
  const nextEntries = entries.value.map((e, idx) =>
    idx === i ? { key: newKey, val: e.val } : e,
  )
  emit('update', Object.fromEntries(nextEntries.map((e) => [e.key, e.val])))
}

function updateVal(i: number, val: number) {
  const entry = entries.value[i]
  if (!entry) return
  emit('update', { ...props.materials, [entry.key]: val })
}
</script>

<style scoped>
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

.map-key {
  flex: 2;
  min-width: 0;
}

.map-val {
  flex: 1;
  padding: 5px 8px;
  font-family: var(--font-body);
  font-size: 13px;
  color: var(--color-text);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.btn-sm {
  padding: 4px 10px;
  font-size: 12px;
  align-self: flex-start;
}

.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 6px;
  font-size: 13px;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.btn-danger-icon {
  color: var(--color-danger, #c0392b);
}

.btn-danger-icon:hover {
  background: rgba(192, 57, 43, 0.15);
}
</style>
