# Mossveil Hollow: Shards of the Shadow

A finite, hand-crafted turn-based RPG built with Vue 3 + TypeScript + Vite. Play a single hero who ventures from **Mossveil Hollow** into gated regions, fights authored encounters, gathers materials, crafts gear, learns skills, and unites three shards to defeat the Shadow Lord.

## Running

```bash
npm install
npm run dev      # start dev server
npm run build    # type-check (vue-tsc) + production bundle
npm test         # run vitest suite
```

## Core loop

1. In **town**, talk to NPCs, accept quests, heal, rest, craft, train, and upgrade buildings.
2. Spend **stamina** exploring a region; each move and encounter drains it.
3. Win fights to earn XP, gold, materials, and **energy** (the per-expedition skill resource).
4. Return to town when stamina or HP runs low (the **Healer** fully restores and clears *wounded*; **sleep outside** is cheaper but risky).
5. Craft gear and learn skills to beat the region boss, which drops a **shard** and unlocks the next region.
6. Collect all three shards to open the **Shadow Gate** and end the game.

## Architecture

Pure, Vue-agnostic game logic lives in `src/engine/`; reactive UI lives in `src/components/`. State flows one way: components call engine functions and dispatch the returned immutable `GameState`.

Key engine modules:

- `GameLoop.ts` — room navigation, exploration, encounter lifecycle, rewards.
- `CombatEngine.ts` — seeded combat resolution, skills, status effects, enemy AI.
- `Outcomes.ts` — shared effect/requirement resolver used by events, dialogue, and quests.
- `ProgressionSystem.ts` — leveling and stat curves (fixed, no enemy level-scaling).
- `ItemDatabase.ts` / `Materials.ts` — items, equipment, crafting materials.
- `CraftingSystem.ts`, `SkillSystem.ts`, `BuildingSystem.ts` — town progression systems.
- `QuestSystem.ts`, `DialogueSystem.ts`, `EventSystem.ts` — narrative/content systems.
- `saveGame.ts` — versioned localStorage persistence (saves reset on version mismatch).

Content is data-driven via JSON in `src/assets/` (`rooms/`, `items/`, `events/`, `quests/`, `dialogue/`, `recipes/`, `buildings/`, `skills/`, `npcs/`). Schemas are frozen in `ContentSchemas.ts`.

## Balance tuning

`src/engine/__tests__/balanceSim.test.ts` runs seeded simulated fights and asserts design budgets (HP lost per fight, boss win-rate with vs. without crafted gear, etc.). Tune numbers in JSON/config until the sim passes — no logic changes needed to retune.

## Dev Content Admin

In **dev builds only** (`npm run dev`), a full-surface content editor overlays the game. It merges edits on top of shipped JSON in `src/assets/` via `ContentRegistry` + `ContentOverlayStore` (localStorage key `strat_content_overlay_v1`).

### Access

- Enabled when `DEV_ADMIN_ENABLED` is true (`import.meta.env.DEV` in `src/engine/gameConfig.ts`).
- **Ctrl+Shift+A** toggles the admin overlay (`AdminOverlay.vue`).

### Export / import workflow

1. Edit content in the overlay (create, update, duplicate, delete). Changes persist in localStorage and apply immediately at runtime.
2. **Export** — downloads `content-overlay-v1-<timestamp>.json` (upserts + explicit `deletedIds` per type).
3. **Import** — merges a bundle into the overlay (upserts deep-merge; `deletedIds` union). Use for backup or sharing WIP edits.
4. **Reset overlay** — clears all overlay state; shipped assets are unchanged.
5. **Merge to repo** — apply an exported bundle to `src/assets/` with:

   ```bash
   node scripts/merge-overlay.mjs path/to/content-overlay-v1.json
   ```

   Writes upserts to `{type}/{id}.json`, deletes files listed in `deletedIds`, then commit the asset changes. Re-run `npm run build` to verify.

Use the **Validation** panel before export; fix errors so references and required fields stay consistent.

### Editable content types

| Tab | Type key | Asset folder |
|-----|----------|--------------|
| Locations | `rooms` | `src/assets/rooms/` |
| NPCs | `npcs` | `src/assets/npcs/` |
| Quests | `quests` | `src/assets/quests/` |
| Questlines | `questlines` | `src/assets/questlines/` |
| Dialogue | `dialogues` | `src/assets/dialogue/` |
| Items | `items` | `src/assets/items/` |
| Events | `events` | `src/assets/events/` |
| Encounters | `encounterTemplates` | `src/assets/encounters/` |
| Recipes | `recipes` | `src/assets/recipes/` |
| Buildings | `buildings` | `src/assets/buildings/` |
| Skills | `skills` | `src/assets/skills/` |

See `docs/superpowers/specs/2026-06-18-admin-content-overlay-design.md` for bundle format and architecture.
