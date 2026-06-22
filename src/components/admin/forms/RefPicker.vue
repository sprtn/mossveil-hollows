<template>
  <div class="ref-picker">
    <input
      v-model="filterQuery"
      type="text"
      class="ref-input"
      :placeholder="placeholder"
      autocomplete="off"
      @focus="onFocus"
      @blur="onBlur"
      @input="onInput"
      @keydown.down.prevent="highlightNext"
      @keydown.up.prevent="highlightPrev"
      @keydown.enter.prevent="selectHighlighted"
      @keydown.escape="close"
    />
    <ul v-if="open && filtered.length > 0" class="ref-dropdown">
      <li
        v-for="(opt, idx) in filtered"
        :key="opt.id"
        class="ref-option"
        :class="{ selected: opt.id === modelValue, highlighted: idx === highlightIndex }"
        @mousedown.prevent="select(opt)"
      >
        <span class="ref-option-label">{{ opt.label }}</span>
        <span class="ref-option-id">{{ opt.id }}</span>
      </li>
    </ul>
    <ul v-else-if="open && filterQuery.length > 0 && !allowCustom" class="ref-dropdown">
      <li class="ref-option ref-option-empty">No matches</li>
    </ul>
    <ul v-else-if="open && allowEmpty" class="ref-dropdown">
      <li class="ref-option" @mousedown.prevent="selectEmpty">
        <span class="ref-option-label">— None —</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

export interface RefOption {
  id: string
  label: string
}

const props = withDefaults(
  defineProps<{
    modelValue: string
    options: RefOption[]
    placeholder?: string
    allowEmpty?: boolean
    allowCustom?: boolean
  }>(),
  {
    placeholder: 'Search…',
    allowEmpty: false,
    allowCustom: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const open = ref(false)
const filterQuery = ref('')
const highlightIndex = ref(0)

const selectedOption = computed(() => props.options.find((o) => o.id === props.modelValue))

function syncDisplayFromValue() {
  if (open.value) return
  const match = selectedOption.value
  if (match) {
    filterQuery.value = match.label
  } else if (props.modelValue) {
    filterQuery.value = props.modelValue
  } else {
    filterQuery.value = ''
  }
}

watch(() => props.modelValue, syncDisplayFromValue, { immediate: true })
watch(() => props.options, syncDisplayFromValue, { deep: true })

const filtered = computed(() => {
  const q = filterQuery.value.toLowerCase().trim()
  const sorted = [...props.options].sort((a, b) => a.label.localeCompare(b.label))
  if (!q) return sorted
  return sorted.filter(
    (o) =>
      o.id.toLowerCase().includes(q) ||
      o.label.toLowerCase().includes(q),
  )
})

watch(filtered, () => {
  highlightIndex.value = 0
})

function onFocus() {
  open.value = true
  filterQuery.value = ''
  highlightIndex.value = Math.max(
    0,
    filtered.value.findIndex((o) => o.id === props.modelValue),
  )
}

function onInput() {
  open.value = true
  if (props.allowCustom) {
    const match = props.options.find(
      (o) => o.label.toLowerCase() === filterQuery.value.toLowerCase(),
    )
    emit('update:modelValue', match?.id ?? filterQuery.value)
  }
}

function onBlur() {
  setTimeout(() => {
    open.value = false
    syncDisplayFromValue()
  }, 150)
}

function close() {
  open.value = false
  syncDisplayFromValue()
}

function select(opt: RefOption) {
  emit('update:modelValue', opt.id)
  filterQuery.value = opt.label
  open.value = false
}

function selectEmpty() {
  emit('update:modelValue', '')
  filterQuery.value = ''
  open.value = false
}

function highlightNext() {
  if (!open.value) {
    onFocus()
    return
  }
  highlightIndex.value = Math.min(highlightIndex.value + 1, filtered.value.length - 1)
}

function highlightPrev() {
  highlightIndex.value = Math.max(highlightIndex.value - 1, 0)
}

function selectHighlighted() {
  const opt = filtered.value[highlightIndex.value]
  if (opt) select(opt)
  else if (props.allowCustom && filterQuery.value) {
    emit('update:modelValue', filterQuery.value)
    open.value = false
  }
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
  max-height: 220px;
  overflow-y: auto;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
}

.ref-option {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 12px;
}

.ref-option:hover,
.ref-option.selected,
.ref-option.highlighted {
  background: rgba(95, 143, 80, 0.18);
}

.ref-option-label {
  color: var(--color-text);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ref-option-id {
  font-family: var(--font-mono, monospace);
  font-size: 10px;
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
