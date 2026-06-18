<template>
  <div class="train-panel panel">
    <h4>{{ npcName }} — Training</h4>
    <p v-if="trainerLine" class="trainer-line">{{ trainerLine }}</p>
    <p class="train-hint">
      Each attempt costs gold and advances one day. Success is a stat-based roll — failure spends both with no progress saved.
    </p>
    <p class="train-meta">
      <strong>Gold:</strong> {{ gameState.player.gold }}g ·
      <strong>Day:</strong> {{ gameState.day ?? 1 }}
    </p>

    <p v-if="lastResult" class="train-result" :class="lastResult.success ? 'success' : 'failure'">
      {{ lastResult.message }}
    </p>

    <div v-if="confirmSkillId" class="confirm-box panel-inset">
      <p>
        Train <strong>{{ confirmSkillName }}</strong>?
        Costs <strong>{{ confirmGold }}g</strong> and <strong>1 day</strong>
        ({{ confirmChance }}% success).
      </p>
      <div class="confirm-actions">
        <button class="btn btn-primary" @click="confirmAttempt">Confirm</button>
        <button class="btn" @click="cancelConfirm">Cancel</button>
      </div>
    </div>

    <div
      v-if="isBryn && showStatPractice"
      class="stat-practice-block panel-inset"
      :class="{ disabled: !statPracticeEnabled }"
    >
      <h5 class="branch-title">Physical Conditioning</h5>
      <p v-if="statPracticeComplete" class="stat-practice-complete">Practice complete.</p>
      <template v-else>
        <p class="stat-practice-header">
          Practice ({{ statPracticeGold }}g, 1 day) — {{ statSessionsLeft }} sessions left
        </p>
        <p v-if="!canAffordPractice" class="skill-lock">Need {{ statPracticeGold }}g.</p>
        <div v-if="confirmStat" class="confirm-box confirm-box--nested">
          <p>
            Practice <strong>{{ statLabel(confirmStat) }}</strong>?
            Costs <strong>{{ statPracticeGold }}g</strong> and <strong>1 day</strong> (+1 {{ statLabel(confirmStat) }}).
          </p>
          <div class="confirm-actions">
            <button class="btn btn-primary" @click="confirmStatAttempt">Confirm</button>
            <button class="btn" @click="cancelStatConfirm">Cancel</button>
          </div>
        </div>
        <div v-else class="stat-practice-buttons">
          <button
            v-for="stat in statKeys"
            :key="stat"
            class="btn"
            :disabled="!statPracticeEnabled || !!confirmSkillId"
            @click="requestStatAttempt(stat)"
          >
            {{ statLabel(stat) }}
          </button>
        </div>
      </template>
    </div>

    <div v-for="branch in branches" :key="branch" class="skill-branch-group">
      <h5 class="branch-title">{{ branchLabel(branch) }}</h5>
      <div v-for="skill in skillsByBranch(branch)" :key="skill.id" class="skill-card panel-inset">
        <div class="skill-info">
          <strong>{{ skill.name }}</strong>
          <span class="skill-meta">{{ skill.energyCost }} energy in combat</span>
          <p class="skill-desc">{{ skill.description }}</p>
          <template v-if="preview(skill.id)">
            <p class="skill-stat">
              {{ statLabel(preview(skill.id)!.governingStat) }}:
              {{ preview(skill.id)!.currentStat }}
              (need {{ preview(skill.id)!.minStat }}+ for {{ formatPct(preview(skill.id)!.chance) }} chance)
            </p>
            <p class="skill-cost">{{ preview(skill.id)!.goldCost }}g · 1 day per attempt</p>
          </template>
          <p v-if="skill.requires.length" class="skill-req">
            Requires: {{ formatRequires(skill.requires) }}
          </p>
          <p v-if="lockReason(skill.id)" class="skill-lock">{{ lockReason(skill.id) }}</p>
        </div>
        <button
          class="btn"
          :class="skillButtonClass(skill.id)"
          :disabled="!canAttempt(skill.id) || !!confirmSkillId || !!confirmStat"
          @click="requestAttempt(skill.id)"
        >
          {{ skillButtonLabel(skill.id) }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { GameState, PlayerStatKey } from '@/engine/GameLoopDesign'
import type { SkillDef } from '@/engine/ContentSchemas'
import { getAllSkills, getSkill, getTrainingPreview } from '@/engine/SkillSystem'
import { statLabel as statLabelDisplay } from '@/engine/statDisplay'
import {
  BRYN_STAT_PRACTICE_GOLD,
} from '@/engine/gameConfig'
import { brynStatSessionsRemaining } from '@/engine/BrynStatTraining'

const props = defineProps<{
  gameState: GameState
  npcId: string
  npcName: string
}>()

const emit = defineEmits<{
  attemptTraining: [skillId: string]
  attemptStatPractice: [stat: PlayerStatKey]
}>()

const confirmSkillId = ref<string | null>(null)
const confirmStat = ref<PlayerStatKey | null>(null)
const lastResult = ref<{ success: boolean; message: string } | null>(null)

const isBryn = computed(() => props.npcId === 'captain_bryn')
const showStatPractice = computed(() => isBryn.value)
const statKeys: PlayerStatKey[] = ['strength', 'constitution', 'dexterity', 'agility', 'defense']
const statPracticeGold = BRYN_STAT_PRACTICE_GOLD
const statSessionsLeft = computed(() => brynStatSessionsRemaining(props.gameState.player))
const statPracticeComplete = computed(() => statSessionsLeft.value <= 0)
const canAffordPractice = computed(() => props.gameState.player.gold >= statPracticeGold)
const statPracticeEnabled = computed(
  () => !statPracticeComplete.value && canAffordPractice.value
)

const trainerLine = computed(() => {
  if (props.npcId === 'captain_bryn') {
    return '"Steel your nerves — the body learns what the mind refuses to skip."'
  }
  return ''
})

const allSkills = getAllSkills()
const branches = ['might', 'survival', 'hunter'] as const

const confirmSkill = computed(() =>
  confirmSkillId.value ? getSkill(confirmSkillId.value) : undefined
)
const confirmSkillName = computed(() => confirmSkill.value?.name ?? '')
const confirmGold = computed(() => confirmSkill.value?.training?.goldCost ?? 0)
const confirmChance = computed(() => {
  if (!confirmSkillId.value) return 0
  const p = getTrainingPreview(props.gameState.player, getSkill(confirmSkillId.value)!)
  return Math.round(p.chance * 100)
})

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

function preview(skillId: string) {
  const skill = getSkill(skillId)
  if (!skill?.training) return null
  return getTrainingPreview(props.gameState.player, skill)
}

function statLabel(stat: string): string {
  return statLabelDisplay(stat as PlayerStatKey)
}

function formatPct(chance: number): string {
  return String(Math.round(chance * 100))
}

function lockReason(skillId: string): string | null {
  const p = preview(skillId)
  if (!p || p.attemptable) return null
  switch (p.lockedReason) {
    case 'known':
      return 'Already mastered.'
    case 'missing_prereq':
      return 'Prerequisites not met.'
    case 'stat_too_low':
      return `${statLabel(p.governingStat)} too low (need ${p.minStat}+).`
    case 'cant_afford':
      return `Need ${p.goldCost}g.`
    default:
      return 'Cannot train.'
  }
}

function canAttempt(skillId: string): boolean {
  const p = preview(skillId)
  return p?.attemptable ?? false
}

function skillButtonLabel(skillId: string): string {
  if (isKnown(skillId)) return 'Known'
  if (!canAttempt(skillId)) return 'Locked'
  return 'Attempt Training'
}

function skillButtonClass(skillId: string): string {
  if (isKnown(skillId)) return 'btn-known'
  if (!canAttempt(skillId)) return 'btn-locked'
  return 'btn-primary'
}

function requestAttempt(skillId: string) {
  if (!canAttempt(skillId)) return
  confirmStat.value = null
  confirmSkillId.value = skillId
  lastResult.value = null
}

function cancelConfirm() {
  confirmSkillId.value = null
}

function confirmAttempt() {
  if (!confirmSkillId.value) return
  const skillId = confirmSkillId.value
  confirmSkillId.value = null
  emit('attemptTraining', skillId)
}

function requestStatAttempt(stat: PlayerStatKey) {
  if (!statPracticeEnabled.value) return
  confirmSkillId.value = null
  confirmStat.value = stat
  lastResult.value = null
}

function cancelStatConfirm() {
  confirmStat.value = null
}

function confirmStatAttempt() {
  if (!confirmStat.value) return
  const stat = confirmStat.value
  confirmStat.value = null
  emit('attemptStatPractice', stat)
}

/** Called by parent after hubAttemptTraining resolves. */
function showResult(success: boolean, skillName: string) {
  lastResult.value = success
    ? { success: true, message: `You train hard… and master ${skillName}!` }
    : { success: false, message: `You drill all day, but ${skillName} won't come together. The day is spent.` }
}

/** Called by parent after hubAttemptBrynStatPractice resolves. */
function showStatPracticeResult(message: string) {
  lastResult.value = { success: true, message }
}

defineExpose({ showResult, showStatPracticeResult })
</script>

<style scoped>
.train-panel { margin-top: 12px; }
.train-panel h4 { margin: 0 0 8px; color: var(--color-accent); font-family: var(--font-display); }
.trainer-line { font-size: 13px; color: var(--color-text-soft); font-style: italic; margin: 0 0 8px; line-height: 1.4; }
.train-hint { color: var(--color-text-muted); font-size: 13px; margin-bottom: 8px; }
.train-meta { margin-bottom: 12px; color: var(--color-text); }
.train-result { padding: 10px; margin-bottom: 12px; border-radius: 4px; font-size: 13px; }
.train-result.success { background: rgba(80, 160, 80, 0.15); color: var(--color-success, #6a6); }
.train-result.failure { background: rgba(160, 80, 80, 0.15); color: var(--color-warning); }
.confirm-box { padding: 12px; margin-bottom: 16px; }
.confirm-box p { margin: 0 0 10px; font-size: 13px; }
.confirm-actions { display: flex; gap: 8px; }
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
.skill-stat { font-size: 12px; color: var(--color-text); margin: 4px 0; }
.skill-cost { font-size: 12px; color: var(--color-accent-warm); margin: 2px 0; }
.skill-desc { font-size: 13px; color: var(--color-text-soft); margin: 4px 0; }
.skill-req { font-size: 12px; color: var(--color-warning); margin: 4px 0 0; }
.skill-lock { font-size: 12px; color: var(--color-text-muted); margin: 4px 0 0; font-style: italic; }
.btn-known { opacity: 0.6; cursor: default; }
.btn-locked { opacity: 0.5; cursor: not-allowed; }
.stat-practice-block { margin-bottom: 16px; padding: 12px; }
.stat-practice-block.disabled { opacity: 0.65; }
.stat-practice-header { font-size: 13px; color: var(--color-accent-warm); margin: 0 0 10px; }
.stat-practice-complete { font-size: 13px; color: var(--color-text-muted); font-style: italic; margin: 0; }
.stat-practice-buttons { display: flex; flex-wrap: wrap; gap: 8px; }
.confirm-box--nested { padding: 10px; margin-top: 8px; margin-bottom: 0; background: var(--color-bg-elevated); }
</style>
