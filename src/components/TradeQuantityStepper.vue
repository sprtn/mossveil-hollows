<template>
  <div class="trade-qty-stepper" :class="{ 'is-disabled': stepperDisabled }">
    <button
      type="button"
      class="shop-btn stepper-btn"
      :disabled="stepperDisabled"
      @click="setQty(min)"
    >−All</button>
    <button
      type="button"
      class="shop-btn stepper-btn"
      :disabled="stepperDisabled"
      @click="bump(-5)"
    >−5</button>
    <button
      type="button"
      class="shop-btn stepper-btn"
      :disabled="stepperDisabled"
      @click="bump(-1)"
    >−1</button>
    <span class="stepper-qty">{{ clampedValue }}</span>
    <button
      type="button"
      class="shop-btn stepper-btn"
      :disabled="stepperDisabled"
      @click="bump(1)"
    >+1</button>
    <button
      type="button"
      class="shop-btn stepper-btn"
      :disabled="stepperDisabled"
      @click="bump(5)"
    >+5</button>
    <button
      type="button"
      class="shop-btn stepper-btn"
      :disabled="stepperDisabled"
      @click="setQty(max)"
    >+All</button>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: number
    min?: number
    max: number
    disabled?: boolean
  }>(),
  { min: 1, disabled: false }
)

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

function clamp(n: number): number {
  if (props.max < props.min) return props.min
  return Math.max(props.min, Math.min(props.max, n))
}

const stepperDisabled = computed(
  () => props.disabled || props.max < props.min
)

const clampedValue = computed(() => clamp(props.modelValue))

watch(
  () => [props.max, props.min, props.modelValue] as const,
  () => {
    const next = clamp(props.modelValue)
    if (next !== props.modelValue) {
      emit('update:modelValue', next)
    }
  },
  { immediate: true }
)

function setQty(value: number) {
  emit('update:modelValue', clamp(value))
}

function bump(delta: number) {
  emit('update:modelValue', clamp(props.modelValue + delta))
}
</script>

<style scoped>
.trade-qty-stepper {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.trade-qty-stepper.is-disabled {
  opacity: 0.45;
}

.stepper-btn {
  padding: 4px 8px;
  min-width: 2.25rem;
  font-size: 11px;
}

.stepper-qty {
  min-width: 2rem;
  text-align: center;
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text);
  padding: 0 4px;
}

.shop-btn {
  background: var(--color-accent);
  border: none;
  border-radius: var(--radius-sm);
  color: var(--color-text);
  cursor: pointer;
}

.shop-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
