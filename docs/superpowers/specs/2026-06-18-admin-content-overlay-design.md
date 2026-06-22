# Admin Content Overlay — Design Spec

**Date:** 2026-06-18  
**Status:** Approved  
**Scope:** Full-surface dev overlay CRUD for all game content types

---

## Summary

Build an in-game **dev admin overlay** that lets authors create, update, and delete game content at runtime. Edits persist in **localStorage** as an overlay merged on top of shipped JSON assets. Authors export a single bundle for merging back into `src/assets/` and import bundles for backup/sharing.

There is **no admin screen today**. Content is hand-authored JSON with manual registry imports (rooms excepted — already use `import.meta.glob`).

---

## Decisions (locked)

| Topic | Decision |
|-------|----------|
| Persistence | Dev overlay on shipped assets (Option A) |
| Scope | Full surface — all asset types + questlines (Option C) |
| Access | `DEV_ADMIN_ENABLED` + **Ctrl+Shift+Q** hotkey (Option A) |
| Export | Single overlay bundle with explicit deletes (Option A) |
| Import | Export + import merge into overlay (Option B) |
| Editor UX | Structured forms + reference pickers (Option A) |
| Architecture | Central `ContentRegistry` + `ContentOverlayStore` (Approach 1) |

---

## Architecture

```
Shipped assets (src/assets/**/*.json) — read-only base
        ↓
ContentRegistry (glob loaders + merge)
        ↓
Game systems (RoomManager, QuestSystem, DialogueSystem, …)
        ↑
ContentOverlayStore (localStorage)
        ↑
AdminOverlay.vue (Ctrl+Shift+Q when DEV_ADMIN_ENABLED)
```

### Merge semantics

For each content type:

```
effectiveMap = { ...baseMap, ...overlay.upserts }
for (id of overlay.deletedIds[type]) delete effectiveMap[id]
```

- Overlay **upserts** win on id collision.
- **Deletes** hide base entities without modifying shipped files.
- Game always reads **effective** content.

### Boot sequence

1. `ContentRegistry.init()` loads all base assets via glob.
2. Load overlay from `localStorage` key `strat_content_overlay_v1`.
3. Build merged maps and reference indexes.
4. Emit `content:updated` when overlay changes (admin save/import/reset).

---

## Overlay bundle format

File: `content-overlay-v1.json`

```typescript
interface ContentOverlayBundle {
  version: 1
  exportedAt: string // ISO8601
  gameVersion: string // informational; from GAME_VERSION
  upserts: {
    rooms: Record<string, Room>
    npcs: Record<string, NpcDef>
    quests: Record<string, QuestDef>
    questlines: Record<string, QuestlineDef>
    dialogues: Record<string, DialogueDef>
    items: Record<string, ItemTemplate>
    events: Record<string, EventCard>
    recipes: Record<string, RecipeDef>
    buildings: Record<string, BuildingDef>
    skills: Record<string, SkillDef>
    encounterTemplates: Record<string, Enemy[]>
  }
  deletedIds: {
    rooms: string[]
    npcs: string[]
    quests: string[]
    questlines: string[]
    dialogues: string[]
    items: string[]
    events: string[]
    recipes: string[]
    buildings: string[]
    skills: string[]
    encounterTemplates: string[]
  }
}
```

### Import

- Parse JSON; validate `version === 1`.
- Deep-merge into localStorage overlay: per-type upserts merge; `deletedIds` union.
- Refresh registry; show success/error toast.

### Export

- Serialize current overlay state to bundle; trigger browser download.

### Repo merge (out of v1 runtime scope)

Manual or via optional `scripts/merge-overlay.mjs` follow-up: apply upserts to `src/assets/{type}/{id}.json`, delete files for deleted ids, update registry imports if new ids added.

---

## New & extracted types

### QuestlineDef (new)

```typescript
interface QuestlineDef {
  id: string
  name: string
  description?: string
  questIds: string[]           // ordered chain
  requiredQuestIds?: string[]  // prerequisites outside chain
  startFlag?: string           // optional gate flag
}
```

- Add to `ContentSchemas.ts`.
- v1: authoring/grouping + validation; no mandatory runtime questline UI in game.

### Encounter templates (extract from code)

- Move `EventSystem.ts` hardcoded `ENCOUNTER_TEMPLATES` to JSON assets under `src/assets/encounters/` (or overlay-only initially).
- Events' `start_combat` refs pick from encounter template list in admin.
- Registry key: `encounterTemplates: Record<string, Enemy[]>`.

---

## ContentRegistry

Replace manual import arrays with glob loaders (follow `RoomManager` pattern).

| Type | Asset path | Registry API |
|------|------------|--------------|
| rooms | `assets/rooms/*.json` | `getRoom`, `getAllRooms` |
| npcs | `assets/npcs/*.json` | `getNpc`, `getAllNpcs` |
| quests | `assets/quests/*.json` | `getQuest`, `getAllQuests` |
| questlines | overlay-only initially | `getQuestline`, `getAllQuestlines` |
| dialogues | `assets/dialogue/*.json` | `getDialogue`, `getAllDialogues` |
| items | `assets/items/*.json` | `getItemTemplate`, `getAllItems` |
| events | `assets/events/*.json` | `getEvent`, `getAllEvents` |
| recipes | `assets/recipes/*.json` | `getRecipe`, `getAllRecipes` |
| buildings | `assets/buildings/*.json` | `getBuilding`, `getAllBuildings` |
| skills | `assets/skills/*.json` | `getSkill`, `getAllSkills` |
| encounterTemplates | `assets/encounters/*.json` | `getEncounterTemplate`, `getAllEncounterTemplates` |

