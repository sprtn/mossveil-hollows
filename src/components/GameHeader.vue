<template>
  <header class="game-header">
    <div class="stat-group">
      <span class="stat-label">{{ resourceIcons.hp }}</span>
      <div class="hp-bar">
        <div
          class="hp-fill"
          :style="{ width: `${hpPercent}%`, backgroundColor: hpColor }"
        ></div>
      </div>
      <span class="stat-value">{{ player.hp }}/{{ player.maxHp }}</span>
    </div>

    <div class="stat-group">
      <span class="stat-label">{{ resourceIcons.energy }}</span>
      <div class="energy-bar">
        <div class="energy-fill" :style="{ width: `${energyPercent}%` }"></div>
      </div>
      <span class="stat-value">{{ player.energy }}/{{ player.maxEnergy }}</span>
    </div>

    <div class="stat-group">
      <span class="stat-label">{{ resourceIcons.stamina }}</span>
      <div class="stamina-bar">
        <div class="stamina-fill" :style="{ width: `${staminaPercent}%` }"></div>
      </div>
      <span class="stat-value">{{ player.stamina }}/{{ player.maxStamina }}</span>
    </div>

    <div class="stat-group">
      <span class="stat-label">Lv:</span>
      <span class="stat-value">{{ player.level }}</span>
      <div class="xp-bar">
        <div class="xp-fill" :style="{ width: `${xpPercent}%` }"></div>
      </div>
    </div>

    <div class="stat-group gold">
      <span>{{ resourceIcons.gold }}</span>
      <span class="stat-value">{{ player.gold }}</span>
    </div>

    <button @click="openPlayerScreen" class="player-button btn">Character</button>

    <div class="audio-controls">
      <div class="mute-toggle">
        <button
          class="audio-btn"
          :class="{ active: !audioMuted }"
          title="Sound on"
          @click="unmute"
        >🔊</button>
        <button
          class="audio-btn"
          :class="{ active: audioMuted }"
          title="Mute"
          @click="mute"
        >🔇</button>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        :value="audioVolume * 100"
        class="volume-slider"
        :class="{ muted: audioMuted }"
        title="Volume"
        @input="setVolume"
      />
    </div>
  </header>
</template>

<script setup lang="ts">
import { inject, computed, ref } from 'vue'
import type { Ref } from 'vue'
import type { GameState } from '@/engine/GameLoopDesign'
import { getXpForNextLevel, LEVEL_XP_REQUIREMENTS, MAX_LEVEL } from '@/engine/ProgressionSystem'
import { resourceIcons } from '@/utils/icons'
import { audioManager } from '@/engine/AudioManager'

const gameState = inject<Ref<GameState>>('gameState')!
const setPlayerScreenOpen = inject<(open: boolean) => void>('setPlayerScreenOpen')!
const unlockAudio = inject<(() => void) | undefined>('unlockAudio', undefined)

// Local reactive mirrors of the (non-reactive) audio manager state.
const audioMuted = ref(audioManager.muted)
const audioVolume = ref(audioManager.volume)

const player = computed(() => gameState.value.player)

const staminaPercent = computed(() => (player.value.stamina / player.value.maxStamina) * 100)
const hpPercent = computed(() => (player.value.hp / player.value.maxHp) * 100)
const energyPercent = computed(() => (player.value.energy / player.value.maxEnergy) * 100)

const hpColor = computed(() => {
  const p = hpPercent.value
  if (p > 60) return '#4caf50'
  if (p > 30) return '#ff9800'
  return '#f44336'
})

const xpCurrent = computed(() => {
  const level = player.value.level
  const xpForCurrentLevel = LEVEL_XP_REQUIREMENTS[level] || 0
  return player.value.xp - xpForCurrentLevel
})

const xpNext = computed(() => {
  const level = player.value.level
  if (level >= MAX_LEVEL) return 0
  const xpForCurrentLevel = LEVEL_XP_REQUIREMENTS[level] || 0
  return getXpForNextLevel(level) - xpForCurrentLevel
})

const xpPercent = computed(() => {
  if (xpNext.value === 0) return 100
  return (xpCurrent.value / xpNext.value) * 100
})

function openPlayerScreen() {
  setPlayerScreenOpen(true)
}

function mute() {
  audioManager.setMuted(true)
  audioMuted.value = true
}

function unmute() {
  unlockAudio?.()
  audioManager.setMuted(false)
  audioMuted.value = false
}

function setVolume(e: Event) {
  unlockAudio?.()
  const val = (e.target as HTMLInputElement).valueAsNumber / 100
  audioManager.setVolume(val)
  audioVolume.value = audioManager.volume
  audioMuted.value = audioManager.muted
}
</script>

<style scoped>
.game-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 24px;
  background: linear-gradient(180deg, var(--color-panel) 0%, var(--color-bg-elevated) 100%);
  color: var(--color-text);
  border-bottom: 1px solid var(--color-border);
  font-size: 14px;
  gap: 16px;
  flex-wrap: wrap;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
}

.stat-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stat-label {
  font-weight: 600;
  color: var(--color-text-muted);
}

.stat-value {
  font-weight: 700;
  min-width: 40px;
}

.hp-bar { width: 160px; }
.energy-bar { width: 80px; }
.stamina-bar { width: 80px; }
.xp-bar { width: 100px; }

.hp-fill, .energy-fill, .xp-fill, .stamina-fill {
  height: 100%;
  transition: width 0.3s ease;
}

.gold { color: var(--color-accent-warm); }

.player-button { white-space: nowrap; }

.audio-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mute-toggle {
  display: flex;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.audio-btn {
  background: var(--color-bg-elevated);
  border: none;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 14px;
  opacity: 0.4;
  filter: grayscale(1);
  transition: all 0.2s;
}

.audio-btn + .audio-btn {
  border-left: 1px solid var(--color-border);
}

.audio-btn.active {
  opacity: 1;
  filter: none;
  background: var(--color-panel);
  box-shadow: inset 0 0 0 1px var(--color-accent);
}

.volume-slider {
  width: 70px;
  accent-color: var(--color-accent);
  transition: filter 0.2s, opacity 0.2s;
}

.volume-slider.muted {
  filter: grayscale(1);
  opacity: 0.4;
  accent-color: var(--color-text-muted);
}
</style>
