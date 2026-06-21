<template>
  <section class="validation-panel panel-inset">
    <header class="validation-header">
      <button type="button" class="validation-toggle" @click="collapsed = !collapsed">
        <span class="toggle-icon">{{ collapsed ? '▸' : '▾' }}</span>
        Validation
        <span v-if="issues.length" class="issue-count" :class="countClass">
          {{ issues.length }}
        </span>
      </button>
      <button type="button" class="btn btn-secondary btn-sm" :disabled="running" @click="runValidation">
        {{ running ? 'Validating…' : 'Validate all' }}
      </button>
    </header>

    <div v-if="!collapsed" class="validation-body">
      <p v-if="lastRunAt && issues.length === 0" class="validation-ok">
        No issues found.
      </p>
      <p v-else-if="!lastRunAt" class="validation-hint">
        Click "Validate all" to check content references and required fields.
      </p>
      <ul v-else class="issue-list">
        <li
          v-for="(item, idx) in issues"
          :key="`${item.entityType}-${item.entityId}-${idx}`"
          class="issue-row"
          :class="item.severity"
        >
          <span class="issue-severity">{{ item.severity }}</span>
          <span class="issue-entity">{{ item.entityType }} / {{ item.entityId }}</span>
          <span class="issue-message">{{ item.message }}</span>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { loadOverlay } from '@/engine/admin/ContentOverlayStore'
import { buildContentIndexes } from '@/engine/admin/contentIndexes'
import { validateAll, type ValidationIssue } from '@/engine/admin/ContentValidator'
import { refreshContentRegistry } from '@/engine/admin/ContentRegistry'

const issues = ref<ValidationIssue[]>([])
const collapsed = ref(false)
const running = ref(false)
const lastRunAt = ref<number | null>(null)

const countClass = computed(() => {
  if (issues.value.some((i) => i.severity === 'error')) return 'has-errors'
  if (issues.value.length > 0) return 'has-warnings'
  return ''
})

function runValidation() {
  running.value = true
  try {
    refreshContentRegistry()
    const state = loadOverlay()
    const indexes = buildContentIndexes()
    issues.value = validateAll(state, indexes)
    lastRunAt.value = Date.now()
  } finally {
    running.value = false
  }
}

defineExpose({ runValidation, issues })
</script>

<style scoped>
.validation-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  margin: 0 12px 12px;
}

.validation-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--color-border);
}

.validation-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0;
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  background: none;
  border: none;
  cursor: pointer;
}

.toggle-icon {
  color: var(--color-text-soft);
  font-size: 11px;
}

.issue-count {
  font-size: 11px;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: var(--radius-sm);
  background: rgba(212, 168, 75, 0.15);
  color: var(--color-warning);
  border: 1px solid rgba(212, 168, 75, 0.35);
}

.issue-count.has-errors {
  background: rgba(200, 80, 80, 0.15);
  color: #e88;
  border-color: rgba(200, 80, 80, 0.35);
}

.issue-count.has-warnings {
  background: rgba(212, 168, 75, 0.15);
  color: var(--color-warning);
}

.btn-sm {
  font-size: 12px;
  padding: 4px 10px;
}

.validation-body {
  max-height: 180px;
  overflow-y: auto;
  padding: 8px 10px;
}

.validation-ok,
.validation-hint {
  margin: 0;
  font-size: 12px;
  color: var(--color-text-soft);
  font-style: italic;
}

.validation-ok {
  color: var(--color-accent-bright);
  font-style: normal;
}

.issue-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.issue-row {
  display: grid;
  grid-template-columns: 56px minmax(120px, 1fr) minmax(0, 2fr);
  gap: 8px;
  align-items: start;
  font-size: 12px;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
}

.issue-row.error {
  border-color: rgba(200, 80, 80, 0.35);
}

.issue-row.warning {
  border-color: rgba(212, 168, 75, 0.35);
}

.issue-severity {
  text-transform: uppercase;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.issue-row.error .issue-severity {
  color: #e88;
}

.issue-row.warning .issue-severity {
  color: var(--color-warning);
}

.issue-entity {
  color: var(--color-text-soft);
  font-family: var(--font-mono, monospace);
  word-break: break-all;
}

.issue-message {
  color: var(--color-text);
}
</style>
