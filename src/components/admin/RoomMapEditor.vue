<template>
  <div class="room-map-editor">
    <div class="room-map-editor__toolbar">
      <span class="hint">Drag nodes to position. Drag from the orange port to connect.</span>
      <button type="button" class="btn btn-sm" @click="resetLayouts">Reset layout</button>
    </div>

    <WorldMapCanvas
      variant="editor"
      :rooms="rooms"
      :layouts="layouts"
      :selected-room-id="selectedRoomId"
      view-scope="world"
      @select-room="emit('select-room', $event)"
      @layout-change="onLayoutChange"
      @connect-rooms="onConnectRequest"
    />

    <div v-if="pendingConnect" class="connect-dialog panel-inset">
      <p>
        Connect <strong>{{ pendingConnect.fromId }}</strong> →
        <strong>{{ pendingConnect.toId }}</strong>
      </p>
      <label class="field-label">
        Exit direction (from source)
        <select v-model="connectDirection" class="field-input">
          <option v-for="d in directions" :key="d" :value="d">{{ directionLabels[d] }}</option>
        </select>
      </label>
      <div class="connect-actions">
        <button type="button" class="btn btn-primary" @click="confirmConnect">Add exit</button>
        <button type="button" class="btn" @click="cancelConnect">Cancel</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { Room, ExitDirection } from '@/engine/RoomSystem'
import type { RoomLayoutsMap } from '@/engine/map/RoomLayout'
import WorldMapCanvas from '@/components/map/WorldMapCanvas.vue'
import {
  loadOverlay,
  saveOverlay,
  setRoomLayout,
  resetRoomLayouts,
  upsertEntity,
} from '@/engine/admin/ContentOverlayStore'
import { getRoom, refreshContentRegistry } from '@/engine/admin/ContentRegistry'

defineProps<{
  rooms: Room[]
  layouts: RoomLayoutsMap
  selectedRoomId?: string | null
}>()

const emit = defineEmits<{
  'select-room': [roomId: string]
  'layouts-updated': []
  'rooms-updated': []
}>()

const directions: ExitDirection[] = ['north', 'south', 'east', 'west', 'up', 'down']
const directionLabels: Record<ExitDirection, string> = {
  north: 'North',
  south: 'South',
  east: 'East',
  west: 'West',
  up: 'Up',
  down: 'Down',
}

const pendingConnect = ref<{ fromId: string; toId: string } | null>(null)
const connectDirection = ref<ExitDirection>('north')

function onLayoutChange(roomId: string, x: number, y: number) {
  let overlay = loadOverlay()
  overlay = setRoomLayout(overlay, roomId, { x, y })
  saveOverlay(overlay)
  refreshContentRegistry()
  emit('layouts-updated')
}

function resetLayouts() {
  if (!confirm('Reset all custom map positions in the overlay?')) return
  let overlay = resetRoomLayouts(loadOverlay())
  saveOverlay(overlay)
  refreshContentRegistry()
  emit('layouts-updated')
}

function onConnectRequest(fromId: string, toId: string) {
  pendingConnect.value = { fromId, toId }
  connectDirection.value = 'north'
}

function cancelConnect() {
  pendingConnect.value = null
}

function confirmConnect() {
  if (!pendingConnect.value) return
  const { fromId, toId } = pendingConnect.value
  const room = getRoom(fromId)
  if (!room) return

  const exits = [...(room.exits ?? [])]
  const dir = connectDirection.value
  const existingIdx = exits.findIndex((e) => e.direction === dir)
  const newExit = { direction: dir, targetRoomId: toId }
  if (existingIdx >= 0) {
    if (!confirm(`Replace existing ${dir} exit on ${fromId}?`)) return
    exits[existingIdx] = { ...exits[existingIdx], ...newExit }
  } else {
    exits.push(newExit)
  }

  let overlay = loadOverlay()
  overlay = upsertEntity(overlay, 'rooms', { ...room, exits })
  saveOverlay(overlay)
  refreshContentRegistry()
  pendingConnect.value = null
  emit('rooms-updated')
}
</script>

<style scoped>
.room-map-editor {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--color-border);
  min-height: 0;
  flex: 1;
}

.room-map-editor :deep(.world-map) {
  flex: 1;
  min-height: 0;
}

.room-map-editor__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  font-size: 12px;
}

.hint {
  color: var(--color-text-muted);
  font-style: italic;
}

.connect-dialog {
  margin: 8px;
  padding: 12px;
}

.field-label {
  display: block;
  font-size: 12px;
  margin: 8px 0;
}

.field-input {
  display: block;
  width: 100%;
  margin-top: 4px;
  padding: 6px 8px;
}

.connect-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.btn-sm {
  font-size: 12px;
  padding: 4px 10px;
}
</style>
