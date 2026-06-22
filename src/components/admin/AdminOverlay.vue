<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="admin-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Content admin"
      @click.self="close"
    >
      <div class="admin-shell panel" @click.stop>
        <header class="admin-topbar">
          <div class="admin-topbar-left">
            <h2 class="admin-title">Content Admin</h2>
            <span v-if="dirty" class="dirty-badge">Unsaved changes</span>
          </div>
          <div class="admin-topbar-actions">
            <input
              ref="importInput"
              type="file"
              accept="application/json,.json"
              class="import-input"
              @change="handleImport"
            />
            <button type="button" class="btn btn-secondary" @click="triggerImport">Import</button>
            <button type="button" class="btn btn-secondary" @click="handleExport">Export</button>
            <button type="button" class="btn btn-danger" @click="handleReset">Reset overlay</button>
            <button type="button" class="btn close-btn" aria-label="Close admin overlay" @click="close">
              ×
            </button>
          </div>
        </header>

        <div class="admin-body">
          <nav class="admin-tabs panel-inset" aria-label="Content types">
            <button
              v-for="tab in contentTabs"
              :key="tab.type"
              type="button"
              class="admin-tab"
              :class="{ active: selectedType === tab.type }"
              @click="selectedType = tab.type"
            >
              {{ tab.label }}
            </button>
          </nav>

          <section class="admin-center panel-inset">
            <AdminEntityList
              ref="entityList"
              :content-type="selectedType"
              @select="onSelectEntity"
              @create="onCreateEntity"
              @duplicated="onEntityDuplicated"
            />
            <div v-if="selectedType === 'rooms'" class="room-map-section">
              <RoomMapEditor
                :rooms="allRooms"
                :layouts="roomLayouts"
                :selected-room-id="selectedEntityId"
                @select-room="onSelectEntity"
                @layouts-updated="syncRoomLayouts"
                @rooms-updated="onRoomMapRoomsUpdated"
              />
            </div>
          </section>

          <aside class="admin-detail panel-inset">
            <template v-if="selectedType === 'rooms'">
              <RoomForm
                ref="roomForm"
                :room-id="selectedEntityId"
                :base-ids="roomBaseIds"
                :overlay-ids="roomOverlayIds"
                :room-options="roomOptions"
                :all-rooms="allRooms"
                @saved="onEntitySaved"
                @deleted="onEntityDeleted"
              />
            </template>
            <template v-else-if="selectedType === 'npcs'">
              <NpcForm
                ref="npcForm"
                :npc-id="selectedEntityId"
                :base-ids="npcBaseIds"
                :overlay-ids="npcOverlayIds"
                :all-npcs="allNpcs"
                :dialogue-options="dialogueOptions"
                @saved="onEntitySaved"
                @deleted="onEntityDeleted"
              />
            </template>
            <template v-else-if="selectedType === 'quests'">
              <QuestForm
                ref="questForm"
                :quest-id="selectedEntityId"
                :base-ids="questBaseIds"
                :overlay-ids="questOverlayIds"
                :all-quests="allQuests"
                @saved="onEntitySaved"
                @deleted="onEntityDeleted"
              />
            </template>
            <template v-else-if="selectedType === 'questlines'">
              <QuestlineForm
                ref="questlineForm"
                :questline-id="selectedEntityId"
                :overlay-ids="questlineOverlayIds"
                :all-questlines="allQuestlines"
                :quest-options="questOptions"
                @saved="onEntitySaved"
                @deleted="onEntityDeleted"
              />
            </template>
            <template v-else-if="selectedType === 'dialogues'">
              <DialogueForm
                ref="dialogueForm"
                :dialogue-id="selectedEntityId"
                :base-ids="dialogueBaseIds"
                :overlay-ids="dialogueOverlayIds"
                :all-dialogues="allDialogues"
                :all-npcs="allNpcs"
                @saved="onEntitySaved"
                @deleted="onEntityDeleted"
              />
            </template>
            <template v-else-if="selectedType === 'encounterTemplates'">
              <EncounterTemplateForm
                ref="encounterTemplateForm"
                :template-id="selectedEntityId"
                :base-ids="encounterTemplateBaseIds"
                :overlay-ids="encounterTemplateOverlayIds"
                :all-templates="allEncounterTemplates"
                @saved="onEntitySaved"
                @deleted="onEntityDeleted"
              />
            </template>
            <template v-else-if="selectedType === 'items'">
              <ItemForm
                ref="itemForm"
                :item-id="selectedEntityId"
                :base-ids="itemBaseIds"
                :overlay-ids="itemOverlayIds"
                :all-items="allItems"
                @saved="onEntitySaved"
                @deleted="onEntityDeleted"
              />
            </template>
            <template v-else-if="selectedType === 'events'">
              <EventForm
                ref="eventForm"
                :event-id="selectedEntityId"
                :base-ids="eventBaseIds"
                :overlay-ids="eventOverlayIds"
                :all-events="allEvents"
                @saved="onEntitySaved"
                @deleted="onEntityDeleted"
              />
            </template>
            <template v-else-if="selectedType === 'recipes'">
              <RecipeForm
                ref="recipeForm"
                :recipe-id="selectedEntityId"
                :base-ids="recipeBaseIds"
                :overlay-ids="recipeOverlayIds"
                :all-recipes="allRecipes"
                @saved="onEntitySaved"
                @deleted="onEntityDeleted"
              />
            </template>
            <template v-else-if="selectedType === 'buildings'">
              <BuildingForm
                ref="buildingForm"
                :building-id="selectedEntityId"
                :base-ids="buildingBaseIds"
                :overlay-ids="buildingOverlayIds"
                :all-buildings="allBuildings"
                @saved="onEntitySaved"
                @deleted="onEntityDeleted"
              />
            </template>
            <template v-else-if="selectedType === 'skills'">
              <SkillForm
                ref="skillForm"
                :skill-id="selectedEntityId"
                :base-ids="skillBaseIds"
                :overlay-ids="skillOverlayIds"
                :all-skills="allSkills"
                @saved="onEntitySaved"
                @deleted="onEntityDeleted"
              />
            </template>
            <template v-else>
              <p v-if="!selectedType" class="empty">Select a type to edit</p>
              <p v-else class="empty">Detail form stub ({{ selectedType }})</p>
            </template>
          </aside>
        </div>

        <AdminValidationPanel ref="validationPanel" />
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
import {
  exportBundle,
  importBundle,
  isOverlayDirty,
  loadOverlay,
  resetOverlay,
} from '@/engine/admin/ContentOverlayStore'
import { OVERLAY_BUNDLE_VERSION, type ContentOverlayBundle, type ContentType } from '@/engine/admin/ContentOverlayTypes'
import {
  getAllRooms,
  getAllRoomLayouts,
  getAllNpcs,
  getAllQuests,
  getAllDialogues,
  getAllQuestlines,
  getAllEncounterTemplates,
  getAllItems,
  getAllEvents,
  getAllRecipes,
  getAllBuildings,
  getAllSkills,
  refreshContentRegistry,
} from '@/engine/admin/ContentRegistry'
import type { Room } from '@/engine/RoomSystem'
import type { RoomLayoutsMap } from '@/engine/map/RoomLayout'
import type { NpcDef, QuestDef, QuestlineDef, DialogueDef, EventCard, RecipeDef, BuildingDef, SkillDef } from '@/engine/ContentSchemas'
import type { ItemTemplate } from '@/engine/GameLoopDesign'
import AdminEntityList from './AdminEntityList.vue'
import RoomMapEditor from './RoomMapEditor.vue'
import RoomForm from './forms/RoomForm.vue'
import NpcForm from './forms/NpcForm.vue'
import QuestForm from './forms/QuestForm.vue'
import QuestlineForm from './forms/QuestlineForm.vue'
import DialogueForm from './forms/DialogueForm.vue'
import EncounterTemplateForm from './forms/EncounterTemplateForm.vue'
import ItemForm from './forms/ItemForm.vue'
import EventForm from './forms/EventForm.vue'
import RecipeForm from './forms/RecipeForm.vue'
import BuildingForm from './forms/BuildingForm.vue'
import SkillForm from './forms/SkillForm.vue'
import AdminValidationPanel from './AdminValidationPanel.vue'
import type { EncounterTemplateEntry } from './forms/EncounterTemplateForm.vue'

