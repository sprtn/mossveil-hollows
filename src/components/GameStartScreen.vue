<template>
  <div class="start-screen">
    <div class="start-bg" aria-hidden="true" />
    <div class="start-vignette" aria-hidden="true" />

    <div class="start-content">
      <header class="start-header">
        <div class="emblem" aria-hidden="true">
          <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="40" cy="40" r="36" stroke="currentColor" stroke-width="1.5" opacity="0.85" />
            <circle cx="40" cy="40" r="28" stroke="currentColor" stroke-width="0.75" opacity="0.45" />
            <path
              d="M40 14 L40 52 M40 52 C32 48 26 42 24 34 M40 52 C48 48 54 42 56 34
                 M40 30 C36 26 32 22 30 18 M40 30 C44 26 48 22 50 18
                 M40 52 L34 62 M40 52 L46 62 M34 62 L30 66 M46 62 L50 66"
              stroke="currentColor"
              stroke-width="1.75"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
        <h1 class="game-title">{{ GAME_TITLE_MAIN }}</h1>
        <p class="game-subtitle">{{ GAME_TITLE_SUB }}</p>
        <p class="tagline">Defeat the guardians. Unite the shards. End the Shadow Lord.</p>
      </header>

      <div class="start-actions">
        <button
          class="start-button primary"
          :disabled="loading"
          @click="startNewGame"
        >
          {{ loading ? 'Opening the gate…' : 'Begin Your Journey' }}
        </button>
        <button
          v-if="canContinue"
          class="start-button continue"
          @click="continueGame"
        >
          Continue
        </button>
      </div>

      <footer class="start-features">
        <div v-for="feature in features" :key="feature.title" class="feature">
          <span class="feature-icon" aria-hidden="true">{{ feature.icon }}</span>
          <strong class="feature-title">{{ feature.title }}</strong>
          <span class="feature-desc">{{ feature.desc }}</span>
        </div>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject, ref, onMounted } from 'vue'
import type { GameState } from '@/engine/GameLoopDesign'
import { createDefaultPlayer } from '@/engine/CombatEngine'
import { startGameFromRoom } from '@/engine/GameLoop'
import { hasSaveGame, loadGame } from '@/engine/saveGame'
import { START_ROOM_ID, GAME_TITLE_MAIN, GAME_TITLE_SUB } from '@/engine/gameConfig'
import { audioManager } from '@/engine/AudioManager'

const dispatch = inject<(state: GameState) => void>('dispatch')!
const unlockAudio = inject<() => void>('unlockAudio')

const loading = ref(false)
const canContinue = ref(false)

const features = [
  { icon: '⚔', title: 'Strategic Combat', desc: 'Plan your moves. Outthink your enemies.' },
  { icon: '◎', title: 'Train & Grow', desc: 'Learn techniques. Sharpen your edge.' },
  { icon: '⌂', title: 'Build & Trade', desc: 'Craft gear. Stock the local market.' },
  { icon: '✦', title: 'Explore & Uncover', desc: 'Venture into the wild. Find the shards.' },
]

onMounted(() => {
  canContinue.value = hasSaveGame()
})

async function startNewGame() {
  loading.value = true
  audioManager.startOnNewGame()
  try {
    const player = createDefaultPlayer()
    const state = await startGameFromRoom(START_ROOM_ID, player)
    dispatch(state)
    audioManager.playForState(state)
  } finally {
    loading.value = false
  }
}

function continueGame() {
  unlockAudio?.()
  const { state, versionMismatch } = loadGame()
  if (versionMismatch) {
    alert('Save was from an older version and has been reset.')
    canContinue.value = false
    return
  }
  if (state) {
    dispatch(state)
    audioManager.playForState(state)
  }
}
</script>

<style scoped>
.start-screen {
  position: relative;
  min-height: 100vh;
  width: 100%;
  overflow: hidden;
  color: var(--color-text);
}

.start-bg {
  position: absolute;
  inset: 0;
  background:
    url('/images/mossveil_hollow_start.png') center center / cover no-repeat;
  transform: scale(1.02);
}

