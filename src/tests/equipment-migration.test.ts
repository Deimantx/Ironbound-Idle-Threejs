import { describe, expect, it } from 'vitest';
import { createNewGame } from '../game/state/initialState';
import { parseGameState } from '../game/persistence/saveSchema';
import { migrateSave } from '../game/persistence/migrations';
import { getItemQuantity } from '../game/systems/inventorySystem';
import type { GameState } from '../game/types';

const legacyState = (version = 2): GameState => {
  const state = createNewGame(0, 'Legacy', 0);
  state.schemaVersion = version;
  return state;
};

const migrate = (state: GameState, version = state.schemaVersion): GameState =>
  migrateSave(state, version);

describe('Equipment 2.1 save migration', () => {
  it('migrates an empty version-3 loadout to version 4', () => {
    const state = legacyState(3);
    state.equipment = {};
    const migrated = migrate(state);
    expect(migrated.schemaVersion).toBe(8);
    expect(migrated.equipment).toEqual({});
  });

  it('converts Body/Legs and Shield sequentially into Armor/Off-hand', () => {
    const state = legacyState(2);
    state.equipment = {
      body: 'iron-platebody',
      legs: 'bronze-platelegs',
      shield: 'iron-shield',
    } as unknown as GameState['equipment'];
    const migrated = migrate(state, 2);
    expect(migrated.schemaVersion).toBe(8);
    expect(migrated.equipment).toEqual({ armor: 'iron-armor', offhand: 'iron-shield' });
    expect(getItemQuantity(migrated.inventory, 'bronze-armor')).toBe(1);
  });

  it('handles empty, valid, and conflicting Shield-slot saves', () => {
    const empty = legacyState(3);
    empty.equipment = {};
    expect(migrate(empty).equipment.offhand).toBeUndefined();

    const shield = legacyState(3);
    shield.equipment = { shield: 'iron-shield' } as unknown as GameState['equipment'];
    expect(migrate(shield).equipment.offhand).toBe('iron-shield');

    const conflict = legacyState(3);
    conflict.equipment = {
      offhand: 'steel-shield',
      shield: 'iron-shield',
    } as unknown as GameState['equipment'];
    const conflictResult = migrate(conflict);
    expect(conflictResult.equipment.offhand).toBe('steel-shield');
    expect(getItemQuantity(conflictResult.inventory, 'iron-shield')).toBe(1);
  });

  it('merges Armor migration stacks at the earliest position and preserves locks', () => {
    const state = legacyState(2);
    state.inventory = [
      { itemId: 'iron-platebody', quantity: 2, locked: false },
      { itemId: 'copper-ore', quantity: 4, locked: false },
      { itemId: 'iron-platelegs', quantity: 3, locked: true },
      { itemId: 'iron-armor', quantity: 1, locked: false },
    ];
    const migrated = migrate(state, 2);
    expect(migrated.inventory).toEqual([
      { itemId: 'iron-armor', quantity: 6, locked: true },
      { itemId: 'copper-ore', quantity: 4, locked: false },
    ]);
  });

  it('keeps migrated equipment when the old inventory was full and preserves unknown IDs', () => {
    const full = legacyState(3);
    full.inventory = Array.from({ length: 60 }, (_, index) => ({
      itemId: `unknown-${index}`,
      quantity: 1,
      locked: false,
    }));
    full.equipment = { shield: 'iron-shield' } as unknown as GameState['equipment'];
    const migrated = migrate(full);
    expect(migrated.equipment.offhand).toBe('iron-shield');
    expect(migrated.inventory.length).toBe(60);

    const invalid = legacyState(3);
    invalid.equipment = { shield: 'lost-but-unknown' } as unknown as GameState['equipment'];
    const invalidResult = migrate(invalid);
    expect(invalidResult.equipment.offhand).toBeUndefined();
    expect(getItemQuantity(invalidResult.inventory, 'lost-but-unknown')).toBe(1);
  });

  it('preserves discovery, active Smithing, and unrelated state during sequential migration', () => {
    const state = legacyState(2);
    state.discoveredItems = ['iron-platebody', 'iron-platelegs', 'iron-shield', 'copper-ore'];
    state.inventory = [{ itemId: 'iron-bar', quantity: 11, locked: false }];
    state.gold = 77;
    state.activeAction = {
      type: 'smithing',
      recipeId: 'iron-platebody',
      quantityMode: 'continuous',
      remaining: 2,
      progressMs: 4000,
    };
    const migrated = migrate(state, 2);
    expect(migrated.discoveredItems).toEqual(['iron-armor', 'iron-shield', 'copper-ore']);
    expect(migrated.inventory).toEqual(state.inventory);
    expect(migrated.gold).toBe(77);
    expect(migrated.activeAction).toMatchObject({
      type: 'smithing',
      recipeId: 'iron-armor',
      quantityMode: 'continuous',
      remaining: null,
      progressMs: 4000,
    });

    const shieldSave = legacyState(3);
    shieldSave.equipment = { shield: 'iron-shield' } as unknown as GameState['equipment'];
    const parsed = parseGameState(JSON.stringify(shieldSave));
    expect(parsed.schemaVersion).toBe(8);
    expect(parsed.equipment.offhand).toBe('iron-shield');
  });

  it('prioritizes a valid existing Armor/Off-hand key and rejects legacy slots in current saves', () => {
    const state = legacyState(2);
    state.equipment = {
      armor: 'bronze-armor',
      body: 'steel-platebody',
      offhand: 'bronze-shield',
      shield: 'steel-shield',
    } as unknown as GameState['equipment'];
    const migrated = migrate(state, 2);
    expect(migrated.equipment.armor).toBe('bronze-armor');
    expect(migrated.equipment.offhand).toBe('bronze-shield');
    expect(getItemQuantity(migrated.inventory, 'steel-armor')).toBe(1);
    expect(getItemQuantity(migrated.inventory, 'steel-shield')).toBe(1);

    const current = createNewGame(0, 'Current');
    current.equipment = { shield: 'iron-shield' } as unknown as GameState['equipment'];
    expect(() => parseGameState(JSON.stringify(current))).toThrow();
    const parsedLegacy = parseGameState(JSON.stringify({ ...current, schemaVersion: 3 }));
    expect(parsedLegacy.schemaVersion).toBe(8);
    expect(parsedLegacy.equipment.offhand).toBe('iron-shield');
  });
});
