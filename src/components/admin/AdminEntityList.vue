<template>
  <div class="admin-entity-list panel-inset">
    <p v-if="!contentType" class="empty">Select a type</p>
    <p v-else class="empty">Entity list stub ({{ contentType }})</p>
  </div>
</template>

<script setup lang="ts">
import type { ContentType } from '@/engine/admin/ContentOverlayTypes'

defineProps<{
  contentType?: ContentType | null
}>()
</script>

<style scoped>
.admin-entity-list {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
</style>