.start-vignette {
  position: absolute;
  inset: 0;
  /* Art-only asset: light vignette for readability under UI text, not to hide baked-in labels */
  background:
    linear-gradient(180deg, rgba(8, 12, 10, 0.45) 0%, transparent 28%, transparent 62%, rgba(8, 12, 10, 0.75) 100%),
    radial-gradient(ellipse at 50% 55%, transparent 0%, rgba(8, 12, 10, 0.2) 100%);
  pointer-events: none;
}

.start-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  min-height: 100vh;
  padding: clamp(24px, 5vh, 48px) clamp(20px, 4vw, 40px) clamp(20px, 3vh, 32px);
  gap: clamp(20px, 4vh, 36px);
}

.start-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 10px;
  margin-top: clamp(8px, 2vh, 24px);
}

.emblem {
  width: 72px;
  height: 72px;
  color: var(--color-accent-warm);
  margin-bottom: 4px;
  filter: drop-shadow(0 0 12px rgba(201, 165, 92, 0.35));
}

.emblem svg {
  width: 100%;
  height: 100%;
}

.game-title {
  font-size: clamp(2rem, 5vw, 3.25rem);
  font-weight: 700;
  color: #f4f0e6;
  margin: 0;
  font-family: var(--font-display);
  text-shadow: 0 2px 16px rgba(0, 0, 0, 0.7);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.game-subtitle {
  font-size: clamp(0.75rem, 2vw, 1rem);
  font-weight: 600;
  color: var(--color-accent-warm);
  margin: 0;
  font-family: var(--font-display);
  letter-spacing: 0.35em;
  text-transform: uppercase;
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.6);
}

.tagline {
  font-size: clamp(0.9rem, 1.8vw, 1.05rem);
  color: rgba(232, 226, 212, 0.88);
  margin: 8px 0 0;
  max-width: 420px;
  line-height: 1.55;
  font-style: italic;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.8);
}

.start-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  width: min(100%, 320px);
}

.start-button {
  width: 100%;
  padding: 16px 28px;
  font-size: 0.95rem;
  font-weight: 700;
  font-family: var(--font-display);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s, background 0.2s, border-color 0.2s;
}

.start-button.primary {
  background: linear-gradient(180deg, rgba(58, 82, 48, 0.92) 0%, rgba(38, 58, 32, 0.95) 100%);
  color: #f4f0e6;
  border: 1px solid rgba(139, 196, 122, 0.55);
  box-shadow:
    0 4px 20px rgba(0, 0, 0, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 0 24px rgba(107, 155, 90, 0.15);
}

.start-button.primary:hover:not(:disabled) {
  transform: translateY(-2px);
  border-color: var(--color-accent-bright);
  box-shadow:
    0 6px 28px rgba(0, 0, 0, 0.5),
    0 0 32px rgba(107, 155, 90, 0.28);
}

.start-button.continue {
  background: rgba(15, 20, 16, 0.55);
  color: var(--color-accent-warm);
  border: 1px solid rgba(201, 165, 92, 0.35);
  letter-spacing: 0.08em;
  font-size: 0.85rem;
  padding: 12px 24px;
}

.start-button.continue:hover {
  background: rgba(25, 32, 24, 0.75);
  border-color: var(--color-accent-warm);
}

.start-button:disabled {
  opacity: 0.65;
  cursor: wait;
}

.start-features {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: clamp(12px, 2vw, 24px);
  width: 100%;
  max-width: 920px;
  padding-top: 8px;
  border-top: 1px solid rgba(201, 165, 92, 0.15);
}

.feature {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 4px;
}

.feature-icon {
  font-size: 1.35rem;
  color: var(--color-accent-warm);
  line-height: 1;
  opacity: 0.9;
}

.feature-title {
  font-family: var(--font-display);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-accent-warm);
}

.feature-desc {
  font-size: 0.72rem;
  color: rgba(184, 176, 160, 0.9);
  line-height: 1.35;
  max-width: 160px;
}

@media (max-width: 720px) {
  .start-features {
    grid-template-columns: repeat(2, 1fr);
    gap: 16px 12px;
  }

  .game-subtitle {
    letter-spacing: 0.2em;
  }
}

@media (max-width: 420px) {
  .start-features {
    grid-template-columns: 1fr;
  }
}
</style>
