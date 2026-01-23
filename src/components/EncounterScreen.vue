<template>
  <div class="encounter-screen">
    <div class="encounter-header">
      <h1>⚔️ ENCOUNTER</h1>
    </div>
    
    <div class="enemy-list">
      <div 
        v-for="enemy in aliveEnemies" 
        :key="enemy.id"
        :class="['enemy-card', { 'selected-target': selectedTarget === enemy.id, 'clickable': !isEnemyTurn && aliveEnemies.length > 1 }]"
        @click="selectEnemyTarget(enemy.id)"
      >
        <div class="enemy-name">
          {{ enemy.name }}
          <span v-if="selectedTarget === enemy.id" class="target-icon">⚔️</span>
        </div>
        <div class="enemy-hp">
          <div class="hp-bar">
            <div 
              class="hp-fill" 
              :style="{ width: `${(enemy.hp / enemy.maxHp) * 100}%` }"
            ></div>
          </div>
          <span class="hp-text">{{ enemy.hp }}/{{ enemy.maxHp }} HP</span>
        </div>
      </div>
    </div>
    
    <div class="combat-actions">
      <div v-if="aliveEnemies.length > 1 && !selectedTarget && !isEnemyTurn" class="target-hint">
        Click on an enemy to select target, then click Attack
      </div>
      
      <div class="action-buttons">
        <button 
          @click="handleAttack" 
          class="action-button primary"
          :disabled="isEnemyTurn || (aliveEnemies.length > 1 && !selectedTarget)"
        >
          {{ isEnemyTurn ? 'Enemy turn...' : (selectedTarget ? `Attack ${getEnemyName(selectedTarget)}` : (aliveEnemies.length === 1 ? 'Attack' : 'Select target first')) }}
        </button>
        <button 
          @click="handleDefend" 
          class="action-button"
          :disabled="isEnemyTurn"
        >
          Defend
        </button>
        <button 
          @click="handleFlee" 
          class="action-button danger"
          :disabled="isEnemyTurn"
        >
          Flee
        </button>
        <button
          v-if="selectedTarget"
          @click="cancelTargetSelection"
          class="action-button"
        >
          Clear Target
        </button>
      </div>
    </div>
    
    <div v-if="actionLog.length > 0" class="action-log">
      <div 
        v-for="(action, index) in actionLog" 
        :key="index"
        :class="['action-log-entry', action.type]"
      >
        {{ action.message }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject, computed, ref, watch } from 'vue'
import type { Ref } from 'vue'
import type { GameState } from '@/engine/GameLoopDesign'
import { playerAction } from '@/engine/GameLoop'

const gameState = inject<Ref<GameState>>('gameState')!
const dispatch = inject<(state: GameState) => void>('dispatch')!

const encounter = computed(() => gameState.value.currentEncounter)
const enemies = computed(() => encounter.value?.enemies || [])
const aliveEnemies = computed(() => enemies.value.filter(e => e.hp > 0))

// Clear target selection if selected enemy dies
watch(() => aliveEnemies.value.map(e => e.id), (aliveIds) => {
  if (selectedTarget.value && !aliveIds.includes(selectedTarget.value)) {
    selectedTarget.value = null
    // Auto-select if only one enemy remains
    if (aliveIds.length === 1 && aliveIds[0]) {
      selectedTarget.value = aliveIds[0]
    }
  } else if (!selectedTarget.value && aliveIds.length === 1 && aliveIds[0]) {
    // Auto-select if only one enemy
    selectedTarget.value = aliveIds[0]
  }
})

interface ActionLogEntry {
  message: string
  type: 'player' | 'enemy'
}

const actionLog = ref<ActionLogEntry[]>([])
const isEnemyTurn = ref(false)
const actionQueue = ref<Array<{ message: string; type: 'player' | 'enemy'; delay: number }>>([])
const selectedTarget = ref<string | null>(null)
let isProcessingQueue = false

// Track previous state to detect changes
const previousPlayerHp = ref(gameState.value.player.hp)
const previousEnemyHps = ref<Map<string, number>>(new Map())

