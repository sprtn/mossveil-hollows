<template>
  <div class="equipment-section">
    <h3 class="section-title">Equipment</h3>

    <div class="equipment-slots">
      <div class="slot">
        <span class="slot-label">Weapon</span>
        <div class="slot-content">
          <template v-if="weapon">
            <span class="equipped-name" :style="{ color: qualityColor(weapon.quality) }">
              {{ formatItemName(getItemName(weapon.templateId), weapon.quality) }}
            </span>
            <span class="equipped-bonus">+{{ weaponBonus }} Strength</span>
            <button @click="unequip('weapon')" class="unequip-btn">Remove</button>
          </template>
          <span v-else class="empty-slot">None equipped</span>
        </div>
      </div>

      <div class="slot">
        <span class="slot-label">Armor</span>
        <div class="slot-content">
          <template v-if="armor">
            <span class="equipped-name" :style="{ color: qualityColor(armor.quality) }">
              {{ formatItemName(getItemName(armor.templateId), armor.quality) }}
            </span>
            <span class="equipped-bonus">+{{ armorBonus }} DEF</span>
            <button @click="unequip('armor')" class="unequip-btn">Remove</button>
          </template>
          <span v-else class="empty-slot">None equipped</span>
        </div>
      </div>
    </div>

    <div class="effective-stats">
      <h4>Effective Combat Stats</h4>
      <div class="stat-row"><span>{{ statIcons.strength }} Strength</span><span>{{ effective.strength }}</span></div>
      <div class="stat-row"><span>{{ statIcons.defense }} DEF</span><span>{{ effective.defense }}</span></div>
      <div class="stat-row"><span>{{ statIcons.dexterity }} DEX</span><span>{{ effective.dexterity }}</span></div>
      <div class="stat-row"><span>{{ statIcons.agility }} AGI</span><span>{{ effective.agility }}</span></div>
    </div>

    <div class="resources-section">
      <h4>Resources</h4>
      <ResourceList />
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject, computed } from 'vue'
import type { Ref } from 'vue'
import type { GameState } from '@/engine/GameLoopDesign'
import { unequipItemAction } from '@/engine/GameLoop'
import { getItemName, getItemTemplate, getEffectiveStats, getEquipBonus } from '@/engine/ItemDatabase'
import { formatItemName, qualityColor, statIcons } from '@/utils/icons'
import ResourceList from './ResourceList.vue'

const gameState = inject<Ref<GameState>>('gameState')!
const dispatch = inject<(state: GameState) => void>('dispatch')!

const weapon = computed(() => gameState.value.player.equipment.weapon)
const armor = computed(() => gameState.value.player.equipment.armor)
const effective = computed(() => getEffectiveStats(gameState.value.player))

const weaponBonus = computed(() =>
  weapon.value
    ? getEquipBonus(getItemTemplate(weapon.value.templateId), weapon.value.quality)
    : 0
)

const armorBonus = computed(() =>
  armor.value
    ? getEquipBonus(getItemTemplate(armor.value.templateId), armor.value.quality)
    : 0
)

function unequip(slot: 'weapon' | 'armor') {
  dispatch(unequipItemAction(gameState.value, slot))
}
</script>

<style scoped>
.equipment-section { background: #1a1a1a; padding: 20px; border-radius: 8px; border-left: 4px solid #3a5a8a; }
.section-title { margin: 0 0 16px; font-size: 18px; color: #64b5f6; border-bottom: 2px solid #3a5a8a; padding-bottom: 8px; }
.equipment-slots { display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px; }
.slot { background: #2a2a2a; padding: 14px; border-radius: 6px; }
.slot-label { font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px; }
.slot-content { display: flex; align-items: center; gap: 12px; margin-top: 8px; flex-wrap: wrap; }
.equipped-name { font-weight: 600; font-size: 16px; }
.equipped-bonus { color: #4caf50; font-size: 13px; }
.empty-slot { color: #666; font-style: italic; }
.unequip-btn { padding: 4px 10px; background: #555; border: none; border-radius: 4px; color: #fff; cursor: pointer; font-size: 12px; }
.effective-stats h4 { margin: 0 0 10px; color: #aaa; font-size: 14px; }
.resources-section { margin-top: 20px; }
.resources-section h4 { margin: 0 0 10px; color: #aaa; font-size: 14px; }
.stat-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #333; color: #ddd; }
</style>
