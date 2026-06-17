<template>
  <div class="material-market-panel">
    <h4>Local Market — Resources</h4>
    <p class="market-hint">
      Buy and sell raw materials here at live prices (Day {{ gameDay }}).
      What you sell enters town stock; traders sell from that stock.
      Visit Sera and Garrick in <em>People</em> for <em>finished goods</em> — not pelts or timber.
    </p>
    <div class="shop-list">
      <div v-for="row in marketListings" :key="row.materialId" class="shop-item market-row">
        <div class="shop-item-info">
          <span class="shop-item-name">
            {{ materialIcon(row.materialId) }} {{ getItemName(row.materialId) }}
          </span>
          <span class="market-meta">
            You: {{ materialCount(row.materialId) }} ·
            In stock: {{ row.stock }} ·
            Buy {{ row.buyPrice }}g / Sell {{ row.sellPrice }}g
          </span>
        </div>
        <div class="sell-btns">
          <button
            v-if="row.stock > 0"
            class="shop-btn"
            :disabled="player.gold < row.buyPrice"
            @click="$emit('buyMaterial', row.materialId, 1)"
          >Buy 1</button>
          <button
            v-if="row.stock > 0"
            class="shop-btn"
            :disabled="player.gold < row.buyPrice * row.stock"
            @click="$emit('buyMaterial', row.materialId, row.stock)"
          >Buy all</button>
          <button
            v-if="materialCount(row.materialId) > 0"
            class="shop-btn"
            @click="$emit('sellMaterial', row.materialId, 1)"
          >Sell 1</button>
          <button
            v-if="materialCount(row.materialId) > 0"
            class="shop-btn"
            @click="$emit('sellMaterial', row.materialId, materialCount(row.materialId))"
          >Sell all</button>
        </div>
      </div>
      <div v-if="marketListings.length === 0" class="empty">
        No materials in the market yet. Gather resources in the zones or wait for stock.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { GameState } from '@/engine/GameLoopDesign'
import { getMarketMaterialListings, getMarketPlayerStock } from '@/engine/MarketSystem'
import { getItemName } from '@/engine/ItemDatabase'
import { materialIcon } from '@/utils/icons'

const props = defineProps<{
  gameState: GameState
}>()

defineEmits<{
  buyMaterial: [materialId: string, qty: number]
  sellMaterial: [materialId: string, qty: number]
}>()

const player = computed(() => props.gameState.player)
const gameDay = computed(() => props.gameState.day ?? 1)
const marketListings = computed(() => getMarketMaterialListings(props.gameState))

function materialCount(matId: string) {
  return getMarketPlayerStock(player.value, matId)
}
</script>

<style scoped>
.market-hint {
  font-size: 12px;
  color: var(--color-text-soft);
  margin: 0 0 10px;
  line-height: 1.4;
}
.market-meta {
  display: block;
  font-size: 11px;
  color: var(--color-text-muted);
  margin-top: 2px;
}
.market-row { flex-wrap: wrap; }
.sell-btns {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex-shrink: 0;
}
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
.shop-btn {
  padding: 4px 12px;
  background: var(--color-accent);
  border: none;
  border-radius: var(--radius-sm);
  color: var(--color-text);
  cursor: pointer;
}
.empty {
  font-size: 13px;
  color: var(--color-text-muted);
  padding: 8px 0;
}
</style>
