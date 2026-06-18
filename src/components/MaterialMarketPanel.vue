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
        <div class="trade-controls">
          <div class="trade-side">
            <TradeQuantityStepper
              :model-value="buyQty[row.materialId] ?? 1"
              :max="maxBuy(row)"
              @update:model-value="(v) => setBuyQty(row.materialId, v)"
            />
            <button
              class="shop-btn action-btn"
              :disabled="maxBuy(row) < 1"
              @click="emitBuy(row.materialId)"
            >Buy</button>
          </div>
          <div class="trade-side">
            <TradeQuantityStepper
              :model-value="sellQty[row.materialId] ?? 1"
              :max="maxSell(row.materialId)"
              @update:model-value="(v) => setSellQty(row.materialId, v)"
            />
            <button
              class="shop-btn action-btn"
              :disabled="maxSell(row.materialId) < 1"
              @click="emitSell(row.materialId)"
            >Sell</button>
          </div>
        </div>
      </div>
      <div v-if="marketListings.length === 0" class="empty">
        No materials in the market yet. Gather resources in the zones or wait for stock.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { GameState } from '@/engine/GameLoopDesign'
import {
  getMarketMaterialListings,
  getMarketPlayerStock,
  type MarketMaterialListing,
} from '@/engine/MarketSystem'
import { getItemName } from '@/engine/ItemDatabase'
import { materialIcon } from '@/utils/icons'
import TradeQuantityStepper from './TradeQuantityStepper.vue'

const props = defineProps<{
  gameState: GameState
}>()

const emit = defineEmits<{
  buyMaterial: [materialId: string, qty: number]
  sellMaterial: [materialId: string, qty: number]
}>()

const player = computed(() => props.gameState.player)
const gameDay = computed(() => props.gameState.day ?? 1)
const marketListings = computed(() => getMarketMaterialListings(props.gameState))

const buyQty = ref<Record<string, number>>({})
const sellQty = ref<Record<string, number>>({})

watch(
  marketListings,
  (rows) => {
    const nextBuy: Record<string, number> = {}
    const nextSell: Record<string, number> = {}
    for (const row of rows) {
      nextBuy[row.materialId] = 1
      nextSell[row.materialId] = 1
    }
    buyQty.value = nextBuy
    sellQty.value = nextSell
  },
  { immediate: true }
)

function materialCount(matId: string) {
  return getMarketPlayerStock(player.value, matId)
}

function maxBuy(row: MarketMaterialListing): number {
  if (row.stock <= 0 || row.buyPrice <= 0) return 0
  return Math.min(row.stock, Math.floor(player.value.gold / row.buyPrice))
}

function maxSell(materialId: string): number {
  return materialCount(materialId)
}

function setBuyQty(materialId: string, value: number) {
  buyQty.value = { ...buyQty.value, [materialId]: value }
}

function setSellQty(materialId: string, value: number) {
  sellQty.value = { ...sellQty.value, [materialId]: value }
}

function emitBuy(materialId: string) {
  emit('buyMaterial', materialId, buyQty.value[materialId] ?? 1)
}

function emitSell(materialId: string) {
  emit('sellMaterial', materialId, sellQty.value[materialId] ?? 1)
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
.trade-controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
  min-width: min(100%, 22rem);
}
.trade-side {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.action-btn {
  min-width: 3.5rem;
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
  gap: 10px;
}
.shop-item-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
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
.shop-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.empty {
  font-size: 13px;
  color: var(--color-text-muted);
  padding: 8px 0;
}
</style>
