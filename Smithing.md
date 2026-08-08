# Smithing 1.3

Smithing has two facilities: the Forge smelts ore into bars, while the Anvil turns bars into equipment and profession tools. Forge and Anvil never run simultaneously. Bronze content remains valid legacy content for old inventories and saves, but Bronze recipes are hidden from normal progression.

## Smithing page structure

The Smithing page is permanently stacked as three full-width panels:

```text
Active Order
Forge
Anvil
```

The default UI layout uses `smithingOverview` on row 1, `smithingForge` on row 2, and `smithingAnvil` on row 3, each spanning all 12 editor columns. Older locally stored Forge/Anvil 5/7 side-by-side positions are sanitized back to this layout. Forge and Anvil collapse state remains local UI state and their panel slots resize with their measured content.

## Smithing 1.31 facility upgrade preview

Forge and Anvil headers now have explicit control regions in this order:

```text
facility identity · Upgrade · Fuel/Tool · Collapse
```

The collapse control is always the final right-most button with its own accessible `Collapse Forge`, `Expand Forge`, `Collapse Anvil`, or `Expand Anvil` label. Facility identity is no longer a large clickable collapse surface.

The `Upgrade` button opens an inline, preview-only panel below its facility header. Forge previews `Basic Forge -> Reinforced Forge`; Anvil previews `Basic Anvil -> Reinforced Anvil`. The panels show non-numeric planned effect categories, `Not yet available` requirements, and a `COMING LATER` treatment. They do not contain a purchase action, temporary costs, numeric bonuses, or gameplay effects.

Upgrade open state, Fuel/Tool popover state, and collapse state are local React UI state. Opening Upgrade closes the same facility's Fuel or Tool popover, and collapsing a facility closes both. No facility state, migration, save field, or schema change is required; save schema remains 8.

## Forge

Forge recipes consume authored ore inputs and abstract fuel units atomically. Coal is the active fuel and remains a normal stackable inventory item. Forge recipes ignore Smithing hammers and use their authored intervals.

| Recipe    | Level | Inputs     |   Fuel | Time |  XP |
| --------- | ----: | ---------- | -----: | ---: | --: |
| Iron Bar  |     1 | 1 Iron Ore | 1 Coal | 3.8s |  20 |
| Steel Bar |    30 | 2 Iron Ore | 2 Coal | 5.2s |  40 |

Steel Bar now requires two Iron Ore and two abstract fuel units for one bar. The Forge card converts abstract units into the physical selected fuel using that fuel definition's `fuelValue`.

The persistent Forge hopper has a base capacity of 20 physical fuel items. The Forge header owns fuel selection, loaded quantity, estimated loaded-fuel time, Auto-refuel, Load 1/5/10/Fill, and Unload. Fuel staging, craft consumption, inventory, XP, statistics, discovery, and deterministic RNG commit atomically.

Forge browsing uses a compact responsive tile grid rather than wide rows. Active non-legacy bar recipes are ordered by Smithing level, with authored order as the stable tie-breaker. The grid targets four columns on wide desktop, three at medium width, two on tablet, and one on narrow screens. The local `SHOW` control defaults to `All Bars`; `Unlocked` only hides recipes above the current Smithing level and does not change recipe or action state. No Forge metal filter, search, or per-bar accordion is used.

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

The Anvil filter controls are two separate rows in this order:

```text
TYPE  [All] [Weapons] [Armor] [Shields] [Tools]
METAL [All Metals] [Iron] [Steel]
```

The rows use compact wrapping chips so future item categories and metal tiers can be added without changing the surrounding structure. Iron and Steel sections have keyboard-accessible full-width collapse buttons. Each heading displays live bar stock, for example `IRON · 3,840 bars`. Collapse state is local React UI state only; it is not stored in `GameState` or the save.

All Metals respects each section's local collapse state. Selecting an explicit Iron or Steel filter temporarily forces that tier visible, and returning to All Metals restores the previous collapse state. Bronze remains hidden from active tier headings.

## Active Order and activity strip

Active Order uses the simple item name, followed by the facility and quantity mode, and no longer repeats `Forging`, `Smelting`, or `Next`. Its lower area is a two-column context grid: `AVAILABLE` plus `TOOL BONUS` for Anvil orders, or `AVAILABLE` plus `FORGE FUEL` for Forge orders. Continuous availability keeps the guaranteed/base estimate internally and displays `~N crafts`; finite modes display exact remaining values when available. Active Anvil orders show the effective hammer name and bonuses, including the no-hammer and pickaxe cases. Active Forge orders show selected fuel, hopper quantity/capacity, and Auto-refuel state without placing loading controls in the order.

The closed Anvil Tool trigger stays in the Anvil header and shows the current tool without repeating its bonus percentages. The opened popover remains detailed with owned quantity, requirements, speed, preservation, and normal equip/unequip actions. The bottom activity strip uses the item name and `Forge` or `Anvil` context; its phase label has no `Next` prefix, and its hammer/fuel label remains compact.

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
- `src/app/uiLayout.ts` and `src/app/UiPanelSlot.tsx` - stacked full-width Smithing defaults, legacy-layout sanitization, and measured panel sizing.
- `src/app/SmithingScreen.tsx` and `src/app/ActivityStrip.tsx` - Smithing UI and activity strip.
- `src/app/formatters.ts` - shared aggregate duration formatting.

## Later facility progression

Actual facility upgrade levels, cross-profession and combat requirements, new fuels, queues, parallel actions, quality rolls, mastery, and hammer durability remain out of scope. The 1.31 preview is intentionally non-functional. The existing `baseForgeFuelCapacity` tuning boundary remains available for a later Basic -> Reinforced -> High-Heat -> Master facility pass.
