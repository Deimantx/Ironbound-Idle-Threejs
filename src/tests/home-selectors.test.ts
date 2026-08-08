import { describe, expect, it } from 'vitest';
import { getItemCollectionProgress, getMonsterCollectionProgress, getOverallCollectionProgress } from '../app/collection/collectionSelectors';
import {
  getHomeActivitySummary,
  getHomeContinueDestination,
  getHomeLoadout,
  getHomeRecentProgress,
  getHomeStarterPathObjectives,
  getHomeWorldRecord,
} from '../app/home/homeSelectors';
import { createNewGame } from '../game/state/initialState';

describe('Home selectors', () => {
  it('normalizes idle and active activity destinations without mutating the action', () => {
    const game = createNewGame(0, 'Activity Selector');
    expect(getHomeActivitySummary(game)).toMatchObject({ type: 'idle', title: 'Idle', destination: null });

    game.activeAction = {
      type: 'mining',
      nodeId: 'iron-vein',
      startedAt: 1_000,
      phase: 'swing',
      progressMs: 300,
    };
    const beforeMining = structuredClone(game.activeAction);
    expect(getHomeActivitySummary(game)).toMatchObject({ type: 'mining', destination: 'mining' });
    expect(game.activeAction).toEqual(beforeMining);

    game.activeAction = {
      type: 'smithing',
      recipeId: 'iron-bar',
      quantityMode: 'continuous',
      remaining: null,
      progressMs: 200,
    };
    expect(getHomeActivitySummary(game)).toMatchObject({
      type: 'smithing',
      title: 'Smithing · Iron Bar',
      destination: 'smithing',
    });
  });

  it('uses active action, then the first incomplete Starter Path objective, then Combat', () => {
    const game = createNewGame(0, 'Continue Selector');
    expect(getHomeContinueDestination(game)).toBe('mining');
    game.inventory = [
      { itemId: 'stone-ore', quantity: 1, locked: false },
      { itemId: 'iron-ore', quantity: 1, locked: false },
    ];
    expect(getHomeContinueDestination(game)).toBe('smithing');
    game.inventory.push({ itemId: 'bronze-bar', quantity: 1, locked: false });
    game.discoveredItems.push('bronze-sword');
    game.equipment.weapon = 'bronze-sword';
    game.killCounts['forest-rat'] = 1;
    expect(getHomeStarterPathObjectives(game).every((objective) => objective.done)).toBe(true);
    expect(getHomeContinueDestination(game)).toBe('combat');
  });

  it('reuses Collection Log progress and splits recent milestones without reordering', () => {
    const game = createNewGame(0, 'Records Selector');
    game.activityLogs.milestones = [
      { id: 'attack', kind: 'level-up', skillId: 'attack', level: 2, at: 4_000 },
      { id: 'mining', kind: 'level-up', skillId: 'mining', level: 3, at: 3_000 },
      { id: 'hitpoints', kind: 'level-up', skillId: 'hitpoints', level: 4, at: 2_000 },
      { id: 'smithing', kind: 'level-up', skillId: 'smithing', level: 5, at: 1_000 },
    ];
    const recent = getHomeRecentProgress(game);
    expect(recent.combat.map((entry) => entry.skillId)).toEqual(['attack', 'hitpoints']);
    expect(recent.profession.map((entry) => entry.skillId)).toEqual(['mining', 'smithing']);

    const record = getHomeWorldRecord(game);
    expect(record.itemProgress).toEqual(getItemCollectionProgress(game));
    expect(record.monsterProgress).toEqual(getMonsterCollectionProgress(game));
    expect(record.overallProgress).toEqual(getOverallCollectionProgress(game));
  });

  it('resolves the compact loadout snapshot and keeps empty slots empty', () => {
    const game = createNewGame(0, 'Loadout Selector');
    game.equipment.weapon = 'bronze-sword';
    game.equipment.armor = 'iron-armor';
    game.equipment.tool = 'iron-smithing-hammer';
    expect(getHomeLoadout(game).map((entry) => [entry.label, entry.item?.name ?? 'Empty'])).toEqual([
      ['Weapon', 'Bronze Sword'],
      ['Armor', 'Iron Armor'],
      ['Offhand', 'Empty'],
      ['Tool', 'Iron Smithing Hammer'],
    ]);
  });
});
