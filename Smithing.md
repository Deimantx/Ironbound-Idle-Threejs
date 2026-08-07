# Smithing 1.0

Smithing is the Phase One production skill. It has one global action and two facilities: the Forge smelts ore into bars, while the Anvil turns bars into equipment and profession tools. Forge and Anvil never run simultaneously.

## Progression

Normal Smithing content progresses from Iron to Steel. Iron Bar is available at Smithing level 1 so a player who has Iron Ore and Coal can train the skill. Bronze items, bars, and recipe IDs remain valid legacy content for old inventories and saves, but Bronze recipes are hidden from the normal Smithing screen.

## Forge

Forge recipes consume their authored ore inputs and fuel atomically, create one bar, award Smithing XP, and increment `statistics.smelted`. Coal is the only active fuel and remains a normal stackable inventory item. Forge recipes do not use hammer speed or preservation.

| Recipe                  | Level | Inputs     | Fuel   | Time |  XP |
| ----------------------- | ----: | ---------- | ------ | ---: | --: |
| Iron Bar (`iron-bar`)   |     1 | 1 Iron Ore | 1 Coal | 3.8s |  12 |
| Steel Bar (`steel-bar`) |    30 | 1 Iron Ore | 2 Coal | 5.2s |  20 |

Legacy Bronze Bar retains its old Copper Ore + Tin Ore requirements, 2.4s interval, and 24 XP without Coal.

## Anvil

Anvil recipes consume authored bar inputs, create one output, award Smithing XP, and increment `statistics.forged`.

| Output                | Recipe ID               | Level |          Bars |  Time |  XP |
| --------------------- | ----------------------- | ----: | ------------: | ----: | --: |
| Iron Sword            | `iron-sword`            |    15 |   4 Iron Bars |  4.2s |  55 |
| Iron Helm             | `iron-helmet`           |    17 |   3 Iron Bars |  4.2s |  59 |
| Iron Bulwark          | `iron-shield`           |    18 |   5 Iron Bars |  4.2s |  63 |
| Iron Armor            | `iron-armor`            |    20 |  11 Iron Bars |  8.4s | 128 |
| Iron Pick             | `iron-pickaxe`          |    22 |   5 Iron Bars |  4.2s |  67 |
| Iron Smithing Hammer  | `iron-smithing-hammer`  |    15 |   3 Iron Bars |  4.2s |  45 |
| Steel Sword           | `steel-sword`           |    30 |  5 Steel Bars |  6.0s |  90 |
| Steel Helm            | `steel-helmet`          |    32 |  4 Steel Bars |  6.0s |  94 |
| Steel Smithing Hammer | `steel-smithing-hammer` |    32 |  4 Steel Bars |  6.0s |  90 |
| Steel Bulwark         | `steel-shield`          |    33 |  6 Steel Bars |  6.0s |  98 |
| Steel Armor           | `steel-armor`           |    35 | 13 Steel Bars | 12.0s | 198 |
| Steel Pick            | `steel-pickaxe`         |    37 |  6 Steel Bars |  6.0s | 102 |

## Smithing hammers

Hammers use the existing generic `tool` equipment slot. Equipping one displaces the current pickaxe through normal equipment flow, so the active profession tool is a deliberate Mining/Smithing tradeoff.

| Hammer                | Required Smithing | Anvil speed | Material preservation |
| --------------------- | ----------------: | ----------: | --------------------: |
| Iron Smithing Hammer  |                15 |   8% faster |     3% per input unit |
| Steel Smithing Hammer |                32 |  15% faster |     6% per input unit |

Without a valid equipped hammer, Anvil work uses its base interval and 0% preservation. Effective Anvil time is `max(250ms, floor(baseInterval × (1 - speedBonus)))`. Forge time is always the authored base interval.

## Preservation and transactions

Preservation applies only to Anvil recipe material inputs. A cycle must first own the full authored requirement; preservation cannot make an under-supplied recipe start. Each required material unit is rolled independently. Preserved units remain in inventory, but the craft still creates its full output and awards full XP.

Smithing stages a clone of inventory and RNG state, removes actual consumed materials and fuel, checks output capacity after those removals, and commits all results together. A rejected cycle consumes nothing, awards nothing, increments no statistics, and advances no RNG. This allows a full inventory to craft when removing the final input stack frees the output slot.

Smithing RNG is deterministic and persisted as `smithing.rngSeed` and `smithing.rngCursor`; `Math.random()` is not used.

## Quantity modes

- `1`: exactly one cycle.
- `10`: up to ten cycles.
- `all`: snapshots the maximum number of complete cycles, including Forge fuel, when the action starts. Preservation cannot extend that target.
- `continuous`: stores `remaining: null` and continues until the next cycle cannot resolve, the recipe becomes invalid, or the player stops/replaces the action.

Max craftable ignores expected preservation and checks the full authored requirements.

## Runtime and offline behavior

Smithing uses the shared action controller, simulation loop, inventory, XP, discovery, statistics, save, and offline report systems. Anvil hammer interval and preservation apply identically online and offline. Summaries report `itemsUsed`, `itemsGained`, `xpGained`, completion keys such as `smelting:iron-bar` and `forging:iron-sword`, and normal stop reasons such as `Materials ran out.`, `Forge fuel ran out.`, and `Inventory is full.`

## UI

The Smithing screen contains a global overview plus collapsible Forge and Anvil panels. Forge shows ore, Coal, time, XP, and level locks. Anvil shows filters, hammer effects, base/effective time, preservation, requirements, and theoretical XP/hour. Bronze is excluded from normal lists. The dedicated Smithing activity strip shows facility, recipe, level progress, theoretical XP/hour, cycle progress, quantity state, and Stop.

## Save schema

Smithing 1.0 uses save schema 7. Migration 7 adds normalized deterministic Smithing RNG state and preserves inventory, equipment, XP, legacy Bronze data, and valid active Smithing recipes. UI collapse state remains local UI state and is not stored in the game save.

## Authoritative source files

- `src/content/recipes.ts` — recipe IDs, levels, intervals, XP, fuel, and legacy flags.
- `src/content/items.ts` — bars, equipment, picks, and Smithing hammers.
- `src/content/smithingTools.ts` — hammer requirements and bonuses.
- `src/game/formulas/smithingFormulas.ts` — RNG, hammer resolution, rates, intervals, preservation, and max craftable.
- `src/game/engine/actionController.ts` — action start and quantity snapshots.
- `src/game/engine/simulation.ts` — atomic online/offline cycle resolution.
- `src/game/persistence/migrations.ts` and `src/game/persistence/saveSchema.ts` — schema 7 persistence.
- `src/app/SmithingScreen.tsx` and `src/app/ActivityStrip.tsx` — Smithing UI and activity strip.