Existing `*Data.ts` / `*System.ts` modules become thin wrappers re-exporting from `ContentRegistry` to minimize call-site churn.

`RoomManager.loadRoom` delegates to `ContentRegistry.getRoom`.

---

## ContentOverlayStore

Module: `src/engine/admin/ContentOverlayStore.ts`

Responsibilities:

- Read/write `localStorage` key `strat_content_overlay_v1`
- CRUD helpers: `upsert(type, entity)`, `remove(type, id)`, `markDeleted(type, id)`, `restore(type, id)`
- `exportBundle(): ContentOverlayBundle`
- `importBundle(bundle, mode: 'merge')` — v1 supports merge only
- `reset(type?)` — clear overlay for one type or all
- `isDirty` tracking for admin UI indicator

Internal shape mirrors bundle `upserts` + `deletedIds` (empty maps/arrays by default).

---

## Admin UI

### Shell

- Component: `src/components/admin/AdminOverlay.vue`
- Full-screen modal; dim scrim; game input blocked while open
- Toggle: **Ctrl+Shift+Q** when `DEV_ADMIN_ENABLED`
- Registered in `App.vue` global hotkey listener

### Layout

| Area | Content |
|------|---------|
| Left sidebar | Type tabs (11 types) |
| Center | Searchable list; Create / Duplicate / Delete; base vs overlay badge |
| Right | Structured detail form |
| Top bar | Import, Export, Reset overlay, dirty indicator |

### Shared form components (`src/components/admin/forms/`)

| Component | Purpose |
|-----------|---------|
| `RefPicker.vue` | Searchable dropdown for cross-refs (room, npc, item, quest, skill, flag…) |
| `OutcomeEffectEditor.vue` | Kind selector + typed fields for all `OutcomeEffect` variants |
| `OutcomeRequirementEditor.vue` | Same for `OutcomeRequirement` |
| `RepeatableList.vue` | Generic add/remove/reorder rows |
| `RoomExitEditor.vue` | Exit rows with room RefPicker |
| `GatherNodeEditor.vue` | Gather node fields inline in room form |
| `EncounterEditor.vue` | Encounter + nested enemy rows |
| `DialogueNodeEditor.vue` | Node list + response rows with next-node picker |
| `QuestStageEditor.vue` | Stage list with objective + reward editors |

### Per-type editors

| Tab | Key fields |
|-----|------------|
| Locations | id, name, description, zoneId, isHub, exits, gatherNodes, encounters |
| NPCs | id, name, role, dialogueId, portrait, profession, services[] |
| Quests | id, name, stages[] (objective, rewards) |
| Questlines | id, name, description, questIds[], requiredQuestIds[], startFlag |
| Dialogue | id, npcId, nodes[] (text, responses[]) |
| Items | Full `ItemTemplate` fields |
| Events | EventCard + choices with outcome editors |
| Encounters | Template id + Enemy[] |
| Recipes | RecipeDef + materials map |
| Buildings | BuildingDef + levels |
| Skills | SkillDef + training + combat blocks |

### Validation

Module: `src/engine/admin/ContentValidator.ts`

Runs on entity save and via "Validate all" action:

- Broken string refs (unknown room/npc/item/quest/dialogue node)
- Duplicate ids within type
- Orphan dialogue nodes (unreachable)
- Questline questIds exist
- Empty required fields

Results shown in validation panel (warnings block save optionally — config: warn-only in v1).

---

## Dev access & safety

```typescript
// gameConfig.ts
export const DEV_ADMIN_ENABLED = import.meta.env.DEV
```

- Production builds: flag false; admin tree inert
- Hotkey only active when flag true
- Reset overlay requires confirm dialog
- No server writes; localStorage only

---

## Testing strategy

| Module | Tests |
|--------|-------|
| `ContentOverlayStore` | merge, delete, import/export round-trip |
| `ContentRegistry` | overlay overrides base; delete hides base |
| `ContentValidator` | broken refs, duplicate ids |
| Outcome editors | serialize valid shapes (unit tests on pure functions) |
| Integration smoke | upsert room in overlay → `getRoom` returns merged entity |

Vitest in `src/engine/__tests__/admin/`.

---

## Implementation phasing

1. **Foundation** — Overlay store, registry, export/import, hotkey shell, Locations CRUD
2. **People & story** — NPCs, Dialogue, Quests, Questlines
3. **World systems** — Items, Events, Encounters (extract templates), Recipes, Buildings, Skills
4. **Polish** — Validation panel, duplicate, room graph preview

Each phase delivers usable admin functionality.

---

## Out of scope (v1)

- Automated repo file writes from browser
- Multi-user CMS backend
- In-game questline player UI
- Raw JSON editor mode
- Production admin access

---

## Key files (existing)

| Path | Role |
|------|------|
| `src/engine/ContentSchemas.ts` | Frozen content types |
| `src/engine/RoomManager.ts` | Room glob loader (pattern to follow) |
| `src/engine/NpcData.ts`, `QuestData.ts`, … | Manual registries to refactor |
| `src/engine/EventSystem.ts` | Hardcoded encounter templates to extract |
| `src/engine/Outcomes.ts` | Shared effect/requirement types for form editors |
| `src/assets/**` | Shipped content JSON |
