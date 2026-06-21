<template>
  <div class="outcome-editor">
    <div class="outcome-kind-row">
      <label class="field-label">
        Kind
        <select
          class="field-select kind-select"
          :value="modelValue.kind"
          @change="onKindChange(($event.target as HTMLSelectElement).value as OutcomeRequirement['kind'])"
        >
          <option v-for="opt in REQUIREMENT_KIND_OPTIONS" :key="opt.id" :value="opt.id">{{ opt.label }}</option>
        </select>
      </label>
    </div>

    <div v-if="meta.fields.length > 0" class="outcome-fields">
      <template v-for="field in meta.fields" :key="field.key">
        <label class="field-label">
          {{ field.label }}<span v-if="field.optional" class="optional-badge"> (opt)</span>

          <template v-if="field.type === 'ref'">
            <RefPicker
              :model-value="(draft as Record<string, string>)[field.key] ?? ''"
              :options="refOptions?.[field.refType!] ?? []"
              :placeholder="`${field.label}…`"
              @update:model-value="setField(field.key, $event)"
            />
          </template>

          <template v-else-if="field.type === 'select'">
            <select
              class="field-select"
              :value="(draft as Record<string, unknown>)[field.key]"
              @change="setField(field.key, ($event.target as HTMLSelectElement).value)"
            >
              <option v-for="opt in field.options" :key="opt" :value="opt">{{ opt }}</option>
            </select>
          </template>

          <template v-else-if="field.type === 'number'">
            <input
              class="field-input"
              type="number"
              :value="(draft as Record<string, unknown>)[field.key] ?? 0"
              @input="setField(field.key, Number(($event.target as HTMLInputElement).value))"
            />
          </template>

          <template v-else-if="field.type === 'boolean'">
            <input
              type="checkbox"
              :checked="!!(draft as Record<string, unknown>)[field.key]"
              @change="setField(field.key, ($event.target as HTMLInputElement).checked)"
            />
          </template>

          <template v-else>
            <input
              class="field-input"
              type="text"
              :value="(draft as Record<string, unknown>)[field.key] ?? ''"
              @input="setField(field.key, ($event.target as HTMLInputElement).value)"
            />
          </template>
        </label>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { OutcomeRequirement } from '@/engine/Outcomes'
import {
  OUTCOME_REQUIREMENT_META,
  REQUIREMENT_KIND_OPTIONS,
  makeDefaultRequirement,
  type RefEntity,
} from '@/engine/admin/outcomeFormMeta'
import RefPicker from './RefPicker.vue'

const props = defineProps<{
  modelValue: OutcomeRequirement
  refOptions?: Partial<Record<RefEntity, { id: string; label: string }[]>>
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: OutcomeRequirement): void
}>()

const draft = computed(() => props.modelValue)
const meta = computed(() => OUTCOME_REQUIREMENT_META[props.modelValue.kind])

function onKindChange(kind: OutcomeRequirement['kind']) {
  emit('update:modelValue', makeDefaultRequirement(kind))
}

function setField(key: string, value: unknown) {
  emit('update:modelValue', { ...props.modelValue, [key]: value } as OutcomeRequirement)
}
</script>

<style scoped>
.outcome-editor {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
}

.outcome-kind-row {
  width: 100%;
}

.kind-select {
  width: 100%;
}

.outcome-fields {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 6px;
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

.optional-badge {
  font-weight: 400;
  text-transform: none;
  color: var(--color-text-muted, var(--color-text-soft));
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
</style>
