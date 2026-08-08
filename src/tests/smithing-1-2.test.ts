import { describe, expect, it } from 'vitest';
import { SMITHING_TUNING } from '../config/smithingTuning';
import { SMITHING_FUELS, smithingFuelById } from '../content/smithingFuels';
import { itemById } from '../content/items';
import { ACTIVE_SMITHING_RECIPES, recipeById } from '../content/recipes';
import { simulateElapsed } from '../game/engine/simulation';
import { startSmithing } from '../game/engine/actionController';
import { getXpForLevel } from '../game/formulas/experienceFormulas';
import {
  getForgeFuelCraftsAvailable,
  getForgeFuelTimeEstimate,
  getForgeFuelUnitsRequired,
  getSmithingProductionEstimate,
  getSmithingStartBlockReason,
  loadForgeFuel,
  unloadForgeFuel,
} from '../game/formulas/smithingFormulas';
import { migrateSave } from '../game/persistence/migrations';
import { parseGameState } from '../game/persistence/saveSchema';
import { createNewGame } from '../game/state/initialState';
import { addItem, getItemQuantity } from '../game/systems/inventorySystem';
import type { GameState } from '../game/types';

const withItems = (state: GameState, entries: Array<[string, number]>): GameState => {
  state.inventory = [];
  for (const [itemId, quantity] of entries)
    state.inventory = addItem(state.inventory, itemId, quantity, 60).inventory;
  return state;
};

