import { describe, expect, it } from 'vitest';
import { itemById } from '../content/items';
import { getDerivedStats, getEquipmentBonuses } from '../game/formulas/statFormulas';
import { createNewGame } from '../game/state/initialState';
import {
  getCompatibleEquipmentStacks,
  getDerivedStatComparison,
  getEquipmentBonusComparison,
  getEquipmentEmptyState,
  getEquipmentTierRank,
} from '../app/equipmentView';
import type { InventoryStack } from '../game/types';

describe('Equipment view helpers and separated bonuses', () => {
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

  it('ranks tiers and compares only meaningful slot-aware bonuses', () => {
    expect(getEquipmentTierRank('steel')).toBeGreaterThan(getEquipmentTierRank('iron'));
    expect(getEquipmentBonusComparison(itemById['bronze-armor'], itemById['iron-armor'])).toEqual([
      { id: 'defence', label: 'Defence', current: 16, candidate: 38, delta: 22 },
      { id: 'health', label: 'Health', current: 7, candidate: 18, delta: 11 },
    ]);
    expect(
      getEquipmentBonusComparison(
        itemById['bronze-pickaxe'],
        itemById['iron-pickaxe'],
        'profession',
      ),
    ).toEqual([]);
    expect(
      getEquipmentBonusComparison(itemById['bronze-pickaxe'], itemById['iron-pickaxe']),
    ).toEqual([]);
  });

  it('isolates sword combat speed from pickaxe Mining speed', () => {
    const base = createNewGame(0, 'Preview');
    const sword = getDerivedStats({ ...base, equipment: { weapon: 'iron-sword' } });
    const pick = getDerivedStats({ ...base, equipment: { tool: 'iron-pickaxe' } });
    const both = getDerivedStats({
      ...base,
      equipment: { weapon: 'iron-sword', tool: 'iron-pickaxe' },
    });
    const baseline = getDerivedStats(base);
    expect(sword.attackIntervalMs).toBeLessThan(baseline.attackIntervalMs);
    expect(sword.miningIntervalMultiplier).toBe(baseline.miningIntervalMultiplier);
    expect(pick.attackIntervalMs).toBe(baseline.attackIntervalMs);
    expect(pick.miningIntervalMultiplier).toBe(baseline.miningIntervalMultiplier);
    expect(both.attackIntervalMs).toBe(sword.attackIntervalMs);
    expect(both.miningIntervalMultiplier).toBe(pick.miningIntervalMultiplier);
    expect(getEquipmentBonuses({ weapon: 'iron-sword', tool: 'iron-pickaxe' })).toEqual({
      attack: 18,
      strength: 12,
      defence: 0,
      health: 0,
      attackSpeed: 0.05,
      miningSpeed: 0,
    });
  });

  it('keeps combat comparisons separate from profession comparisons', () => {
    const game = createNewGame(0, 'Comparison');
    const current = getDerivedStats(game);
    const preview = getDerivedStats({ ...game, equipment: { tool: 'steel-pickaxe' } });
    expect(getDerivedStatComparison(current, preview).map((row) => row.id)).toEqual([
      'accuracy',
      'maxHit',
      'defence',
      'maxHealth',
      'attackIntervalMs',
    ]);
    const mining = getDerivedStatComparison(current, preview, 'profession')[0];
    expect(mining.id).toBe('miningIntervalMultiplier');
    expect(mining.delta).toBe(0);
    expect(mining.beneficial).toBe(true);
  });

  it('keeps content-bearing and no-content empty states honest', () => {
    expect(getEquipmentEmptyState('weapon', true)).toEqual({
      message: 'No compatible Weapons in Inventory.',
      secondary: 'Forge or collect gear for this slot.',
      showOpenInventory: true,
    });
    expect(getEquipmentEmptyState('offhand', true).message).toBe(
      'No compatible Off-hand items in Inventory.',
    );
    expect(getEquipmentEmptyState('gloves', false)).toEqual({
      message: 'No Gloves are currently available.',
      showOpenInventory: false,
    });
    expect(getEquipmentEmptyState('cape', false).message).toBe('No Capes are currently available.');
  });
});
