<template>
  <div class="encounter-screen">
    <div class="encounter-header">
      <h1>ENCOUNTER</h1>
      <div v-if="playerPoisoned" class="status-badge poison">Poisoned</div>
      <div v-if="playerStunned" class="status-badge stun">Stunned</div>
    </div>

    <div class="player-combat-bar">
      <span>{{ player.name }}</span>
      <div class="hp-bar">
        <div class="hp-fill player-hp" :style="{ width: `${playerHpPct}%` }"></div>
      </div>
      <span>{{ player.hp }}/{{ player.maxHp }}</span>
      <span class="energy-text">⚡{{ player.energy }}/{{ player.maxEnergy }}</span>
    </div>

    <div class="enemy-list">
      <div
        v-for="enemy in aliveEnemies"
        :key="enemy.id"
        :class="['enemy-card', { 'selected-target': selectedTarget === enemy.id, clickable: !isBusy && aliveEnemies.length > 1 }]"
        @click="selectEnemyTarget(enemy.id)"
      >
        <div class="enemy-name">
          {{ enemy.name }}
          <span v-if="enemy.isBoss" class="boss-tag">BOSS</span>
          <span v-if="selectedTarget === enemy.id" class="target-icon">⚔</span>
        </div>
        <div class="enemy-hp">
          <div class="hp-bar">
            <div class="hp-fill enemy-hp" :style="{ width: `${(enemy.hp / enemy.maxHp) * 100}%` }"></div>
          </div>
          <span class="hp-text">{{ enemy.hp }}/{{ enemy.maxHp }}</span>
        </div>
        <div v-if="hasPoison(enemy)" class="enemy-status">☠ Poison</div>
      </div>
    </div>

    <div class="combat-actions">
      <div class="action-buttons">
        <button @click="handleAttack" class="action-button primary" :disabled="isBusy || !canAttack">
          {{ attackLabel }}
        </button>
        <button @click="handleDefend" class="action-button" :disabled="isBusy">Defend</button>
        <button @click="handleFlee" class="action-button danger" :disabled="isBusy">Flee</button>
      </div>

      <div class="skill-buttons">
        <button
          v-for="skill in skills"
          :key="skill.action"
          @click="handleSkill(skill.action)"
          class="action-button skill"
          :disabled="isBusy || player.energy < skill.cost"
          :title="skill.description"
        >
          {{ skill.label }} ({{ skill.cost }}⚡)
        </button>
      </div>

      <div v-if="consumables.length > 0" class="item-buttons">
        <button
          v-for="item in consumables"
          :key="item.templateId"
          @click="handleUseItem(item.templateId)"
          class="action-button item-btn"
          :disabled="isBusy"
        >
          {{ getItemName(item.templateId) }} (x{{ item.quantity }})
        </button>
      </div>
    </div>

    <div v-if="actionLog.length > 0" class="action-log">
      <div
        v-for="(entry, index) in actionLog"
        :key="index"
        :class="['action-log-entry', entry.type, { crit: entry.crit }]"
      >
        {{ entry.message }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject, computed, ref, watch } from 'vue'
import type { Ref } from 'vue'
import type { GameState, PlayerAction, CombatEvent, Enemy } from '@/engine/GameLoopDesign'
import { playerAction } from '@/engine/GameLoop'
import { getItemName, getItemTemplate } from '@/engine/ItemDatabase'
import { getAllSkills } from '@/engine/SkillSystem'

const gameState = inject<Ref<GameState>>('gameState')!
const dispatch = inject<(state: GameState) => void>('dispatch')!

const encounter = computed(() => gameState.value.currentEncounter)
const player = computed(() => gameState.value.player)
const enemies = computed(() => encounter.value?.enemies || [])
const aliveEnemies = computed(() => enemies.value.filter((e) => e.hp > 0))
const playerHpPct = computed(() => (player.value.hp / player.value.maxHp) * 100)
const playerPoisoned = computed(() => player.value.statusEffects?.some((s) => s.type === 'poison'))
const playerStunned = computed(() => player.value.statusEffects?.some((s) => s.type === 'stun'))

