# Ironbound Idle — Mining 1.1 Balance Reference

This is the balance sheet for the current Mining implementation. Values intended for balance tuning live in code; this file mirrors them for quick review.

Authoritative sources:

- `src/content/miningNodes.ts` — active rocks, stages, primary rewards, and bonus drops
- `src/content/miningTools.ts` — pickaxe requirements and Mining stats
- `src/content/items.ts` — item names, rarity, stackability, and legacy registry entries
- `src/config/miningTuning.ts` — stamina and no-pickaxe fallback
- `src/game/formulas/miningFormulas.ts` — effectiveness, damage, XP, rewards, RNG, and rate estimates
- `src/game/engine/simulation.ts` — swing, rest, respawn, inventory, and offline behavior
- `src/game/persistence/migrations.ts` — retired-node save migration

## Active Phase One progression

The normal Mining screen contains exactly these three nodes:

| Node          | ID              | Mining level | Required penetration | Primary item      | XP / fully effective swing | Damage per primary item | Respawn |
| ------------- | --------------- | -----------: | -------------------: | ----------------- | -------------------------: | ----------------------: | ------: |
| Stone Outcrop | `stone-outcrop` |            1 |                   10 | Stone Ore         |                          8 |                      10 |  15 sec |
| Iron Vein     | `iron-vein`     |           15 |                   35 | Iron Ore          |                         18 |                      14 |  15 sec |
| Coal Seam     | `coal-seam`     |           30 |                   45 | Coal Ore (`coal`) |                         26 |                      16 |  15 sec |

Retired active node IDs are `copper-vein`, `tin-vein`, and `mithril-deposit`. Their item definitions remain registered for save and Smithing compatibility, but they are not normal Mining targets or drops.

## Global tuning

| Setting                     |    Value |
| --------------------------- | -------: |
| Maximum Mining stamina      |      100 |
| Stamina restored after rest |      100 |
| Rest duration               |   10 sec |
| Minimum effectiveness       |      10% |
| Maximum effectiveness       |     100% |
| Inventory capacity          | 60 slots |
| Offline simulation cap      |    24 hr |
| Current save schema         |        5 |

### No-pickaxe fallback

If no valid pickaxe is equipped, or the equipped pickaxe is above the player's Mining level, Mining uses:

| Rock damage | Penetration | Swing interval | Stamina / swing | Required level |
| ----------: | ----------: | -------------: | --------------: | -------------: |
|           1 |           0 |        5.0 sec |              25 |              1 |

The 10% effectiveness floor and minimum one damage floor mean a level-valid node can technically be mined without a pickaxe.

## Stage progression

Every active node has the same five stages and bonus multipliers. Durability is intentionally ascending toward the center: the outer crust is quickest, while deeper material takes longer to break and has better byproduct chances.

| Stage | Name             | Bonus chance multiplier |
| ----: | ---------------- | ----------------------: |
|     1 | Outer Crust      |                   0.50x |
|     2 | Exposed Seam     |                   0.75x |
|     3 | Dense Vein       |                   1.00x |
|     4 | Rich Core        |                   1.35x |
|     5 | Heart of Deposit |                   1.80x |

### Durability by stage

The runtime starts a fresh rock at Stage 1 with that stage's maximum durability. When a stage is depleted, the next stage starts at its own maximum.

| Node          | Stage 1 | Stage 2 | Stage 3 | Stage 4 | Stage 5 | Total rock durability |
| ------------- | ------: | ------: | ------: | ------: | ------: | --------------------: |
| Stone Outcrop |      60 |      70 |      80 |      90 |     100 |                   400 |
| Iron Vein     |     100 |     120 |     140 |     160 |     180 |                   700 |
| Coal Seam     |     120 |     140 |     160 |     180 |     200 |                   800 |

Stage multipliers affect bonus-drop chances only. They do not change primary yield, swing damage, or XP.

## Mining rewards

### Primary resources

Primary yield is deterministic. Each accepted swing adds `effective damage / damage per primary item` to fractional progress. Whole points become items; the remainder carries to the next swing.

