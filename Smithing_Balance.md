# Ironbound Idle - Smithing 1.31 Balance Reference

This is the balance sheet for the current Smithing implementation. Values intended for balance tuning live in code; this file mirrors them for quick review.

Authoritative sources:

- `src/content/recipes.ts` - active and legacy recipes, inputs, levels, intervals, outputs, and XP
- `src/content/smithingFuels.ts` - registered Forge fuels and fuel values
- `src/content/smithingTools.ts` - Smithing hammer requirements, speed, and preservation
- `src/content/items.ts` - ore, bar, equipment, tool, rarity, and source definitions
- `src/config/smithingTuning.ts` - Forge capacity, tier mapping, and XP-per-bar tuning
- `src/game/formulas/smithingFormulas.ts` - fuel, interval, preservation, production, and rate formulas
- `src/game/engine/simulation.ts` - online/offline cycles, atomic transactions, and stop behavior
- `src/game/systems/equipmentSystem.ts` - generic tool-slot equip and unequip behavior
- `src/game/persistence/migrations.ts` and `src/game/persistence/saveSchema.ts` - Smithing save compatibility
- `src/config/gameConfig.ts` - inventory, offline, and save-version limits

## Active Phase One progression

Forge and Anvil share the single active-action slot, so only one Smithing activity can run at a time. Bronze recipes remain valid for old inventories and saves, but active Iron and Steel recipes are the normal progression.

### Forge bars

| Recipe    | ID          | Smithing level | Inputs     | Fuel / craft | Output |  XP |    Time |
| --------- | ----------- | -------------: | ---------- | -----------: | ------ | --: | ------: |
| Iron Bar  | `iron-bar`  |              1 | 1 Iron Ore |       1 Coal | 1 bar  |  20 | 3.8 sec |
| Steel Bar | `steel-bar` |             30 | 2 Iron Ore |       2 Coal | 1 bar  |  40 | 5.2 sec |

Iron Ore and Coal come from active Mining progression. Forge fuel is represented as abstract units internally, then converted to physical selected fuel items using the registered fuel's `fuelValue`.

### Anvil equipment and profession tools

Every active Anvil recipe creates one output. Anvil XP is derived from the number of bars consumed and the tier XP-per-bar setting:

```text
Iron XP per bar  = 20
Steel XP per bar = 40
recipe XP        = authored bar cost * tier XP per bar
```

| Output                | ID                      | Level | Bars |     Time |  XP |
| --------------------- | ----------------------- | ----: | ---: | -------: | --: |
| Iron Sword            | `iron-sword`            |    15 |    4 |  4.2 sec |  80 |
| Iron Helm             | `iron-helmet`           |    17 |    3 |  4.2 sec |  60 |
| Iron Bulwark          | `iron-shield`           |    18 |    5 |  4.2 sec | 100 |
| Iron Armor            | `iron-armor`            |    20 |   11 |  8.4 sec | 220 |
| Iron Pick             | `iron-pickaxe`          |    22 |    5 |  4.2 sec | 100 |
| Iron Smithing Hammer  | `iron-smithing-hammer`  |    15 |    3 |  4.2 sec |  60 |
| Steel Sword           | `steel-sword`           |    30 |    5 |  6.0 sec | 200 |
| Steel Helm            | `steel-helmet`          |    32 |    4 |  6.0 sec | 160 |
| Steel Smithing Hammer | `steel-smithing-hammer` |    32 |    4 |  6.0 sec | 160 |
| Steel Bulwark         | `steel-shield`          |    33 |    6 |  6.0 sec | 240 |
| Steel Armor           | `steel-armor`           |    35 |   13 | 12.0 sec | 520 |
| Steel Pick            | `steel-pickaxe`         |    37 |    6 |  6.0 sec | 240 |

## Global tuning

| Setting                      |                  Value |
| ---------------------------- | ---------------------: |
| Maximum Smithing level       |                    100 |
| XP curve multiplier          |                  1.30x |
| Minimum effective craft time |                 250 ms |
| Forge hopper capacity        | 20 physical fuel items |
| Active Forge fuel            |                   Coal |
| Coal fuel value              |                 1 unit |
| Iron XP per bar              |                     20 |
| Steel XP per bar             |                     40 |
| Inventory capacity           |               60 slots |
| Offline simulation cap       |                  24 hr |
| Current save schema          |                      8 |

The Forge fuel hopper stores physical selected fuel items. Fuel is removed from inventory when loaded and returned when unloaded. The default Forge fuel is Coal and Auto-refuel defaults to enabled.

## Forge fuel and production

### Active fuel definitions

| Item ID | Display name | Fuel value | Active role        |
| ------- | ------------ | ---------: | ------------------ |
| `coal`  | Coal         |          1 | Current Forge fuel |

With the current fuel definition, physical fuel and abstract units are one-to-one:

| Recipe    | Fuel units / craft | Physical Coal / craft | Crafts from a full hopper |
| --------- | -----------------: | --------------------: | ------------------------: |
| Iron Bar  |                  1 |                     1 |                        20 |
| Steel Bar |                  2 |                     2 |                        10 |

Fuel rules:

