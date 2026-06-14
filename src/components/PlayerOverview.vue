<template>
  <div class="overview-section">
    <h3 class="section-title">Overview</h3>

    <div class="overview-content">
      <div class="player-name">{{ player.name }}</div>

      <div class="vitals-row">
        <span>{{ resourceIcons.hp }} Lv {{ player.level }}</span>
        <span>{{ resourceIcons.gold }} {{ player.gold }}g</span>
        <span>{{ resourceIcons.energy }} {{ player.energy }}/{{ player.maxEnergy }}</span>
      </div>

      <div class="stat-row">
        <span class="stat-label">{{ resourceIcons.hp }} HP</span>
        <div class="hp-display">
          <div class="hp-bar">
            <div class="hp-fill" :style="{ width: `${hpPercent}%`, backgroundColor: hpColor }"></div>
          </div>
          <span class="hp-text">{{ player.hp }} / {{ player.maxHp }}</span>
        </div>
      </div>

      <div v-if="unallocatedPoints > 0" class="attribute-points-banner">
        <span>+{{ unallocatedPoints }} attribute points</span>
      </div>

      <div class="stats-grid">
        <div
          v-for="stat in statKeys"
          :key="stat"
          class="stat-item"
          @mouseenter="showTooltip($event, stat)"
          @mouseleave="hideTooltip"
        >
          <div class="stat-header">
            <span class="stat-label">{{ statIcons[stat] }} {{ statLabel(stat) }}</span>
            <button
              v-if="unallocatedPoints > 0"
              @click="allocatePoint(stat)"
              class="allocate-button"
            >+</button>
          </div>
          <span class="stat-value">{{ player.stats[stat] }}</span>
          <span v-if="derived(stat)" class="stat-derived">{{ derived(stat) }}</span>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="tooltipVisible" class="tooltip" :style="tooltipStyle">
        {{ tooltipText }}
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { inject, computed, ref } from 'vue'
import { Teleport } from 'vue'
import type { Ref } from 'vue'
import type { GameState, PlayerStatKey } from '@/engine/GameLoopDesign'
import { allocateAttributePoint } from '@/engine/GameLoop'
import { getEffectiveStats } from '@/engine/ItemDatabase'
import { derivedStatText, derivedStatProjection } from '@/engine/statDisplay'
import { resourceIcons, statIcons, statDescriptions } from '@/utils/icons'

const gameState = inject<Ref<GameState>>('gameState')!
const dispatch = inject<(state: GameState) => void>('dispatch')!

const player = computed(() => gameState.value.player)
const effectiveStats = computed(() => getEffectiveStats(player.value))
const unallocatedPoints = computed(() => player.value.unallocatedAttributePoints || 0)
const statKeys: PlayerStatKey[] = ['strength', 'constitution', 'dexterity', 'agility', 'defense']

const hpPercent = computed(() => (player.value.hp / player.value.maxHp) * 100)
const hpColor = computed(() => {
  const p = hpPercent.value
  if (p > 60) return '#4caf50'
  if (p > 30) return '#ff9800'
  return '#f44336'
})

const tooltipVisible = ref(false)
const tooltipText = ref('')
const tooltipStyle = ref({ top: '0px', left: '0px' })

function statLabel(stat: PlayerStatKey): string {
  return stat.charAt(0).toUpperCase() + stat.slice(1)
}

function derived(stat: PlayerStatKey): string {
  return derivedStatText(stat, effectiveStats.value[stat])
}

function showTooltip(event: MouseEvent, stat: PlayerStatKey) {
  const projection = derivedStatProjection(stat, effectiveStats.value[stat])
  tooltipText.value = statDescriptions[stat] + (projection ? `\n${projection}` : '')
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  tooltipStyle.value = { top: `${rect.top - 50}px`, left: `${rect.left}px` }
  tooltipVisible.value = true
}

function hideTooltip() {
  tooltipVisible.value = false
}

function allocatePoint(stat: PlayerStatKey) {
  dispatch(allocateAttributePoint(gameState.value, stat))
}
</script>

<style scoped>
.overview-section { background: #1a1a1a; padding: 20px; border-radius: 8px; border-left: 4px solid #4caf50; }
.section-title { margin: 0 0 16px; font-size: 18px; color: #4caf50; border-bottom: 2px solid #4caf50; padding-bottom: 8px; }
.overview-content { display: flex; flex-direction: column; gap: 12px; }
.player-name { font-size: 22px; font-weight: 700; color: #fff; }
.vitals-row { display: flex; gap: 16px; font-size: 13px; color: #aaa; }
.stat-row { display: flex; align-items: center; gap: 12px; }
.stat-label { color: #aaa; font-weight: 600; min-width: 60px; }
.hp-display { display: flex; align-items: center; gap: 12px; flex: 1; }
.hp-bar { flex: 1; height: 20px; background: #1a1a1a; border: 1px solid #444; border-radius: 4px; overflow: hidden; max-width: 280px; }
.hp-fill { height: 100%; transition: width 0.3s; }
.hp-text { color: #aaa; font-size: 13px; }
.stats-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
.stat-item { padding: 10px; background: #2a2a2a; border-radius: 6px; cursor: help; }
.stat-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.stat-item .stat-label { font-size: 11px; color: #888; min-width: auto; }
.stat-item .stat-value { font-size: 18px; color: #fff; font-weight: 700; }
.stat-item .stat-derived { display: block; margin-top: 4px; font-size: 10px; color: #8fbf7a; font-weight: 600; }
.allocate-button { background: #4caf50; color: #fff; border: none; border-radius: 4px; width: 22px; height: 22px; cursor: pointer; }
.attribute-points-banner { padding: 10px; background: #2a4a2a; border: 2px solid #4caf50; border-radius: 6px; color: #4caf50; font-weight: 600; }
.tooltip { position: fixed; padding: 8px 12px; background: #1a1a1a; color: #fff; font-size: 11px; line-height: 1.4; white-space: pre-line; border: 1px solid #444; border-radius: 4px; max-width: 240px; z-index: 10000; pointer-events: none; }
</style>