| Node          | Primary output |              Yield target |
| ------------- | -------------- | ------------------------: |
| Stone Outcrop | Stone Ore      | 1 per 10 effective damage |
| Iron Vein     | Iron Ore       | 1 per 14 effective damage |
| Coal Seam     | Coal Ore       | 1 per 16 effective damage |

### Active bonus-drop definitions

Each drop is rolled once per accepted swing. Quantity is an inclusive uniform range.

| Node          | Bonus item | Base chance | Quantity |
| ------------- | ---------- | ----------: | -------: |
| Stone Outcrop | Iron Ore   |       8.00% |        1 |
| Stone Outcrop | Rough Gem  |       0.40% |        1 |
| Iron Vein     | Rough Gem  |       0.70% |        1 |
| Coal Seam     | Rough Gem  |       0.80% |        1 |

Stone Fragment and Sharpening Grit are not active Mining drops. Coal has no special authored byproduct beyond its generic Rough Gem chance.

### Effective bonus chances by stage

The following are the actual per-swing chances after applying the stage multiplier.

| Node / drop       | Stage 1 | Stage 2 | Stage 3 | Stage 4 | Stage 5 |
| ----------------- | ------: | ------: | ------: | ------: | ------: |
| Stone → Iron Ore  |   4.00% |   6.00% |   8.00% |  10.80% |  14.40% |
| Stone → Rough Gem |   0.20% |   0.30% |   0.40% |   0.54% |   0.72% |
| Iron → Rough Gem  |   0.35% |  0.525% |   0.70% |  0.945% |   1.26% |
| Coal → Rough Gem  |   0.40% |   0.60% |   0.80% |   1.08% |   1.44% |

Example: Stone Outcrop Stage 5 Iron Ore chance is `0.08 × 1.80 = 0.144`, or 14.4%.

## Items associated with Mining

### Current direct Mining outputs

| ID          | Display name | Category | Rarity | Stackable | Source                 | Current role                           |
| ----------- | ------------ | -------- | ------ | --------- | ---------------------- | -------------------------------------- |
| `stone-ore` | Stone Ore    | Material | Common | Yes       | Mining · Stone Outcrop | Primary Stone resource                 |
| `iron-ore`  | Iron Ore     | Material | Common | Yes       | Mining · Iron Vein     | Primary Iron resource; Stone byproduct |
| `coal`      | Coal Ore     | Material | Common | Yes       | Mining · Coal Seam     | Primary fuel resource                  |
| `rough-gem` | Rough Gem    | Material | Rare   | Yes       | Mining                 | Generic future Jewelcrafting material  |

### Legacy item definitions preserved for saves

These items are still valid registry entries and existing inventory quantities must remain intact. They are not active Phase One Mining outputs.

| ID                | Name            | Category | Rarity   | Source / compatibility                |
| ----------------- | --------------- | -------- | -------- | ------------------------------------- |
| `copper-ore`      | Copper Ore      | Material | Common   | Legacy Bronze-era Smithing            |
| `tin-ore`         | Tin Ore         | Material | Common   | Legacy Bronze-era Smithing            |
| `mithril-ore`     | Mithril Ore     | Material | Common   | Legacy inventory compatibility        |
| `stone-fragment`  | Stone Fragment  | Material | Common   | Legacy Mining inventory compatibility |
| `sharpening-grit` | Sharpening Grit | Material | Uncommon | Legacy Mining inventory compatibility |

Current downstream recipe use:

- Copper Ore + Tin Ore → Bronze Bar.
- Iron Ore → Iron Bar.
- Iron Ore + Coal Ore → Steel Bar.
- Stone Ore, Rough Gem, Mithril Ore, Stone Fragment, and Sharpening Grit currently have no new Mining 1.1 crafting sink.

## Pickaxes

These explicit definitions are authoritative for Mining. Generic `miningSpeed` item bonuses are no longer attached to pickaxes and do not drive Mining.