// Initialize enemy HP tracking when encounter starts
watch(() => encounter.value?.id, (newEncounterId) => {
  if (newEncounterId && encounter.value) {
    previousEnemyHps.value.clear()
    encounter.value.enemies.forEach((enemy) => {
      previousEnemyHps.value.set(enemy.id, enemy.hp)
    })
    previousPlayerHp.value = gameState.value.player.hp
    actionLog.value = [] // Clear log on new encounter
    actionQueue.value = [] // Clear queue
    isEnemyTurn.value = false // Reset enemy turn state
    isProcessingQueue = false
    selectedTarget.value = null // Clear target selection
    
    // Auto-select target if only one enemy
    const alive = encounter.value.enemies.filter(e => e.hp > 0)
    if (alive.length === 1 && alive[0]) {
      selectedTarget.value = alive[0].id
    }
  }
}, { immediate: true })

// Watch is mainly for initialization, actual action tracking happens in handlers

function addActionLog(message: string, type: 'player' | 'enemy', delay: number = 0) {
  const addToLog = (msg: string, t: 'player' | 'enemy') => {
    actionLog.value.unshift({ message: msg, type: t })
    // Keep only last 10 entries
    if (actionLog.value.length > 10) {
      actionLog.value = actionLog.value.slice(0, 10)
    }
    
    // Also store in encounter for results screen
    // Read from current gameState to get latest encounter state
    const currentEncounter = gameState.value.currentEncounter
    if (currentEncounter) {
      const currentLog = currentEncounter.combatLog || []
      const updatedLog = [msg, ...currentLog].slice(0, 50) // Keep last 50 for results
      // Update encounter in gameState
      const updatedEncounter = {
        ...currentEncounter,
        combatLog: updatedLog,
      }
      const newState = {
        ...gameState.value,
        currentEncounter: updatedEncounter,
      }
      dispatch(newState)
    }
  }
  
  if (delay > 0) {
    // Add to queue with delay
    actionQueue.value.push({ message, type, delay })
    processActionQueue()
  } else {
    // Add immediately
    addToLog(message, type)
  }
}

function processActionQueue() {
  if (isProcessingQueue || actionQueue.value.length === 0) return
  
  isProcessingQueue = true
  const nextAction = actionQueue.value.shift()
  if (!nextAction) {
    isProcessingQueue = false
    return
  }
  
  setTimeout(() => {
    // Add to log (this will also store in encounter)
    const addToLog = (msg: string, t: 'player' | 'enemy') => {
      actionLog.value.unshift({ message: msg, type: t })
      // Keep only last 10 entries
      if (actionLog.value.length > 10) {
        actionLog.value = actionLog.value.slice(0, 10)
      }
      
      // Also store in encounter for results screen
      // Read from current gameState to get latest encounter state
      const currentEncounter = gameState.value.currentEncounter
      if (currentEncounter) {
        const currentLog = currentEncounter.combatLog || []
        const updatedLog = [msg, ...currentLog].slice(0, 50) // Keep more entries for results
        const updatedEncounter = {
          ...currentEncounter,
          combatLog: updatedLog,
        }
        const newState = {
          ...gameState.value,
          currentEncounter: updatedEncounter,
        }
        dispatch(newState)
      }
    }
    
    addToLog(nextAction.message, nextAction.type)
    
    isProcessingQueue = false
    
    // Process next item in queue
    if (actionQueue.value.length > 0) {
      processActionQueue()
    } else {
      // Queue is empty, re-enable player actions
      isEnemyTurn.value = false
    }
  }, nextAction.delay)
}

function getEnemyName(enemyId: string): string {
  return encounter.value?.enemies.find(e => e.id === enemyId)?.name || 'Enemy'
}

function selectEnemyTarget(enemyId: string) {
  // Only allow targeting if multiple enemies and not during enemy turn
  if (isEnemyTurn.value || aliveEnemies.value.length <= 1) return
  
  // Toggle selection - clicking same enemy deselects
  if (selectedTarget.value === enemyId) {
    selectedTarget.value = null
  } else {
    selectedTarget.value = enemyId
  }
}

function cancelTargetSelection() {
  selectedTarget.value = null
}

