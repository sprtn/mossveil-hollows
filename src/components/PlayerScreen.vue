<template>
  <div class="modal-overlay" @click="closeModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h2>CHARACTER</h2>
        <button @click="closeModal" class="close-button">×</button>
      </div>
      
      <div class="player-screen-content">
        <PlayerOverview />
        <PlayerInventory />
        <PlayerEquipment />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject } from 'vue'
import PlayerOverview from './PlayerOverview.vue'
import PlayerInventory from './PlayerInventory.vue'
import PlayerEquipment from './PlayerEquipment.vue'

const setPlayerScreenOpen = inject<(open: boolean) => void>('setPlayerScreenOpen')!

function closeModal() {
  setPlayerScreenOpen(false)
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background-color: #2a2a2a;
  border-radius: 12px;
  width: 90%;
  max-width: 700px;
  max-height: 85vh;
  overflow-y: auto;
  overflow-x: visible;
  border: 2px solid #444;
  position: relative;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 2px solid #444;
}

.modal-header h2 {
  margin: 0;
  font-size: 24px;
  color: #ffffff;
}

.close-button {
  background: none;
  border: none;
  color: #aaa;
  font-size: 32px;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  line-height: 1;
  transition: color 0.2s;
}

.close-button:hover {
  color: #ffffff;
}

.player-screen-content {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 32px;
  overflow: visible;
}
</style>
