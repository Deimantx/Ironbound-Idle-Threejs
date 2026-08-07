import { describe, expect, it } from 'vitest';
import { SMITHING_TUNING, getSmithingXpPerBar } from '../config/smithingTuning';
import { recipeById } from '../content/recipes';
import { formatHoursMinutes } from '../app/formatters';
import { startSmithing } from '../game/engine/actionController';
import {
  getForgeFuelItemsRequired,
  getSmithingProductionEstimate,
  getSmithingStartBlockReason,
} from '../game/formulas/smithingFormulas';
import { getXpForLevel } from '../game/formulas/experienceFormulas';
import { equipItem } from '../game/systems/equipmentSystem';
import { createNewGame } from '../game/state/initialState';
import { simulateElapsed } from '../game/engine/simulation';
import { addItem, getItemQuantity } from '../game/systems/inventorySystem';

describe('Smithing 1.25 XP and cost normalization', () => {
  it('centralizes XP per active bar tier and derives forging XP from bar count', () => {
    expect(SMITHING_TUNING.xpPerBarByTier).toEqual({ iron: 20, steel: 40 });
    expect(getSmithingXpPerBar('iron')).toBe(20);
    expect(getSmithingXpPerBar('steel')).toBe(40);

    const expected: Record<string, number> = {
      'iron-sword': 80,
      'iron-helmet': 60,
      'iron-shield': 100,
      'iron-armor': 220,
      'iron-pickaxe': 100,
      'iron-smithing-hammer': 60,
      'steel-sword': 200,
      'steel-helmet': 160,
      'steel-smithing-hammer': 160,
      'steel-shield': 240,
      'steel-armor': 520,
      'steel-pickaxe': 240,
    };
    for (const [recipeId, xp] of Object.entries(expected))
      expect(recipeById[recipeId]?.xp).toBe(xp);
    expect(recipeById['iron-bar']?.xp).toBe(20);
    expect(recipeById['steel-bar']?.xp).toBe(40);
  });

  it('requires two Iron Ore and two fuel units for one Steel Bar', () => {
    const insufficient = createNewGame(0, 'Steel Cost Gate');
    insufficient.skills.smithing = { level: 30, xp: getXpForLevel(30) };
    insufficient.inventory = addItem([], 'iron-ore', 1, 60).inventory;
    insufficient.inventory = addItem(insufficient.inventory, 'coal', 2, 60).inventory;
    expect(getSmithingStartBlockReason(insufficient, recipeById['steel-bar'])).toBe('materials');

    const state = createNewGame(0, 'Steel Bar');
    state.skills.smithing = { level: 30, xp: getXpForLevel(30) };
    state.inventory = addItem([], 'iron-ore', 2, 60).inventory;
    state.inventory = addItem(state.inventory, 'coal', 2, 60).inventory;
    const result = simulateElapsed(startSmithing(state, 'steel-bar', 1, 0), 5200);
    expect(getItemQuantity(result.state.inventory, 'iron-ore')).toBe(0);
    expect(getItemQuantity(result.state.inventory, 'coal')).toBe(0);
    expect(getItemQuantity(result.state.inventory, 'steel-bar')).toBe(1);
    expect(result.summary.itemsUsed).toEqual({ 'iron-ore': 2, coal: 2 });
    expect(result.summary.xpGained.smithing).toBe(40);
    expect(result.state.activeAction).toEqual({ type: 'none' });
    expect(recipeById['steel-bar']).toMatchObject({ intervalMs: 5200, forgeFuelUnits: 2 });
  });

  it('converts abstract Forge fuel units to physical selected fuel items', () => {
    const state = createNewGame(0, 'Fuel Display');
    expect(getForgeFuelItemsRequired(state, recipeById['iron-bar'])).toBe(1);
    expect(getForgeFuelItemsRequired(state, recipeById['steel-bar'])).toBe(2);
  });

  it('blocks generic tool swaps while an Anvil order is active', () => {
    const state = createNewGame(0, 'Active Tool Guard');
    state.skills.smithing = { level: 15, xp: getXpForLevel(15) };
    state.inventory = addItem([], 'iron-bar', 4, 60).inventory;
    state.inventory = addItem(state.inventory, 'iron-smithing-hammer', 1, 60).inventory;
    const active = startSmithing(state, 'iron-sword', 'continuous', 0);
    const blocked = equipItem(active, 'iron-smithing-hammer');
    expect(blocked.ok).toBe(false);
    expect(blocked.message).toBe('Stop the current Anvil order to change tools.');
    expect(blocked.state.equipment.tool).toBe('worn-pickaxe');
  });
});

describe('Smithing 1.25 duration formatting', () => {
  it.each([
    [0, '00:00'],
    [30_000, '00:01'],
    [320_000, '00:05'],
    [3_527_800, '00:59'],
    [3_720_000, '01:02'],
    [43_620_000, '12:07'],
    [445_500_000, '123:45'],
  ])('formats %s ms as %s without 24-hour wrapping', (milliseconds, expected) => {
    expect(formatHoursMinutes(milliseconds)).toBe(expected);
  });

  it('uses normalized XP in production estimates', () => {
    const state = createNewGame(0, 'Estimate XP');
    state.skills.smithing = { level: 15, xp: getXpForLevel(15) };
    state.inventory = addItem([], 'iron-bar', 8, 60).inventory;
    const estimate = getSmithingProductionEstimate(state, recipeById['iron-sword'], 'all');
    expect(estimate).toMatchObject({
      baseCraftsAvailable: 2,
      xpPerCraft: 80,
      totalBaseXp: 160,
      totalBaseTimeMs: 8400,
    });
  });
});
