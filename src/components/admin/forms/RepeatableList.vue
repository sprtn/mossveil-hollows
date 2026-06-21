<template>
  <div class="repeatable-list">
    <div v-for="(item, i) in modelValue" :key="i" class="repeatable-row">
      <div class="repeatable-row-content">
        <slot :item="item" :index="i" :update="(val: unknown) => updateItem(i, val)" />
      </div>
      <button type="button" class="btn-icon btn-danger-icon" title="Remove" @click="remove(i)">✕</button>
    </div>
    <button type="button" class="btn btn-secondary btn-sm" @click="add">{{ addLabel ?? '+ Add' }}</button>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: unknown[]
  addLabel?: string
  makeItem: () => unknown
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: unknown[]): void
}>()

function add() {
  emit('update:modelValue', [...props.modelValue, props.makeItem()])
}

function remove(i: number) {
  emit('update:modelValue', props.modelValue.filter((_, idx) => idx !== i))
}

function updateItem(i: number, val: unknown) {
  const updated = [...props.modelValue]
  updated[i] = val
  emit('update:modelValue', updated)
}
</script>

<style scoped>
.repeatable-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.repeatable-row {
  display: flex;
  align-items: flex-start;
  gap: 6px;
}

.repeatable-row-content {
  flex: 1;
  min-width: 0;
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
  margin-top: 2px;
}

.btn-danger-icon {
  color: var(--color-danger, #c0392b);
}

.btn-danger-icon:hover {
  background: rgba(192, 57, 43, 0.15);
}
</style>
