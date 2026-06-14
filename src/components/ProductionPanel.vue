<template>
  <div v-if="level >= minLevel" class="production-panel">
    <h5>Logging Camp Production</h5>
    <p class="prod-desc">
      While enabled, workers cut oak each time you <strong>end a day</strong> by resting in town
      (Free Rest, Inn, or Sleep at Home). Logs are sold straight to the local market — they never
      sit in your pack. Wages go into the camp payroll, then circulate through town traders.
    </p>
    <p class="prod-day">Town day: <strong>{{ gameDay }}</strong></p>
    <div class="prod-stats">
      <span>Market wood price: <strong>{{ woodPrice }}g</strong> / log</span>
      <span>Base output: <strong>{{ outputPerDay }}</strong> {{ outputName }}/day</span>
      <span>
        Worker morale: <strong>{{ morale }}%</strong>
        <span class="morale-bar" :style="{ '--morale': morale + '%' }" />
      </span>
      <span v-if="bonusChance > 0">
        Bonus log chance: <strong>{{ bonusChanceLabel }}</strong> (pay above {{ fairWage }}g)
      </span>
      <span v-if="state.totalPayrollCirculated > 0">
        Payroll circulated (lifetime): <strong>{{ state.totalPayrollCirculated }}g</strong>
      </span>
      <span v-if="state.accumulatedLogs > 0">
        Total sold by camp: <strong>{{ state.accumulatedLogs }}</strong> logs (lifetime)
      </span>
      <span v-if="state.lastRunDay" class="last-run">
        Last run: Day {{ state.lastRunDay }} —
        {{ state.lastOutput }} logs → {{ state.lastRevenue }}g revenue
        <template v-if="state.lastMorale != null"> (morale {{ state.lastMorale }}%)</template>
      </span>
      <span v-else-if="!state.enabled" class="status-warn">
        Auto-run is off — check the box below to start on your next rest.
      </span>
      <span v-else-if="state.lastSkipReason" class="status-warn">{{ state.lastSkipReason }}</span>
    </div>
    <label class="prod-toggle">
      <input type="checkbox" :checked="state.enabled" @change="toggleEnabled" />
      Auto-cut and sell logs when I rest in town
    </label>
    <div class="labour-row">
      <label>Labour pay (gold/day, 0–{{ maxPay }})</label>
      <input
        type="number"
        min="0"
        :max="maxPay"
        :value="labour"
        class="labour-input"
        @change="updateLabour"
      />
      <span class="labour-hint">
        +{{ moralePerGold }}% morale per gold (max 100% at {{ fairWage }}g).
        Above {{ fairWage }}g: +{{ bonusPerGold }}% chance of one extra log per gold (max
        {{ maxBonusLabel }} at {{ maxPay }}g). Payroll softens wood price crashes in town.
      </span>
    </div>
    <p class="prod-hint">
      Expected when workers show: <strong>~{{ expectedOutput }}</strong> logs,
      net <strong>~{{ netPerDay }}g</strong> ({{ expectedOutput }} × {{ woodPrice }}g − {{ labour }}g pay).
      Low morale can skip a shift entirely.
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { GameState } from '@/engine/GameLoopDesign'
import type { BuildingProductionDef } from '@/engine/ContentSchemas'
import { getBuildingLevel } from '@/engine/BuildingSystem'
import { getProductionState } from '@/engine/EconomyTick'
import { getWoodMarketPrice } from '@/engine/MarketSystem'
import { getItemName } from '@/engine/ItemDatabase'
import {
  LABOUR_PAY_MAX,
  LABOUR_FAIR_WAGE,
  MORALE_PERCENT_PER_GOLD,
  BONUS_LOG_CHANCE_PER_GOLD,
  computeMoralePercent,
  computeBonusLogChance,
  expectedOutputPerRun,
  clampLabourPay,
} from '@/engine/productionLabour'

const props = defineProps<{
  gameState: GameState
  buildingId: string
  production?: BuildingProductionDef
}>()

const emit = defineEmits<{
  toggle: [enabled: boolean]
  labour: [gold: number]
}>()

const fairWage = computed(() => props.production?.fairWageGold ?? LABOUR_FAIR_WAGE)
const maxPay = computed(() => props.production?.maxLabourGold ?? LABOUR_PAY_MAX)
const moralePerGold = MORALE_PERCENT_PER_GOLD
const bonusPerGold = Math.round(BONUS_LOG_CHANCE_PER_GOLD * 100)

const level = computed(() => getBuildingLevel(props.gameState, props.buildingId))
const minLevel = computed(() => props.production?.minLevel ?? 1)
const state = computed(() => getProductionState(props.gameState, props.buildingId))
const gameDay = computed(() => props.gameState.day ?? 1)
const woodPrice = computed(() => getWoodMarketPrice(props.gameState))
const outputPerDay = computed(() => props.production?.outputPerDay ?? 0)
const outputName = computed(() =>
  getItemName(props.production?.outputMaterialId ?? 'oak_wood')
)
const labour = computed(() =>
  clampLabourPay(state.value.labourGoldPerDay ?? props.production?.labourGoldPerDay ?? fairWage.value)
)
const morale = computed(() => computeMoralePercent(labour.value))
const bonusChance = computed(() => computeBonusLogChance(labour.value))
const bonusChanceLabel = computed(() => `${Math.round(bonusChance.value * 100)}%`)
const maxBonusLabel = computed(() =>
  `${Math.round(computeBonusLogChance(maxPay.value) * 100)}%`
)
const expectedOutput = computed(() =>
  expectedOutputPerRun(outputPerDay.value, labour.value).toFixed(1)
)
const netPerDay = computed(() => {
  const revenue = woodPrice.value * expectedOutputPerRun(outputPerDay.value, labour.value)
  return Math.round(revenue - labour.value)
})

function toggleEnabled(event: Event) {
  emit('toggle', (event.target as HTMLInputElement).checked)
}

function updateLabour(event: Event) {
  const val = parseInt((event.target as HTMLInputElement).value, 10)
  emit('labour', Number.isNaN(val) ? 0 : clampLabourPay(val))
}
</script>

<style scoped>
.production-panel {
  margin-top: 12px;
  padding: 12px;
  background: rgba(107, 155, 90, 0.06);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}
.production-panel h5 {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--color-accent);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.prod-desc, .prod-hint, .labour-hint {
  font-size: 12px;
  color: var(--color-text-soft);
  margin: 6px 0;
  line-height: 1.45;
}
.prod-day { font-size: 12px; color: var(--color-text-muted); margin: 4px 0 8px; }
.prod-stats {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #ccc;
  margin-bottom: 10px;
}
.morale-bar {
  display: inline-block;
  width: 64px;
  height: 6px;
  margin-left: 6px;
  vertical-align: middle;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
}
.morale-bar::after {
  content: '';
  display: block;
  height: 100%;
  width: var(--morale);
  background: linear-gradient(90deg, #8b6914, var(--color-accent-warm, #c9a55c));
  border-radius: 3px;
}
.last-run { color: var(--color-accent); }
.status-warn { color: var(--color-warning, #e6a23c); font-style: italic; }
.prod-toggle {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13px;
  margin-bottom: 8px;
  cursor: pointer;
  line-height: 1.4;
}
.labour-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--color-text-soft);
  margin-bottom: 8px;
}
.labour-input {
  width: 80px;
  padding: 4px 8px;
  background: var(--color-panel-inset);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
}
</style>
