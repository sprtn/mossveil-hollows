<template>
  <div class="equipment-section">
    <h3 class="section-title">Equipment</h3>
    
    <div class="equipment-placeholder">
      <p>Equipment system not yet implemented.</p>
      <p class="placeholder-note">Weapons and armor will appear here when equipped.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
// No props needed - equipment system not implemented
</script>

<style scoped>
.equipment-section {
  background-color: #1a1a1a;
  padding: 20px;
  border-radius: 8px;
  border-left: 4px solid #666;
}

.section-title {
  margin: 0 0 16px 0;
  font-size: 18px;
  color: #666;
  border-bottom: 2px solid #666;
  padding-bottom: 8px;
}

.equipment-placeholder {
  text-align: center;
  padding: 32px;
  color: #666;
}

.equipment-placeholder p {
  margin: 8px 0;
}

.placeholder-note {
  font-size: 12px;
  font-style: italic;
  color: #555;
}
</style>
