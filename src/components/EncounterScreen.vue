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

    <div v-if="activeBuffs.length > 0 || secondWindStatus" class="combat-status-row">
      <div v-for="buff in activeBuffs" :key="buff.id" class="status-badge buff">
        {{ buff.label }}
      </div>
      <div v-if="secondWindStatus === 'ready'" class="status-badge second-wind" title="Passive: auto-revives you once per expedition when reduced to 0 HP">
        Second Wind ready
      </div>
      <div v-else-if="secondWindStatus === 'used'" class="status-badge second-wind used">
        Second Wind spent
      </div>
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
      <div v-if="consumables.length > 0" class="action-tabs">
        <button
          :class="['tab-btn', { active: activeTab === 'main' }]"
          @click="activeTab = 'main'"
        >Actions</button>
        <button
          :class="['tab-btn', { active: activeTab === 'consumables' }]"
          @click="activeTab = 'consumables'"
        >Consumables</button>
      </div>

      <p v-if="consumableUsedThisTurn" class="consumable-hint">Consumable used this turn — take your action.</p>
      <p v-else-if="activeTab === 'consumables'" class="consumable-hint">Use one consumable, then attack, skill, or defend.</p>

      <div v-show="activeTab === 'main'" class="action-buttons">
        <button @click="handleAttack" class="action-button primary" :disabled="isBusy || !canAttack">
          {{ attackLabel }}
        </button>
        <button @click="handleDefend" class="action-button" :disabled="isBusy">Defend</button>
        <button @click="handleFlee" class="action-button danger" :disabled="isBusy">Flee</button>
        <button
          v-for="skill in skills"
          :key="skill.id"
          @click="handleSkill(skill.id)"
          class="action-button skill"
          :disabled="isBusy || player.energy < skill.cost"
          :title="skill.description"
        >
          {{ skill.label }} ({{ skill.cost }}⚡)
        </button>
      </div>

      <div v-show="activeTab === 'consumables'" class="item-buttons">
        <button
          v-for="item in consumables"
          :key="`${item.templateId}::${item.quality}`"
          @click="handleUseConsumable(item)"
          class="action-button item-btn"
          :disabled="consumableUsedThisTurn"
          :title="consumableDescription(item)"
        >
          <span :style="{ color: qualityColor(item.quality) }">
            {{ formatItemName(getItemName(item.templateId), item.quality) }}
          </span>
          (x{{ item.quantity }})
        </button>
      </div>
    </div>

    <div v-if="pinnedPlayerLines.length > 0 || actionLog.length > 0" class="action-log">
      <div
        v-for="(entry, index) in pinnedPlayerLines"
        :key="`pin-${index}`"
        :class="['action-log-entry', 'player', 'pinned', { crit: entry.crit }]"
      >
        {{ entry.message }}
      </div>
      <div
        v-for="(entry, index) in actionLog"
        :key="`log-${index}`"
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
import type { GameState, PlayerAction, CombatEvent, Enemy, InventoryItem } from '@/engine/GameLoopDesign'
import { playerAction, useCombatConsumable } from '@/engine/GameLoop'
import { getItemName, getItemTemplate } from '@/engine/ItemDatabase'
import { getActivatableCombatSkills } from '@/engine/SkillSystem'
import { formatItemName, itemStatSummary, qualityColor } from '@/utils/icons'
import {
  classifyCombatEvent,
  combatEventsToPinnedEntries,
  partitionCombatEvents,
  trimCombatLog,
  type CombatLogEntry,
} from '@/utils/combatLog'

const gameState = inject<Ref<GameState>>('gameState')!
const dispatch = inject<(state: GameState) => void>('dispatch')!

const encounter = computed(() => gameState.value.currentEncounter)
const player = computed(() => gameState.value.player)
const enemies = computed(() => encounter.value?.enemies || [])
const aliveEnemies = computed(() => enemies.value.filter((e) => e.hp > 0))
const playerHpPct = computed(() => (player.value.hp / player.value.maxHp) * 100)
const playerPoisoned = computed(() => player.value.statusEffects?.some((s) => s.type === 'poison'))
const playerStunned = computed(() => player.value.statusEffects?.some((s) => s.type === 'stun'))

interface LogEntry extends CombatLogEntry {}

const actionLog = ref<LogEntry[]>([])
const pinnedPlayerLines = ref<LogEntry[]>([])
const isBusy = ref(false)
const selectedTarget = ref<string | null>(null)
const activeTab = ref<'main' | 'consumables'>('main')

const activeBuffs = computed(() => encounter.value?.combatBuffs ?? [])
const consumableUsedThisTurn = computed(() => encounter.value?.consumableUsedThisTurn ?? false)

const knowsSecondWind = computed(() =>
  (player.value.knownSkills ?? []).includes('skill_second_wind')
)
const secondWindUsed = computed(() => gameState.value.flags?.second_wind_used ?? false)
const secondWindStatus = computed<'ready' | 'used' | null>(() => {
  if (!knowsSecondWind.value) return null
  return secondWindUsed.value ? 'used' : 'ready'
})

