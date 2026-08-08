import { describe, expect, it } from 'vitest';
import { ACTIVE_SMITHING_RECIPES, LEGACY_SMITHING_RECIPES, recipeById } from '../content/recipes';
import { ITEMS, itemById } from '../content/items';
import { SMITHING_TOOLS } from '../content/smithingTools';
import { equipItem } from '../game/systems/equipmentSystem';
import { getItemQuantity, addItem } from '../game/systems/inventorySystem';
import { createNewGame } from '../game/state/initialState';
import { startSmithing } from '../game/engine/actionController';
import { recipeCanStart } from '../game/engine/actionController';
import { simulateElapsed } from '../game/engine/simulation';
import {
  getSmithingEffectiveInterval,
  getSmithingMaxCraftable,
  getSmithingPreservationChance,
} from '../game/formulas/smithingFormulas';
import { getLevelFromXp, getXpForLevel } from '../game/formulas/experienceFormulas';
import { migrateSave } from '../game/persistence/migrations';
import type { GameState } from '../game/types';

const withItems = (state: GameState, entries: Array<[string, number]>): GameState => {
  state.inventory = [];
  for (const [itemId, quantity] of entries)
    state.inventory = addItem(state.inventory, itemId, quantity, 60).inventory;
  return state;
};

const levelSmithing = (state: GameState, level: number): void => {
  state.skills.smithing = { level, xp: getXpForLevel(level) };
};

describe('Smithing 1.0 content and formulas', () => {
  it('keeps active Iron/Steel progression separate from legacy Bronze', () => {
    expect(recipeById['iron-bar']).toMatchObject({
      level: 1,
      xp: 20,
      forgeFuelUnits: 1,
      fuel: { itemId: 'coal', quantity: 1 },
    });
    expect(recipeById['steel-bar']).toMatchObject({
      level: 30,
      xp: 40,
      forgeFuelUnits: 2,
      fuel: { itemId: 'coal', quantity: 2 },
    });
    expect(LEGACY_SMITHING_RECIPES.every((recipe) => recipe.legacy)).toBe(true);
    expect(ACTIVE_SMITHING_RECIPES.some((recipe) => recipe.id === 'bronze-bar')).toBe(false);
    expect(itemById['iron-smithing-hammer']?.slot).toBe('tool');
    expect(itemById['steel-smithing-hammer']?.slot).toBe('tool');
    expect(SMITHING_TOOLS.every((tool) => itemById[tool.itemId])).toBe(true);
    expect(ITEMS.filter((item) => item.id.endsWith('smithing-hammer'))).toHaveLength(2);
  });

  it('includes Forge fuel in max craftable calculations', () => {
    const state = withItems(createNewGame(0, 'Fuel'), [
      ['iron-ore', 5],
      ['coal', 2],
    ]);
    expect(getSmithingMaxCraftable(state, recipeById['iron-bar'])).toBe(2);
    expect(getSmithingMaxCraftable(state, recipeById['steel-bar'])).toBe(1);
  });

  it('requires Forge fuel in recipeCanStart while keeping Anvil recipes material-gated', () => {
    const state = withItems(createNewGame(0, 'Start Gate'), [['iron-ore', 1]]);
    expect(recipeCanStart(state, 'iron-bar')).toBe(false);
    state.inventory = addItem(state.inventory, 'coal', 1, 60).inventory;
    expect(recipeCanStart(state, 'iron-bar')).toBe(true);
    state.inventory = [];
    expect(recipeCanStart(state, 'iron-sword')).toBe(false);
    state.inventory = addItem(state.inventory, 'iron-bar', 4, 60).inventory;
    levelSmithing(state, 15);
    expect(recipeCanStart(state, 'iron-sword')).toBe(true);
  });

  it('smelts Iron Bar from level 1 and awards the authored XP', () => {
    const state = withItems(createNewGame(0, 'Forge'), [
      ['iron-ore', 1],
      ['coal', 1],
    ]);
    const result = simulateElapsed(startSmithing(state, 'iron-bar', 1, 0), 3800);
    expect(getItemQuantity(result.state.inventory, 'iron-ore')).toBe(0);
    expect(getItemQuantity(result.state.inventory, 'coal')).toBe(0);
    expect(getItemQuantity(result.state.inventory, 'iron-bar')).toBe(1);
    expect(result.summary.xpGained.smithing).toBe(20);
    expect(result.state.statistics.smelted).toBe(1);
  });

  it('stops a Forge cycle cleanly without Coal and ignores hammers', () => {
    const state = withItems(createNewGame(0, 'No Fuel'), [['iron-ore', 1]]);
    levelSmithing(state, 15);
    state.equipment.tool = 'iron-smithing-hammer';
    expect(getSmithingEffectiveInterval(state, recipeById['iron-bar'])).toBe(3800);
    const result = simulateElapsed(startSmithing(state, 'iron-bar', 1, 0), 3800);
    expect(result.state.activeAction).toEqual({ type: 'none' });
    expect(result.summary.stoppedReason).toBe('Forge fuel ran out.');
    expect(result.summary.xpGained.smithing).toBeUndefined();
  });

  it('applies hammer speed and material preservation only to Anvil work', () => {
    const state = createNewGame(0, 'Hammer');
    levelSmithing(state, 15);
    state.equipment.tool = 'iron-smithing-hammer';
    expect(getSmithingEffectiveInterval(state, recipeById['iron-sword'])).toBe(3864);
    expect(getSmithingPreservationChance(state, recipeById['iron-sword'])).toBe(0.03);
    expect(getSmithingPreservationChance(state, recipeById['iron-bar'])).toBe(0);
    expect(getSmithingEffectiveInterval(state, recipeById['iron-bar'])).toBe(3800);
  });

  it('uses the existing tool slot and enforces Smithing hammer requirements', () => {
    const state = withItems(createNewGame(0, 'Equip Hammer'), [['iron-smithing-hammer', 1]]);
    levelSmithing(state, 14);
    expect(equipItem(state, 'iron-smithing-hammer')).toMatchObject({
      ok: false,
      message: 'Smithing level 15 is required for Iron Smithing Hammer.',
    });
    levelSmithing(state, 15);
    const result = equipItem(state, 'iron-smithing-hammer');
    expect(result.ok).toBe(true);
    expect(result.state.equipment.tool).toBe('iron-smithing-hammer');
    expect(getItemQuantity(result.state.inventory, 'worn-pickaxe')).toBe(1);
  });
});

