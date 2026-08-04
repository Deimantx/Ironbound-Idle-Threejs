# Content guide

Content is identified by stable string IDs and is kept out of React components.

- Add an item in `src/content/items.ts`. Give it an ID, category, source, stacking rule, and optional equipment slot/bonuses.
- Add a mining node in `src/content/miningNodes.ts`, then point `rewardItemId` to an item. The mining engine reads its level, interval, and XP directly.
- Add a smithing recipe in `src/content/recipes.ts` with input IDs, output ID, level, interval, and XP. Use `smelting` or `forging` to select the UI tab and statistic bucket.
- Add an enemy in `src/content/enemies.ts`, including the area, combat ratings, loot entries, gold range, and visual theme. Add its ID to the relevant area in `src/content/areas.ts`.
- Add a combat area in `src/content/areas.ts` with an unlock predicate and enemy IDs.
- Add a locked navigation feature in `src/content/navigation.ts`; use the `locked` flag and a description so it opens the common locked screen.
- Add a save migration in `src/game/persistence/migrations.ts` as the next numeric function, and increase `currentSaveVersion` in `src/config/gameConfig.ts`. Keep migrations pure and sequential.

The simulation consumes these definitions through `src/game/engine/simulation.ts`; UI screens should only read definitions and call store actions.
