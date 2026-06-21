<template>
  <div class="ref-picker">
    <input
      v-model="search"
      type="text"
      class="ref-input"
      :placeholder="placeholder"
      @focus="open = true"
      @blur="onBlur"
    />
    <ul v-if="open && filtered.length > 0" class="ref-dropdown">
      <li
        v-for="opt in filtered"
        :key="opt.id"
        class="ref-option"
        :class="{ selected: opt.id === modelValue }"
        @mousedown.prevent="select(opt)"
      >
        <span class="ref-option-id">{{ opt.id }}</span>
        <span class="ref-option-label">{{ opt.label }}</span>
      </li>
    </ul>
    <ul v-else-if="open && search.length > 0" class="ref-dropdown">
      <li class="ref-option ref-option-empty">No results</li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: string
    options: { id: string; label: string }[]
    placeholder?: string
  }>(),
  { placeholder: 'Search…' }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const open = ref(false)
const search = ref('')

watch(
  () => props.modelValue,
  (val) => {
    const match = props.options.find((o) => o.id === val)
    search.value = match ? `${match.id} — ${match.label}` : val
  },
  { immediate: true }
)

const filtered = computed(() => {
  const q = search.value.toLowerCase()
  return props.options.filter(
    (o) => o.id.toLowerCase().includes(q) || o.label.toLowerCase().includes(q)
  )
})

function select(opt: { id: string; label: string }) {
  emit('update:modelValue', opt.id)
  search.value = `${opt.id} — ${opt.label}`
  open.value = false
}

function onBlur() {
  setTimeout(() => {
    open.value = false
  }, 150)
}
</script>

<style scoped>
.ref-picker {
  position: relative;
  width: 100%;
}

.ref-input {
  width: 100%;
  box-sizing: border-box;
  padding: 5px 8px;
  font-family: var(--font-body);
  font-size: 13px;
  color: var(--color-text);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.ref-input:focus {
  outline: none;
  border-color: var(--color-accent);
}

.ref-dropdown {
  position: absolute;
  top: calc(100% + 2px);
  left: 0;
  right: 0;
  z-index: 100;
  margin: 0;
  padding: 4px 0;
  list-style: none;
  max-height: 200px;
  overflow-y: auto;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
}

.ref-option {
  display: flex;
  gap: 8px;
  align-items: baseline;
  padding: 5px 10px;
  cursor: pointer;
  font-size: 12px;
}

.ref-option:hover,
.ref-option.selected {
  background: rgba(95, 143, 80, 0.18);
}

.ref-option-id {
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  color: var(--color-accent);
  flex-shrink: 0;
}

.ref-option-label {
  color: var(--color-text-soft);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ref-option-empty {
  color: var(--color-text-muted, var(--color-text-soft));
  font-style: italic;
  cursor: default;
}
</style>
