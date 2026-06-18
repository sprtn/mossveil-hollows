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
