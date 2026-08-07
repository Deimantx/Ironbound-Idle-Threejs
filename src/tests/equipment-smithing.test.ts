import { describe, expect, it } from 'vitest';
import { startSmithing } from '../game/engine/actionController';
import { simulateElapsed } from '../game/engine/simulation';
import { createNewGame } from '../game/state/initialState';
import { getXpForLevel } from '../game/formulas/experienceFormulas';
import { addItem, getItemQuantity } from '../game/systems/inventorySystem';

describe('unified Armor smithing', () => {
  it('crafts Bronze Armor with the combined recipe cost, time, and XP', () => {
    const state = createNewGame(0, 'Armorer');
    state.skills.smithing = { level: 6, xp: getXpForLevel(6) };
    state.inventory = addItem([], 'bronze-bar', 9, 60).inventory;
    const active = startSmithing(state, 'bronze-armor', 1, 0);
    const result = simulateElapsed(active, 5600);
    expect(getItemQuantity(result.state.inventory, 'bronze-armor')).toBe(1);
    expect(getItemQuantity(result.state.inventory, 'bronze-bar')).toBe(0);
    expect(result.state.skills.smithing.xp).toBe(getXpForLevel(6) + 78);
    expect(result.state.discoveredItems).toContain('bronze-armor');
    expect(result.state.activeAction.type).toBe('none');
  });
});
