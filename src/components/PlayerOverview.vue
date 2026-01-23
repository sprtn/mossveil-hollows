<template>
  <div class="overview-section">
    <h3 class="section-title">Overview</h3>
    
    <div class="overview-content">
      <div class="player-name">{{ player.name }}</div>
      
      <div class="stat-row">
        <span class="stat-label">Level:</span>
        <span class="stat-value">{{ player.level }}</span>
      </div>
      
      <div class="stat-row">
        <span class="stat-label">HP:</span>
        <div class="hp-display">
          <div class="hp-bar">
            <div 
              class="hp-fill" 
              :style="{ width: `${hpPercent}%`, backgroundColor: hpColor }"
            ></div>
          </div>
          <span class="hp-text">{{ player.hp }} / {{ player.maxHp }}</span>
        </div>
      </div>
      
      <div class="stat-row">
        <span class="stat-label">XP:</span>
        <span class="stat-value">{{ player.xp }}</span>
      </div>
      
      <div v-if="unallocatedPoints > 0" class="attribute-points-banner">
        <span class="points-label">Unallocated Attribute Points:</span>
        <span class="points-value">{{ unallocatedPoints }}</span>
      </div>
      
      <div class="stats-grid">
        <div class="stat-item" @mouseenter="showTooltip($event, 'strength')" @mouseleave="hideTooltip">
          <div class="stat-header">
            <span class="stat-label">
              Strength:
              <span class="tooltip-trigger">ℹ️</span>
            </span>
            <button
              v-if="unallocatedPoints > 0"
              @click="allocatePoint('strength')"
              class="allocate-button"
              title="Allocate 1 attribute point to Strength"
            >
              +
            </button>
          </div>
          <span class="stat-value">{{ player.stats.strength }}</span>
        </div>
        <div class="stat-item" @mouseenter="showTooltip($event, 'defense')" @mouseleave="hideTooltip">
          <div class="stat-header">
            <span class="stat-label">
              Defense:
              <span class="tooltip-trigger">ℹ️</span>
            </span>
            <button
              v-if="unallocatedPoints > 0"
              @click="allocatePoint('defense')"
              class="allocate-button"
              title="Allocate 1 attribute point to Defense"
            >
              +
            </button>
          </div>
          <span class="stat-value">{{ player.stats.defense }}</span>
        </div>
        <div class="stat-item" @mouseenter="showTooltip($event, 'speed')" @mouseleave="hideTooltip">
          <div class="stat-header">
            <span class="stat-label">
              Speed:
              <span class="tooltip-trigger">ℹ️</span>
            </span>
            <button
              v-if="unallocatedPoints > 0"
              @click="allocatePoint('speed')"
              class="allocate-button"
              title="Allocate 1 attribute point to Speed"
            >
              +
            </button>
          </div>
          <span class="stat-value">{{ player.stats.speed }}</span>
        </div>
      </div>
    </div>
    
    <!-- Tooltip rendered outside modal bounds -->
    <Teleport to="body">
      <div 
        v-if="tooltipVisible" 
        class="tooltip" 
        :style="tooltipStyle"
      >
        {{ tooltipText }}
        <span class="tooltip-arrow"></span>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { inject, computed, ref } from 'vue'
import { Teleport } from 'vue'
import type { Ref } from 'vue'
import type { GameState } from '@/engine/GameLoopDesign'
import { allocateAttributePoint } from '@/engine/GameLoop'

const gameState = inject<Ref<GameState>>('gameState')!
const dispatch = inject<(state: GameState) => void>('dispatch')!

const player = computed(() => gameState.value.player)

const unallocatedPoints = computed(() => player.value.unallocatedAttributePoints || 0)

const hpPercent = computed(() => {
  return (player.value.hp / player.value.maxHp) * 100
})

const hpColor = computed(() => {
  const percent = hpPercent.value
  if (percent > 60) return '#4caf50' // Green
  if (percent > 30) return '#ff9800' // Orange
  return '#f44336' // Red
})

const tooltipVisible = ref(false)
const tooltipText = ref('')
const tooltipStyle = ref({ top: '0px', left: '0px' })

