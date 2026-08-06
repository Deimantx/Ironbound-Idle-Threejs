import { describe, expect, it } from 'vitest';
import { RECIPES, recipeById } from '../content/recipes';
import { ITEMS, itemById } from '../content/items';
import { ACTIVE_EQUIPMENT_SLOTS } from '../game/equipmentSlots';

describe('Equipment 2.0 content', () => {
  it('exposes exactly five active slots and keeps future slots separate', () => {
    expect(ACTIVE_EQUIPMENT_SLOTS).toEqual(['head', 'armor', 'weapon', 'shield', 'tool']);
    expect(ACTIVE_EQUIPMENT_SLOTS).not.toContain('body');
    expect(ACTIVE_EQUIPMENT_SLOTS).not.toContain('legs');
  });

  it('defines unified Armor items with the combined legacy bonuses', () => {
    expect(itemById['bronze-armor']).toMatchObject({
      id: 'bronze-armor',
      name: 'Bronze Armor',
      category: 'armor',
      slot: 'armor',
      bonuses: { defence: 16, health: 7 },
    });
    expect(itemById['iron-armor']).toMatchObject({
      name: 'Iron Armor',
      slot: 'armor',
      bonuses: { defence: 38, health: 18 },
    });
    expect(itemById['steel-armor']).toMatchObject({
      name: 'Steel Armor',
      slot: 'armor',
      bonuses: { defence: 67, health: 32 },
    });
    for (const id of [
      'bronze-platebody',
      'bronze-platelegs',
      'iron-platebody',
      'iron-platelegs',
      'steel-platebody',
      'steel-platelegs',
    ])
      expect(itemById[id]).toBeUndefined();
    expect(ITEMS.filter((item) => item.slot === 'armor').map((item) => item.id)).toEqual([
      'bronze-armor',
      'iron-armor',
      'steel-armor',
    ]);
  });

  it('defines one balanced Armor recipe per tier and no legacy recipes', () => {
    expect(recipeById['bronze-armor']).toMatchObject({
      level: 6,
      intervalMs: 5600,
      inputs: [{ itemId: 'bronze-bar', quantity: 9 }],
      outputItemId: 'bronze-armor',
      xp: 78,
    });
    expect(recipeById['iron-armor']).toMatchObject({
      level: 20,
      intervalMs: 8400,
      inputs: [{ itemId: 'iron-bar', quantity: 11 }],
      outputItemId: 'iron-armor',
      xp: 128,
    });
    expect(recipeById['steel-armor']).toMatchObject({
      level: 35,
      intervalMs: 12000,
      inputs: [{ itemId: 'steel-bar', quantity: 13 }],
      outputItemId: 'steel-armor',
      xp: 198,
    });
    expect(
      RECIPES.some((recipe) => /platebody|platelegs|Cuirass|Greaves/.test(recipe.id + recipe.name)),
    ).toBe(false);
    expect(RECIPES.every((recipe) => itemById[recipe.outputItemId])).toBe(true);
  });
});