describe('Smithing 1.2 Forge fuel', () => {
  it('registers Coal as a value-one fuel and keeps Bronze fuel-free', () => {
    expect(SMITHING_FUELS).toEqual([{ itemId: 'coal', name: 'Coal', fuelValue: 1 }]);
    expect(smithingFuelById.coal.fuelValue).toBe(1);
    expect(getForgeFuelUnitsRequired(recipeById['iron-bar'])).toBe(1);
    expect(getForgeFuelUnitsRequired(recipeById['steel-bar'])).toBe(2);
    expect(getForgeFuelUnitsRequired(recipeById['bronze-bar'])).toBe(0);
    expect(ACTIVE_SMITHING_RECIPES.every((recipe) => !recipe.legacy)).toBe(true);
    expect(
      ACTIVE_SMITHING_RECIPES.every((recipe) => itemById[recipe.outputItemId]?.tier !== 'bronze'),
    ).toBe(true);
  });

  it('loads 1, 5, 10, and Fill into the persistent capacity-limited hopper', () => {
    const state = withItems(createNewGame(0, 'Manual Fuel'), [['coal', 25]]);
    expect(state.smithing.forgeFuel).toMatchObject({
      selectedFuelItemId: 'coal',
      loadedFuelItemId: null,
      loadedFuelQuantity: 0,
      autoRefuel: true,
    });

    const one = loadForgeFuel(state, 1);
    const five = loadForgeFuel(one.state, 5);
    const ten = loadForgeFuel(five.state, 10);
    const fill = loadForgeFuel(ten.state, 'max');

    expect([one, five, ten, fill].map((result) => result.quantity)).toEqual([1, 5, 10, 4]);
    expect(fill.state.smithing.forgeFuel).toMatchObject({
      loadedFuelItemId: 'coal',
      loadedFuelQuantity: SMITHING_TUNING.baseForgeFuelCapacity,
    });
    expect(getItemQuantity(fill.state.inventory, 'coal')).toBe(5);
    expect(unloadForgeFuel(fill.state).quantity).toBe(SMITHING_TUNING.baseForgeFuelCapacity);
    expect(getItemQuantity(unloadForgeFuel(fill.state).state.inventory, 'coal')).toBe(25);
  });

  it('does not load locked fuel and safely refuses an unload with no inventory space', () => {
    const locked = createNewGame(0, 'Locked Fuel');
    locked.inventory = [{ itemId: 'coal', quantity: 5, locked: true }];
    expect(loadForgeFuel(locked, 'max')).toMatchObject({ ok: false, quantity: 0 });
    expect(locked.smithing.forgeFuel.loadedFuelQuantity).toBe(0);

    const full = createNewGame(0, 'Full Hopper');
    full.inventory = Array.from({ length: 60 }, (_, index) => ({
      itemId: index === 0 ? 'iron-ore' : 'copper-ore',
      quantity: 1,
      locked: false,
    }));
    full.smithing.forgeFuel.loadedFuelItemId = 'coal';
    full.smithing.forgeFuel.loadedFuelQuantity = 2;
    const result = unloadForgeFuel(full);
    expect(result.ok).toBe(false);
    expect(result.state).toEqual(full);
    expect(result.message).toContain('inventory space');
  });

  it('prioritizes level, then materials, then hopper fuel startability', () => {
    const iron = recipeById['iron-bar'];
    const steel = recipeById['steel-bar'];
    const lowLevel = createNewGame(0, 'Priority');
    expect(getSmithingStartBlockReason(lowLevel, steel)).toBe('level');

    const noMaterials = withItems(createNewGame(0, 'Priority Materials'), [['coal', 1]]);
    expect(getSmithingStartBlockReason(noMaterials, iron)).toBe('materials');

    const manual = withItems(createNewGame(0, 'Manual Start'), [
      ['iron-ore', 1],
      ['coal', 1],
    ]);
    manual.smithing.forgeFuel.autoRefuel = false;
    expect(getSmithingStartBlockReason(manual, iron)).toBe('load-fuel');
    manual.inventory = [{ itemId: 'iron-ore', quantity: 1, locked: false }];
    expect(getSmithingStartBlockReason(manual, iron)).toBe('fuel');

    const automatic = withItems(createNewGame(0, 'Automatic Start'), [
      ['iron-ore', 1],
      ['coal', 1],
    ]);
    expect(getSmithingStartBlockReason(automatic, iron)).toBeNull();
  });

  it('auto-refuels atomically and records only consumed fuel in the summary', () => {
    const state = withItems(createNewGame(0, 'Auto Fuel'), [
      ['iron-ore', 1],
      ['coal', 1],
    ]);
    const result = simulateElapsed(startSmithing(state, 'iron-bar', 1, 0), 3800);
    expect(getItemQuantity(result.state.inventory, 'iron-bar')).toBe(1);
    expect(getItemQuantity(result.state.inventory, 'coal')).toBe(0);
    expect(result.state.smithing.forgeFuel.loadedFuelQuantity).toBe(0);
    expect(result.summary.itemsUsed).toEqual({ 'iron-ore': 1, coal: 1 });

    const partial = withItems(createNewGame(0, 'Partial Fuel'), [
      ['iron-ore', 2],
      ['coal', 2],
    ]);
    partial.smithing.forgeFuel.loadedFuelItemId = 'coal';
    partial.smithing.forgeFuel.loadedFuelQuantity = 1;
    partial.skills.smithing = { level: 30, xp: getXpForLevel(30) };
    partial.inventory = partial.inventory.filter((stack) => stack.itemId !== 'coal');
    partial.inventory = addItem(partial.inventory, 'coal', 2, 60).inventory;
    const steelResult = simulateElapsed(startSmithing(partial, 'steel-bar', 1, 0), 5200);
    expect(getItemQuantity(steelResult.state.inventory, 'steel-bar')).toBe(1);
    expect(steelResult.summary.itemsUsed.coal).toBe(2);
    expect(steelResult.state.smithing.forgeFuel.loadedFuelQuantity).toBe(1);
    expect(getItemQuantity(steelResult.state.inventory, 'coal')).toBe(0);
  });

  it('uses only loaded hopper fuel when auto-refuel is disabled', () => {
    const state = withItems(createNewGame(0, 'Manual Mode'), [
      ['iron-ore', 1],
      ['coal', 5],
    ]);
    state.smithing.forgeFuel.autoRefuel = false;
    const loaded = loadForgeFuel(state, 2).state;
    const result = simulateElapsed(startSmithing(loaded, 'iron-bar', 1, 0), 3800);
    expect(getItemQuantity(result.state.inventory, 'iron-bar')).toBe(1);
    expect(getItemQuantity(result.state.inventory, 'coal')).toBe(3);
    expect(result.state.smithing.forgeFuel.loadedFuelQuantity).toBe(1);
    expect(result.summary.itemsUsed.coal).toBe(1);
  });

  it('snapshots All from hopper-only or hopper-plus-inventory fuel and stops when supply ends', () => {
    const manual = withItems(createNewGame(0, 'All Manual Fuel'), [
      ['iron-ore', 3],
      ['coal', 3],
    ]);
    manual.smithing.forgeFuel.autoRefuel = false;
    const loaded = loadForgeFuel(manual, 1).state;
    const manualStart = startSmithing(loaded, 'iron-bar', 'all', 0);
    expect(manualStart.activeAction).toMatchObject({ remaining: 1 });
    const manualResult = simulateElapsed(manualStart, 20_000);
    expect(getItemQuantity(manualResult.state.inventory, 'iron-bar')).toBe(1);
    expect(getItemQuantity(manualResult.state.inventory, 'coal')).toBe(2);

    const automatic = withItems(createNewGame(0, 'All Automatic Fuel'), [
      ['iron-ore', 3],
      ['coal', 3],
    ]);
    const automaticStart = startSmithing(automatic, 'iron-bar', 'all', 0);
    expect(automaticStart.activeAction).toMatchObject({ remaining: 3 });
    const automaticResult = simulateElapsed(automaticStart, 20_000);
    expect(getItemQuantity(automaticResult.state.inventory, 'iron-bar')).toBe(3);
    expect(automaticResult.state.activeAction).toEqual({ type: 'none' });

    const insufficient = withItems(createNewGame(0, 'Insufficient Fuel'), [['iron-ore', 1]]);
    const stopped = simulateElapsed(startSmithing(insufficient, 'iron-bar', 1, 0), 3800);
    expect(stopped.summary.stoppedReason).toBe('Forge fuel ran out.');
  });

  it('rolls back staged fuel, materials, RNG, and summary effects when output cannot fit', () => {
    const state = createNewGame(0, 'Atomic Fuel');
    state.inventory = [
      { itemId: 'iron-ore', quantity: 2, locked: false },
      { itemId: 'coal', quantity: 21, locked: false },
      ...Array.from({ length: 58 }, () => ({
        itemId: 'copper-ore',
        quantity: 1,
        locked: false,
      })),
    ];
    const before = structuredClone(state);
    const result = simulateElapsed(startSmithing(state, 'iron-bar', 1, 0), 3800);

    expect(result.state.inventory).toEqual(before.inventory);
    expect(result.state.smithing).toEqual(before.smithing);
    expect(result.state.skills.smithing).toEqual(before.skills.smithing);
    expect(result.summary.itemsUsed).toEqual({});
    expect(result.summary.itemsGained).toEqual({});
    expect(result.summary.stoppedReason).toBe('Inventory is full.');
  });

  it('separates loaded fuel estimates from production estimates', () => {
    const state = withItems(createNewGame(0, 'Estimates'), [
      ['iron-ore', 5],
      ['coal', 3],
    ]);
    const recipe = recipeById['iron-bar'];
    const estimate = getSmithingProductionEstimate(state, recipe, 'all');
    expect(getForgeFuelCraftsAvailable(state, recipe)).toBe(0);
    expect(getForgeFuelCraftsAvailable(state, recipe, true)).toBe(3);
    expect(estimate).toMatchObject({
      baseCraftsAvailable: 3,
      intervalMs: 3800,
      xpPerCraft: 20,
      totalBaseXp: 60,
      totalBaseTimeMs: 11_400,
    });
    expect(getForgeFuelTimeEstimate(state, recipe)).toBe(0);
    const loaded = loadForgeFuel(state, 3).state;
    expect(getForgeFuelTimeEstimate(loaded, recipe)).toBe(11_400);
  });

  it('keeps Forge RNG, fuel, and output deterministic across chunked simulation', () => {
    const initial = withItems(createNewGame(0, 'Chunked Fuel'), [
      ['iron-ore', 20],
      ['coal', 20],
    ]);
    const one = startSmithing(initial, 'iron-bar', 'continuous', 0);
    const oneResult = simulateElapsed(one, 60_000).state;
    let many = structuredClone(one);
    for (let index = 0; index < 6; index += 1) many = simulateElapsed(many, 10_000).state;
    expect(many.inventory).toEqual(oneResult.inventory);
    expect(many.smithing).toEqual(oneResult.smithing);
    expect(many.skills.smithing).toEqual(oneResult.skills.smithing);
    expect(many.statistics).toEqual(oneResult.statistics);
    expect(many.activeAction).toEqual(oneResult.activeAction);
  });

  it('migrates schema 7 saves to schema 8 without dropping progress or legacy Coal', () => {
    const state = createNewGame(0, 'Schema Eight');
    state.schemaVersion = 7;
    const smithingXp = getXpForLevel(15) + 123;
    state.skills.smithing = { level: 15, xp: smithingXp };
    state.smithing = { rngSeed: 9876, rngCursor: 12 } as GameState['smithing'];
    state.inventory = [{ itemId: 'coal', quantity: 7, locked: true }];
    state.activeAction = {
      type: 'smithing',
      recipeId: 'bronze-armor',
      quantityMode: 'continuous',
      remaining: null,
      progressMs: 123,
    };

    const migrated = migrateSave(state, 7);
    const parsed = parseGameState(JSON.stringify(state));
    for (const result of [migrated, parsed]) {
      expect(result.schemaVersion).toBe(14);
      expect(result.skills.smithing).toEqual({ level: 15, xp: smithingXp });
      expect(result.smithing).toMatchObject({
        rngSeed: 9876,
        rngCursor: 12,
        forgeFuel: {
          selectedFuelItemId: 'coal',
          loadedFuelItemId: null,
          loadedFuelQuantity: 0,
          autoRefuel: true,
        },
      });
      expect(result.inventory).toEqual([{ itemId: 'coal', quantity: 7, locked: true }]);
      expect(result.activeAction).toMatchObject({ recipeId: 'bronze-armor' });
    }
  });
});
