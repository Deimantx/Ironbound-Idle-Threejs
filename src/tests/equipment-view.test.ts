import { describe, expect, it } from 'vitest';
import { itemById } from '../content/items';
import { getDerivedStats } from '../game/formulas/statFormulas';
import { createNewGame } from '../game/state/initialState';
import {
  getCompatibleEquipmentStacks,
  getDerivedStatComparison,
  getEquipmentBonusComparison,
  getEquipmentTierRank,
} from '../app/equipmentView';
import type { InventoryStack } from '../game/types';

describe('Equipment view helpers', () => {
  it('filters compatible inventory gear without mutating input order', () => {
    const stacks: InventoryStack[] = [
      { itemId: 'bronze-armor', quantity: 1, locked: false },
      { itemId: 'steel-armor', quantity: 1, locked: true },
      { itemId: 'iron-sword', quantity: 1, locked: false },
      { itemId: 'unknown', quantity: 2, locked: false },
    ];
    const original = structuredClone(stacks);
    expect(
      getCompatibleEquipmentStacks(stacks, itemById, 'armor').map((stack) => stack.itemId),
    ).toEqual(['steel-armor', 'bronze-armor']);
    expect(stacks).toEqual(original);
    expect(getCompatibleEquipmentStacks(stacks, itemById, 'armor')[0].locked).toBe(true);
  });

  it('ranks tiers deterministically and compares only meaningful bonuses', () => {
    expect(getEquipmentTierRank('steel')).toBeGreaterThan(getEquipmentTierRank('iron'));
    const rows = getEquipmentBonusComparison(itemById['bronze-armor'], itemById['iron-armor']);
    expect(rows).toEqual([
      { id: 'defence', label: 'Defence', current: 16, candidate: 38, delta: 22 },
      { id: 'health', label: 'Health', current: 7, candidate: 18, delta: 11 },
    ]);
    expect(
      getEquipmentBonusComparison(itemById['bronze-sword'], itemById['bronze-sword']),
    ).not.toContainEqual(expect.objectContaining({ current: 0, candidate: 0 }));
  });

  it('marks lower intervals as beneficial in derived comparisons', () => {
    const game = createNewGame(0, 'Preview');
    const current = getDerivedStats(game);
    const preview = getDerivedStats({
      ...game,
      equipment: { weapon: 'steel-sword', tool: 'steel-pickaxe' },
    });
    const rows = getDerivedStatComparison(current, preview);
    const attackInterval = rows.find((row) => row.id === 'attackIntervalMs');
    const miningInterval = rows.find((row) => row.id === 'miningIntervalMultiplier');
    expect(attackInterval?.delta).toBeLessThan(0);
    expect(attackInterval?.beneficial).toBe(true);
    expect(miningInterval?.delta).toBeLessThan(0);
    expect(miningInterval?.beneficial).toBe(true);
  });
});
