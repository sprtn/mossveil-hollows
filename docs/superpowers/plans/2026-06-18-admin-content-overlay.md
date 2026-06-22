# Admin Content Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an in-game dev admin overlay with full CRUD over all game content types, persisting edits in localStorage and supporting single-bundle export/import.

**Architecture:** Central `ContentRegistry` merges shipped JSON (glob-loaded) with a `ContentOverlayStore` in localStorage. `AdminOverlay.vue` provides structured forms with reference pickers. `DEV_ADMIN_ENABLED` + Ctrl+Shift+Q toggles access.

**Tech Stack:** Vue 3, TypeScript, Vite, Vitest, existing `ContentSchemas.ts` types

**Spec:** `docs/superpowers/specs/2026-06-18-admin-content-overlay-design.md`

## Global Constraints

- `DEV_ADMIN_ENABLED = import.meta.env.DEV` in `gameConfig.ts`
- localStorage key: `strat_content_overlay_v1`
- Bundle version: `1` (reject other versions on import)
- Overlay merge: upserts override base; `deletedIds` hide base entities
- Structured forms only — no raw JSON editor in v1
- Do not modify shipped JSON at runtime — overlay only
- Follow existing engine patterns (`RoomManager` glob, `ContentSchemas` types)
- Vitest for all engine/admin logic; run `npx vitest run` after each task

---

## File Structure Overview

| Path | Responsibility |
|------|----------------|
| `src/engine/admin/ContentOverlayTypes.ts` | Bundle + overlay type definitions |
| `src/engine/admin/ContentOverlayStore.ts` | localStorage CRUD, import/export |
| `src/engine/admin/ContentRegistry.ts` | Glob base assets, merge overlay, public getters |
| `src/engine/admin/ContentValidator.ts` | Cross-ref validation |
| `src/engine/admin/contentIndexes.ts` | Build ref lists for RefPicker |
| `src/components/admin/AdminOverlay.vue` | Shell layout, tabs, top bar |
| `src/components/admin/AdminEntityList.vue` | Searchable list with badges |
| `src/components/admin/AdminEntityDetail.vue` | Routes to type-specific form |
| `src/components/admin/forms/*.vue` | Shared + per-type form components |
| `src/assets/encounters/*.json` | Extracted encounter templates |

---

## Phase 1: Foundation

### Task 1: Overlay types and empty store

**Files:**
- Create: `src/engine/admin/ContentOverlayTypes.ts`
- Create: `src/engine/admin/ContentOverlayStore.ts`
- Create: `src/engine/__tests__/admin/contentOverlayStore.test.ts`

**Interfaces:**
- Produces: `ContentOverlayState`, `ContentOverlayBundle`, `ContentType`, `createEmptyOverlay()`, `loadOverlay()`, `saveOverlay(state)`, `exportBundle()`, `importBundle(bundle)`

- [ ] **Step 1: Write failing tests**

```typescript
// src/engine/__tests__/admin/contentOverlayStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import {
  createEmptyOverlay,
  upsertEntity,
  markDeleted,
  exportBundle,
  importBundle,
  loadOverlay,
  saveOverlay,
  OVERLAY_STORAGE_KEY,
} from '../../admin/ContentOverlayStore'

describe('ContentOverlayStore', () => {
  beforeEach(() => {
    localStorage.removeItem(OVERLAY_STORAGE_KEY)
  })

  it('starts empty', () => {
    expect(loadOverlay()).toEqual(createEmptyOverlay())
  })

  it('upserts and exports a room', () => {
    let state = createEmptyOverlay()
    state = upsertEntity(state, 'rooms', {
      id: 'test_room',
      type: 'static',
      name: 'Test',
      description: 'Desc',
      exits: [],
    })
    saveOverlay(state)
    const bundle = exportBundle()
    expect(bundle.upserts.rooms.test_room.name).toBe('Test')
  })

  it('marks deleted ids', () => {
    let state = upsertEntity(createEmptyOverlay(), 'rooms', {
      id: 'gone_room', type: 'static', name: 'G', description: 'D', exits: [],
    })
    state = markDeleted(state, 'rooms', 'town_hub')
    expect(state.deletedIds.rooms).toContain('town_hub')
  })

  it('import merges upserts and deletedIds', () => {
    const bundle = exportBundle()
    bundle.upserts.npcs = {
      new_npc: { id: 'new_npc', name: 'N', role: 'R', dialogueId: 'd1' },
    }
    bundle.deletedIds.quests = ['tainted_grove']
    importBundle(bundle)
    const loaded = loadOverlay()
    expect(loaded.upserts.npcs.new_npc).toBeDefined()
    expect(loaded.deletedIds.quests).toContain('tainted_grove')
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npx vitest run src/engine/__tests__/admin/contentOverlayStore.test.ts`