const open = defineModel<boolean>('open', { default: false })

const selectedType = ref<ContentType | null>(null)
const selectedEntityId = ref<string | null>(null)
const roomLayouts = ref<RoomLayoutsMap>({})
const importInput = useTemplateRef<HTMLInputElement>('importInput')
const dirtyTick = ref(0)
const entityList = useTemplateRef<InstanceType<typeof AdminEntityList>>('entityList')
const roomForm = useTemplateRef<InstanceType<typeof RoomForm>>('roomForm')
const npcForm = useTemplateRef<InstanceType<typeof NpcForm>>('npcForm')
const questForm = useTemplateRef<InstanceType<typeof QuestForm>>('questForm')
const questlineForm = useTemplateRef<InstanceType<typeof QuestlineForm>>('questlineForm')
const dialogueForm = useTemplateRef<InstanceType<typeof DialogueForm>>('dialogueForm')
const encounterTemplateForm = useTemplateRef<InstanceType<typeof EncounterTemplateForm>>('encounterTemplateForm')
const itemForm = useTemplateRef<InstanceType<typeof ItemForm>>('itemForm')
const eventForm = useTemplateRef<InstanceType<typeof EventForm>>('eventForm')
const recipeForm = useTemplateRef<InstanceType<typeof RecipeForm>>('recipeForm')
const buildingForm = useTemplateRef<InstanceType<typeof BuildingForm>>('buildingForm')
const skillForm = useTemplateRef<InstanceType<typeof SkillForm>>('skillForm')
const validationPanel = useTemplateRef<InstanceType<typeof AdminValidationPanel>>('validationPanel')

