<template>
  <div class="inventory-section">
    <h3 class="section-title">Inventory</h3>
    
    <div v-if="inventory.length === 0" class="empty-inventory">
      Your inventory is empty.
    </div>
    
    <div v-else class="inventory-list">
      <div 
        v-for="item in inventory" 
        :key="item.id"
        class="inventory-item"
      >
        <div class="item-info">
          <div class="item-name">{{ item.name }}</div>
          <div class="item-type">{{ item.type }}</div>
          <div v-if="item.effect?.hpRestore" class="item-effect">
            Restores {{ item.effect.hpRestore }} HP
          </div>
        </div>
        <div class="item-actions">
          <span class="item-quantity">x{{ item.quantity }}</span>
          <button 
            v-if="item.type === 'consumable' && item.effect?.hpRestore"
            @click="useItemHandler(item.id)"
            class="use-button"
          >
            Use
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject, computed } from 'vue'
import type { Ref } from 'vue'
import type { GameState } from '@/engine/GameLoopDesign'
import { useItem } from '@/engine/GameLoop'

const gameState = inject<Ref<GameState>>('gameState')!
const dispatch = inject<(state: GameState) => void>('dispatch')!

const inventory = computed(() => gameState.value.player.inventory || [])

function useItemHandler(itemId: string) {
  const newState = useItem(gameState.value, itemId)
  dispatch(newState)
}
</script>

<style scoped>
.inventory-section {
  background-color: #1a1a1a;
  padding: 20px;
  border-radius: 8px;
  border-left: 4px solid #4caf50;
}

.section-title {
  margin: 0 0 16px 0;
  font-size: 18px;
  color: #4caf50;
  border-bottom: 2px solid #4caf50;
  padding-bottom: 8px;
}

.empty-inventory {
  text-align: center;
  padding: 32px;
  color: #666;
  font-style: italic;
}

.inventory-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.inventory-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background-color: #2a2a2a;
  border-radius: 6px;
  border: 1px solid #444;
}

.item-info {
  flex: 1;
}

.item-name {
  font-weight: 600;
  color: #ffffff;
  font-size: 16px;
  margin-bottom: 4px;
}

.item-type {
  font-size: 12px;
  color: #888;
  text-transform: capitalize;
  margin-bottom: 4px;
}

.item-effect {
  font-size: 12px;
  color: #4caf50;
}

.item-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.item-quantity {
  color: #aaa;
  font-weight: 600;
  min-width: 40px;
  text-align: right;
}

.use-button {
  padding: 8px 16px;
  background-color: #4caf50;
  color: #ffffff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  transition: background-color 0.2s;
}

.use-button:hover {
  background-color: #66bb6a;
}
</style>
