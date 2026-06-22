# World Map — Design Spec

**Date:** 2026-06-18  
**Status:** Approved & implemented  
**Scope:** Shared SVG world map for admin room editing, player navigation, and in-room minimap

---

## Summary

Replace the flat text room list and read-only ring graph with a **shared interactive map** of locations (rooms). Authors drag nodes to position them and draw exits on the graph; players see discovered rooms, current position, and reachable exits on the same layout.

Room **topology** (exits) still lives on each room JSON (`exits[]`). Room **geometry** (x/y positions) lives in a separate layout file merged with the dev overlay.

This spec pairs with the [Admin Content Overlay](./2026-06-18-admin-content-overlay-design.md) — the map editor lives inside the admin overlay’s Locations tab.

---

## Decisions (locked)

| Topic | Decision |
|-------|----------|
| Admin map interaction | Drag nodes to reposition; drag from orange **port** on a node to another node to create an exit |
| New exit UX | Direction picker popover on connect; confirm replaces existing exit in same direction if one exists |
| Reverse exits | **Not** auto-created — one directed edge per connect gesture |
| Admin room list | Collapsible sections grouped by `room.zoneId`; hub rooms → **Hub / Unzoned**; missing `zoneId` → **Unzoned** |
| Shared component | `WorldMapCanvas` with variants: `editor`, `navigation`, `minimap` |
| Layout storage | Shipped `src/assets/map/room_layouts.json` + overlay `roomLayouts` in localStorage |
| Layout merge | `defaults` → `base JSON` → `overlay` (overlay wins) |
| Player surfaces | `RoomExploringScreen` minimap only (sidebar map removed) |
| Default view (player) | **Neighborhood** on load — fits current room + directly connected nodes; **Zone / World / Fit** toolbar |
| Discovery | Show only **discovered** rooms: current, visited (`roomHistory`), and directly reachable exits |
| Navigation rules | Same passability logic as `goToRoom` / room exit buttons (locked, hidden, area gates, keys) |
| `requiresItem` on graph | Editing lock requirements on edges — **out of scope v1** (still editable in room form) |

---

## Architecture

```
src/assets/map/room_layouts.json     — shipped node positions (room id → { x, y })
        ↓
ContentOverlayStore.roomLayouts      — dev overlay positions (localStorage)
        ↓
ContentRegistry.getAllRoomLayouts()  — resolveRoomLayouts(rooms, base, overlay)
        ↓
worldMapUtils.ts                     — zones, edges, bounds, navigation helpers
        ↓
WorldMapCanvas.vue                   — SVG pan/zoom, nodes, directed edges, zones
        ├─ variant="editor"     → RoomMapEditor (admin)
        └─ variant="minimap"    → RoomExploringScreen
```

Room **connections** are derived from `room.exits` at render time (`buildMapEdges`). Layout changes do not mutate exit data except when the admin explicitly connects two rooms (which upserts the source room’s `exits[]` in the overlay).

---

## Coordinate system

Module: `src/engine/map/RoomLayout.ts`

```typescript
interface RoomLayoutPoint {
  x: number  // 0 … MAP_COORD_SIZE
  y: number
}

const MAP_COORD_SIZE = 1000

type RoomLayoutsMap = Record<string, RoomLayoutPoint>
```

- Normalized **1000×1000** map space; SVG `viewBox` pans/zooms within it.
- `computeDefaultLayout()` places rooms in per-zone rings when no position exists.
- `clampLayoutPoint()` keeps dragged nodes inside bounds.

---

## Zone grouping

Module: `src/engine/map/worldMapUtils.ts`

| Input | Zone key | Display label |
|-------|----------|---------------|
| `room.isHub === true` | `__hub__` | Hub / Unzoned |
| `room.zoneId` set | e.g. `forest` | Capitalized zone id |
| No `zoneId` | `__unzoned__` | Unzoned |

Zone regions render as labeled background rectangles on the map. In **zone** scope, rooms outside the current zone are dimmed (hub rooms are never dimmed).

---

## Layout merge semantics

```typescript
effectiveLayouts = resolveRoomLayouts(allRooms, baseRoomLayoutsJson, overlay.roomLayouts ?? {})
```

Precedence (low → high):

1. **Computed defaults** — ring layout per zone cluster  
2. **`room_layouts.json`** — committed author positions  
3. **Overlay `roomLayouts`** — unsaved dev positions from admin drag  

New rooms without any entry get a default position in their zone cluster.

### Overlay bundle extension

`ContentOverlayBundle` includes optional:

```typescript
roomLayouts?: RoomLayoutsMap
```

- Export includes `roomLayouts` when non-empty.
- Import deep-merges layout entries into the overlay.
- `setRoomLayout(overlay, roomId, point)` / `resetRoomLayouts(overlay)` helpers in `ContentOverlayStore`.
- `isOverlayDirty()` treats non-empty `roomLayouts` as dirty.

### Repo merge

`scripts/merge-overlay.mjs` merges `bundle.roomLayouts` into `src/assets/map/room_layouts.json` (shallow merge per room id). Review git diff after merge.

---

## WorldMapCanvas

Component: `src/components/map/WorldMapCanvas.vue`

### Variants

| Variant | Used in | Interaction |
|---------|---------|-------------|
| `editor` | `RoomMapEditor` | Drag nodes; drag port→node to connect; click node to select; pan/zoom |
| `minimap` | `RoomExploringScreen` | Click reachable node or navigable edge to travel; pan/zoom |

### Props (key)