// Rooms
const allRooms = ref<Room[]>([])
const roomBaseIds = ref<Set<string>>(new Set())
const roomOverlayIds = ref<Set<string>>(new Set())
const roomOptions = computed<{ id: string; label: string }[]>(() =>
  allRooms.value.map((r) => ({ id: r.id, label: r.name || r.id }))
)

// NPCs
const allNpcs = ref<NpcDef[]>([])
const npcBaseIds = ref<Set<string>>(new Set())
const npcOverlayIds = ref<Set<string>>(new Set())

// Quests
const allQuests = ref<QuestDef[]>([])
const questBaseIds = ref<Set<string>>(new Set())
const questOverlayIds = ref<Set<string>>(new Set())
const questOptions = computed<{ id: string; label: string }[]>(() =>
  allQuests.value.map((q) => ({ id: q.id, label: q.name || q.id }))
)

// Questlines
const allQuestlines = ref<QuestlineDef[]>([])
const questlineOverlayIds = ref<Set<string>>(new Set())

// Dialogues
const allDialogues = ref<DialogueDef[]>([])
const dialogueBaseIds = ref<Set<string>>(new Set())
const dialogueOverlayIds = ref<Set<string>>(new Set())

// Encounter templates
const allEncounterTemplates = ref<EncounterTemplateEntry[]>([])
const encounterTemplateBaseIds = ref<Set<string>>(new Set())
const encounterTemplateOverlayIds = ref<Set<string>>(new Set())

// Items
const allItems = ref<ItemTemplate[]>([])
const itemBaseIds = ref<Set<string>>(new Set())
const itemOverlayIds = ref<Set<string>>(new Set())

// Events
const allEvents = ref<EventCard[]>([])
const eventBaseIds = ref<Set<string>>(new Set())
const eventOverlayIds = ref<Set<string>>(new Set())

