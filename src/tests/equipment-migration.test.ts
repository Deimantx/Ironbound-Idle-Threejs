import { describe, expect, it } from 'vitest';
import { createNewGame } from '../game/state/initialState';
import { parseGameState } from '../game/persistence/saveSchema';
import { migrateSave } from '../game/persistence/migrations';
import { getItemQuantity } from '../game/systems/inventorySystem';
import type { GameState } from '../game/types';

const legacyState = (): GameState => {
  const state = createNewGame(0, 'Legacy', 0);
  state.schemaVersion = 2;
  return state;
};

const migrate = (state: GameState): GameState => migrateSave(state, 2);

describe('Equipment 2.0 save migration', () => {
  it('creates an empty Armor slot and raises the schema to version 3', () => {
    const state = legacyState();
    state.equipment = {};
    const migrated = migrate(state);
    expect(migrated.schemaVersion).toBe(3);
    expect(migrated.equipment).toEqual({});
  });

  it('converts Body-only, Legs-only, same-tier, and mixed-tier equipment safely', () => {
    const bodyOnly = legacyState();
    bodyOnly.equipment = { body: 'iron-platebody' } as unknown as GameState['equipment'];
    expect(migrate(bodyOnly).equipment.armor).toBe('iron-armor');

    const legsOnly = legacyState();
    legsOnly.equipment = { legs: 'bronze-platelegs' } as unknown as GameState['equipment'];
    expect(migrate(legsOnly).equipment.armor).toBe('bronze-armor');

    const pair = legacyState();
    pair.equipment = {
      body: 'steel-platebody',
      legs: 'steel-platelegs',
    } as unknown as GameState['equipment'];
    const pairResult = migrate(pair);
    expect(pairResult.equipment.armor).toBe('steel-armor');
    expect(getItemQuantity(pairResult.inventory, 'steel-armor')).toBe(1);

    const mixed = legacyState();
    mixed.equipment = {
      body: 'bronze-platebody',
      legs: 'iron-platelegs',
    } as unknown as GameState['equipment'];
    const mixedResult = migrate(mixed);
    expect(mixedResult.equipment.armor).toBe('iron-armor');
    expect(getItemQuantity(mixedResult.inventory, 'bronze-armor')).toBe(1);
  });

  it('merges legacy inventory stacks at the earliest position and preserves locks', () => {
    const state = legacyState();
    state.inventory = [
      { itemId: 'iron-platebody', quantity: 2, locked: false },
      { itemId: 'copper-ore', quantity: 4, locked: false },
      { itemId: 'iron-platelegs', quantity: 3, locked: true },
      { itemId: 'iron-armor', quantity: 1, locked: false },
    ];
    const migrated = migrate(state);
    expect(migrated.inventory).toEqual([
      { itemId: 'iron-armor', quantity: 6, locked: true },
      { itemId: 'copper-ore', quantity: 4, locked: false },
    ]);
  });

  it('keeps migrated equipment when the old inventory was full and handles invalid IDs', () => {
    const full = legacyState();
    full.inventory = Array.from({ length: 60 }, (_, index) => ({
      itemId: `unknown-${index}`,
      quantity: 1,
      locked: false,
    }));
    full.equipment = {
      body: 'iron-platebody',
      legs: 'bronze-platelegs',
    } as unknown as GameState['equipment'];
    const migrated = migrate(full);
    expect(migrated.equipment.armor).toBe('iron-armor');
    expect(getItemQuantity(migrated.inventory, 'bronze-armor')).toBe(1);
    expect(migrated.inventory.length).toBe(61);

    const invalid = legacyState();
    invalid.equipment = { body: 'lost-but-unknown' } as unknown as GameState['equipment'];
    const invalidResult = migrate(invalid);
    expect(invalidResult.equipment.armor).toBeUndefined();
    expect(getItemQuantity(invalidResult.inventory, 'lost-but-unknown')).toBe(1);
  });

  it('migrates discovery and active Smithing without consuming materials', () => {
    for (const recipeId of ['iron-platebody', 'iron-platelegs']) {
      const state = legacyState();
      state.discoveredItems = ['iron-platebody', 'iron-platelegs', 'iron-armor', 'copper-ore'];
      state.inventory = [{ itemId: 'iron-bar', quantity: 11, locked: false }];
      state.activeAction = {
        type: 'smithing',
        recipeId,
        quantityMode: 'continuous',
        remaining: 2,
        progressMs: 4000,
      };
      const migrated = migrate(state);
      expect(migrated.discoveredItems).toEqual(['iron-armor', 'copper-ore']);
      expect(migrated.inventory).toEqual(state.inventory);
      expect(migrated.activeAction).toMatchObject({
        type: 'smithing',
        recipeId: 'iron-armor',
        quantityMode: 'continuous',
        remaining: 2,
        progressMs: 4000,
      });
    }
  });

  it('prioritizes a valid existing Armor key and rejects legacy slots in current saves', () => {
    const state = legacyState();
    state.equipment = {
      armor: 'bronze-armor',
      body: 'steel-platebody',
    } as unknown as GameState['equipment'];
    const migrated = migrate(state);
    expect(migrated.equipment.armor).toBe('bronze-armor');
    expect(getItemQuantity(migrated.inventory, 'steel-armor')).toBe(1);

    const current = createNewGame(0, 'Current');
    current.equipment = { body: 'iron-platebody' } as unknown as GameState['equipment'];
    expect(() => parseGameState(JSON.stringify(current))).toThrow();
    const parsedLegacy = parseGameState(JSON.stringify({ ...current, schemaVersion: 2 }));
    expect(parsedLegacy.schemaVersion).toBe(3);
    expect(parsedLegacy.equipment.armor).toBe('iron-armor');
  });
});
