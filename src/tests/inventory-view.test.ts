import { describe, expect, it } from 'vitest';
import { itemById } from '../content/items';
import type { InventoryStack } from '../game/types';
import {
  getInventoryDisplayGroup,
  getInventoryGroupCounts,
  getVisibleInventoryStacks,
  matchesInventorySearch,
} from '../app/inventoryView';

describe('inventory view helpers', () => {
  it('maps item categories to the five display groups', () => {
    expect(getInventoryDisplayGroup('material')).toBe('materials');
    expect(getInventoryDisplayGroup('bar')).toBe('materials');
    expect(getInventoryDisplayGroup('weapon')).toBe('equipment');
    expect(getInventoryDisplayGroup('armor')).toBe('equipment');
    expect(getInventoryDisplayGroup('shield')).toBe('equipment');
    expect(getInventoryDisplayGroup('tool')).toBe('equipment');
    expect(getInventoryDisplayGroup('drop')).toBe('drops');
    expect(getInventoryDisplayGroup('currency')).toBe('currency');
  });

  it('searches names case-insensitively across source, slot, and tier metadata', () => {
    const sword = itemById['iron-sword'];
    expect(matchesInventorySearch(sword, 'IRON SWORD')).toBe(true);
    expect(matchesInventorySearch(sword, 'smithing')).toBe(true);
    expect(matchesInventorySearch(sword, 'WEAPON')).toBe(true);
    expect(matchesInventorySearch(sword, 'iron')).toBe(true);
    expect(matchesInventorySearch(sword, '  sword  ')).toBe(true);
    expect(matchesInventorySearch(sword, 'copper')).toBe(false);
  });

  it('combines a trimmed search with a display-group filter without changing stack order', () => {
    const stacks: InventoryStack[] = [
      { itemId: 'copper-ore', quantity: 8, locked: false },
      { itemId: 'iron-sword', quantity: 1, locked: false },
      { itemId: 'rat-tail', quantity: 3, locked: false },
    ];
    const original = structuredClone(stacks);
    expect(getVisibleInventoryStacks(stacks, itemById, 'materials', '  mining  ')).toEqual([
      stacks[0],
    ]);
    expect(getVisibleInventoryStacks(stacks, itemById, 'equipment', 'weapon')).toEqual([stacks[1]]);
    expect(stacks).toEqual(original);
  });

  it('counts occupied stacks rather than item quantities', () => {
    const stacks: InventoryStack[] = [
      { itemId: 'copper-ore', quantity: 124, locked: false },
      { itemId: 'iron-bar', quantity: 8, locked: false },
      { itemId: 'iron-sword', quantity: 1, locked: false },
      { itemId: 'rat-tail', quantity: 0, locked: false },
    ];
    expect(getInventoryGroupCounts(stacks, itemById)).toEqual({
      all: 3,
      materials: 2,
      equipment: 1,
      drops: 0,
      currency: 0,
    });
  });
});
