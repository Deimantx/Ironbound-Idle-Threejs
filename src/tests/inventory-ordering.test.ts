import { describe, expect, it } from 'vitest';
import type { InventoryStack, ItemDefinition } from '../game/types';
import {
  reconcileManualOrder,
  reorderVisibleSubset,
  sortInventoryStacks,
} from '../app/inventoryOrdering';
import {
  DEFAULT_INVENTORY_VIEW_PREFERENCES,
  sanitizeInventoryViewPreferences,
} from '../app/inventoryOrderingPreferences';

const definition = (
  id: string,
  name: string,
  category: ItemDefinition['category'],
  options: Partial<Pick<ItemDefinition, 'rarity' | 'tier'>> = {},
): ItemDefinition => ({
  id,
  name,
  category,
  description: '',
  stackable: true,
  rarity: options.rarity ?? 'common',
  source: '',
  ...options,
});

const definitions: Record<string, ItemDefinition> = {
  alpha: definition('alpha', 'Alpha Ore', 'material', { tier: 'bronze' }),
  bar: definition('bar', 'Bronze Bar', 'bar', { tier: 'bronze' }),
  sword: definition('sword', 'Iron Sword', 'weapon', { rarity: 'rare', tier: 'iron' }),
  trophy: definition('trophy', 'Wolf Fang', 'drop', { rarity: 'uncommon' }),
};

const stacks: InventoryStack[] = [
  { itemId: 'sword', quantity: 2, locked: false },
  { itemId: 'alpha', quantity: 12, locked: true },
  { itemId: 'trophy', quantity: 5, locked: false },
  { itemId: 'bar', quantity: 12, locked: false },
];

describe('inventory ordering helpers', () => {
  it('sorts every required automatic mode with deterministic ties', () => {
    expect(
      sortInventoryStacks(stacks, definitions, 'name', 'asc', []).map((stack) => stack.itemId),
    ).toEqual(['alpha', 'bar', 'sword', 'trophy']);
    expect(
      sortInventoryStacks(stacks, definitions, 'quantity', 'asc', []).map((stack) => stack.itemId),
    ).toEqual(['sword', 'trophy', 'alpha', 'bar']);
    expect(
      sortInventoryStacks(stacks, definitions, 'category', 'asc', []).map((stack) => stack.itemId),
    ).toEqual(['alpha', 'bar', 'sword', 'trophy']);
    expect(
      sortInventoryStacks(stacks, definitions, 'category', 'desc', []).map((stack) => stack.itemId),
    ).toEqual(['trophy', 'sword', 'alpha', 'bar']);
    expect(
      sortInventoryStacks(stacks, definitions, 'rarity', 'desc', []).map((stack) => stack.itemId),
    ).toEqual(['sword', 'trophy', 'alpha', 'bar']);
    expect(
      sortInventoryStacks(stacks, definitions, 'tier', 'asc', []).map((stack) => stack.itemId),
    ).toEqual(['alpha', 'bar', 'sword', 'trophy']);
    expect(
      sortInventoryStacks(stacks, definitions, 'tier', 'desc', []).map((stack) => stack.itemId),
    ).toEqual(['sword', 'alpha', 'bar', 'trophy']);
  });

  it('reconciles manual order by ignoring stale IDs and appending new IDs', () => {
    expect(reconcileManualOrder(['stale', 'bar', 'bar'], ['alpha', 'bar', 'sword'])).toEqual([
      'bar',
      'alpha',
      'sword',
    ]);
  });

  it('reorders only visible IDs while preserving hidden positions', () => {
    expect(reorderVisibleSubset(['a', 'b', 'c', 'd', 'e'], ['b', 'd'], 'd', 'b', 'before')).toEqual(
      ['a', 'd', 'c', 'b', 'e'],
    );
    expect(reorderVisibleSubset(['a', 'b', 'c', 'd', 'e'], ['b', 'd'], 'b', 'd', 'after')).toEqual([
      'a',
      'd',
      'c',
      'b',
      'e',
    ]);
  });
});

describe('inventory view preference sanitizing', () => {
  it('rejects invalid storage values and ignores unknown fields', () => {
    expect(sanitizeInventoryViewPreferences({ version: 99, sortMode: 'name' })).toEqual(
      DEFAULT_INVENTORY_VIEW_PREFERENCES,
    );
    expect(
      sanitizeInventoryViewPreferences({
        version: 1,
        sortMode: 'rarity',
        sortDirection: 'desc',
        lastAutoSortMode: 'category',
        manualOrder: ['a', 'a', 4, 'b'],
        unexpected: true,
      }),
    ).toEqual({
      version: 1,
      sortMode: 'rarity',
      sortDirection: 'desc',
      lastAutoSortMode: 'category',
      manualOrder: ['a', 'b'],
    });
  });
});
