# Content guide

Content is identified by stable string IDs and is kept out of React components.

- Add an item in `src/content/items.ts`. Give it an ID, category, source, stacking rule, and optional equipment slot/bonuses.
- Registered items automatically appear in the development-only Debug Tools item spawner and inherit its current category, tier, slot, rarity, source, and search filters.
- Add a mining node in `src/content/miningNodes.ts`, then point `rewardItemId` to an item. The mining engine reads its level, interval, and XP directly.
- Add a smithing recipe in `src/content/recipes.ts` with input IDs, output ID, level, interval, and XP. Use `smelting` or `forging` to select the UI tab and statistic bucket.
- Add an enemy in `src/content/enemies.ts`, including the area, combat ratings, loot entries, gold range, and visual theme. Add its ID to the relevant area in `src/content/areas.ts`.
- Add a combat area in `src/content/areas.ts` with an unlock predicate and enemy IDs.
- Add a locked navigation feature in `src/content/navigation.ts`; use the `locked` flag and a description so it opens the common locked screen.
- Add a save migration in `src/game/persistence/migrations.ts` as the next numeric function, and increase `currentSaveVersion` in `src/config/gameConfig.ts`. Keep migrations pure and sequential.

## Current equipment content

The current equipment model includes nine combat slots — `head`, `armor`, `gloves`, `boots`,
`weapon`, `offhand`, `amulet`, `ring`, and `cape` — plus one profession slot, `tool`. The
visible label for `offhand` is **Off-hand**. Body, legs, and `shield` are not current slots.

Shield items retain the `shield` item category, IDs, names, and recipes, but occupy the `offhand`
slot. Off-hand is intentionally broader than Shield for future secondary-hand equipment.

Equipment bonuses use `attackSpeed` for combat attack interval and `miningSpeed` for Mining
interval. The old generic `speed` bonus is not current content.

Unified Armor item IDs are `bronze-armor`, `iron-armor`, and `steel-armor`. Their forging recipe
IDs use the same three IDs and output the matching Armor item. New equipment must resolve to a
current slot, and every recipe output must resolve to an item in `src/content/items.ts`.

Legacy `*-platebody` and `*-platelegs` IDs belong only in the version-3 save migration maps;
legacy `shield` equipment-slot references belong only in the version-4 migration and compatibility
tests. They must not be added back to current item or recipe content.

The simulation consumes these definitions through `src/game/engine/simulation.ts`; UI screens should only read definitions and call store actions.
