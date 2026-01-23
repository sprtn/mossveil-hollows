<template>
  <header class="game-header">
    <div class="stat-group">
      <span class="stat-label">HP:</span>
      <div class="hp-bar">
        <div 
          class="hp-fill" 
          :style="{ width: `${hpPercent}%`, backgroundColor: hpColor }"
        ></div>
      </div>
      <span class="stat-value">{{ player.hp }}/{{ player.maxHp }}</span>
    </div>
    
    <div class="stat-group">
      <span class="stat-label">Level:</span>
      <span class="stat-value">{{ player.level }}</span>
      <div class="xp-bar">
        <div 
          class="xp-fill" 
          :style="{ width: `${xpPercent}%` }"
        ></div>
      </div>
      <span class="xp-text">{{ xpCurrent }} / {{ xpNext }}</span>
    </div>
    
    <button @click="openPlayerScreen" class="player-button">
      Player
    </button>
  </header>
</template>

<script setup lang="ts">
import { inject, computed } from 'vue'
import type { Ref } from 'vue'
import type { GameState } from '@/engine/GameLoopDesign'
import { getXpForNextLevel, LEVEL_XP_REQUIREMENTS, MAX_LEVEL } from '@/engine/ProgressionSystem'

const gameState = inject<Ref<GameState>>('gameState')!
const setPlayerScreenOpen = inject<(open: boolean) => void>('setPlayerScreenOpen')!

const player = computed(() => gameState.value.player)

const hpPercent = computed(() => {
  return (player.value.hp / player.value.maxHp) * 100
})

const hpColor = computed(() => {
  const percent = hpPercent.value
  if (percent > 60) return '#4caf50' // Green
  if (percent > 30) return '#ff9800' // Orange
  return '#f44336' // Red
})

const xpCurrent = computed(() => {
  const level = player.value.level
  const currentXp = player.value.xp
  const xpForCurrentLevel = LEVEL_XP_REQUIREMENTS[level] || 0
  return currentXp - xpForCurrentLevel
})

const xpNext = computed(() => {
  const level = player.value.level
  if (level >= MAX_LEVEL) return 0
  const xpForCurrentLevel = LEVEL_XP_REQUIREMENTS[level] || 0
  const xpForNextLevel = getXpForNextLevel(level)
  return xpForNextLevel - xpForCurrentLevel
})

const xpPercent = computed(() => {
  if (xpNext.value === 0) return 100 // Max level
  if (xpNext.value === Infinity) return 0 // Edge case
  return (xpCurrent.value / xpNext.value) * 100
})

function openPlayerScreen() {
  setPlayerScreenOpen(true)
}
</script>

<style scoped>
.game-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 24px;
  background-color: #2a2a2a;
  color: #ffffff;
  border-bottom: 2px solid #444;
  font-size: 14px;
}

.stat-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stat-label {
  font-weight: 600;
  color: #aaa;
}

.stat-value {
  font-weight: 700;
  min-width: 60px;
}

.hp-bar {
  width: 200px;
  height: 20px;
  background-color: #1a1a1a;
  border: 1px solid #444;
  border-radius: 4px;
  overflow: hidden;
  position: relative;
}

.hp-fill {
  height: 100%;
  transition: width 0.3s ease, background-color 0.3s ease;
}

.xp-bar {
  width: 150px;
  height: 16px;
  background-color: #1a1a1a;
  border: 1px solid #444;
  border-radius: 4px;
  overflow: hidden;
  position: relative;
}

.xp-fill {
  height: 100%;
  background-color: #2196f3;
  transition: width 0.3s ease;
}

.xp-text {
  font-size: 12px;
  color: #aaa;
  min-width: 80px;
  font-weight: 600;
}

.player-button {
  padding: 8px 16px;
  background-color: #3a3a3a;
  color: #ffffff;
  border: 2px solid #555;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  font-size: 14px;
  transition: all 0.2s;
}

.player-button:hover {
  background-color: #4a4a4a;
  border-color: #666;
}
</style>