| Item ID          | Name         | Tier   | Source         | Rarity   | Required Mining level | Rock damage | Penetration | Swing interval | Stamina / swing |
| ---------------- | ------------ | ------ | -------------- | -------- | --------------------: | ----------: | ----------: | -------------: | --------------: |
| `worn-pickaxe`   | Worn Pickaxe | —      | Mining starter | Common   |                     1 |          10 |          10 |        3.0 sec |              20 |
| `bronze-pickaxe` | Bronze Pick  | Bronze | Smithing       | Common   |                     8 |          16 |          25 |        2.8 sec |              18 |
| `iron-pickaxe`   | Iron Pick    | Iron   | Smithing       | Uncommon |                    20 |          28 |          45 |        2.5 sec |              16 |
| `steel-pickaxe`  | Steel Pick   | Steel  | Smithing       | Rare     |                    35 |          42 |          70 |        2.2 sec |              14 |

All pickaxes occupy the `tool` equipment slot and are stackable. New profiles start with the Worn Pickaxe equipped and discovered.

### Pickaxe Smithing recipes

| Recipe ID        | Output      | Smithing level | Inputs        | Output quantity | Smithing XP | Craft interval |
| ---------------- | ----------- | -------------: | ------------- | --------------: | ----------: | -------------: |
| `bronze-pickaxe` | Bronze Pick |              8 | 4 Bronze Bars |               1 |          42 |        2.8 sec |
| `iron-pickaxe`   | Iron Pick   |             22 | 5 Iron Bars   |               1 |          67 |        4.2 sec |
| `steel-pickaxe`  | Steel Pick  |             37 | 6 Steel Bars  |               1 |         102 |        6.0 sec |

Mining equip requirements are 8, 20, and 35. Smithing recipe requirements remain separate.

## Mining formulas

### Effectiveness and classifications

```text
effectiveness = clamp(tool penetration / node required penetration, 0.10, 1.00)
```

The UI classification thresholds are:

| Label                 | Effectiveness |
| --------------------- | ------------: |
| OPTIMAL               |          100% |
| EFFECTIVE             |        70–99% |
| WEAK                  |        40–69% |
| UNDERPOWERED          |        15–39% |
| SEVERELY UNDERPOWERED |        10–14% |

### Swing damage and XP

```text
swing damage = max(1, floor(tool rock damage × effectiveness))
swing XP     = max(1, floor(node XP × effectiveness))
```

Low penetration reduces damage and XP; it does not make a swing miss.

### Primary yield and bonus drops

```text
total progress = previous fractional progress + swing damage / damage per primary item
primary items  = floor(total progress)
new remainder  = total progress - primary items

effective chance = clamp(base chance × current stage multiplier, 0, 1)
```

Bonus rolls use deterministic per-node RNG. Accepted reward bundles, offline simulation, and equivalent elapsed-time chunks remain deterministic.

## Estimated rates

These values mirror `getMiningEstimatedRates`. They assume a valid Mining level, full stamina, no inventory-full stop, and the current tool. Cycle time includes estimated rests and the 15-second respawn; primary output excludes bonus drops.

| Tool   | Node  | Effectiveness | Damage | XP / swing | Swings / rock |       Cycle | Primary / rock | Primary / hr |   XP / hr |
| ------ | ----- | ------------: | -----: | ---------: | ------------: | ----------: | -------------: | -----------: | --------: |
| Worn   | Stone |        100.0% |     10 |          8 |            40 |   215.0 sec |             40 |       669.77 |  5,358.14 |
| Worn   | Iron  |         28.6% |      2 |          5 |           350 | 1,765.0 sec |             50 |       101.98 |  3,569.41 |
| Worn   | Coal  |         22.2% |      2 |          5 |           400 | 2,015.0 sec |             50 |        89.33 |  3,573.20 |
| Bronze | Stone |        100.0% |     16 |          8 |            25 |   135.0 sec |             40 |     1,066.67 |  5,333.33 |
| Bronze | Iron  |         71.4% |     11 |         12 |            64 |   314.2 sec |             50 |       572.88 |  8,799.49 |
| Bronze | Coal  |         55.6% |      8 |         14 |           100 |   495.0 sec |             50 |       363.64 | 10,181.82 |
| Iron   | Stone |        100.0% |     28 |          8 |            15 |    72.5 sec |             42 |     2,085.52 |  5,958.62 |
| Iron   | Iron  |        100.0% |     28 |         18 |            25 |   117.5 sec |             50 |     1,531.91 | 13,787.23 |
| Iron   | Coal  |        100.0% |     28 |         26 |            29 |   127.5 sec |             50 |     1,411.76 | 21,289.41 |
| Steel  | Stone |        100.0% |     42 |          8 |            10 |    47.0 sec |             42 |     3,217.02 |  6,127.66 |
| Steel  | Iron  |        100.0% |     42 |         18 |            17 |    72.4 sec |             51 |     2,535.91 | 15,215.47 |
| Steel  | Coal  |        100.0% |     42 |         26 |            20 |    79.0 sec |             52 |     2,369.62 | 23,696.20 |