const tooltipDescriptions: Record<string, string> = {
  strength: 'Increases damage dealt when attacking enemies. Each point adds 1 to your base attack damage.',
  defense: 'Reduces damage taken from enemy attacks. Each point reduces incoming damage by 1.',
  speed: 'Reserved for future turn order mechanics. Currently has no effect in combat.',
}

function showTooltip(event: MouseEvent, stat: string) {
  tooltipText.value = tooltipDescriptions[stat] || ''
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const tooltipWidth = 250
  const tooltipHeight = 60 // Approximate height
  const spacing = 8
  
  // Position above the element, centered
  let left = rect.left + rect.width / 2 - tooltipWidth / 2
  let top = rect.top - tooltipHeight - spacing
  
  // Adjust if tooltip would go off screen
  if (left < 10) {
    left = 10
  } else if (left + tooltipWidth > window.innerWidth - 10) {
    left = window.innerWidth - tooltipWidth - 10
  }
  
  // If tooltip would go above viewport, position below instead
  if (top < 10) {
    top = rect.bottom + spacing
  }
  
  tooltipStyle.value = {
    top: `${top}px`,
    left: `${left}px`,
  }
  tooltipVisible.value = true
}

function hideTooltip() {
  tooltipVisible.value = false
}

function allocatePoint(stat: 'strength' | 'defense' | 'speed') {
  const newState = allocateAttributePoint(gameState.value, stat)
  dispatch(newState)
}
</script>

<style scoped>
.overview-section {
  background-color: #1a1a1a;
  padding: 20px;
  border-radius: 8px;
  border-left: 4px solid #4caf50;
  overflow: visible;
}

.section-title {
  margin: 0 0 16px 0;
  font-size: 18px;
  color: #4caf50;
  border-bottom: 2px solid #4caf50;
  padding-bottom: 8px;
}

.overview-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.player-name {
  font-size: 24px;
  font-weight: 700;
  color: #ffffff;
  margin-bottom: 8px;
}

.stat-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.stat-label {
  color: #aaa;
  font-weight: 600;
  min-width: 80px;
}

.stat-value {
  color: #ffffff;
  font-weight: 700;
}

.hp-display {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.hp-bar {
  flex: 1;
  height: 24px;
  background-color: #1a1a1a;
  border: 1px solid #444;
  border-radius: 4px;
  overflow: hidden;
  max-width: 300px;
}

.hp-fill {
  height: 100%;
  transition: width 0.3s ease, background-color 0.3s ease;
}

.hp-text {
  color: #aaa;
  font-weight: 600;
  min-width: 100px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-top: 8px;
  overflow: visible;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  background-color: #2a2a2a;
  border-radius: 6px;
  position: relative;
  cursor: help;
}

.stat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-item .stat-label {
  font-size: 12px;
  color: #888;
  min-width: auto;
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
}

.tooltip-trigger {
  font-size: 10px;
  color: #666;
  cursor: help;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.stat-item:hover .tooltip-trigger {
  opacity: 1;
}

.tooltip {
  position: fixed;
  padding: 8px 12px;
  background-color: #1a1a1a;
  color: #ffffff;
  font-size: 11px;
  line-height: 1.4;
  border: 1px solid #444;
  border-radius: 4px;
  max-width: 250px;
  width: max-content;
  white-space: normal;
  z-index: 10000;
  pointer-events: none;
  transition: opacity 0.2s;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.5);
}

.tooltip-arrow {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border: 6px solid transparent;
  border-top-color: #1a1a1a;
}

/* Prevent tooltip from being cut off */
.stat-item {
  overflow: visible;
}

.stat-item .stat-value {
  font-size: 20px;
  color: #ffffff;
}

.allocate-button {
  background-color: #4caf50;
  color: #ffffff;
  border: none;
  border-radius: 4px;
  width: 24px;
  height: 24px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

.allocate-button:hover {
  background-color: #45a049;
}

.allocate-button:active {
  background-color: #3d8b40;
}

.attribute-points-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background-color: #2a4a2a;
  border: 2px solid #4caf50;
  border-radius: 6px;
  margin-top: 8px;
}

.points-label {
  color: #aaa;
  font-weight: 600;
}

.points-value {
  color: #4caf50;
  font-weight: 700;
  font-size: 18px;
}
</style>