// Recipes
const allRecipes = ref<RecipeDef[]>([])
const recipeBaseIds = ref<Set<string>>(new Set())
const recipeOverlayIds = ref<Set<string>>(new Set())

// Buildings
const allBuildings = ref<BuildingDef[]>([])
const buildingBaseIds = ref<Set<string>>(new Set())
const buildingOverlayIds = ref<Set<string>>(new Set())

// Skills
const allSkills = ref<SkillDef[]>([])
const skillBaseIds = ref<Set<string>>(new Set())
const skillOverlayIds = ref<Set<string>>(new Set())

const dialogueOptions = computed<{ id: string; label: string }[]>(() => {
  const source = allDialogues.value.length ? allDialogues.value : getAllDialogues()
  return source.map((d) => ({ id: d.id, label: d.npcId ? `(npc: ${d.npcId})` : d.id }))
})

function computeIdSets(
  allEntities: { id: string }[],
  overlayUpsertIds: Set<string>,
): { baseIds: Set<string>; overlayIds: Set<string> } {
  const baseIds = new Set<string>()
  for (const e of allEntities) {
    if (!overlayUpsertIds.has(e.id)) baseIds.add(e.id)
  }
  return { baseIds, overlayIds: overlayUpsertIds }
}

function syncRoomData() {
  refreshContentRegistry()
  allRooms.value = getAllRooms()
  roomLayouts.value = getAllRoomLayouts()
  const overlay = loadOverlay()
  const oIds = new Set(Object.keys(overlay.upserts.rooms))
  const { baseIds, overlayIds } = computeIdSets(allRooms.value, oIds)
  roomBaseIds.value = baseIds
  roomOverlayIds.value = overlayIds
}

function syncRoomLayouts() {
  refreshContentRegistry()
  roomLayouts.value = getAllRoomLayouts()
  refreshDirty()
}

function onRoomMapRoomsUpdated() {
  syncRoomData()
  entityList.value?.refresh()
  refreshDirty()
  validationPanel.value?.runValidation()
  if (selectedEntityId.value) {
    const room = allRooms.value.find((r) => r.id === selectedEntityId.value)
    if (room) roomForm.value?.loadRoom(room)
  }
}

function syncNpcData() {
  refreshContentRegistry()
  allNpcs.value = getAllNpcs()
  const overlay = loadOverlay()
  const oIds = new Set(Object.keys(overlay.upserts.npcs))
  const { baseIds, overlayIds } = computeIdSets(allNpcs.value, oIds)
  npcBaseIds.value = baseIds
  npcOverlayIds.value = overlayIds
}

function syncQuestData() {
  refreshContentRegistry()
  allQuests.value = getAllQuests()
  const overlay = loadOverlay()
  const oIds = new Set(Object.keys(overlay.upserts.quests))
  const { baseIds, overlayIds } = computeIdSets(allQuests.value, oIds)
  questBaseIds.value = baseIds
  questOverlayIds.value = overlayIds
}

function syncQuestlineData() {
  refreshContentRegistry()
  allQuestlines.value = getAllQuestlines()
  const overlay = loadOverlay()
  questlineOverlayIds.value = new Set(Object.keys(overlay.upserts.questlines))
}

function syncDialogueData() {
  refreshContentRegistry()
  allDialogues.value = getAllDialogues()
  const overlay = loadOverlay()
  const oIds = new Set(Object.keys(overlay.upserts.dialogues))
  const { baseIds, overlayIds } = computeIdSets(allDialogues.value, oIds)
  dialogueBaseIds.value = baseIds
  dialogueOverlayIds.value = overlayIds
}

function syncEncounterTemplateData() {
  refreshContentRegistry()
  allEncounterTemplates.value = getAllEncounterTemplates()
  const overlay = loadOverlay()
  const oIds = new Set(Object.keys(overlay.upserts.encounterTemplates))
  const { baseIds, overlayIds } = computeIdSets(allEncounterTemplates.value, oIds)
  encounterTemplateBaseIds.value = baseIds
  encounterTemplateOverlayIds.value = overlayIds
}

