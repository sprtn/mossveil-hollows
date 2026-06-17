<template>
  <div class="vendor-shop-panel">
    <h4>Buy</h4>
    <div class="shop-list">
      <div
        v-for="item in buyList"
        :key="`${item.templateId}::${item.quality ?? 'common'}`"
        class="shop-item"
      >
        <div class="shop-item-info">
          <span class="shop-item-name" :style="{ color: qualityColor(item.quality) }">
            {{ formatItemName(getItemName(item.templateId), item.quality) }}
            x{{ item.stock }} — {{ buyPrice(item.templateId, item.quality) }}g
          </span>
          <span v-if="itemStats(item.templateId, item.quality)" class="item-stats">
            {{ itemStats(item.templateId, item.quality) }}
          </span>
          <span v-if="itemDesc(item.templateId)" class="item-desc">{{ itemDesc(item.templateId) }}</span>
        </div>
        <button
          class="shop-btn"
          :disabled="player.gold < buyPrice(item.templateId, item.quality)"
          @click="$emit('buy', item.templateId, item.quality)"
        >Buy</button>
      </div>
      <div v-if="buyList.length === 0" class="empty">Nothing for sale right now.</div>
    </div>

    <h4>Sell</h4>
    <div class="shop-list">
      <div
        v-for="item in sellList"
        :key="`${item.templateId}::${item.quality}`"
        class="shop-item"
      >
        <div class="shop-item-info">
          <span class="shop-item-name" :style="{ color: qualityColor(item.quality) }">
            {{ formatItemName(getItemName(item.templateId), item.quality) }}
            x{{ item.quantity }} — {{ sellPrice(item.templateId, item.quality) }}g
          </span>
          <span v-if="itemStats(item.templateId, item.quality)" class="item-stats">
            {{ itemStats(item.templateId, item.quality) }}
          </span>
        </div>
        <button class="shop-btn" @click="$emit('sell', item.templateId, item.quality)">Sell</button>
      </div>
      <div v-if="sellList.length === 0" class="empty">Nothing to sell here.</div>
    </div>

    <div v-if="pendingSwap" class="swap-prompt">
      <p>
        Equip
        <strong>{{ formatItemName(getItemName(pendingSwap.templateId), pendingSwap.quality) }}</strong>
        (+{{ pendingSwap.newBonus }})?
      </p>
      <button class="shop-btn" @click="$emit('confirmSwap')">Equip</button>
      <button class="shop-btn secondary" @click="$emit('dismissSwap')">Keep</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { GameState } from '@/engine/GameLoopDesign'
import type { Quality } from '@/engine/Quality'
import { getItemName, getItemTemplate } from '@/engine/ItemDatabase'
import {
  getVendorBuyList,
  getVendorSellList,
  getVendorBuyDiscount,
  getVendorSellBonus,
} from '@/engine/VendorSystem'
import { getPrice } from '@/engine/MarketSystem'
import { formatItemName, itemStatSummary, qualityColor } from '@/utils/icons'

export type PendingEquipSwap = {
  templateId: string
  quality: Quality
  slot: 'weapon' | 'armor'
  currentId: string
  newBonus: number
  currentBonus: number
}

const props = defineProps<{
  gameState: GameState
  vendorId: string
  pendingSwap?: PendingEquipSwap | null
}>()

defineEmits<{
  buy: [templateId: string, quality?: Quality]
  sell: [templateId: string, quality?: Quality]
  confirmSwap: []
  dismissSwap: []
}>()

const player = computed(() => props.gameState.player)
const buyList = computed(() => getVendorBuyList(props.gameState, props.vendorId))
const sellList = computed(() => getVendorSellList(props.gameState, props.vendorId))

function buyPrice(templateId: string, quality?: Quality) {
  return getPrice(props.gameState, templateId, 'buy', {
    buyDiscount: getVendorBuyDiscount(props.gameState, props.vendorId),
    quality,
  })
}

function sellPrice(templateId: string, quality?: Quality) {
  return getPrice(props.gameState, templateId, 'sell', {
    sellBonus: getVendorSellBonus(props.gameState, props.vendorId),
    quality,
  })
}

function itemStats(id: string, quality?: Quality) {
  return itemStatSummary(getItemTemplate(id), quality)
}

function itemDesc(id: string) {
  return getItemTemplate(id)?.description ?? ''
}
</script>

<style scoped>
.shop-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}
.shop-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  background: var(--color-panel-inset);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  margin-bottom: 6px;
}
.shop-item-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.shop-item-name { color: var(--color-text); }
.item-stats, .item-desc {
  font-size: 11px;
  color: var(--color-text-muted);
}
.shop-btn {
  padding: 4px 12px;
  background: var(--color-accent);
  border: none;
  border-radius: var(--radius-sm);
  color: var(--color-text);
  cursor: pointer;
}
.shop-btn.secondary {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
}
.swap-prompt {
  padding: 12px;
  background: var(--color-panel-inset);
  border: 1px solid var(--color-water);
  border-radius: var(--radius-md);
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.empty {
  font-size: 13px;
  color: var(--color-text-muted);
  padding: 4px 0;
}
</style>
