<template>
  <div class="inventory-section">
    <h3 class="section-title">Inventory</h3>

    <div v-if="inventory.length === 0" class="empty-inventory">Your inventory is empty.</div>

    <div v-else class="inventory-list">
      <div
        v-for="item in inventory"
        :key="`${item.templateId}::${item.quality}`"
        class="inventory-item"
      >
        <div class="item-info">
          <div class="item-name" :style="{ color: qualityColor(item.quality) }">
            {{ formatItemName(getItemName(item.templateId), item.quality) }}
          </div>
          <div v-if="itemStats(item)" class="item-stats">{{ itemStats(item) }}</div>
          <div class="item-type">{{ getItemType(item.templateId) }}</div>
          <div v-if="getItemDescription(item.templateId)" class="item-desc">
            {{ getItemDescription(item.templateId) }}
          </div>
        </div>
        <div class="item-actions">
          <span class="item-quantity">x{{ item.quantity }}</span>
          <button
            v-if="isConsumable(item.templateId)"
            @click="useItemHandler(item)"
            class="use-button"
          >
            Use
          </button>
          <button
            v-if="isEquippable(item.templateId)"
            @click="equipHandler(item)"
            class="equip-button"
            :disabled="isEquipped(item)"
          >
            {{ isEquipped(item) ? 'Equipped' : 'Equip' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject, computed } from 'vue'
import type { Ref } from 'vue'
import type { GameState, InventoryItem } from '@/engine/GameLoopDesign'
import { useItem, equipItemAction } from '@/engine/GameLoop'
import { getItemName, getItemTemplate } from '@/engine/ItemDatabase'
import { formatItemName, itemStatSummary, qualityColor } from '@/utils/icons'

const gameState = inject<Ref<GameState>>('gameState')!
const dispatch = inject<(state: GameState) => void>('dispatch')!

const inventory = computed(() => gameState.value.player.inventory || [])
const equipment = computed(() => gameState.value.player.equipment)

function getItemType(id: string) {
  return getItemTemplate(id)?.type ?? 'item'
}

function getItemDescription(id: string) {
  return getItemTemplate(id)?.description ?? ''
}

function itemStats(item: InventoryItem) {
  return itemStatSummary(getItemTemplate(item.templateId), item.quality)
}

function isConsumable(id: string) {
  return getItemTemplate(id)?.type === 'consumable'
}

function isEquippable(id: string) {
  const t = getItemTemplate(id)
  return t?.type === 'weapon' || t?.type === 'armor'
}

function isEquipped(item: InventoryItem) {
  const w = equipment.value.weapon
  const a = equipment.value.armor
  return (
    (w?.templateId === item.templateId && w.quality === item.quality) ||
    (a?.templateId === item.templateId && a.quality === item.quality)
  )
}

function useItemHandler(item: InventoryItem) {
  dispatch(useItem(gameState.value, item.templateId, item.quality))
}

function equipHandler(item: InventoryItem) {
  dispatch(equipItemAction(gameState.value, item.templateId, item.quality))
}
</script>

<style scoped>
.inventory-section { background: #1a1a1a; padding: 20px; border-radius: 8px; border-left: 4px solid #4caf50; }
.section-title { margin: 0 0 16px; font-size: 18px; color: #4caf50; border-bottom: 2px solid #4caf50; padding-bottom: 8px; }
.empty-inventory { text-align: center; padding: 32px; color: #666; font-style: italic; }
.inventory-list { display: flex; flex-direction: column; gap: 12px; }
.inventory-item { display: flex; justify-content: space-between; align-items: center; padding: 16px; background: #2a2a2a; border-radius: 6px; border: 1px solid #444; }
.item-name { font-weight: 600; font-size: 16px; margin-bottom: 4px; }
.item-stats { font-size: 12px; color: #4caf50; font-weight: 600; margin-bottom: 4px; }
.item-type { font-size: 12px; color: #888; text-transform: capitalize; margin-bottom: 4px; }
.item-desc { font-size: 12px; color: #aaa; }
.item-actions { display: flex; align-items: center; gap: 8px; }
.item-quantity { color: #aaa; font-weight: 600; }
.use-button, .equip-button { padding: 8px 14px; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 13px; }
.use-button { background: #4caf50; color: #fff; }
.equip-button { background: #3a5a8a; color: #fff; }
.equip-button:disabled { opacity: 0.5; cursor: default; }
</style>
