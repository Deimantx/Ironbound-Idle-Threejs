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
- [x] Equipment 2.0: unified Armor slot, compatible inventory candidates, item/derived-stat previews, and explicit Equip/Replace/Unequip actions
- [x] Equipment 2.1: nine combat slots, one profession Tool slot, Shield-to-Off-hand migration, active Gloves/Boots/Amulet/Ring/Cape, separated combat/profession UI, and split attack/Mining speed bonuses
- [x] Equipment 2.2: centered Armor loadout, tighter Gloves/Boots layout, compact slot cards with empty icons, 7/5 default panel split, responsive Selected/Compatible workspace, safe desktop sticky statistics, contextual Special Attacks, improved Profession Bonuses disclosure, concise empty states, and left-aligned Tool layout
- [x] Automated interval combat, styles, auto-repeat, loot, gold, XP, deaths
- [x] Three areas, six enemies, unlock requirements, collection discoveries
- [x] Persistent action strip and navigation without stopping actions
- [x] Three profile saves, backup recovery, checksum, Zod validation, migration entry point
- [x] Save migration v3 for unified Armor inventory, equipped gear, discovery, and active Smithing actions
- [x] Save migration v4 for legacy Shield-slot equipment to Off-hand with conflict/capacity safety
- [x] Export/import JSON flow and destructive-action confirmations
- [x] Offline replay cap and summary modal
- [x] Responsive semantic interface with locked future-feature screens
- [x] Procedural Three.js contextual visual layer with quality and reduced-motion settings
- [x] Universal screen-panel editor foundation with editable Combat, Inventory, Equipment, Mining, and Smithing panels, responsive fallback, and per-panel scaling
- [x] P2 UI foundation: Inventory, Equipment, Mining, and Smithing are extracted from `App.tsx` and routed through the shared panel system
- [x] Inventory 2.0: polished stack-based item bank with search, display-group filters, capacity indicator, rarity-aware item cards, persistent desktop details, compact drawer, Equip/View Equipment, Lock/Unlock, Destroy One confirmation, and Universal UI editor compatibility
- [x] Inventory 2.1: compact cards, single accent selection state, bank-header sorting and direction controls, Auto Sort/manual snapshots, profile-scoped view preferences, desktop-only native drag reorder, filtered-order preservation, and responsive natural-height details behavior
- [x] Inventory 2.2: compressed search/filter/capacity toolbar, readable filter counts, accessible Auto Sort switch, integrated bank/details composition, contextual item actions, refined details hierarchy, Category-sort group headers, and preserved compact cards/desktop drag behavior
- [x] Development-only item helper
- [x] Debug Tools 2.0: one development-only lazy-loaded panel with Overview, Inventory, Equipment, Progression, Combat, Professions, Simulation, and Saves & UI categories
- [x] Debug Tools 2.0: registry-driven searchable item spawner with category/tier/slot/rarity filters, quantity validation, capacity/lock/edge actions, and session action history
- [x] Debug Tools 2.0: authoritative Equipment controls and Bronze/Iron/Steel presets, exact skill XP/level and Gold controls, Combat HP/enemy/kill/unlock tools, and profession cycles
- [x] Debug Tools 2.0: deterministic active-action advancement, capped offline replay, save/UI preference actions, current-schema validation, and fresh legacy Armor/Shield migration fixtures
- [x] Debug Tools 2.0: centralized debug mutation boundary, destructive confirmations, responsive accessible overlay, focused action/preset/fixture/UI tests, and production-bundle absence check
- [x] Debug Tools 2.0.1: one-stack Inventory invariant, truthful current-item fill and capacity simulation, large-stack quantity testing, preserved Combat sessions with merged simulation events, serialized and batched debug mutations, next-event Combat stepping, low-HP enemy kills, immediate Combat death resolution, live Inventory preference reset, and modular debug panel files
- [x] Unit and UI integration tests for formulas, inventory, equipment, actions, persistence, and navigation
- [x] README and content guide

Known non-blocking limitations: inventory remains intentionally a stack-based bank rather than a spatial drag-and-drop grid; manual drag reorder is desktop-only above the existing 900px compact breakpoint; WebGL gracefully falls back to an empty CSS scene on devices without a context; import is intentionally slot-targeted from the current profile/settings flow.