| Prop | Purpose |
|------|---------|
| `rooms` | Room definitions (topology source) |
| `layouts` | Resolved `RoomLayoutsMap` |
| `currentRoomId` | Highlights current node (player variants) |
| `selectedRoomId` | Highlights selection (editor) |
| `visitedRoomIds` | Visited styling |
| `gameState` | Required for reachability checks (player variants) |
| `viewScope` | `'zone'` \| `'world'` — initial scope |
| `showWorldToggle` | Show Zone / World / Fit toolbar |

### Emits

| Event | When |
|-------|------|
| `select-room` | Editor node click |
| `layout-change` | Editor drag complete `(roomId, x, y)` |
| `connect-rooms` | Editor port dropped on node `(fromId, toId)` |
| `navigate` | Player clicks reachable target |

### Visual language

- **Nodes** — circle + short name; current = accent fill; reachable = bright stroke; visited = subtle fill; dimmed = low opacity.
- **Edges** — directed arrows with direction label (N/S/E/W/↑/↓); locked = dashed + 🔒; hidden omitted on player maps; navigable edge from current room = accent stroke, clickable.
- **Zones** — tinted rects + label; hub zone uses warm tint.

### Player scope toolbar

When `showWorldToggle` is true:

- **Zone** — fit view to current room and direct exit neighbors; dim other discovered rooms.
- **World** — fit all rooms (or all visible discovered rooms passed in).
- **Fit** — re-fit current scope.

Default scope: **zone** (not whole-world fit on first paint).

---

## Admin integration

### RoomMapEditor

Component: `src/components/admin/RoomMapEditor.vue`

Wraps `WorldMapCanvas` (`variant="editor"`). On:

- **`layout-change`** — `setRoomLayout` + `saveOverlay` + registry refresh.
- **`connect-rooms`** — show direction dialog; `upsertEntity` on source room with new/updated exit.
- **Reset layout** — `resetRoomLayouts` clears overlay positions (confirm dialog).

Always visible at the bottom of the admin **Locations** center column (no toggle).

### Admin entity list

When `contentType === 'rooms'`, `AdminEntityList` groups items into collapsible zone sections instead of a flat list. Search still filters across all rooms.

---

## Player integration

### RoomExploringScreen minimap

Compact map below room description (`variant="minimap"`, ~180px tall). Discovery filter and scope toolbar. **Zone** scope fits the current room plus all nodes directly connected by an exit (either direction). `navigate` → existing `handleGoTo`.

### Discovery & navigation

`getDiscoveredRoomIds(state)` returns:

- Current room id  
- All `roomHistory` ids  
- All targets of **passable** exits from current room  

`getReachableTargetIds` / `canNavigateToRoom` mirror exit filtering used elsewhere:

- Hidden exits excluded  
- Non-hub rooms cannot exit to hub id directly (hub return uses dedicated UI)  
- Area gates (`cave`, `ruins`) respect `areasUnlocked`  
- Locked exits require `requiresItem` / `requiresItems` in inventory  

Players cannot click undiscovered or unreachable nodes.

---

## Data files

### Shipped layout seed

`src/assets/map/room_layouts.json` — positions for all current rooms (13 at time of implementation). Example:

```json
{
  "town_hub": { "x": 120, "y": 500 },
  "zone_forest_entrance": { "x": 280, "y": 500 }
}
```

### Room topology (unchanged)

Still authored per room in `src/assets/rooms/{id}.json`:

```typescript
interface RoomExit {
  direction: 'north' | 'south' | 'east' | 'west' | 'up' | 'down'
  targetRoomId: string
  locked?: boolean
  requiresItem?: string
  requiresItems?: string[]
  hidden?: boolean
}
```

---

## Testing

| Module | Tests |
|--------|-------|
| `worldMapUtils` | Zone keys, layout merge, edges, discovery ids, navigation |
| `ContentOverlayStore` | `setRoomLayout`, export/import `roomLayouts`, reset |

Location: `src/engine/__tests__/map/`, `src/engine/__tests__/admin/`.

---

## Out of scope (v1)

- Auto-creating reverse exits when connecting A→B  
- Editing `requiresItem` / lock state on the graph (use room form)  
- Separate layout per zone at file level (single `room_layouts.json`)  
- Fog-of-war rendering for undiscovered rooms on the map (undiscovered rooms are omitted, not greyed)  
- Multi-floor layered maps  
- Animated travel along edges  

---

## Key files

| Path | Role |
|------|------|
| `src/engine/map/RoomLayout.ts` | Coordinate types and `MAP_COORD_SIZE` |
| `src/engine/map/worldMapUtils.ts` | Zones, layouts, edges, bounds, navigation |
| `src/assets/map/room_layouts.json` | Shipped positions |
| `src/components/map/WorldMapCanvas.vue` | Shared SVG map |
| `src/components/admin/RoomMapEditor.vue` | Admin wrapper + connect dialog |
| `src/components/admin/AdminOverlay.vue` | Embeds map editor on Locations tab |
| `src/components/admin/AdminEntityList.vue` | Zone-grouped room list |
| `src/components/RoomExploringScreen.vue` | In-room minimap |
| `src/engine/admin/ContentRegistry.ts` | `getAllRoomLayouts()` |
| `src/engine/admin/ContentOverlayStore.ts` | Overlay layout CRUD |
| `scripts/merge-overlay.mjs` | Merge layouts into assets |

---

## Author workflow (quick reference)

1. Open dev build → **Ctrl+Shift+A** → **Locations** tab.  
2. Drag nodes to arrange; use orange port to connect rooms (pick direction).  
3. Edit room details in the right-hand form as needed.  
4. **Export** overlay bundle; run `node scripts/merge-overlay.mjs bundle.json` to commit positions and room changes to `src/assets/`.  
5. Players see updated map on next build; overlay positions apply immediately in dev without merge.
