<template>
  <div class="vendor-shop-panel">
    <h4>Buy</h4>
    <div class="shop-list">
      <div
        v-for="item in buyList"
        :key="buyKey(item)"
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
        <div class="trade-side">
          <TradeQuantityStepper
            :model-value="buyQty[buyKey(item)] ?? 1"
            :max="maxBuy(item)"
            @update:model-value="(v) => setBuyQty(buyKey(item), v)"
          />
          <button
            class="shop-btn action-btn"
            :disabled="maxBuy(item) < 1"
            @click="emitBuy(item)"
          >Buy</button>
        </div>
      </div>
      <div v-if="buyList.length === 0" class="empty">Nothing for sale right now.</div>
    </div>

    <h4>Sell</h4>
    <div class="shop-list">
      <div
        v-for="item in sellList"
        :key="sellKey(item)"
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
        <div class="trade-side">
          <TradeQuantityStepper
            :model-value="sellQty[sellKey(item)] ?? 1"
            :max="item.quantity"
            @update:model-value="(v) => setSellQty(sellKey(item), v)"
          />
          <button
            class="shop-btn action-btn"
            :disabled="item.quantity < 1"
            @click="emitSell(item)"
          >Sell</button>
        </div>
      </div>
      <div v-if="sellList.length === 0" class="empty">Nothing to sell here.</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
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
import TradeQuantityStepper from './TradeQuantityStepper.vue'

const props = defineProps<{
  gameState: GameState
  vendorId: string
}>()

const emit = defineEmits<{
  buy: [templateId: string, quality: Quality | undefined, qty: number]
  sell: [templateId: string, quality: Quality | undefined, qty: number]
}>()

const player = computed(() => props.gameState.player)
const buyList = computed(() => getVendorBuyList(props.gameState, props.vendorId))
const sellList = computed(() => getVendorSellList(props.gameState, props.vendorId))

const buyQty = ref<Record<string, number>>({})
const sellQty = ref<Record<string, number>>({})

watch(
  [buyList, sellList],
  ([buys, sells]) => {
    const nextBuy: Record<string, number> = {}
    const nextSell: Record<string, number> = {}
    for (const item of buys) {
      nextBuy[buyKey(item)] = 1
    }
    for (const item of sells) {
      nextSell[sellKey(item)] = 1
    }
    buyQty.value = nextBuy
    sellQty.value = nextSell
  },
  { immediate: true }
)

function buyKey(item: { templateId: string; quality?: Quality }) {
  return `${item.templateId}::${item.quality ?? 'common'}`
}

function sellKey(item: { templateId: string; quality: Quality }) {
  return `${item.templateId}::${item.quality}`
}

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

function maxBuy(item: { templateId: string; stock: number; quality?: Quality }) {
  const unit = buyPrice(item.templateId, item.quality)
  if (item.stock <= 0 || unit <= 0) return 0
  return Math.min(item.stock, Math.floor(player.value.gold / unit))
}

function setBuyQty(key: string, value: number) {
  buyQty.value = { ...buyQty.value, [key]: value }
}

function setSellQty(key: string, value: number) {
  sellQty.value = { ...sellQty.value, [key]: value }
}

function emitBuy(item: { templateId: string; quality?: Quality }) {
  const key = buyKey(item)
  emit('buy', item.templateId, item.quality, buyQty.value[key] ?? 1)
}

function emitSell(item: { templateId: string; quality: Quality }) {
  const key = sellKey(item)
  emit('sell', item.templateId, item.quality, sellQty.value[key] ?? 1)
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
  gap: 10px;
  flex-wrap: wrap;
}
.shop-item-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
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
.shop-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.empty {
  font-size: 13px;
  color: var(--color-text-muted);
  padding: 4px 0;
}
</style>
