<template>
  <div class="town-actions-strip">
    <button class="action-button" @click="$emit('rest')">
      {{ resourceIcons.hp }} Free Rest (~60% cap)
    </button>
    <button
      class="action-button"
      :disabled="player.gold < innCost"
      @click="$emit('inn')"
    >
      {{ resourceIcons.gold }} Inn ({{ innCost }}g — full, safe)
    </button>
    <button
      v-if="hasHouse"
      class="action-button primary"
      @click="$emit('sleepHome')"
    >
      {{ resourceIcons.hp }} Sleep at Home (free, full)
    </button>
    <button class="action-button" @click="$emit('save')">Save</button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { GameState } from '@/engine/GameLoopDesign'
import { INN_COST } from '@/engine/gameConfig'
import { getBuildingLevel } from '@/engine/BuildingSystem'
import { resourceIcons } from '@/utils/icons'

const props = defineProps<{
  gameState: GameState
}>()

defineEmits<{
  rest: []
  inn: []
  sleepHome: []
  save: []
}>()

const player = computed(() => props.gameState.player)
const innCost = INN_COST
const hasHouse = computed(() => getBuildingLevel(props.gameState, 'house') >= 1)
</script>

<style scoped>
.town-actions-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}
</style>