- [ ] **Step 3: Implement types and store**

```typescript
// src/engine/admin/ContentOverlayTypes.ts
import type { Room } from '../RoomSystem'
import type {
  NpcDef, QuestDef, DialogueDef, EventCard, RecipeDef, BuildingDef, SkillDef,
} from '../ContentSchemas'
import type { ItemTemplate, Enemy } from '../GameLoopDesign'

export const OVERLAY_BUNDLE_VERSION = 1 as const
export const OVERLAY_STORAGE_KEY = 'strat_content_overlay_v1'

export interface QuestlineDef {
  id: string
  name: string
  description?: string
  questIds: string[]
  requiredQuestIds?: string[]
  startFlag?: string
}

export type ContentType =
  | 'rooms' | 'npcs' | 'quests' | 'questlines' | 'dialogues'
  | 'items' | 'events' | 'recipes' | 'buildings' | 'skills' | 'encounterTemplates'

export type ContentEntityMap = {
  rooms: Room
  npcs: NpcDef
  quests: QuestDef
  questlines: QuestlineDef
  dialogues: DialogueDef
  items: ItemTemplate
  events: EventCard
  recipes: RecipeDef
  buildings: BuildingDef
  skills: SkillDef
  encounterTemplates: Enemy[]
}

export interface ContentOverlayState {
  upserts: { [K in ContentType]: Record<string, ContentEntityMap[K]> }
  deletedIds: { [K in ContentType]: string[] }
}

export interface ContentOverlayBundle {
  version: typeof OVERLAY_BUNDLE_VERSION
  exportedAt: string
  gameVersion: string
  upserts: ContentOverlayState['upserts']
  deletedIds: ContentOverlayState['deletedIds']
}
```

Implement `ContentOverlayStore.ts` with `createEmptyOverlay`, `loadOverlay`, `saveOverlay`, `upsertEntity`, `markDeleted`, `removeUpsert`, `resetOverlay(type?)`, `exportBundle`, `importBundle` (deep merge per type).

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/engine/admin/ docs/superpowers/
git commit -m "feat(admin): add content overlay store and types"
```

---

### Task 2: ContentRegistry with room glob + overlay merge

**Files:**
- Create: `src/engine/admin/ContentRegistry.ts`
- Create: `src/engine/__tests__/admin/contentRegistry.test.ts`
- Modify: `src/engine/RoomManager.ts` — delegate to registry
- Modify: `src/engine/gameConfig.ts` — add `DEV_ADMIN_ENABLED`

**Interfaces:**
- Consumes: `ContentOverlayStore.loadOverlay`, `saveOverlay`
- Produces: `initContentRegistry()`, `refreshContentRegistry()`, `getRoom(id)`, `getAllRooms()`, `getEffectiveMap(type)`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { initContentRegistry, getRoom, getAllRooms, refreshContentRegistry } from '../../admin/ContentRegistry'
import { upsertEntity, saveOverlay, createEmptyOverlay, markDeleted, OVERLAY_STORAGE_KEY } from '../../admin/ContentOverlayStore'

describe('ContentRegistry rooms', () => {
  beforeEach(() => {
    localStorage.removeItem(OVERLAY_STORAGE_KEY)
    initContentRegistry()
  })

  it('loads shipped town_hub', () => {
    expect(getRoom('town_hub')?.name).toBeTruthy()
  })

  it('overlay upsert overrides base room name', () => {
    let overlay = upsertEntity(createEmptyOverlay(), 'rooms', {
      ...getRoom('town_hub')!,
      name: 'Overlay Hub',
    })
    saveOverlay(overlay)
    refreshContentRegistry()
    expect(getRoom('town_hub')?.name).toBe('Overlay Hub')
  })

  it('deleted id hides base room', () => {
    let overlay = markDeleted(createEmptyOverlay(), 'rooms', 'town_hub')
    saveOverlay(overlay)
    refreshContentRegistry()
    expect(getAllRooms().some(r => r.id === 'town_hub')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement ContentRegistry**

```typescript
// Pattern for each type — rooms first:
const roomModules = import.meta.glob<{ default: Room }>('../assets/rooms/*.json', { eager: true })