interface LogEntry {
  message: string
  type: 'player' | 'enemy' | 'system'
  crit?: boolean
}

const actionLog = ref<LogEntry[]>([])
const isBusy = ref(false)
const selectedTarget = ref<string | null>(null)

const knownSkillIds = computed(() => new Set(player.value.knownSkills ?? []))

const skills = computed(() =>
  getAllSkills()
    .filter((s) => s.action && knownSkillIds.value.has(s.id))
    .map((s) => ({
      action: s.action as PlayerAction,
      label: s.name,
      cost: s.energyCost,
      description: s.description,
    }))
)

const consumables = computed(() =>
  player.value.inventory.filter((i) => {
    const t = getItemTemplate(i.templateId)
    return t?.type === 'consumable' && i.quantity > 0
  })
)

const canAttack = computed(() => {
  if (aliveEnemies.value.length === 0) return false
  if (aliveEnemies.value.length === 1) return true
  return !!selectedTarget.value
})

const attackLabel = computed(() => {
  if (isBusy.value) return 'Resolving...'
  if (aliveEnemies.value.length === 1) return 'Attack'
  if (selectedTarget.value) {
    const name = enemies.value.find((e) => e.id === selectedTarget.value)?.name
    return `Attack ${name}`
  }
  return 'Select target'
})

watch(() => encounter.value?.id, () => {
  actionLog.value = []
  isBusy.value = false
  selectedTarget.value = null
  if (aliveEnemies.value.length === 1 && aliveEnemies.value[0]) {
    selectedTarget.value = aliveEnemies.value[0].id
  }
}, { immediate: true })

function hasPoison(enemy: Enemy) {
  return enemy.statusEffects?.some((s) => s.type === 'poison')
}

function selectEnemyTarget(enemyId: string) {
  if (isBusy.value || aliveEnemies.value.length <= 1) return
  selectedTarget.value = selectedTarget.value === enemyId ? null : enemyId
}

function classifyEvent(event: CombatEvent): LogEntry['type'] {
  if (event.source === player.value.id) return 'player'
  if (event.source === 'status') return 'system'
  return 'enemy'
}

function displayEvents(events: CombatEvent[], delay = 0) {
  events.forEach((event, i) => {
    setTimeout(() => {
      actionLog.value.unshift({
        message: event.message,
        type: classifyEvent(event),
        crit: event.crit,
      })
      if (actionLog.value.length > 12) actionLog.value = actionLog.value.slice(0, 12)
      if (i === events.length - 1) {
        setTimeout(() => { isBusy.value = false }, 200)
      }
    }, delay + i * 300)
  })
  if (events.length === 0) isBusy.value = false
}

function runAction(action: PlayerAction, options: { targetId?: string; itemId?: string } = {}) {
  if (isBusy.value) return
  isBusy.value = true

  const prevPhase = gameState.value.phase
  const newState = playerAction(gameState.value, action, options)

  const events = newState.combatResults?.events ?? newState.currentEncounter?.lastEvents ?? []

  if (newState.phase !== prevPhase) {
    dispatch(newState)
    if (events.length) displayEvents(events)
    else isBusy.value = false
    return
  }

  dispatch(newState)
  displayEvents(events)
  selectedTarget.value = null
  if (aliveEnemies.value.length === 1 && aliveEnemies.value[0]) {
    selectedTarget.value = aliveEnemies.value[0].id
  }
}

function handleAttack() {
  const targetId = selectedTarget.value || aliveEnemies.value[0]?.id
  if (!targetId) return
  runAction('attack', { targetId })
}

function handleDefend() {
  runAction('defend')
}

function handleFlee() {
  runAction('flee')
}

