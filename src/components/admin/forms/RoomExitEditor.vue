<template>
  <div class="exit-list">
    <div v-for="(exit, i) in exits" :key="i" class="exit-card">
      <div class="exit-row">
        <select v-model="exit.direction" class="field-select exit-dir">
          <option v-for="d in DIRECTIONS" :key="d" :value="d">{{ d }}</option>
        </select>
        <div class="exit-target">
          <RefPicker
            :model-value="exit.targetRoomId"
            :options="refOptions?.rooms ?? []"
            placeholder="Target room…"
            @update:model-value="exit.targetRoomId = $event"
          />
        </div>
        <label class="exit-flag" title="Locked">
          <input v-model="exit.locked" type="checkbox" />
          <span>Locked</span>
        </label>
        <label class="exit-flag" title="Hidden">
          <input v-model="exit.hidden" type="checkbox" />
          <span>Hidden</span>
        </label>
        <button type="button" class="btn-icon btn-danger-icon" title="Remove exit" @click="remove(i)">
          ✕
        </button>
      </div>
      <div v-if="exit.locked" class="exit-lock-row">
        <label class="field-label">
          Key item
          <RefPicker
            :model-value="exit.requiresItem ?? ''"
            :options="refOptions?.items ?? []"
            placeholder="Select key item…"
            allow-empty
            @update:model-value="exit.requiresItem = $event || undefined"
          />
        </label>
      </div>
    </div>
    <button type="button" class="btn btn-secondary btn-sm" @click="addExit">+ Exit</button>
  </div>
</template>

<script setup lang="ts">
import type { RoomExit, ExitDirection } from '@/engine/RoomSystem'
import type { AdminRefOptions } from '@/engine/admin/contentIndexes'
import RefPicker from './RefPicker.vue'

defineProps<{
  refOptions?: Partial<AdminRefOptions>
}>()

const exits = defineModel<RoomExit[]>({ default: () => [] })

const DIRECTIONS: ExitDirection[] = ['north', 'south', 'east', 'west', 'up', 'down']

function addExit() {
  exits.value = [...exits.value, { direction: 'north', targetRoomId: '' }]
}

function remove(i: number) {
  exits.value = exits.value.filter((_, idx) => idx !== i)
}
</script>

<style scoped>
.exit-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.exit-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
}

.exit-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
}

.exit-lock-row {
  padding-top: 4px;
  border-top: 1px dashed var(--color-border);
}

.exit-dir {
  flex: 0 0 80px;
}

.exit-target {
  flex: 1;
  min-width: 0;
}

.exit-flag {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--color-text-soft);
  white-space: nowrap;
  cursor: pointer;
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

.field-select {
  padding: 5px 6px;
  font-family: var(--font-body);
  font-size: 13px;
  color: var(--color-text);
  background: var(--color-bg);
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
}

.btn-danger-icon {
  color: var(--color-danger, #c0392b);
}

.btn-danger-icon:hover {
  background: rgba(192, 57, 43, 0.15);
}
</style>