function handleAttack() {
  if (aliveEnemies.value.length === 0 || isEnemyTurn.value) return
  
  // Require target selection if multiple enemies
  if (!selectedTarget.value && aliveEnemies.value.length > 1) {
    return // Don't attack, user needs to select target
  }
  
  // Use selected target or first enemy if only one
  const targetId = selectedTarget.value || aliveEnemies.value[0]?.id || ''
  if (!targetId) {
    return
  }
  
  // Auto-select if only one enemy
  if (aliveEnemies.value.length === 1) {
    selectedTarget.value = targetId
  }
  
  // Disable buttons during enemy turn
  isEnemyTurn.value = true
  
  const targetEnemy = encounter.value?.enemies.find(e => e.id === targetId)
  
  // Store state before action
  const prevEnemyHps = new Map<string, number>()
  encounter.value?.enemies.forEach((e) => {
    prevEnemyHps.set(e.id, e.hp)
  })
  
  // Store the log BEFORE player action (to compare with log after enemy turns)
  const logBeforeAction = encounter.value?.combatLog || []
  
  const newState = playerAction(gameState.value, 'attack', targetId)
  
  // Store the log AFTER enemy turns but BEFORE we add player attack message
  // This allows us to detect enemy attacks separately
  const logAfterEnemyTurns = newState.currentEncounter?.combatLog || []
  
  // Get current log from encounter (preserved through playerAction)
  const currentLog = logAfterEnemyTurns
  
  // Detect player attack and add to log
  if (targetEnemy && newState.currentEncounter) {
    const prevEnemyHp = prevEnemyHps.get(targetId) || targetEnemy.maxHp
    const newEnemy = newState.currentEncounter.enemies.find(e => e.id === targetId)
    if (newEnemy) {
      const damage = prevEnemyHp - newEnemy.hp
      if (damage > 0) {
        let playerMessage = ''
        if (newEnemy.hp <= 0) {
          playerMessage = `You defeat ${targetEnemy.name}!`
        } else {
          playerMessage = `You attack ${targetEnemy.name} for ${damage} damage!`
        }
        // Add player action to log in the new state
        const updatedLog = [playerMessage, ...currentLog].slice(0, 50)
        newState.currentEncounter.combatLog = updatedLog
        // Also update UI log for immediate display
        actionLog.value.unshift({ message: playerMessage, type: 'player' })
        if (actionLog.value.length > 10) {
          actionLog.value = actionLog.value.slice(0, 10)
        }
      }
    }
  }
  
  // Update tracked state
  previousPlayerHp.value = newState.player.hp
  newState.currentEncounter?.enemies.forEach((e) => {
    previousEnemyHps.value.set(e.id, e.hp)
  })
  
  // Clear target selection after attack
  selectedTarget.value = null
  
  dispatch(newState)
  
  // Enemy attacks are now logged in executeEnemyTurns, so we just need to display them
  // Check if combat log was updated with enemy attacks
  const aliveEnemiesAfter = newState.currentEncounter?.enemies.filter(e => e.hp > 0) || []
  
  // Check if enemies attacked (they should attack if they're alive)
  if (aliveEnemiesAfter.length > 0) {
    // Get the new log entries (enemy attacks) that were added by executeEnemyTurns
    // Compare logAfterEnemyTurns (after enemy turns) with logBeforeAction (before player action)
    const newEntries = logAfterEnemyTurns.slice(0, logAfterEnemyTurns.length - logBeforeAction.length)
    
    // Add enemy attack messages to UI log with delays
    newEntries.forEach((entry, index) => {
      if (entry.includes('attacks you')) {
        addActionLog(entry, 'enemy', 400 + (index * 100))
      }
    })
  } else {
    // No enemies alive, re-enable buttons
    isEnemyTurn.value = false
  }
}

function handleDefend() {
  if (isEnemyTurn.value) return
  
  // Disable buttons during enemy turn
  isEnemyTurn.value = true
  
  // Store state before action
  const prevPlayerHp = gameState.value.player.hp
  const currentLog = encounter.value?.combatLog || []
  
  const newState = playerAction(gameState.value, 'defend')
  
  // Add player defend action to log
  const defendMessage = 'You take a defensive stance.'
  const updatedLog = [defendMessage, ...currentLog].slice(0, 50)
  if (newState.currentEncounter) {
    newState.currentEncounter.combatLog = updatedLog
  }
  // Also update UI log for immediate display
  actionLog.value.unshift({ message: defendMessage, type: 'player' })
  if (actionLog.value.length > 10) {
    actionLog.value = actionLog.value.slice(0, 10)
  }
  
  previousPlayerHp.value = newState.player.hp
  
  dispatch(newState)
  
  // Enemy attacks are now logged in executeEnemyTurns, so we just need to display them
  const newPlayerHp = newState.player.hp
  if (newPlayerHp < prevPlayerHp && newState.currentEncounter?.combatLog) {
    // Get the new log entries (enemy attacks) that were added
    const oldLog = encounter.value?.combatLog || []
    const newLog = newState.currentEncounter.combatLog
    const newEntries = newLog.slice(0, newLog.length - oldLog.length)
    
    // Add enemy attack messages to UI log with delays
    newEntries.forEach((entry, index) => {
      if (entry.includes('attacks you')) {
        addActionLog(entry, 'enemy', 400 + (index * 100))
      }
    })
  } else {
    // No enemy attacks, re-enable buttons
    isEnemyTurn.value = false
  }
}

