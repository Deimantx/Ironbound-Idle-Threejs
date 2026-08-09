import { describe, expect, it } from 'vitest';
import { getItemCollectionProgress, getMonsterCollectionProgress, getOverallCollectionProgress } from '../app/collection/collectionSelectors';
import {
  getHomeActivitySummary,
  getHomeContinueDestination,
  getHomeRecentProgress,
  getHomeWorldRecord,
} from '../app/home/homeSelectors';
import { createNewGame } from '../game/state/initialState';
import type { GameState } from '../game/types';

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

  it('resumes active combat or professions and defaults idle characters to Combat', () => {
    const game = createNewGame(0, 'Continue Selector');
    expect(getHomeContinueDestination(game)).toBe('combat');
    game.activeAction = {
      type: 'mining',
      nodeId: 'stone-outcrop',
      startedAt: 0,
      phase: 'swing',
      progressMs: 0,
    };
    expect(getHomeContinueDestination(game)).toBe('mining');
    game.activeAction = {
      type: 'smithing',
      recipeId: 'bronze-bar',
      quantityMode: 'continuous',
      remaining: null,
      progressMs: 0,
    };
    expect(getHomeContinueDestination(game)).toBe('smithing');
    game.activeAction = { type: 'combat' } as GameState['activeAction'];
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
    expect(record.totalItemsGained).toBe(0);
    expect(record.playTimeMs).toBe(0);
  });

  it('limits each integrated recent-progress category to two entries', () => {
    const game = createNewGame(0, 'Recent Limit');
    game.activityLogs.milestones = Array.from({ length: 8 }, (_, index) => ({
      id: `mining-${index}`,
      kind: 'level-up' as const,
      skillId: index % 2 === 0 ? 'mining' : 'attack',
      level: index + 2,
      at: index,
    }));
    const recent = getHomeRecentProgress(game);
    expect(recent.combat).toHaveLength(2);
    expect(recent.profession).toHaveLength(2);
  });
});