describe('Smithing 1.0 atomic cycles and quantity modes', () => {
  it('preserves deterministic Anvil materials and advances RNG only on commit', () => {
    const state = withItems(createNewGame(0, 'Preservation'), [['iron-bar', 4]]);
    levelSmithing(state, 15);
    state.equipment.tool = 'iron-smithing-hammer';
    state.smithing = { ...state.smithing, rngSeed: 1972, rngCursor: 0 };
    const result = simulateElapsed(startSmithing(state, 'iron-sword', 1, 0), 3864);
    expect(getItemQuantity(result.state.inventory, 'iron-sword')).toBe(1);
    expect(getItemQuantity(result.state.inventory, 'iron-bar')).toBe(3);
    expect(result.summary.itemsUsed['iron-bar']).toBe(1);
    expect(result.summary.xpGained.smithing).toBe(80);
    expect(result.state.smithing.rngCursor).toBe(4);

    const rejected = withItems(createNewGame(0, 'Rejected'), [['iron-bar', 5]]);
    levelSmithing(rejected, 15);
    rejected.equipment.tool = 'iron-smithing-hammer';
    rejected.smithing = { ...rejected.smithing, rngSeed: 1972, rngCursor: 0 };
    rejected.inventory.push(
      ...Array.from({ length: 59 }, () => ({ itemId: 'tin-ore', quantity: 1, locked: false })),
    );
    const rejectedResult = simulateElapsed(startSmithing(rejected, 'iron-sword', 1, 0), 3864);
    expect(getItemQuantity(rejectedResult.state.inventory, 'iron-bar')).toBe(5);
    expect(rejectedResult.state.smithing.rngCursor).toBe(0);
    expect(rejectedResult.summary.xpGained.smithing).toBeUndefined();
    expect(rejectedResult.summary.stoppedReason).toBe('Inventory is full.');
  });

  it('allows a full inventory craft when consuming the final input frees a slot', () => {
    const state = createNewGame(0, 'Atomic Space');
    levelSmithing(state, 15);
    state.inventory = [
      { itemId: 'iron-bar', quantity: 4, locked: false },
      ...Array.from({ length: 59 }, () => ({ itemId: 'tin-ore', quantity: 1, locked: false })),
    ];
    const result = simulateElapsed(startSmithing(state, 'iron-sword', 1, 0), 4200);
    expect(getItemQuantity(result.state.inventory, 'iron-bar')).toBe(0);
    expect(getItemQuantity(result.state.inventory, 'iron-sword')).toBe(1);
    expect(result.summary.stoppedReason).toBeUndefined();
  });

  it('snapshots All and distinguishes it from Continuous', () => {
    const all = withItems(createNewGame(0, 'All'), [
      ['iron-ore', 3],
      ['coal', 3],
    ]);
    const allStarted = startSmithing(all, 'iron-bar', 'all', 0);
    expect(allStarted.activeAction).toMatchObject({ type: 'smithing', remaining: 3 });
    const allResult = simulateElapsed(allStarted, 20_000);
    expect(getItemQuantity(allResult.state.inventory, 'iron-bar')).toBe(3);
    expect(allResult.state.activeAction).toEqual({ type: 'none' });

    const continuous = withItems(createNewGame(0, 'Continuous'), [
      ['iron-ore', 3],
      ['coal', 3],
    ]);
    const continuousStarted = startSmithing(continuous, 'iron-bar', 'continuous', 0);
    expect(continuousStarted.activeAction).toMatchObject({ type: 'smithing', remaining: null });
    const continuousResult = simulateElapsed(continuousStarted, 20_000);
    expect(getItemQuantity(continuousResult.state.inventory, 'iron-bar')).toBe(3);
    expect(continuousResult.state.activeAction).toEqual({ type: 'none' });
  });

  it('matches one large offline simulation with chunked simulation', () => {
    const initial = withItems(createNewGame(0, 'Offline'), [['iron-bar', 20]]);
    levelSmithing(initial, 15);
    initial.equipment.tool = 'iron-smithing-hammer';
    initial.smithing = { ...initial.smithing, rngSeed: 1972, rngCursor: 0 };
    const one = startSmithing(initial, 'iron-sword', 'continuous', 0);
    let many = structuredClone(one);
    const oneResult = simulateElapsed(one, 60_000).state;
    for (let index = 0; index < 6; index += 1) many = simulateElapsed(many, 10_000).state;
    expect(many.inventory).toEqual(oneResult.inventory);
    expect(many.skills.smithing).toEqual(oneResult.skills.smithing);
    expect(many.activeAction).toEqual(oneResult.activeAction);
    expect(many.smithing).toEqual(oneResult.smithing);
    expect(many.statistics).toEqual(oneResult.statistics);
  });
});