function handleFlee() {
  if (isEnemyTurn.value) return
  
  const currentLog = encounter.value?.combatLog || []
  const fleeMessage = 'You attempt to flee...'
  
  const newState = playerAction(gameState.value, 'flee')
  
  // Add flee action to log if encounter still exists
  if (newState.currentEncounter) {
    const updatedLog = [fleeMessage, ...currentLog].slice(0, 50)
    newState.currentEncounter.combatLog = updatedLog
  }
  
  // Also update UI log for immediate display
  actionLog.value.unshift({ message: fleeMessage, type: 'player' })
  if (actionLog.value.length > 10) {
    actionLog.value = actionLog.value.slice(0, 10)
  }
  
  dispatch(newState)
  // Flee ends encounter, so no need to handle enemy turn
}
</script>

<style scoped>
.encounter-screen {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.encounter-header {
  text-align: center;
  padding: 16px;
  background-color: #2a2a2a;
  border-radius: 8px;
  border: 2px solid #ff4444;
}

.encounter-header h1 {
  font-size: 24px;
  margin: 0;
  color: #ff4444;
}

.enemy-list {
  background-color: #2a2a2a;
  padding: 16px;
  border-radius: 8px;
}

.enemy-card {
  padding: 12px;
  margin-bottom: 8px;
  background-color: #1a1a1a;
  border-radius: 6px;
  border-left: 4px solid #ff4444;
  transition: all 0.2s;
}

.enemy-card.clickable {
  cursor: pointer;
}

.enemy-card.clickable:hover {
  background-color: #2a2a2a;
  transform: translateX(4px);
}

.enemy-card.selected-target {
  background-color: #2a4a2a;
  border-left: 4px solid #4caf50;
  box-shadow: 0 0 8px rgba(76, 175, 80, 0.3);
}

.enemy-name {
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 8px;
  font-size: 18px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.target-icon {
  font-size: 20px;
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

.enemy-hp {
  display: flex;
  align-items: center;
  gap: 12px;
}

.hp-bar {
  flex: 1;
  height: 24px;
  background-color: #1a1a1a;
  border: 1px solid #444;
  border-radius: 4px;
  overflow: hidden;
}

.hp-fill {
  height: 100%;
  background-color: #f44336;
  transition: width 0.3s ease;
}

.hp-text {
  font-size: 14px;
  color: #aaa;
  min-width: 100px;
  font-weight: 600;
}

.combat-actions {
  background-color: #2a2a2a;
  padding: 16px;
  border-radius: 8px;
}

.action-log {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
  padding: 12px;
  background-color: #1a1a1a;
  border-radius: 8px;
  border: 1px solid #444;
}

.action-log-entry {
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 14px;
  line-height: 1.4;
}

.action-log-entry.player {
  background-color: #2a4a2a;
  color: #4caf50;
  border-left: 3px solid #4caf50;
}

.action-log-entry.enemy {
  background-color: #4a2a2a;
  color: #ff6666;
  border-left: 3px solid #ff4444;
}

.action-buttons {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.action-button {
  padding: 12px 24px;
  font-size: 16px;
  font-weight: 600;
  background-color: #3a3a3a;
  color: #ffffff;
  border: 2px solid #555;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-button:hover {
  background-color: #4a4a4a;
  border-color: #666;
}

.action-button.primary {
  background-color: #4caf50;
  border-color: #66bb6a;
}

.action-button.primary:hover {
  background-color: #66bb6a;
}

.action-button.danger {
  background-color: #f44336;
  border-color: #ef5350;
}

.action-button.danger:hover {
  background-color: #ef5350;
}

.action-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  pointer-events: none;
}

.target-hint {
  padding: 12px;
  background-color: #2a2a2a;
  border-radius: 8px;
  border-left: 4px solid #4caf50;
  font-size: 14px;
  color: #aaa;
  text-align: center;
  font-style: italic;
}
</style>
