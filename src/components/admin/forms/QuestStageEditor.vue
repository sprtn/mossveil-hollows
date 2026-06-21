<template>
  <div class="stage-editor">
    <div class="stage-header">
      <span class="stage-label">Stage {{ index + 1 }}</span>
    </div>

    <label class="field-label">
      Stage ID
      <input
        :value="modelValue.id"
        type="text"
        class="field-input"
        placeholder="stage_1"
        @input="update('id', ($event.target as HTMLInputElement).value)"
      />
    </label>

    <label class="field-label">
      Description
      <textarea
        :value="modelValue.description"
        class="field-textarea"
        rows="2"
        placeholder="What the player must do…"
        @input="update('description', ($event.target as HTMLTextAreaElement).value)"
      />
    </label>

    <div class="objective-section">
      <div class="objective-title">Objective</div>
      <div class="objective-grid">
        <label class="field-label">
          Type
          <select
            class="field-select"
            :value="modelValue.objective.type"
            @change="updateObjectiveType(($event.target as HTMLSelectElement).value as QuestObjectiveType)"
          >
            <option v-for="t in OBJECTIVE_TYPES" :key="t" :value="t">{{ t }}</option>
          </select>
        </label>
        <label class="field-label">
          Target
          <input
            :value="modelValue.objective.target"
            type="text"
            class="field-input"
            placeholder="npc_id / item_id / room_id…"
            @input="updateObjectiveField('target', ($event.target as HTMLInputElement).value)"
          />
        </label>
        <label v-if="showCount" class="field-label">
          Count
          <input
            :value="modelValue.objective.count ?? 1"
            type="number"
            min="1"
            class="field-input"
            @input="updateObjectiveField('count', Number(($event.target as HTMLInputElement).value))"
          />
        </label>
      </div>
    </div>

    <div class="rewards-section">
      <div class="rewards-title">Rewards</div>
        <RepeatableList
          :model-value="modelValue.rewards"
          add-label="+ Add Reward"
          :make-item="makeReward"
          @update:model-value="update('rewards', $event as OutcomeEffect[])"
        >
        <template #default="{ item, update: updateReward }">
          <OutcomeEffectEditor
            :model-value="item as OutcomeEffect"
            :ref-options="refOptions"
            @update:model-value="updateReward($event)"
          />
        </template>
      </RepeatableList>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { QuestStage, QuestObjectiveType } from '@/engine/ContentSchemas'
import type { OutcomeEffect } from '@/engine/Outcomes'
import { makeDefaultEffect, type RefEntity } from '@/engine/admin/outcomeFormMeta'
import RepeatableList from './RepeatableList.vue'
import OutcomeEffectEditor from './OutcomeEffectEditor.vue'

const OBJECTIVE_TYPES: QuestObjectiveType[] = [
  'talk_npc',
  'collect_material',
  'collect_item',
  'craft_item',
  'defeat_boss',
  'defeat_enemy',
  'visit_room',
  'set_flag',
]

const COUNT_TYPES = new Set<QuestObjectiveType>([
  'collect_material',
  'collect_item',
  'craft_item',
  'defeat_enemy',
])

const props = defineProps<{
  modelValue: QuestStage
  index: number
  refOptions?: Partial<Record<RefEntity, { id: string; label: string }[]>>
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: QuestStage): void
}>()

const showCount = computed(() => COUNT_TYPES.has(props.modelValue.objective.type))

function update<K extends keyof QuestStage>(key: K, value: QuestStage[K]) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}

function updateObjectiveType(type: QuestObjectiveType) {
  const count = COUNT_TYPES.has(type) ? (props.modelValue.objective.count ?? 1) : undefined
  emit('update:modelValue', {
    ...props.modelValue,
    objective: { ...props.modelValue.objective, type, count },
  })
}

function updateObjectiveField(key: string, value: unknown) {
  emit('update:modelValue', {
    ...props.modelValue,
    objective: { ...props.modelValue.objective, [key]: value },
  })
}

function makeReward(): OutcomeEffect {
  return makeDefaultEffect('give_gold')
}
</script>

<style scoped>
.stage-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
}

.stage-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2px;
}

.stage-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-accent);
}

.objective-section,
.rewards-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-elevated);
}

.objective-title,
.rewards-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-soft);
  margin-bottom: 2px;
}

.objective-grid {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 6px;
  align-items: end;
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

.field-input:focus,
.field-textarea:focus,
.field-select:focus {
  outline: none;
  border-color: var(--color-accent);
}
</style>