- Smelting recipes consume their authored fuel units only after a complete cycle can resolve.
- If Auto-refuel is enabled, the simulation stages available selected fuel before the cycle.
- Changing fuel while the hopper contains another fuel is blocked until the hopper is unloaded.
- Forging recipes do not consume Forge fuel.
- Smithing hammers do not modify Forge intervals.
- Legacy Bronze Bar remains fuel-free and keeps its historical recipe values.

## Anvil tools and preservation

Smithing hammers occupy the generic `equipment.tool` slot. A pickaxe in that slot is not treated as a Smithing hammer.

| Item ID                 | Required Smithing level | Speed bonus | Material preservation | Source           |
| ----------------------- | ----------------------: | ----------: | --------------------: | ---------------- |
| `iron-smithing-hammer`  |                      15 |          8% |                    3% | Smithing - Anvil |
| `steel-smithing-hammer` |                      32 |         15% |                    6% | Smithing - Anvil |

The hammer bonuses apply only to Anvil forging. A preservation roll is made independently for each required input unit. The expected material consumption per input unit is therefore:

```text
expected consumed units = 1 - preservation chance
```

The displayed recipe requirement remains the full authored cost. Preservation is resolved only when the craft commits, so it does not increase the number of cycles shown by the base production estimate.

Hammer rules:

- The equipped hammer must meet its Smithing-level requirement to provide bonuses.
- A hammer change is blocked while an Anvil order is active.
- Equipping a hammer uses the normal generic tool-slot flow and can displace a pickaxe into inventory.
- Unequipping requires enough inventory space for the returned tool.
- Hammers have no durability or separate Smithing equipment slot.

## Smithing formulas

### Effective craft time

```text
effective interval = max(250 ms, floor(base interval * (1 - hammer speed bonus)))
```

The hammer speed bonus is zero for Forge smelting. With the current definitions, the effective Anvil intervals are:

| Base interval |  No hammer | Iron Hammer | Steel Hammer |
| ------------: | ---------: | ----------: | -----------: |
|       4.2 sec |  4.200 sec |   3.864 sec |    3.570 sec |
|       8.4 sec |  8.400 sec |   7.728 sec |    7.140 sec |
|       6.0 sec |  6.000 sec |   5.520 sec |    5.100 sec |
|      12.0 sec | 12.000 sec |  11.040 sec |   10.200 sec |

### Fuel and production estimates

```text
fuel items required = ceil(fuel units required / selected fuel value)
crafts available    = min(material crafts available, fuel crafts available)
crafts per hour     = 3,600,000 / effective interval
XP per hour         = crafts per hour * authored recipe XP
```

The base estimate includes available loaded fuel and, when Auto-refuel is enabled, available unlocked inventory fuel. Preservation is not included in the base craft count or XP rate.

### Quantity modes

```text
1             = exactly one cycle
10            = up to ten cycles
all           = all complete cycles available when the action starts
continuous    = continue until the next cycle cannot resolve or the player stops
```

## Estimated rates

These values mirror `getSmithingEstimatedRates`. They assume the required Smithing level, enough materials, enough fuel for Forge recipes, and no inventory-full stop. Forge rates ignore hammers. Anvil rates show XP only; each cycle still creates one output.

### Forge rates

| Recipe    |    Time | Crafts / hr | XP / craft | XP / hr |
| --------- | ------: | ----------: | ---------: | ------: |
| Iron Bar  | 3.8 sec |      947.37 |         20 |  18,947 |
| Steel Bar | 5.2 sec |      692.31 |         40 |  27,692 |

### Anvil rates by hammer

| Output                | Base time | XP / craft | XP / hr - no hammer | XP / hr - Iron Hammer | XP / hr - Steel Hammer |
| --------------------- | --------: | ---------: | ------------------: | --------------------: | ---------------------: |
| Iron Sword            |   4.2 sec |         80 |              68,571 |                74,534 |                 80,672 |
| Iron Helm             |   4.2 sec |         60 |              51,429 |                55,901 |                 60,504 |
| Iron Bulwark          |   4.2 sec |        100 |              85,714 |                93,168 |                100,840 |
| Iron Armor            |   8.4 sec |        220 |              94,286 |               102,484 |                110,924 |
| Iron Pick             |   4.2 sec |        100 |              85,714 |                93,168 |                100,840 |
| Iron Smithing Hammer  |   4.2 sec |         60 |              51,429 |                55,901 |                 60,504 |
| Steel Sword           |   6.0 sec |        200 |             120,000 |               130,435 |                141,176 |
| Steel Helm            |   6.0 sec |        160 |              96,000 |               104,348 |                112,941 |
| Steel Smithing Hammer |   6.0 sec |        160 |              96,000 |               104,348 |                112,941 |
| Steel Bulwark         |   6.0 sec |        240 |             144,000 |               156,522 |                169,412 |
| Steel Armor           |  12.0 sec |        520 |             156,000 |               169,565 |                183,529 |
| Steel Pick            |   6.0 sec |        240 |             144,000 |               156,522 |                169,412 |

Iron Hammer rates become available at Smithing level 15. Steel Hammer rates become available at Smithing level 32 and can accelerate both Iron and Steel Anvil recipes.

