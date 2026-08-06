import { describe, expect, it } from 'vitest';
import { itemById } from '../content/items';
import type { InventoryStack } from '../game/types';
import {
  getInventoryDisplayGroup,
  getInventoryGroupCounts,
  getInventoryResultLabel,
  getInventoryStackGroups,
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

  it('groups visible stacks by display group without mutating order or adding empty groups', () => {
    const stacks: InventoryStack[] = [
      { itemId: 'rat-tail', quantity: 3, locked: false },
      { itemId: 'copper-ore', quantity: 8, locked: false },
      { itemId: 'iron-sword', quantity: 1, locked: false },
      { itemId: 'unknown-item', quantity: 2, locked: false },
    ];
    const original = structuredClone(stacks);
    expect(getInventoryStackGroups(stacks, itemById)).toEqual([
      { id: 'materials', label: 'Materials', stacks: [stacks[1]] },
      { id: 'equipment', label: 'Equipment', stacks: [stacks[2]] },
      { id: 'drops', label: 'Drops', stacks: [stacks[0]] },
      { id: 'unknown', label: 'Unknown', stacks: [stacks[3]] },
    ]);
    expect(stacks).toEqual(original);
    expect(
      getInventoryStackGroups(
        getVisibleInventoryStacks(stacks, itemById, 'materials', 'mining'),
        itemById,
      ),
    ).toEqual([{ id: 'materials', label: 'Materials', stacks: [stacks[1]] }]);
  });

  it('keeps the result label in the bank header vocabulary', () => {
    expect(getInventoryResultLabel(3, 'all', '')).toBe('3 stacks');
    expect(getInventoryResultLabel(8, 'equipment', '')).toBe('8 equipment stacks');
    expect(getInventoryResultLabel(3, 'all', ' iron ')).toBe('3 results for "iron"');
  });
});