describe('Smithing schema 8 migration', () => {
  it('adds Forge fuel state without changing XP, inventory, equipment, RNG, or active recipe', () => {
    const state = createNewGame(0, 'Schema Seven');
    state.schemaVersion = 7;
    state.smithing = { rngSeed: 1972, rngCursor: 9 } as GameState['smithing'];
    state.inventory = [{ itemId: 'bronze-bar', quantity: 4, locked: true }];
    state.equipment.tool = 'worn-pickaxe';
    state.activeAction = {
      type: 'smithing',
      recipeId: 'bronze-armor',
      quantityMode: 'continuous',
      remaining: null,
      progressMs: 100,
    };
    const xp = state.skills.smithing.xp;
    const migrated = migrateSave(state, 7);
    expect(migrated.schemaVersion).toBe(13);
    expect(migrated.smithing).toMatchObject({
      rngSeed: 1972,
      rngCursor: 9,
      forgeFuel: {
        selectedFuelItemId: 'coal',
        loadedFuelItemId: null,
        loadedFuelQuantity: 0,
        autoRefuel: true,
      },
    });
    expect(migrated.skills.smithing.xp).toBe(xp);
    expect(migrated.inventory).toEqual(state.inventory);
    expect(migrated.equipment).toEqual(state.equipment);
    expect(migrated.activeAction).toMatchObject({ recipeId: 'bronze-armor' });
  });

  it('repairs a current-save Smithing level that disagrees with its XP', () => {
    const state = createNewGame(0, 'Stale Smithing');
    state.skills.smithing = { level: 3, xp: 220 };
    const migrated = migrateSave(state, 8);
    expect(migrated.skills.smithing).toEqual({ level: getLevelFromXp(220), xp: 220 });
  });
});
