<template>
  <div class="gather-list">
    <div v-for="(node, i) in nodes" :key="i" class="gather-card">
      <div class="gather-card-header">
        <span class="gather-card-title">Node {{ i + 1 }}</span>
        <button type="button" class="btn-icon btn-danger-icon" title="Remove node" @click="remove(i)">✕</button>
      </div>
      <div class="form-grid-2">
        <label class="field-label">
          ID
          <input v-model="node.id" type="text" class="field-input" placeholder="oak_node_1" />
        </label>
        <label class="field-label">
          Profession
          <select v-model="node.profession" class="field-select">
            <option v-for="p in PROFESSIONS" :key="p" :value="p">{{ p }}</option>
          </select>
        </label>
        <label class="field-label">
          Resource
          <RefPicker
            v-model="node.resource"
            :options="materialOptions"
            placeholder="Select material…"
            allow-custom
          />
        </label>
        <label class="field-label">
          Base Yield
          <input v-model.number="node.baseYield" type="number" class="field-input" min="1" />
        </label>
        <label class="field-label">
          Max Charges
          <input v-model.number="node.maxCharges" type="number" class="field-input" min="1" />
        </label>
        <label class="field-label">
          Regen / Day
          <input v-model.number="node.regenPerDay" type="number" class="field-input" min="0" />
        </label>
        <label class="field-label">
          Min Level
          <input v-model.number="node.minLevel" type="number" class="field-input" min="1" placeholder="—" />
        </label>
      </div>
    </div>
    <button type="button" class="btn btn-secondary btn-sm" @click="addNode">+ Gather Node</button>
  </div>
</template>

<script setup lang="ts">
import type { GatherNode, GatheringProfessionId } from '@/engine/GatherNodes'
import RefPicker from './RefPicker.vue'

defineProps<{
  materialOptions: { id: string; label: string }[]
}>()

const nodes = defineModel<GatherNode[]>({ default: () => [] })

const PROFESSIONS: GatheringProfessionId[] = ['forestry', 'mining', 'herbalism', 'farming_fishing']

function addNode() {
  nodes.value = [
    ...nodes.value,
    {
      id: `node_${Date.now()}`,
      profession: 'forestry',
      resource: '',
      baseYield: 1,
      maxCharges: 3,
      regenPerDay: 1,
    },
  ]
}

function remove(i: number) {
  nodes.value = nodes.value.filter((_, idx) => idx !== i)
}
</script>

<style scoped>
.gather-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.gather-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 10px;
  background: var(--color-bg);
}

.gather-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.gather-card-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-soft);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.form-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.field-label {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-soft);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.field-input,
.field-select {
  padding: 5px 7px;
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
}

.btn-danger-icon {
  color: var(--color-danger, #c0392b);
}

.btn-danger-icon:hover {
  background: rgba(192, 57, 43, 0.15);
}
</style>