The estimator uses `floor(swings per rock / swings per full stamina)` for rests. The live simulation prioritizes rock respawn before rest if the final swing both depletes the rock and empties stamina, so this table is an estimate rather than a second ruleset.

## Runtime behavior

| Phase          |               Duration | Result                                                              |
| -------------- | ---------------------: | ------------------------------------------------------------------- |
| Swinging       | Pickaxe swing interval | Resolves one atomic reward bundle, XP, stamina, durability, and RNG |
| Resting        |                 10 sec | Restores stamina to 100                                             |
| Rock reforming |                 15 sec | Resets the node to Stage 1 and its starting durability              |

Important rules:

- A swing is rejected atomically if the complete primary-plus-bonus bundle cannot fit in the inventory.
- On an inventory-full rejection, rewards, XP, stamina, durability, statistics, and RNG progress are unchanged; Mining stops.
- `statistics.miningSwings`, `miningStagesDepleted`, and `miningRocksDepleted` track explicit Mining outcomes. The older `statistics.mined` value remains for compatibility.
- Simulation summaries use `mine-swing:<node>`, `mine-stage:<node>:<stage index>`, and `mine-rock:<node>` keys.

## UI and debug reference

The Mining screen has three editable panels: `miningOverview`, `miningNodes`, and `miningDetails`.

- The active panel shows the active rock, current stage, correct current durability denominator, stage track, phase progress, stamina, and primary progress.
- Node bodies select/inspect only; separate buttons Mine, Mining/Stop, Switch, or Locked control the active action.
- A selected node may differ from the active node. Locked Coal can be inspected without starting it.
- Node cards show the primary resource, estimated resource and XP rates, exact effectiveness, and the shared classification labels above.
- Details show every stage, base → current bonus chances, the selected rock's resource, and the current pickaxe's damage/penetration comparison.
- The Equipment screen shows explicit pickaxe stats from `miningTools.ts`.
- Debug Mining controls cover start, complete swing, deplete stage/rock, complete rest/respawn, stamina, stage, durability, node reset, and full Mining reset. Retired nodes are not ordinary debug choices.

## Save migration and compatibility

- Copper- or Tin-active Mining actions migrate to `stone-outcrop` without granting rewards.
- Stage, clamped durability, fractional primary progress, RNG seed/cursor, valid phase, and stamina are preserved where possible.
- Iron and Coal active actions remain active when their Mining level is valid; Coal uses its new level-30 requirement.
- Mithril-active actions stop safely. Mithril is not mapped to Coal.
- Retired Copper/Tin/Mithril runtime states are no longer authoritative active node state.
- Existing Copper Ore, Tin Ore, Mithril Ore, Stone Fragment, and Sharpening Grit inventory stacks are preserved.
- Bronze-era Smithing recipes remain technically valid for compatibility; Mining 1.1 does not redesign Smithing.

## Safe legacy cleanup notes

- Deprecated Mining node fields `intervalMs`, `rewardItemId`, and `xp` were removed because no active Mining consumer needs them. Mining uses `xpPerSwing`, `primaryRewardItemId`, `respawnMs`, `stages`, and `bonusDrops`.
- Pickaxe item `miningSpeed` bonuses were removed. Generic stat infrastructure remains only for compatibility with broader equipment code; Mining behavior comes from `miningTools.ts`.
- Legacy item definitions remain registered because deleting them would risk existing saves and Bronze-era Smithing references.