function handleSkill(action: PlayerAction) {
  const targetId = selectedTarget.value || aliveEnemies.value[0]?.id
  runAction(action, { targetId })
}

function handleUseItem(templateId: string) {
  runAction('use_item', { itemId: templateId })
}
</script>

<style scoped>
.encounter-screen {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.encounter-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 16px;
  background: var(--color-panel);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-danger);
}

.encounter-header h1 {
  font-size: 22px;
  margin: 0;
  color: var(--color-danger-bright);
  font-family: var(--font-display);
}

.status-badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}
.status-badge.poison { background: #4a2a4a; color: #ce93d8; }
.status-badge.stun { background: #4a4a2a; color: #ffd54f; }

.player-combat-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #1a2a1a;
  border-radius: 8px;
  border-left: 4px solid #4caf50;
}

.energy-text { color: #ce93d8; font-weight: 600; }

.enemy-list { background: #2a2a2a; padding: 16px; border-radius: 8px; }

.enemy-card {
  padding: 12px;
  margin-bottom: 8px;
  background: #1a1a1a;
  border-radius: 6px;
  border-left: 4px solid #ff4444;
  transition: all 0.2s;
}
.enemy-card.clickable { cursor: pointer; }
.enemy-card.clickable:hover { background: #2a2a2a; transform: translateX(4px); }
.enemy-card.selected-target {
  background: #2a4a2a;
  border-left-color: #4caf50;
  box-shadow: 0 0 8px rgba(76, 175, 80, 0.3);
}

.enemy-name {
  font-weight: 600;
  color: #fff;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.boss-tag {
  background: #ff4444;
  color: #fff;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
}

.enemy-hp { display: flex; align-items: center; gap: 12px; }
.hp-bar {
  flex: 1;
  height: 20px;
  background: #1a1a1a;
  border: 1px solid #444;
  border-radius: 4px;
  overflow: hidden;
}
.hp-fill { height: 100%; transition: width 0.4s ease; }
.hp-fill.player-hp { background: #4caf50; }
.hp-fill.enemy-hp { background: #f44336; }
.hp-text { font-size: 13px; color: #aaa; min-width: 90px; font-weight: 600; }
.enemy-status { font-size: 12px; color: #ce93d8; margin-top: 4px; }

.combat-actions { background: #2a2a2a; padding: 16px; border-radius: 8px; display: flex; flex-direction: column; gap: 12px; }

.action-buttons, .skill-buttons, .item-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}

.action-button {
  padding: 10px 18px;
  font-size: 14px;
  font-weight: 600;
  background: #3a3a3a;
  color: #fff;
  border: 2px solid #555;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}
.action-button:hover:not(:disabled) { background: #4a4a4a; }
.action-button.primary { background: #4caf50; border-color: #66bb6a; }
.action-button.danger { background: #f44336; border-color: #ef5350; }
.action-button.skill { background: #5c3d8a; border-color: #7b52b8; }
.action-button.item-btn { background: #2a4a5a; border-color: #3a6a7a; }
.action-button:disabled { opacity: 0.5; cursor: not-allowed; }

.action-log {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 220px;
  overflow-y: auto;
  padding: 12px;
  background: #1a1a1a;
  border-radius: 8px;
  border: 1px solid #444;
}

.action-log-entry {
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 14px;
  animation: slideIn 0.3s ease;
}
.action-log-entry.player { background: #2a4a2a; color: #4caf50; border-left: 3px solid #4caf50; }
.action-log-entry.enemy { background: #4a2a2a; color: #ff6666; border-left: 3px solid #ff4444; }
.action-log-entry.system { background: #3a3a2a; color: #ffd54f; border-left: 3px solid #ffd54f; }
.action-log-entry.crit { font-weight: 700; text-shadow: 0 0 6px rgba(255, 215, 0, 0.5); }

@keyframes slideIn {
  from { opacity: 0; transform: translateX(-10px); }
  to { opacity: 1; transform: translateX(0); }
}
</style>
