import { describe, expect, it } from 'vitest';
import { ITEM_ART, ENEMY_ART } from '../app/art/artRegistry';
import { getCollectionEligibleItemIds } from '../app/screens/collection/collectionSelectors';
import { ITEMS, itemById } from '../content/items';
import { RETIRED_ITEM_IDS, RETIRED_RECIPE_IDS } from '../game/persistence/retiredContent';
import { ACTIVE_SMITHING_RECIPES, recipeById } from '../content/recipes';
import { MINING_TOOLS, miningToolByItemId } from '../content/miningTools';
import { createNewGame } from '../game/state/initialState';
import { debugAddItem, debugDiscoverAllItems, debugFillInventory } from '../game/debug/debugActions';
import { migrateSave } from '../game/persistence/migrations';
import type { GameState } from '../game/types';

describe('retired profession content', () => {
  it('keeps retired item IDs out of active registries and collection eligibility', () => {
    for (const itemId of RETIRED_ITEM_IDS) {
      expect(itemById[itemId]).toBeUndefined();
      expect(getCollectionEligibleItemIds()).not.toContain(itemId);
    }
    expect(ITEMS).not.toEqual(expect.arrayContaining([{ id: 'copper-ore' }]));
    for (const recipeId of RETIRED_RECIPE_IDS) expect(recipeById[recipeId]).toBeUndefined();
    expect(ACTIVE_SMITHING_RECIPES.every((recipe) => !recipe.id.startsWith('bronze-'))).toBe(true);
    expect(miningToolByItemId['bronze-pickaxe']).toBeUndefined();
    expect(MINING_TOOLS.map((tool) => tool.itemId)).toEqual([
      'worn-pickaxe',
      'iron-pickaxe',
      'steel-pickaxe',
    ]);
  });

  it('keeps debug inventory actions current-content only', () => {
    const state = createNewGame(0, 'Debug content test');
    expect(debugAddItem(state, 'copper-ore', 1).result.ok).toBe(false);

    const filled = debugFillInventory(state).state;
    expect(filled?.inventory.some((stack) => RETIRED_ITEM_IDS.has(stack.itemId))).toBe(false);

    const discovered = debugDiscoverAllItems(state).state;
    expect(discovered?.discoveredItems.some((itemId) => RETIRED_ITEM_IDS.has(itemId))).toBe(false);
  });

  it('sanitizes version 16 retired stacks, equipment, discoveries, and work', () => {
    const state = createNewGame(0, 'Migration content test');
    const legacy = {
      ...state,
      schemaVersion: 16,
      inventory: [
        { itemId: 'copper-ore', quantity: 12, locked: true },
        { itemId: 'tin-ore', quantity: 4, locked: false },
        { itemId: 'iron-ore', quantity: 2, locked: false },
      ],
      discoveredItems: ['copper-ore', 'bronze-pickaxe', 'iron-ore'],
      equipment: { ...state.equipment, tool: 'bronze-pickaxe' },
      activeAction: {
        type: 'smithing' as const,
        recipeId: 'bronze-bar',
        quantityMode: 'continuous' as const,
        remaining: null,
        progressMs: 400,
      },
    } satisfies GameState;

    const migrated = migrateSave(legacy, 16);
    expect(migrated.schemaVersion).toBe(17);
    expect(migrated.inventory).toEqual([{ itemId: 'iron-ore', quantity: 2, locked: false }]);
    expect(migrated.discoveredItems).not.toEqual(expect.arrayContaining(['copper-ore', 'bronze-pickaxe']));
    expect(migrated.equipment.tool).toBe('worn-pickaxe');
    expect(migrated.activeAction).toEqual({ type: 'none' });
  });

  it('keeps every active monster image and only maps active items to custom art', () => {
    const activeEnemyIds = [
      'redknife-lookout', 'redknife-brigand', 'redknife-bowhand', 'redknife-enforcer',
      'greyfang-wolf', 'greyfang-stalker', 'greyfang-ravager', 'greyfang-alpha',
      'brambletooth-scavenger', 'brambletooth-spearman', 'brambletooth-trapper', 'brambletooth-boarhandler',
    ];
    expect(activeEnemyIds.every((enemyId) => Boolean(ENEMY_ART[enemyId]))).toBe(true);
    expect(Object.keys(ITEM_ART).every((itemId) => Boolean(itemById[itemId]))).toBe(true);
  });
});