function loadBaseRooms(): Record<string, Room> {
  const map: Record<string, Room> = {}
  for (const mod of Object.values(roomModules)) {
    const room = mod.default
    map[room.id] = room
  }
  return map
}

function mergeMaps<T>(base: Record<string, T>, overlay: ContentOverlayState, type: ContentType): Record<string, T> {
  const result = { ...base, ...overlay.upserts[type] }
  for (const id of overlay.deletedIds[type]) delete result[id]
  return result
}
```

Export `initContentRegistry()` (call from `main.ts`), `refreshContentRegistry()`, typed getters.

Update `RoomManager.ts`:

```typescript
import { getRoom as getRoomFromRegistry } from './admin/ContentRegistry'

export async function loadRoom(roomId: string): Promise<Room> {
  const room = getRoomFromRegistry(roomId)
  if (!room) throw new Error(`Room not found: ${roomId}`)
  return room
}
```

Add to `gameConfig.ts`:

```typescript
export const DEV_ADMIN_ENABLED = import.meta.env.DEV
```

Call `initContentRegistry()` in `src/main.ts` before `createApp`.

- [ ] **Step 4: Run all tests — fix regressions**

Run: `npx vitest run`

- [ ] **Step 5: Commit**

---

### Task 3: Admin overlay shell + hotkey

**Files:**
- Create: `src/components/admin/AdminOverlay.vue`
- Create: `src/components/admin/AdminEntityList.vue` (stub)
- Modify: `src/App.vue` — hotkey listener, mount AdminOverlay

**Interfaces:**
- Consumes: `DEV_ADMIN_ENABLED`, `refreshContentRegistry`
- Produces: `AdminOverlay` toggled via `v-model:open`

- [ ] **Step 1: Create AdminOverlay shell**

Layout per spec: left tabs (11 types), center list stub, right detail stub, top bar with Export/Import/Reset buttons (wired in Task 4).

- [ ] **Step 2: Wire hotkey in App.vue**

```typescript
import { ref, onMounted, onUnmounted } from 'vue'
import { DEV_ADMIN_ENABLED } from '@/engine/gameConfig'
import AdminOverlay from './components/admin/AdminOverlay.vue'

const adminOpen = ref(false)

