<template>
  <div class="combat-results-screen">
    <div class="results-header">
      <h1 v-if="results.result === 'win'" class="victory">Victory!</h1>
      <h1 v-else-if="results.result === 'loss'" class="defeat">Defeat</h1>
      <h1 v-else class="fled">Fled</h1>
    </div>

    <div class="results-content">
      <div v-if="results.xpGained > 0" class="results-section">
        <h2>Experience</h2>
        <div class="xp-amount">+{{ results.xpGained }} XP</div>
        <div v-if="results.levelsGained > 0" class="level-up">
          Level Up! +{{ results.levelsGained }} level{{ results.levelsGained > 1 ? 's' : '' }}
        </div>
      </div>

      <div v-if="results.goldGained > 0" class="results-section gold-section">
        <h2>Gold</h2>
        <div class="gold-amount">+{{ results.goldGained }} gold</div>
      </div>

      <div v-if="results.lootGained.length > 0" class="results-section">
        <h2>Loot</h2>
        <div class="loot-list">
          <div v-for="(item, index) in results.lootGained" :key="index" class="loot-item">
            <span class="loot-icon">{{ getItemIcon(item.templateId) }}</span>
            <span class="loot-name">{{ getItemName(item.templateId) }}</span>
            <span v-if="item.quantity > 1" class="loot-quantity">x{{ item.quantity }}</span>
          </div>
        </div>
      </div>

      <div v-if="results.combatLog?.length" class="results-section">
        <h2>Combat Log</h2>
        <div class="combat-log">
          <div v-for="(entry, index) in results.combatLog.slice(0, 8)" :key="index" class="log-entry">
            {{ entry }}
          </div>
        </div>
      </div>

      <div class="continue-section">
        <button @click="handleContinue" class="continue-button">Continue</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject, computed } from 'vue'
import type { Ref } from 'vue'
import type { GameState } from '@/engine/GameLoopDesign'
import { continueFromCombatResults } from '@/engine/GameLoop'
import { getItemName, getItemTemplate } from '@/engine/ItemDatabase'

const gameState = inject<Ref<GameState>>('gameState')!
const dispatch = inject<(state: GameState) => void>('dispatch')!

const results = computed(() => gameState.value.combatResults!)

function getItemIcon(templateId: string): string {
  const type = getItemTemplate(templateId)?.type
  switch (type) {
    case 'weapon': return '⚔'
    case 'armor': return '🛡'
    case 'consumable': return '🧪'
    case 'key': return '🗝'
    default: return '📦'
  }
}

function handleContinue() {
  dispatch(continueFromCombatResults(gameState.value))
}
</script>

<style scoped>
.combat-results-screen { display: flex; flex-direction: column; gap: 24px; max-width: 600px; margin: 0 auto; }
.results-header { text-align: center; padding: 24px; background: #2a2a2a; border-radius: 8px; border: 2px solid #444; }
.results-header h1 { margin: 0; font-size: 32px; font-weight: 700; }
.victory { color: #4caf50; }
.defeat { color: #f44336; }
.fled { color: #ff9800; }
.results-section { background: #2a2a2a; padding: 20px; border-radius: 8px; border-left: 4px solid #4caf50; }
.results-section h2 { margin: 0 0 12px; font-size: 18px; color: #fff; }
.xp-amount { font-size: 22px; font-weight: 700; color: #4caf50; }
.level-up { color: #ffd700; font-weight: 600; margin-top: 8px; }
.gold-section { border-left-color: #ffd700; }
.gold-amount { font-size: 22px; font-weight: 700; color: #ffd700; }
.loot-list { display: flex; flex-direction: column; gap: 8px; }
.loot-item { display: flex; align-items: center; gap: 12px; padding: 10px; background: #1a1a1a; border-radius: 6px; }
.loot-name { flex: 1; color: #fff; font-weight: 600; }
.combat-log { max-height: 180px; overflow-y: auto; }
.log-entry { font-size: 13px; color: #aaa; padding: 4px 0; border-bottom: 1px solid #333; }
.continue-section { display: flex; justify-content: center; }
.continue-button { padding: 16px 48px; font-size: 18px; font-weight: 700; background: #4caf50; color: #fff; border: none; border-radius: 8px; cursor: pointer; }
.continue-button:hover { background: #66bb6a; }
</style>
