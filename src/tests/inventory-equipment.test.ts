import { describe, expect, it } from 'vitest';
import { createNewGame } from '../game/state/initialState';
import { addItem, destroyItem, getItemQuantity, removeItem } from '../game/systems/inventorySystem';
import { equipItem, unequipItem } from '../game/systems/equipmentSystem';
import { getDerivedStats } from '../game/formulas/statFormulas';

describe('inventory and equipment', () => {
  it('adds, stacks, removes exact quantities, and rejects full inventory', () => {
    let inventory = addItem([], 'copper-ore', 4, 1).inventory;
    inventory = addItem(inventory, 'copper-ore', 6, 1).inventory;
    expect(getItemQuantity(inventory, 'copper-ore')).toBe(10);
    expect(removeItem(inventory, 'copper-ore', 3).inventory[0].quantity).toBe(7);
    expect(addItem(inventory, 'tin-ore', 1, 1).rejected).toBe(1);
    expect(removeItem(inventory, 'copper-ore', 99).rejected).toBe(99);
  });
  it('protects locked item destruction', () => {
    const inventory = [{ itemId: 'copper-ore', quantity: 2, locked: true }];
    expect(destroyItem(inventory, 'copper-ore', 1).rejected).toBe(1);
    expect(getItemQuantity(destroyItem(inventory, 'copper-ore', 1).inventory, 'copper-ore')).toBe(
      2,
    );
  });
  it('equips valid gear, changes derived stats, and returns it on unequip', () => {
    const state = createNewGame(0, 'Test');
    state.inventory = addItem([], 'bronze-sword', 1, 60).inventory;
    const before = getDerivedStats(state).attack;
    const equipped = equipItem(state, 'bronze-sword');
    expect(equipped.ok).toBe(true);
    expect(equipped.state.equipment.weapon).toBe('bronze-sword');
    expect(getDerivedStats(equipped.state).attack).toBeGreaterThan(before);
    const empty = unequipItem(equipped.state, 'weapon');
    expect(empty.ok).toBe(true);
    expect(getItemQuantity(empty.state.inventory, 'bronze-sword')).toBe(1);
  });
});
