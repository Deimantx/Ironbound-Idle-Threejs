# Ironbound Idle

Ironbound Idle is a desktop-first, responsive browser idle RPG built around mining, smelting, smithing, equipment, automated combat, collection discovery, and safe local progression. It uses original procedural visuals and data-driven content.

## Run it

```bash
npm install
npm run dev
```

Other useful commands are `npm run test`, `npm run typecheck`, `npm run lint`, `npm run format`, `npm run build`, and `npm run preview`.

## Stack and architecture

Vite, React, strict TypeScript, Zustand, Immer-compatible immutable updates, Dexie, Zod, Vitest, React Testing Library, Three.js, and Lucide React. Content lives in `src/content`; pure simulation and formulas live in `src/game`; the semantic HTML/CSS interface is in `src/app`; the contextual procedural scene is in `src/three`.

The heartbeat is timestamp-based and runs independently of React or Three.js frames. Mining, smithing, and combat store millisecond remainder progress in a discriminated `activeAction` union. The same simulation is used for live ticks and offline replay.

## Saves and offline progress

Three local profile slots are written to localStorage and mirrored to Dexie. Each record has a schema version, profile ID, payload, SHA-256 checksum when Web Crypto is available, and a last-known-good backup. Zod validates records before load/import; migration entry points are sequential in `src/game/persistence/migrations.ts`. Load replays the saved action for up to the central 24-hour cap and presents a summary.

## Content and post-MVP

The MVP includes six combat enemies across three areas, five mining nodes, seven material/bar definitions, three equipment tiers, nine combat equipment slots plus one profession Tool slot, item and monster collection tabs, and visible locked future navigation. Ranged/magic combat, food, shops, dungeons, achievements, mastery, cloud accounts, and multiplayer remain post-MVP scope.

## Built-in visual UI editor

The game includes an in-game **Edit UI** button backed by a universal screen-panel registry. It
provides drag-to-move handles for the global shell and registered screen panels, twelve-column
grid placement with row/column/width/height controls, size/spacing sliders, color pickers, and
global or per-panel reset buttons, including individual panel scaling from 50% to 150%. Combat is
Inventory, Equipment, Mining, and Smithing use the same `UiPanelSlot` wrapper. Layout changes are
saved in the current browser and do not affect gameplay code. Desktop panel placements fall back
to a single-column stack on smaller screens.
