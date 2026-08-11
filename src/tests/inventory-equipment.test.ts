import { describe, expect, it } from 'vitest';
import { createNewGame } from '../game/state/initialState';
import { addItem, destroyItem, getItemQuantity, removeItem } from '../game/systems/inventorySystem';
import { equipItem, unequipItem } from '../game/systems/equipmentSystem';
import { getDerivedStats } from '../game/formulas/statFormulas';

describe('inventory and equipment', () => {
  it('adds, stacks, removes exact quantities, and rejects full inventory', () => {
    let inventory = addItem([], 'iron-ore', 4, 1).inventory;
    inventory = addItem(inventory, 'iron-ore', 6, 1).inventory;
    expect(getItemQuantity(inventory, 'iron-ore')).toBe(10);
    expect(removeItem(inventory, 'iron-ore', 3).inventory[0].quantity).toBe(7);
    expect(addItem(inventory, 'coal', 1, 1).rejected).toBe(1);
    expect(removeItem(inventory, 'iron-ore', 99).rejected).toBe(99);
  });
  it('protects locked item destruction', () => {
    const inventory = [{ itemId: 'iron-ore', quantity: 2, locked: true }];
    expect(destroyItem(inventory, 'iron-ore', 1).rejected).toBe(1);
    expect(getItemQuantity(destroyItem(inventory, 'iron-ore', 1).inventory, 'iron-ore')).toBe(
      2,
    );
  });
  it('equips valid gear, changes derived stats, and returns it on unequip', () => {
    const state = createNewGame(0, 'Test');
    state.inventory = addItem([], 'iron-sword', 1, 60).inventory;
    const before = getDerivedStats(state).attack;
    const equipped = equipItem(state, 'iron-sword');
    expect(equipped.ok).toBe(true);
    expect(equipped.state.equipment.weapon).toBe('iron-sword');
    expect(getDerivedStats(equipped.state).attack).toBeGreaterThan(before);
    const empty = unequipItem(equipped.state, 'weapon');
    expect(empty.ok).toBe(true);
    expect(getItemQuantity(empty.state.inventory, 'iron-sword')).toBe(1);
  });

  it('equips and replaces unified Armor atomically', () => {
    const state = createNewGame(0, 'Armor');
    state.inventory = [
      { itemId: 'iron-armor', quantity: 1, locked: false },
      { itemId: 'iron-sword', quantity: 1, locked: false },
    ];
    const equipped = equipItem(state, 'iron-armor');
    expect(equipped.ok).toBe(true);
    expect(equipped.state.equipment.armor).toBe('iron-armor');
    expect(getDerivedStats(equipped.state).defence).toBe(39);
    expect(getDerivedStats(equipped.state).maxHealth).toBe(38);

    equipped.state.inventory.push({ itemId: 'steel-armor', quantity: 1, locked: false });
    const replaced = equipItem(equipped.state, 'steel-armor');
    expect(replaced.ok).toBe(true);
    expect(replaced.state.equipment.armor).toBe('steel-armor');
    expect(getItemQuantity(replaced.state.inventory, 'iron-armor')).toBe(1);
  });

  it('equips, replaces, and unequips Shield items through Off-hand', () => {
    const state = createNewGame(0, 'Off-hand');
    state.inventory = [
      { itemId: 'iron-shield', quantity: 1, locked: false },
      { itemId: 'steel-shield', quantity: 1, locked: false },
    ];
    const equipped = equipItem(state, 'iron-shield');
    expect(equipped.ok).toBe(true);
    expect(equipped.state.equipment.offhand).toBe('iron-shield');
    expect((equipped.state.equipment as Record<string, string>).shield).toBeUndefined();
    const replaced = equipItem(equipped.state, 'steel-shield');
    expect(replaced.ok).toBe(true);
    expect(replaced.state.equipment.offhand).toBe('steel-shield');
    expect(getItemQuantity(replaced.state.inventory, 'iron-shield')).toBe(1);
    const empty = unequipItem(replaced.state, 'offhand');
    expect(empty.ok).toBe(true);
    expect(empty.state.equipment.offhand).toBeUndefined();
    expect(getItemQuantity(empty.state.inventory, 'steel-shield')).toBe(1);
  });

  it('clamps health when gear lowers the maximum without healing on an increase', () => {
    const state = createNewGame(0, 'Health');
    state.inventory = [
      { itemId: 'steel-armor', quantity: 1, locked: false },
      { itemId: 'iron-armor', quantity: 1, locked: false },
    ];
    state.player.currentHp = 20;
    const increased = equipItem(state, 'steel-armor');
    expect(increased.state.player.currentHp).toBe(20);
    expect(getDerivedStats(increased.state).maxHealth).toBe(52);

    increased.state.player.currentHp = 52;
    const reduced = equipItem(increased.state, 'iron-armor');
    expect(reduced.state.player.currentHp).toBe(38);
    const unequipped = unequipItem(reduced.state, 'armor');
    expect(unequipped.state.player.currentHp).toBe(20);
  });

  it('rejects a replacement or unequip that cannot return displaced gear', () => {
    const state = createNewGame(0, 'Capacity');
    state.equipment.armor = 'steel-armor';
    state.inventory = [
      { itemId: 'iron-armor', quantity: 2, locked: false },
      ...Array.from({ length: 59 }, (_, index) => ({
        itemId: `unknown-${index}`,
        quantity: 1,
        locked: false,
      })),
    ];
    const replacement = equipItem(state, 'iron-armor');
    expect(replacement.ok).toBe(false);
    expect(replacement.state.equipment.armor).toBe('steel-armor');
    expect(getItemQuantity(replacement.state.inventory, 'iron-armor')).toBe(2);

    const unequip = unequipItem(state, 'armor');
    expect(unequip.ok).toBe(false);
    expect(unequip.state.equipment.armor).toBe('steel-armor');
  });
});
