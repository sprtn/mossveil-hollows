<template>
  <div class="train-panel panel">
    <h4>{{ npcName }} — Training</h4>
    <p v-if="trainerLine" class="trainer-line">{{ trainerLine }}</p>
    <p class="train-hint">Buy skill points with gold, then learn combat techniques.</p>
    <p class="train-meta">
      <strong>Points:</strong> {{ gameState.player.skillPoints ?? 0 }} ·
      <strong>Gold:</strong> {{ gameState.player.gold }}g
    </p>
    <button
      class="btn btn-primary"
      :disabled="gameState.player.gold < trainingCost"
      @click="$emit('buyPoint')"
    >
      Buy Skill Point ({{ trainingCost }}g)
    </button>

    <div v-for="branch in branches" :key="branch" class="skill-branch-group">
      <h5 class="branch-title">{{ branchLabel(branch) }}</h5>
      <div v-for="skill in skillsByBranch(branch)" :key="skill.id" class="skill-card panel-inset">
        <div class="skill-info">
          <strong>{{ skill.name }}</strong>
          <span class="skill-meta">
            {{ skill.cost }} pt · {{ skill.energyCost }} energy
          </span>
          <p class="skill-desc">{{ skill.description }}</p>
          <p v-if="skill.requires.length" class="skill-req">
            Requires: {{ formatRequires(skill.requires) }}
          </p>
        </div>
        <button
          class="btn"
          :class="skillButtonClass(skill.id)"
          :disabled="!canLearn(skill.id)"
          @click="$emit('learn', skill.id)"
        >
          {{ skillButtonLabel(skill.id) }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { GameState } from '@/engine/GameLoopDesign'
import type { SkillDef } from '@/engine/ContentSchemas'
import { getAllSkills, canLearnSkill, getSkill } from '@/engine/SkillSystem'
import { TRAINING_COST } from '@/engine/gameConfig'

const props = defineProps<{
  gameState: GameState
  npcId: string
  npcName: string
}>()

defineEmits<{ buyPoint: []; learn: [skillId: string] }>()

const trainerLine = computed(() => {
  if (props.npcId === 'captain_bryn') {
    return '"Steel your nerves and spend your points wisely — techniques win battles."'
  }
  return ''
})

const trainingCost = TRAINING_COST
const allSkills = getAllSkills()
const branches = ['might', 'survival', 'hunter'] as const

function skillsByBranch(branch: SkillDef['branch']): SkillDef[] {
  return allSkills.filter((s) => s.branch === branch)
}

function branchLabel(branch: string): string {
  return branch.charAt(0).toUpperCase() + branch.slice(1)
}

function formatRequires(requires: string[]): string {
  return requires.map((id) => getSkill(id)?.name ?? id.replace('skill_', '').replace(/_/g, ' ')).join(', ')
}

function isKnown(skillId: string): boolean {
  return (props.gameState.player.knownSkills ?? []).includes(skillId)
}

function canLearn(skillId: string): boolean {
  return canLearnSkill(props.gameState, skillId)
}

function skillButtonLabel(skillId: string): string {
  if (isKnown(skillId)) return 'Known'
  const skill = getSkill(skillId)
  if (!skill) return 'Learn'
  const reqsMet = skill.requires.every((r) => isKnown(r))
  if (!reqsMet) return 'Locked'
  if ((props.gameState.player.skillPoints ?? 0) < skill.cost) return 'Need points'
  return 'Learn'
}

function skillButtonClass(skillId: string): string {
  if (isKnown(skillId)) return 'btn-known'
  if (!canLearn(skillId)) return 'btn-locked'
  return 'btn-primary'
}
</script>

<style scoped>
.train-panel { margin-top: 12px; }
.train-panel h4 { margin: 0 0 8px; color: var(--color-accent); font-family: var(--font-display); }
.trainer-line { font-size: 13px; color: var(--color-text-soft); font-style: italic; margin: 0 0 8px; line-height: 1.4; }
.train-hint { color: var(--color-text-muted); font-size: 13px; margin-bottom: 8px; }
.train-meta { margin-bottom: 12px; color: var(--color-text); }
.skill-branch-group { margin-top: 16px; }
.branch-title {
  margin: 0 0 8px;
  color: var(--color-accent-warm);
  font-family: var(--font-display);
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 1px;
}
.skill-card {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  padding: 10px;
  margin-bottom: 8px;
}
.skill-info { flex: 1; }
.skill-meta { display: block; font-size: 12px; color: var(--color-text-muted); margin: 4px 0; }
.skill-desc { font-size: 13px; color: var(--color-text-soft); margin: 4px 0; }
.skill-req { font-size: 12px; color: var(--color-warning); margin: 4px 0 0; }
.btn-known { opacity: 0.6; cursor: default; }
.btn-locked { opacity: 0.5; cursor: not-allowed; }
</style>
