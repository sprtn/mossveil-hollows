<template>
  <div class="combat-results-screen">
    <div class="results-header">
      <h1 v-if="results.result === 'win'" class="victory">🎉 Victory!</h1>
      <h1 v-else-if="results.result === 'loss'" class="defeat">💀 Defeat</h1>
      <h1 v-else class="fled">🏃 Fled</h1>
    </div>

    <div class="results-content">
      <!-- XP Gains -->
      <div class="results-section">
        <h2>Experience</h2>
        <div class="xp-display">
          <div class="xp-amount">+{{ results.xpGained }} XP</div>
          <div v-if="results.levelsGained > 0" class="level-up">
            ⭐ Level Up! Gained {{ results.levelsGained }} level{{ results.levelsGained > 1 ? 's' : '' }}
          </div>
        </div>
      </div>

      <!-- Loot Gains -->
      <div v-if="results.lootGained.length > 0" class="results-section">
        <h2>Loot</h2>
        <div v-if="totalCoins > 0" class="coins-display">
          <span class="coins-icon">💰</span>
          <span class="coins-amount">{{ totalCoins }} coins</span>
        </div>
        <div class="loot-list">
          <div 
            v-for="(item, index) in nonCoinLoot" 
            :key="index"
            class="loot-item"
          >
            <span class="loot-icon">{{ getItemIcon(item.type) }}</span>
            <span class="loot-name">{{ item.name }}</span>
            <span v-if="item.quantity > 1" class="loot-quantity">×{{ item.quantity }}</span>
          </div>
        </div>
      </div>

      <!-- Combat Log -->
      <div v-if="results.combatLog && results.combatLog.length > 0" class="results-section">
        <h2>Combat Log</h2>
        <div class="combat-log">
          <div 
            v-for="(entry, index) in results.combatLog" 
            :key="index"
            class="log-entry"
          >
            {{ entry }}
          </div>
        </div>
      </div>

      <!-- Continue Button -->
      <div class="continue-section">
        <button @click="handleContinue" class="continue-button">
          Continue
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject, computed } from 'vue'
import type { Ref } from 'vue'
import type { GameState } from '@/engine/GameLoopDesign'

const gameState = inject<Ref<GameState>>('gameState')!
const dispatch = inject<(state: GameState) => void>('dispatch')!

const results = computed(() => gameState.value.combatResults!)

// Calculate total coins and separate non-coin items
const totalCoins = computed(() => {
  if (!results.value) return 0
  return results.value.lootGained
    .filter(item => item.name.toLowerCase().includes('coin') || item.id.includes('coin'))
    .reduce((sum, item) => sum + (item.quantity || 1), 0)
})

const nonCoinLoot = computed(() => {
  if (!results.value) return []
  return results.value.lootGained.filter(
    item => !item.name.toLowerCase().includes('coin') && !item.id.includes('coin')
  )
})

function getItemIcon(type: string): string {
  switch (type) {
    case 'weapon': return '⚔️'
    case 'armor': return '🛡️'
    case 'consumable': return '🧪'
    case 'key': return '🗝️'
    default: return '📦'
  }
}

function handleContinue() {
  // Transition back to room exploring
  const newState = {
    ...gameState.value,
    phase: 'room_exploring' as const,
    combatResults: undefined,
  }
  dispatch(newState)
}
</script>

<style scoped>
.combat-results-screen {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 600px;
  margin: 0 auto;
}

.results-header {
  text-align: center;
  padding: 24px;
  background-color: #2a2a2a;
  border-radius: 8px;
  border: 2px solid #444;
}

.results-header h1 {
  margin: 0;
  font-size: 32px;
  font-weight: 700;
}

.results-header .victory {
  color: #4caf50;
  text-shadow: 0 0 10px rgba(76, 175, 80, 0.5);
}

.results-header .defeat {
  color: #f44336;
  text-shadow: 0 0 10px rgba(244, 67, 54, 0.5);
}

.results-header .fled {
  color: #ff9800;
  text-shadow: 0 0 10px rgba(255, 152, 0, 0.5);
}

.results-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.results-section {
  background-color: #2a2a2a;
  padding: 20px;
  border-radius: 8px;
  border-left: 4px solid #4caf50;
}

.results-section h2 {
  margin: 0 0 16px 0;
  font-size: 20px;
  font-weight: 700;
  color: #ffffff;
  border-bottom: 1px solid #444;
  padding-bottom: 8px;
}

.xp-display {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.xp-amount {
  font-size: 24px;
  font-weight: 700;
  color: #4caf50;
}

.level-up {
  font-size: 18px;
  font-weight: 600;
  color: #ffd700;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

.loot-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.loot-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background-color: #1a1a1a;
  border-radius: 6px;
  border-left: 3px solid #666;
}

.loot-icon {
  font-size: 24px;
}

.loot-name {
  flex: 1;
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
}

.loot-quantity {
  font-size: 14px;
  color: #aaa;
  font-weight: 600;
}

.coins-display {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background-color: #2a4a2a;
  border-radius: 6px;
  margin-bottom: 12px;
  border-left: 3px solid #ffd700;
}

.coins-icon {
  font-size: 28px;
}

.coins-amount {
  font-size: 20px;
  font-weight: 700;
  color: #ffd700;
}

.combat-log {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 200px;
  overflow-y: auto;
  padding: 12px;
  background-color: #1a1a1a;
  border-radius: 6px;
}

.log-entry {
  font-size: 14px;
  color: #aaa;
  line-height: 1.6;
  padding: 4px 0;
  border-bottom: 1px solid #2a2a2a;
}

.log-entry:last-child {
  border-bottom: none;
}

.continue-section {
  display: flex;
  justify-content: center;
  margin-top: 8px;
}

.continue-button {
  padding: 16px 48px;
  font-size: 18px;
  font-weight: 700;
  background-color: #4caf50;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.continue-button:hover {
  background-color: #66bb6a;
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.4);
}

.continue-button:active {
  transform: translateY(0);
}
</style>