function syncItemData() {
  refreshContentRegistry()
  allItems.value = getAllItems()
  const overlay = loadOverlay()
  const oIds = new Set(Object.keys(overlay.upserts.items))
  const { baseIds, overlayIds } = computeIdSets(allItems.value, oIds)
  itemBaseIds.value = baseIds
  itemOverlayIds.value = overlayIds
}

function syncEventData() {
  refreshContentRegistry()
  allEvents.value = getAllEvents()
  const overlay = loadOverlay()
  const oIds = new Set(Object.keys(overlay.upserts.events))
  const { baseIds, overlayIds } = computeIdSets(allEvents.value, oIds)
  eventBaseIds.value = baseIds
  eventOverlayIds.value = overlayIds
}

function syncRecipeData() {
  refreshContentRegistry()
  allRecipes.value = getAllRecipes()
  const overlay = loadOverlay()
  const oIds = new Set(Object.keys(overlay.upserts.recipes))
  const { baseIds, overlayIds } = computeIdSets(allRecipes.value, oIds)
  recipeBaseIds.value = baseIds
  recipeOverlayIds.value = overlayIds
}

function syncBuildingData() {
  refreshContentRegistry()
  allBuildings.value = getAllBuildings()
  const overlay = loadOverlay()
  const oIds = new Set(Object.keys(overlay.upserts.buildings))
  const { baseIds, overlayIds } = computeIdSets(allBuildings.value, oIds)
  buildingBaseIds.value = baseIds
  buildingOverlayIds.value = overlayIds
}

function syncSkillData() {
  refreshContentRegistry()
  allSkills.value = getAllSkills()
  const overlay = loadOverlay()
  const oIds = new Set(Object.keys(overlay.upserts.skills))
  const { baseIds, overlayIds } = computeIdSets(allSkills.value, oIds)
  skillBaseIds.value = baseIds
  skillOverlayIds.value = overlayIds
}

function syncDataForType(type: ContentType | null) {
  if (type === 'rooms') syncRoomData()
  else if (type === 'npcs') syncNpcData()
  else if (type === 'quests') syncQuestData()
  else if (type === 'questlines') syncQuestlineData()
  else if (type === 'dialogues') syncDialogueData()
  else if (type === 'encounterTemplates') syncEncounterTemplateData()
  else if (type === 'items') syncItemData()
  else if (type === 'events') syncEventData()
  else if (type === 'recipes') syncRecipeData()
  else if (type === 'buildings') syncBuildingData()
  else if (type === 'skills') syncSkillData()
}

function onSelectEntity(id: string) {
  selectedEntityId.value = id
}

function onCreateEntity() {
  selectedEntityId.value = null
  const type = selectedType.value
  if (type === 'rooms') roomForm.value?.createNew()
  else if (type === 'npcs') npcForm.value?.createNew()
  else if (type === 'quests') questForm.value?.createNew()
  else if (type === 'questlines') questlineForm.value?.createNew()
  else if (type === 'dialogues') dialogueForm.value?.createNew()
  else if (type === 'encounterTemplates') encounterTemplateForm.value?.createNew()
  else if (type === 'items') itemForm.value?.createNew()
  else if (type === 'events') eventForm.value?.createNew()
  else if (type === 'recipes') recipeForm.value?.createNew()
  else if (type === 'buildings') buildingForm.value?.createNew()
  else if (type === 'skills') skillForm.value?.createNew()
}

function onEntitySaved() {
  syncDataForType(selectedType.value)
  entityList.value?.refresh()
  refreshDirty()
  validationPanel.value?.runValidation()
}

function onEntityDuplicated(id: string) {
  selectedEntityId.value = id
  syncDataForType(selectedType.value)
  entityList.value?.refresh()
  refreshDirty()
  validationPanel.value?.runValidation()
}

function onEntityDeleted() {
  selectedEntityId.value = null
  syncDataForType(selectedType.value)
  entityList.value?.refresh()
  refreshDirty()
}

