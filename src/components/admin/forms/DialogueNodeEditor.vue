<template>
  <div class="node-editor">
    <div class="node-header">
      <span class="node-label">Node {{ index + 1 }}</span>
    </div>

    <label class="field-label">
      Node ID
      <input
        :value="modelValue.id"
        type="text"
        class="field-input"
        placeholder="node_1"
        @input="update('id', ($event.target as HTMLInputElement).value)"
      />
    </label>

    <label class="field-label">
      Text
      <textarea
        :value="modelValue.text"
        class="field-textarea"
        rows="3"
        placeholder="NPC dialogue text…"
        @input="update('text', ($event.target as HTMLTextAreaElement).value)"
      />
    </label>

    <div class="responses-section">
      <div class="section-sub-title">Responses</div>
      <RepeatableList
        :model-value="modelValue.responses"
        add-label="+ Add Response"
        :make-item="makeResponse"
        @update:model-value="update('responses', $event as DialogueResponse[])"
      >
        <template #default="{ item, update: updateResp }">
          <div class="response-editor">
            <label class="field-label">
              Response Text
              <input
                :value="(item as DialogueResponse).text"
                type="text"
                class="field-input"
                placeholder="Player choice text…"
                @input="updateResp({ ...(item as DialogueResponse), text: ($event.target as HTMLInputElement).value })"
              />
            </label>

            <label class="field-label">
              Next Node
              <select
                class="field-select"
                :value="(item as DialogueResponse).next ?? ''"
                @change="updateResp({ ...(item as DialogueResponse), next: ($event.target as HTMLSelectElement).value || undefined })"
              >
                <option value="">— End dialogue —</option>
                <option v-for="nid in nodeIds" :key="nid" :value="nid">{{ nid }}</option>
              </select>
            </label>

            <div class="response-sub-section">
              <div class="section-sub-title">Requirements</div>
              <RepeatableList
                :model-value="(item as DialogueResponse).requires ?? []"
                add-label="+ Add Requirement"
                :make-item="makeRequirement"
                @update:model-value="updateResp({ ...(item as DialogueResponse), requires: ($event as OutcomeRequirement[]).length ? ($event as OutcomeRequirement[]) : undefined })"
              >
                <template #default="{ item: req, update: updateReq }">
                  <OutcomeRequirementEditor
                    :model-value="req as OutcomeRequirement"
                    @update:model-value="updateReq($event)"
                  />
                </template>
              </RepeatableList>
            </div>

            <div class="response-sub-section">
              <div class="section-sub-title">Outcomes</div>
              <RepeatableList
                :model-value="(item as DialogueResponse).outcomes ?? []"
                add-label="+ Add Outcome"
                :make-item="makeEffect"
                @update:model-value="updateResp({ ...(item as DialogueResponse), outcomes: ($event as OutcomeEffect[]).length ? ($event as OutcomeEffect[]) : undefined })"
              >
                <template #default="{ item: eff, update: updateEff }">
                  <OutcomeEffectEditor
                    :model-value="eff as OutcomeEffect"
                    @update:model-value="updateEff($event)"
                  />
                </template>
              </RepeatableList>
            </div>
          </div>
        </template>
      </RepeatableList>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DialogueNode, DialogueResponse } from '@/engine/ContentSchemas'
import type { OutcomeEffect, OutcomeRequirement } from '@/engine/Outcomes'
import { makeDefaultEffect, makeDefaultRequirement } from '@/engine/admin/outcomeFormMeta'
import RepeatableList from './RepeatableList.vue'
import OutcomeEffectEditor from './OutcomeEffectEditor.vue'
import OutcomeRequirementEditor from './OutcomeRequirementEditor.vue'

const props = defineProps<{
  modelValue: DialogueNode
  index: number
  nodeIds: string[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: DialogueNode): void
}>()

function update<K extends keyof DialogueNode>(key: K, value: DialogueNode[K]) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}

function makeResponse(): DialogueResponse {
  return { text: '' }
}

function makeRequirement(): OutcomeRequirement {
  return makeDefaultRequirement('has_flag')
}

function makeEffect(): OutcomeEffect {
  return makeDefaultEffect('give_gold')
}
</script>

<style scoped>
.node-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
}

.node-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2px;
}

.node-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-accent);
}

.responses-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-elevated);
}

.response-editor {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
}

.response-sub-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-elevated);
}

.section-sub-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-soft);
  margin-bottom: 2px;
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
