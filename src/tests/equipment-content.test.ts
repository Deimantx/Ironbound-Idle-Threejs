import { describe, expect, it } from 'vitest';
import { RECIPES, recipeById } from '../content/recipes';
import { ITEMS, itemById } from '../content/items';
import { legacyItemById } from '../content/legacyItems';
import { legacyRecipeById } from '../content/legacyRecipes';
import {
  ACTIVE_EQUIPMENT_SLOTS,
  COMBAT_EQUIPMENT_SLOTS,
  EQUIPMENT_SLOT_LABELS,
  PROFESSION_EQUIPMENT_SLOTS,
} from '../game/equipmentSlots';

describe('Equipment 2.1 content', () => {
  it('exposes the exact nine combat slots plus one profession slot', () => {
    expect(COMBAT_EQUIPMENT_SLOTS).toEqual([
      'head',
      'armor',
      'gloves',
      'boots',
      'weapon',
      'offhand',
      'amulet',
      'ring',
      'cape',
    ]);
    expect(PROFESSION_EQUIPMENT_SLOTS).toEqual(['tool']);
    expect(ACTIVE_EQUIPMENT_SLOTS).toHaveLength(10);
    expect(ACTIVE_EQUIPMENT_SLOTS).not.toContain('body');
    expect(ACTIVE_EQUIPMENT_SLOTS).not.toContain('legs');
    expect(ACTIVE_EQUIPMENT_SLOTS).not.toContain('shield');
    expect(EQUIPMENT_SLOT_LABELS.offhand).toBe('Off-hand');
  });

  it('keeps unified Armor and Shield taxonomy while moving Shields to Off-hand', () => {
    expect(legacyItemById['bronze-armor']).toMatchObject({
      id: 'bronze-armor',
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
    for (const id of ['iron-shield', 'steel-shield'])
      expect(itemById[id]).toMatchObject({ category: 'shield', slot: 'offhand' });
    expect(itemById['bronze-shield']).toBeUndefined();
    expect(ITEMS.some((item) => (item.slot as string | undefined) === 'shield')).toBe(false);
    for (const id of [
      'bronze-platebody',
      'bronze-platelegs',
      'iron-platebody',
      'iron-platelegs',
      'steel-platebody',
      'steel-platelegs',
    ])
      expect(itemById[id]).toBeUndefined();
  });

  it('keeps pickaxe stats outside generic item bonuses', () => {
    expect(itemById['iron-sword']?.bonuses).toEqual({
      attack: 18,
      strength: 12,
      attackSpeed: 0.05,
    });
    expect(itemById['steel-sword']?.bonuses).toEqual({
      attack: 32,
      strength: 24,
      attackSpeed: 0.1,
    });
    expect(itemById['iron-pickaxe']?.bonuses).toEqual({});
    expect(itemById['steel-pickaxe']?.bonuses).toEqual({});
    expect(ITEMS.flatMap((item) => Object.keys(item.bonuses ?? {}))).not.toContain('speed');
  });

  it('keeps existing Shield recipes and removes legacy Armor recipes', () => {
    expect(recipeById['iron-shield']).toMatchObject({ outputItemId: 'iron-shield' });
    expect(recipeById['steel-shield']).toMatchObject({ outputItemId: 'steel-shield' });
    expect(legacyRecipeById['bronze-armor']).toMatchObject({
      level: 6,
      intervalMs: 5600,
      inputs: [{ itemId: 'bronze-bar', quantity: 9 }],
      outputItemId: 'bronze-armor',
      xp: 78,
    });
    expect(recipeById['iron-armor']).toMatchObject({ level: 20, intervalMs: 8400, xp: 220 });
    expect(recipeById['steel-armor']).toMatchObject({ level: 35, intervalMs: 12000, xp: 520 });
    expect(
      RECIPES.some((recipe) => /platebody|platelegs|Cuirass|Greaves/.test(recipe.id + recipe.name)),
    ).toBe(false);
    expect(RECIPES.every((recipe) => itemById[recipe.outputItemId])).toBe(true);
    expect(recipeById['bronze-armor']).toBeUndefined();
  });
});
