# Implementation status

Core MVP workflow is implemented and verified by the project checks.

- [x] Vite + React + strict TypeScript project with lockfile
- [x] Data-driven items, mining nodes, recipes, enemies, areas, and navigation
- [x] Profile selection with three local slots and character creation
- [x] Timestamp-based live simulation with remainder progress
- [x] Level 1–100 XP formulas, progress display, and level-up log entries
- [x] Mining, smelting, forging, quantity modes, level/material gates
- [x] Stack inventory, capacity enforcement, search/filter, lock/destroy protection
- [x] Equipment slots, atomic swap/unequip, derived combat/mining stats
- [x] Automated interval combat, styles, auto-repeat, loot, gold, XP, deaths
- [x] Three areas, six enemies, unlock requirements, collection discoveries
- [x] Persistent action strip and navigation without stopping actions
- [x] Three profile saves, backup recovery, checksum, Zod validation, migration entry point
- [x] Export/import JSON flow and destructive-action confirmations
- [x] Offline replay cap and summary modal
- [x] Responsive semantic interface with locked future-feature screens
- [x] Procedural Three.js contextual visual layer with quality and reduced-motion settings
- [x] Universal screen-panel editor foundation with editable Combat, Inventory, Equipment, Mining, and Smithing panels, responsive fallback, and per-panel scaling
- [x] P2 UI foundation: Inventory, Equipment, Mining, and Smithing are extracted from `App.tsx` and routed through the shared panel system; their final P2 visual redesigns remain future work
- [x] Development-only item helper
- [x] Unit and UI integration tests for formulas, inventory, equipment, actions, persistence, and navigation
- [x] README and content guide

Known non-blocking limitations: inventory is intentionally a stack-based bank rather than a drag-and-drop grid; WebGL gracefully falls back to an empty CSS scene on devices without a context; import is intentionally slot-targeted from the current profile/settings flow.