const dirty = computed(() => {
  dirtyTick.value
  return isOverlayDirty()
})

function refreshDirty() {
  dirtyTick.value++
}

const contentTabs: { type: ContentType; label: string }[] = [
  { type: 'rooms', label: 'Locations' },
  { type: 'npcs', label: 'NPCs' },
  { type: 'quests', label: 'Quests' },
  { type: 'questlines', label: 'Questlines' },
  { type: 'dialogues', label: 'Dialogue' },
  { type: 'items', label: 'Items' },
  { type: 'events', label: 'Events' },
  { type: 'encounterTemplates', label: 'Encounters' },
  { type: 'recipes', label: 'Recipes' },
  { type: 'buildings', label: 'Buildings' },
  { type: 'skills', label: 'Skills' },
]

function close() {
  open.value = false
}

function handleExport() {
  const json = JSON.stringify(exportBundle(), null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `content-overlay-v1-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function triggerImport() {
  importInput.value?.click()
}

async function handleImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  try {
    const text = await file.text()
    const bundle = JSON.parse(text) as ContentOverlayBundle
    if (bundle.version !== OVERLAY_BUNDLE_VERSION) {
      throw new Error(`Unsupported overlay bundle version: ${bundle.version ?? 'missing'}`)
    }
    importBundle(bundle)
    refreshContentRegistry()
    syncDataForType(selectedType.value)
    entityList.value?.refresh()
    refreshDirty()
    validationPanel.value?.runValidation()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to import overlay bundle'
    window.alert(`Import failed: ${message}`)
  } finally {
    input.value = ''
  }
}

function handleReset() {
  if (!window.confirm('Reset all content overlay changes? This cannot be undone.')) return
  resetOverlay()
  refreshContentRegistry()
  syncDataForType(selectedType.value)
  entityList.value?.refresh()
  refreshDirty()
  validationPanel.value?.runValidation()
}

watch(open, (isOpen) => {
  if (isOpen) {
    refreshDirty()
    syncDataForType(selectedType.value)
    validationPanel.value?.runValidation()
  }
})

watch(selectedType, (type) => {
  selectedEntityId.value = null
  syncDataForType(type)
})
</script>

<style scoped>
.admin-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: stretch;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.78);
}

.admin-shell {
  display: flex;
  flex-direction: column;
  width: min(1400px, 100%);
  max-height: 100%;
  padding: 0;
  overflow: hidden;
}

.admin-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-elevated);
}

.admin-topbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.admin-title {
  margin: 0;
  font-size: 18px;
  letter-spacing: 0.04em;
  color: var(--color-accent-bright);
}

.dirty-badge {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-warning);
  border: 1px solid rgba(212, 168, 75, 0.35);
  border-radius: var(--radius-sm);
  padding: 2px 8px;
  background: rgba(212, 168, 75, 0.1);
}

.admin-topbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.import-input {
  display: none;
}

.close-btn {
  min-width: 36px;
  padding: 4px 10px;
  font-size: 22px;
  line-height: 1;
}

.admin-body {
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr) minmax(280px, 360px);
  gap: 12px;
  flex: 1;
  min-height: 0;
  padding: 12px;
  overflow: hidden;
}

.admin-tabs {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  overflow-y: auto;
}

.admin-tab {
  text-align: left;
  padding: 8px 10px;
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-soft);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.15s;
}

.admin-tab:hover {
  color: var(--color-text);
  background: var(--color-bg-elevated);
  border-color: var(--color-border);
}

.admin-tab.active {
  color: var(--color-text);
  background: rgba(95, 143, 80, 0.15);
  border-color: var(--color-accent);
  box-shadow: var(--shadow-glow);
}

.admin-center,
.admin-detail {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-soft);
  font-style: italic;
  font-size: 13px;
  padding: 24px;
}

.admin-center {
  padding: 0;
}

.room-map-section {
  flex: 1;
  min-height: 200px;
  display: flex;
  flex-direction: column;
}

.admin-detail {
  padding: 0;
  overflow: hidden;
}
</style>
