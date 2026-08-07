# Smithing 1.25

Smithing has two facilities: the Forge smelts ore into bars, while the Anvil turns bars into equipment and profession tools. Forge and Anvil never run simultaneously. Bronze content remains valid legacy content for old inventories and saves, but Bronze recipes are hidden from normal progression.

## Forge

Forge recipes consume authored ore inputs and abstract fuel units atomically. Coal is the active fuel and remains a normal stackable inventory item. Forge recipes ignore Smithing hammers and use their authored intervals.

| Recipe    | Level | Inputs     |   Fuel | Time |  XP |
| --------- | ----: | ---------- | -----: | ---: | --: |
| Iron Bar  |     1 | 1 Iron Ore | 1 Coal | 3.8s |  20 |
| Steel Bar |    30 | 2 Iron Ore | 2 Coal | 5.2s |  40 |

Steel Bar now requires two Iron Ore and two abstract fuel units for one bar. The Forge card converts abstract units into the physical selected fuel using that fuel definition's `fuelValue`.

The persistent Forge hopper has a base capacity of 20 physical fuel items. The Forge header owns fuel selection, loaded quantity, estimated loaded-fuel time, Auto-refuel, Load 1/5/10/Fill, and Unload. Fuel staging, craft consumption, inventory, XP, statistics, discovery, and deterministic RNG commit atomically.

Legacy Bronze Bar retains its historical Copper Ore + Tin Ore requirements, 2.4s interval, and 24 XP without Forge fuel.

## Anvil

Active Iron and Steel forging XP is derived from bars consumed and the tier tuning:

```text
Iron tier: 20 XP per bar
Steel tier: 40 XP per bar
```

| Output                | Level | Bars |  Time |  XP |
| --------------------- | ----: | ---: | ----: | --: |
| Iron Sword            |    15 |    4 |  4.2s |  80 |
| Iron Helm             |    17 |    3 |  4.2s |  60 |
| Iron Bulwark          |    18 |    5 |  4.2s | 100 |
| Iron Armor            |    20 |   11 |  8.4s | 220 |
| Iron Pick             |    22 |    5 |  4.2s | 100 |
| Iron Smithing Hammer  |    15 |    3 |  4.2s |  60 |
| Steel Sword           |    30 |    5 |  6.0s | 200 |
| Steel Helm            |    32 |    4 |  6.0s | 160 |
| Steel Smithing Hammer |    32 |    4 |  6.0s | 160 |
| Steel Bulwark         |    33 |    6 |  6.0s | 240 |
| Steel Armor           |    35 |   13 | 12.0s | 520 |
| Steel Pick            |    37 |    6 |  6.0s | 240 |

Recipe rows show only the effective Anvil time. The hammer selector owns the speed explanation; Forge rows continue to show authored base time. The effective formula remains `max(250ms, floor(baseInterval * (1 - speedBonus)))`.

## Smithing hammers and the generic tool slot

Hammers use the existing `equipment.tool` slot. The Anvil header has an accessible Tool selector driven by the registered definitions in `src/content/smithingTools.ts`. It shows owned quantity, Smithing requirement, speed, preservation, equipped state, and unavailable reasons. Equipping a hammer uses the normal equipment flow, so a pickaxe is returned to inventory when displaced. Unequip uses the same inventory-capacity validation.

The Equipment screen remains authoritative and reflects selections made in Smithing. If a pickaxe occupies the generic tool slot, Smithing reports `No Smithing Hammer` and identifies the equipped pickaxe rather than treating it as a hammer.

Hammer changes are blocked while an Anvil order is active with the message `Stop the current Anvil order to change tools.` This keeps the effective interval and progress deterministic and avoids tool-switch acceleration exploits. Forge work can continue to ignore hammers.

## Tier sections and filters

The Anvil keeps All Metals, Iron, and Steel filters. Iron and Steel sections have keyboard-accessible full-width collapse buttons. Each heading displays live bar stock, for example `IRON - 3,840 bars`. Collapse state is local React UI state only; it is not stored in `GameState` or the save.

All Metals respects each section's local collapse state. Selecting an explicit Iron or Steel filter temporarily forces that tier visible, and returning to All Metals restores the previous collapse state. Bronze remains hidden from active tier headings.

## Active Order and activity strip

Active Order uses the simple item name, followed by the facility and quantity mode, and no longer repeats `Forging`, `Smelting`, `Next`, or a detailed Anvil Tool block. Forge Active Order retains compact fuel context. The bottom activity strip uses the item name and `Forge` or `Anvil` context; its phase label has no `Next` prefix, and its hammer label remains compact.

Aggregate estimates use `formatHoursMinutes()` with nearest-minute rounding and no 24-hour wrap. For example, 3,527.8 seconds displays as `00:59`; individual live craft countdowns remain in seconds such as `0.8s`.

## Preservation and transactions

Preservation applies only to Anvil material inputs. A cycle first requires the full authored cost; preserved units remain in inventory while the craft still creates its full output and awards full XP. Smithing stages inventory and RNG, then commits successful material/fuel consumption, output, XP, statistics, discovery, and RNG together. Rejected cycles consume nothing.

## Quantity modes and runtime

- `1`: exactly one cycle.
- `10`: up to ten cycles.
- `all`: snapshots complete cycles from the authored requirements when the action starts.
- `continuous`: continues until the next cycle cannot resolve or the player stops/replaces the action.

The shared online and offline simulation uses the same effective interval, preservation, fuel, XP, and atomic transaction rules. `XP_CURVE_MULTIPLIER`, `MAX_LEVEL`, save schema 8, Forge hopper persistence, Auto-refuel, and deterministic Smithing RNG are unchanged.

## Authoritative source files

- `src/content/recipes.ts` - recipe IDs, levels, intervals, authored inputs, and outputs.
- `src/content/smithingFuels.ts` - active fuel definitions and fuel values.
- `src/config/smithingTuning.ts` - hopper capacity, tier bar mapping, and XP-per-bar tuning.
- `src/content/items.ts` - bars, equipment, picks, and Smithing hammers.
- `src/content/smithingTools.ts` - registered hammer requirements and bonuses.
- `src/game/formulas/smithingFormulas.ts` - fuel helpers, hammer resolution, rates, intervals, preservation, estimates, and max craftable.
- `src/game/systems/equipmentSystem.ts` - authoritative generic tool equip/unequip flow and active-Anvil guard.
- `src/app/SmithingScreen.tsx` and `src/app/ActivityStrip.tsx` - Smithing UI and activity strip.
- `src/app/formatters.ts` - shared aggregate duration formatting.

## Smithing 1.3 direction

Facility upgrade levels, new fuels, queues, parallel actions, quality rolls, mastery, and hammer durability remain out of scope. The existing `baseForgeFuelCapacity` tuning boundary remains available for a later Basic -> Reinforced -> High-Heat -> Master facility pass.