## Runtime behavior

| Phase              |                  Duration | Result                                                                                     |
| ------------------ | ------------------------: | ------------------------------------------------------------------------------------------ |
| Smithing cycle     | Effective recipe interval | Resolves one atomic material, fuel, output, XP, statistics, discovery, and RNG transaction |
| Idle / stopped     |                       N/A | No Smithing resources or XP are consumed                                                   |
| Offline simulation |               Up to 24 hr | Replays the same Smithing cycle rules used online                                          |

Important rules:

- A cycle checks the full authored input cost before resolving preservation.
- Fuel staging, preserved material consumption, output insertion, XP, statistics, discovery, and Smithing RNG commit together.
- If any staged operation cannot complete, the cycle consumes nothing and Smithing stops safely.
- Inventory-full rejection leaves materials, fuel, XP, statistics, and RNG unchanged for that cycle.
- Missing materials, insufficient fuel, an invalid recipe, or an invalid Smithing level stops the active order.
- Equivalent elapsed-time chunks use the same deterministic Smithing RNG state.
- `statistics.smelted` and `statistics.forged` track completed Forge and Anvil cycles.

## Items associated with Smithing

### Active bars and inputs

| ID          | Display name | Category | Rarity | Stackable | Source             | Current role                              |
| ----------- | ------------ | -------- | ------ | --------- | ------------------ | ----------------------------------------- |
| `iron-ore`  | Iron Ore     | Material | Common | Yes       | Mining - Iron Vein | Iron Bar input                            |
| `coal`      | Coal Ore     | Material | Common | Yes       | Mining - Coal Seam | Active Forge fuel and Steel input context |
| `iron-bar`  | Iron Bar     | Material | Common | Yes       | Smithing - Forge   | Iron-tier Anvil input                     |
| `steel-bar` | Steel Bar    | Material | Common | Yes       | Smithing - Forge   | Steel-tier Anvil input                    |

### Active Smithing outputs

Active outputs are the Iron and Steel Anvil items listed in the progression table above. Picks and Smithing hammers are registered tools; equipment outputs use their normal weapon, armor, shield, and generic tool slots.

### Legacy Bronze compatibility

Bronze recipes remain registered for old inventories and active saves but are hidden from normal Phase One browsing.

| Recipe / output | Historical values                        | Current role                 |
| --------------- | ---------------------------------------- | ---------------------------- |
| Bronze Bar      | 1 Copper Ore + 1 Tin Ore, 2.4 sec, 24 XP | Legacy Forge recipe; no fuel |
| Bronze Sword    | 3 Bronze Bars, 2.8 sec, 30 XP            | Legacy Anvil output          |
| Bronze Helm     | 2 Bronze Bars, 2.8 sec, 34 XP            | Legacy Anvil output          |
| Bronze Buckler  | 4 Bronze Bars, 2.8 sec, 38 XP            | Legacy Anvil output          |
| Bronze Armor    | 9 Bronze Bars, 5.6 sec, 78 XP            | Legacy Anvil output          |
| Bronze Pick     | 4 Bronze Bars, 2.8 sec, 42 XP            | Legacy Anvil output          |

## UI and debug reference

The Smithing screen has three editable panels: `smithingOverview`, `smithingForge`, and `smithingAnvil`.

- Active Order shows the selected recipe, quantity mode, available cycles, effective tool context, Forge fuel context, and XP/ETA information.
- Forge shows active Iron and Steel bar recipes in a responsive tile grid with local All Bars / Unlocked visibility.
- Anvil shows separate Type and Metal filters, collapsible Iron and Steel sections, bar stock summaries, and the generic Smithing hammer selector.
- Recipe material displays show authored requirements; preservation remains a runtime transaction rule.
- Facility Upgrade previews are presentation-only. They do not add facility levels, costs, purchases, bonuses, or save fields.
- The Activity Bar is a display surface for the active Smithing order and does not implement a second simulation path.

## Save migration and compatibility

- The current save schema is 8.
- Smithing state persists the deterministic `rngSeed`, `rngCursor`, and Forge fuel state: selected fuel, loaded fuel, loaded quantity, and Auto-refuel.
- Migration 7 normalizes legacy Smithing active-action recipe IDs, quantity modes, remaining counts, and progress.
- Migration 8 normalizes Forge fuel state and clamps loaded quantity to the current hopper capacity.
- Legacy armor IDs such as old platebody and platelegs entries are mapped to the current armor recipes/items.
- Legacy Bronze recipes and existing Bronze, Copper, and Tin inventory stacks remain valid for compatibility.
- No facility level, facility upgrade, or future progression-resource field exists in the save schema.

## Safe legacy cleanup notes

- Bronze recipes are not active Phase One progression, but deleting them would risk old inventories and saves.
- Smithing hammers use the generic tool slot; adding a separate hammer slot would change equipment and save semantics.
- Forge fuel is intentionally represented by the registered fuel definition and abstract units rather than hardcoding Coal into every formula.
- Facility upgrades remain a future balance surface. The current UI preview is non-functional and must not be treated as an implemented production modifier.