const skills = computed(() =>
  getActivatableCombatSkills(gameState.value).map((s) => ({
    id: s.id,
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
  pinnedPlayerLines.value = []
  isBusy.value = false
  selectedTarget.value = null
  activeTab.value = 'main'
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

function consumableDescription(item: InventoryItem): string {
  const t = getItemTemplate(item.templateId)
  const stats = itemStatSummary(t, item.quality)
  return stats ? `${t?.description ?? ''} — ${stats}` : (t?.description ?? '')
}

function logConsumableEvent(message: string) {
  pinnedPlayerLines.value = [{ message, type: 'player', pinned: true }]
  actionLog.value = trimCombatLog(actionLog.value)
}

function classifyEvent(event: CombatEvent): LogEntry['type'] {
  return classifyCombatEvent(event, player.value.id)
}

/** Animate enemy/system lines only — input readiness is not tied to these timers. */
function displayEvents(events: CombatEvent[]) {
  const playerId = player.value.id
  const { playerEvents, otherEvents } = partitionCombatEvents(events, playerId)

  // Pin player-authored lines for this turn so enemy flood cannot bury them.
  if (playerEvents.length > 0) {
    pinnedPlayerLines.value = combatEventsToPinnedEntries(playerEvents)
  }

  otherEvents.forEach((event, i) => {
    setTimeout(() => {
      actionLog.value.unshift({
        message: event.message,
        type: classifyEvent(event),
        crit: event.crit,
      })
      actionLog.value = trimCombatLog(actionLog.value)
    }, i * 150)
  })
}

function runAction(action: PlayerAction, options: { targetId?: string; itemId?: string; skillId?: string } = {}) {
  if (isBusy.value) return
  isBusy.value = true

  const prevPhase = gameState.value.phase
  try {
    const newState = playerAction(gameState.value, action, options)
    const events = newState.combatResults?.events ?? newState.currentEncounter?.lastEvents ?? []

    dispatch(newState)

    if (events.length) {
      displayEvents(events)
    }

    if (newState.phase === 'encounter_action') {
      selectedTarget.value = null
      if (aliveEnemies.value.length === 1 && aliveEnemies.value[0]) {
        selectedTarget.value = aliveEnemies.value[0].id
      }
    }

    if (newState.phase !== prevPhase) {
      return
    }
  } catch (err) {
    console.error('Combat action failed:', err)
  } finally {
    // Engine resolve is synchronous — re-enable input immediately, not when log animation ends.
    isBusy.value = false
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

function handleSkill(skillId: string) {
  const skill = getActivatableCombatSkills(gameState.value).find((s) => s.id === skillId)
  const needsTarget =
    skill?.combat?.targetMode === 'single_enemy' ||
    skill?.combat?.targetMode === 'all_enemies_single_roll'
  const targetId = needsTarget ? selectedTarget.value || aliveEnemies.value[0]?.id : undefined
  runAction('use_skill', { skillId, targetId })
}

function handleUseConsumable(item: InventoryItem) {
  if (consumableUsedThisTurn.value) return
  const newState = useCombatConsumable(gameState.value, item.templateId, item.quality)
  if (newState === gameState.value) return
  const events = newState.currentEncounter?.lastEvents ?? []
  dispatch(newState)
  for (const event of events) {
    logConsumableEvent(event.message)
  }
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
.status-badge.buff { background: #2a3a4a; color: #81d4fa; border: 1px solid #4fc3f7; }
.status-badge.second-wind { background: #2a3a2a; color: #a5d6a7; border: 1px solid #66bb6a; }
.status-badge.second-wind.used { background: #2a2a2a; color: #888; border-color: #555; }

.combat-status-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
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

.action-tabs {
  display: flex;
  gap: 4px;
  justify-content: center;
  margin-bottom: 4px;
}

.tab-btn {
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  background: #1a1a1a;
  color: #aaa;
  border: 1px solid #444;
  border-radius: 6px 6px 0 0;
  cursor: pointer;
}
.tab-btn.active {
  background: #3a3a3a;
  color: #fff;
  border-bottom-color: #3a3a3a;
}

.consumable-hint {
  margin: 0;
  text-align: center;
  font-size: 12px;
  color: #aaa;
}

.player-combat-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #1a2a1a;
  border-radius: 8px;
  border-left: 4px solid #4caf50;
}

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
.action-log-entry.player.pinned { box-shadow: 0 0 0 1px rgba(76, 175, 80, 0.35); }
.action-log-entry.enemy { background: #4a2a2a; color: #ff6666; border-left: 3px solid #ff4444; }
.action-log-entry.system { background: #3a3a2a; color: #ffd54f; border-left: 3px solid #ffd54f; }
.action-log-entry.crit { font-weight: 700; text-shadow: 0 0 6px rgba(255, 215, 0, 0.5); }

@keyframes slideIn {
  from { opacity: 0; transform: translateX(-10px); }
  to { opacity: 1; transform: translateX(0); }
}
</style>
