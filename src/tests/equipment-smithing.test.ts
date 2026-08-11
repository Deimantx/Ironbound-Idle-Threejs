import { describe, expect, it } from 'vitest';
import { startSmithing } from '../game/engine/actionController';
import { simulateElapsed } from '../game/engine/simulation';
import { createNewGame } from '../game/state/initialState';
import { addItem, getItemQuantity } from '../game/systems/inventorySystem';

describe('unified Armor smithing', () => {
  it('does not expose retired Bronze Armor smithing', () => {
    const state = createNewGame(0, 'Armorer');
    state.inventory = addItem([], 'bronze-bar', 9, 60).inventory;
    const active = startSmithing(state, 'bronze-armor', 1, 0);
    const result = simulateElapsed(active, 5600);
    expect(getItemQuantity(result.state.inventory, 'bronze-armor')).toBe(0);
    expect(getItemQuantity(result.state.inventory, 'bronze-bar')).toBe(0);
    expect(result.state.activeAction.type).toBe('none');
  });
});