function onKeydown(e: KeyboardEvent) {
  if (!DEV_ADMIN_ENABLED) return
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') {
    e.preventDefault()
    adminOpen.value = !adminOpen.value
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
```

- [ ] **Step 3: Manual verify in dev**

Run `npm run dev`, Ctrl+Shift+Q toggles overlay.

- [ ] **Step 4: Commit**

---

### Task 4: Export / import / reset in admin top bar

**Files:**
- Modify: `src/components/admin/AdminOverlay.vue`
- Modify: `src/engine/admin/ContentOverlayStore.ts` — add `downloadBundle()`, `parseBundleFile(file)`

- [ ] **Step 1: Export button triggers download**

```typescript
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
```

- [ ] **Step 2: Import file input + merge**

Hidden `<input type="file" accept="application/json">`; on change parse, validate `version === 1`, call `importBundle`, `refreshContentRegistry`.

- [ ] **Step 3: Reset with confirm**

`resetOverlay()` or per-type; confirm dialog; refresh registry.

- [ ] **Step 4: Commit**

---

### Task 5: Locations CRUD (rooms form)

**Files:**
- Create: `src/components/admin/forms/RoomForm.vue`
- Create: `src/components/admin/forms/RoomExitEditor.vue`
- Create: `src/components/admin/forms/GatherNodeEditor.vue`
- Create: `src/components/admin/forms/EncounterEditor.vue`
- Create: `src/components/admin/forms/RefPicker.vue`
- Modify: `src/components/admin/AdminEntityList.vue`
- Modify: `src/components/admin/AdminOverlay.vue`

- [ ] **Step 1: RefPicker component**

Props: `modelValue: string`, `options: { id: string; label: string }[]`, `placeholder`. Emits `update:modelValue`.

- [ ] **Step 2: RoomForm with all Room fields**

Save calls `upsertEntity(loadOverlay(), 'rooms', room)` → `saveOverlay` → `refreshContentRegistry`.

Create generates new id `room_${Date.now()}` with defaults. Delete calls `markDeleted` (if base) or `removeUpsert` (if overlay-only).

- [ ] **Step 3: AdminEntityList shows getAllRooms()**

Badge: "base" if only in shipped, "overlay" if in upserts, "modified" if upsert overrides base id.

- [ ] **Step 4: Manual test — edit town_hub name, verify in-game room title changes**

- [ ] **Step 5: Commit**

---

## Phase 2: People & Story

### Task 6: Migrate NpcData + QuestData + DialogueSystem to ContentRegistry

**Files:**
- Modify: `src/engine/admin/ContentRegistry.ts` — add npcs, quests, dialogues globs
- Modify: `src/engine/NpcData.ts`, `QuestData.ts`, `DialogueSystem.ts` — delegate to registry
- Create: `src/engine/__tests__/admin/contentRegistry.npc.test.ts`

- [ ] **Step 1: Tests for npc/quest/dialogue overlay merge**

- [ ] **Step 2: Add eager globs for `assets/npcs/*.json`, `assets/quests/*.json`, `assets/dialogue/*.json`**

- [ ] **Step 3: Refactor getters — `getNpc`, `getAllNpcs`, `getQuest`, `getDialogue`, etc.**

- [ ] **Step 4: Run full test suite**

- [ ] **Step 5: Commit**

---

### Task 7: Outcome effect/requirement form editors

**Files:**
- Create: `src/engine/admin/outcomeFormMeta.ts` — labels, fields per kind
- Create: `src/components/admin/forms/OutcomeEffectEditor.vue`
- Create: `src/components/admin/forms/OutcomeRequirementEditor.vue`
- Create: `src/components/admin/forms/RepeatableList.vue`
- Create: `src/engine/__tests__/admin/outcomeFormMeta.test.ts`

- [ ] **Step 1: Test that all OutcomeEffect kinds have form metadata**

- [ ] **Step 2: Implement kind selector + conditional fields using RefPicker for ids**

- [ ] **Step 3: Commit**

---

### Task 8: NPC + Quest + Questline forms

**Files:**
- Create: `src/components/admin/forms/NpcForm.vue`
- Create: `src/components/admin/forms/QuestForm.vue`
- Create: `src/components/admin/forms/QuestStageEditor.vue`
- Create: `src/components/admin/forms/QuestlineForm.vue`
- Modify: `src/engine/ContentSchemas.ts` — export `QuestlineDef` (re-export from admin types or move to schemas)

Wire tabs in AdminOverlay.

- [ ] **Step 1: NpcForm — dialogueId RefPicker scoped to dialogues**

- [ ] **Step 2: QuestForm — repeatable stages with objective type selector + target RefPicker**

- [ ] **Step 3: QuestlineForm — questIds multi-picker ordered via RepeatableList**

- [ ] **Step 4: Commit**

---

### Task 9: Dialogue tree form

**Files:**
- Create: `src/components/admin/forms/DialogueForm.vue`
- Create: `src/components/admin/forms/DialogueNodeEditor.vue`

- [ ] **Step 1: Node list with add/remove**

- [ ] **Step 2: Per-node responses with next-node RefPicker (same dialogue nodes)**

- [ ] **Step 3: OutcomeEffectEditor on responses**

- [ ] **Step 4: Commit**

---

## Phase 3: World Systems

### Task 10: Migrate ItemDatabase, EventSystem, CraftingSystem, BuildingSystem, SkillSystem to ContentRegistry

**Files:**
- Modify: `src/engine/admin/ContentRegistry.ts`
- Modify: `src/engine/ItemDatabase.ts`, `EventSystem.ts`, `CraftingSystem.ts`, `BuildingSystem.ts`, `SkillSystem.ts`
- Create: `src/engine/__tests__/admin/contentRegistry.assets.test.ts`

Replace manual import arrays with registry delegation. Item map built from `getAllItems()`.

- [ ] **Step 1: Tests per type for overlay override**

- [ ] **Step 2: Globs for items, events, recipes, buildings, skills**

- [ ] **Step 3: Refactor each module**

- [ ] **Step 4: Full test suite**

- [ ] **Step 5: Commit**

---

### Task 11: Extract encounter templates from EventSystem

**Files:**
- Create: `src/assets/encounters/wolf_pair.json`, `bandit_trio.json`, etc. (from existing ENCOUNTER_TEMPLATES)
- Modify: `src/engine/EventSystem.ts` — load via ContentRegistry
- Modify: `src/engine/admin/ContentRegistry.ts` — encounterTemplates glob
- Create: `src/components/admin/forms/EncounterTemplateForm.vue`

- [ ] **Step 1: Move hardcoded templates to JSON files preserving ids**

- [ ] **Step 2: `getEncounterTemplate(id)` in registry**

- [ ] **Step 3: EncounterTemplateForm — Enemy[] editor**

- [ ] **Step 4: Commit**

---

### Task 12: Item, Event, Recipe, Building, Skill forms

**Files:**
- Create: `src/components/admin/forms/ItemForm.vue`
- Create: `src/components/admin/forms/EventForm.vue`
- Create: `src/components/admin/forms/RecipeForm.vue`
- Create: `src/components/admin/forms/BuildingForm.vue`
- Create: `src/components/admin/forms/SkillForm.vue`

- [ ] **Step 1: ItemForm — type, stats, quality fields per ItemTemplate**

- [ ] **Step 2: EventForm — choices with OutcomeRequirement/Effect editors**

- [ ] **Step 3: RecipeForm — materials map editor**

- [ ] **Step 4: BuildingForm — levels repeatable**

- [ ] **Step 5: SkillForm — training + combat JSON-shaped fields as sub-forms**

- [ ] **Step 6: Wire all tabs in AdminOverlay**

- [ ] **Step 7: Commit**

---

## Phase 4: Polish

### Task 13: ContentValidator

**Files:**
- Create: `src/engine/admin/ContentValidator.ts`
- Create: `src/engine/admin/contentIndexes.ts`
- Create: `src/engine/__tests__/admin/contentValidator.test.ts`
- Create: `src/components/admin/AdminValidationPanel.vue`

- [ ] **Step 1: Tests — broken room ref in exit, unknown dialogueId on npc, orphan dialogue node**

- [ ] **Step 2: Implement validateAll(state, registry) → ValidationIssue[]**

- [ ] **Step 3: Show in admin UI; run on save (warn-only)**

- [ ] **Step 4: Commit**

---

### Task 14: Duplicate entity + room graph preview

**Files:**
- Modify: `src/components/admin/AdminEntityList.vue`
- Create: `src/components/admin/RoomGraphPreview.vue`

- [ ] **Step 1: Duplicate — deep clone entity, new id suffix `_copy`, upsert**

- [ ] **Step 2: RoomGraphPreview — read-only nodes/edges from exits of getAllRooms()**

- [ ] **Step 3: Commit**

---

### Task 15: Final integration + docs

**Files:**
- Modify: `README.md` — document dev admin usage
- Create: `scripts/merge-overlay.mjs` (optional stub with usage comment)

- [ ] **Step 1: README section — Ctrl+Shift+Q, export/import workflow**

- [ ] **Step 2: Full test suite + build**

Run: `npx vitest run && npm run build`

- [ ] **Step 3: Commit**

---

## Spec Coverage Checklist

| Spec requirement | Task |
|------------------|------|
| ContentRegistry merge | 2, 6, 10 |
| Overlay store CRUD | 1 |
| Export/import bundle | 1, 4 |
| DEV_ADMIN + hotkey | 2, 3 |
| Locations CRUD | 5 |
| NPCs, Quests, Dialogue | 6, 8, 9 |
| Questlines | 1, 8 |
| Items, Events, Recipes, Buildings, Skills | 10, 12 |
| Encounter templates extract | 11 |
| Structured forms + RefPicker | 5, 7, 8–12 |
| Validation | 13 |
| Duplicate + room graph | 14 |

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-18-admin-content-overlay.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks
2. **Inline Execution** — implement tasks in this session with checkpoints

Which approach?
