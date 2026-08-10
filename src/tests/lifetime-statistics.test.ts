import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatPlayTime } from '../app/shared/formatters';
import { startMining, startSmithing } from '../game/engine/actionController';
import { simulateElapsed } from '../game/engine/simulation';
import { parseGameState } from '../game/persistence/saveSchema';
import { createNewGame } from '../game/state/initialState';
import { countSummaryItems, useGameStore } from '../game/state/gameStore';
import { emptySummary } from '../game/types';

afterEach(() => {
  vi.restoreAllMocks();
  useGameStore.getState().setGame(null);
});

describe('Home lifetime statistics', () => {
  it('starts new saves with zero lifetime item and foreground time totals', () => {
    const game = createNewGame(0, 'Lifetime Tester');
    expect(game.statistics.totalItemsGained).toBe(0);
    expect(game.statistics.playTimeMs).toBe(0);
  });

  it('formats play time as a clock below one day and days plus a clock after it', () => {
    expect(formatPlayTime(0)).toBe('00:00');
    expect(formatPlayTime(5 * 60_000)).toBe('00:05');
    expect(formatPlayTime((8 * 60 + 42) * 60_000)).toBe('08:42');
    expect(formatPlayTime((23 * 60 + 59) * 60_000)).toBe('23:59');
    expect(formatPlayTime(24 * 60 * 60_000)).toBe('1d 00:00');
    expect(formatPlayTime((31 * 60 + 15) * 60_000)).toBe('1d 07:15');
    expect(formatPlayTime((55 * 60 + 31) * 60_000)).toBe('2d 07:31');
    expect(formatPlayTime((124 * 24 * 60 + 4 * 60 + 12) * 60_000)).toBe('124d 04:12');
  });

  it('counts only non-negative accepted item quantities from a simulation summary', () => {
    expect(countSummaryItems({ itemsGained: { ore: 3, bars: 2, rejected: -5 } })).toBe(5);
  });

  it('accumulates mining and smithing outputs when their summaries are applied', () => {
    const mining = startMining(createNewGame(0, 'Mining Lifetime'), 'stone-outcrop', 0);
    const miningResult = simulateElapsed(mining, 3_000);
    const miningItems = countSummaryItems(miningResult.summary);
    expect(miningItems).toBeGreaterThan(0);
    useGameStore.getState().setGame(miningResult.state, miningResult.summary);
    expect(useGameStore.getState().game?.statistics.totalItemsGained).toBe(miningItems);

    const smithing = createNewGame(0, 'Smithing Lifetime');
    smithing.inventory = [
      { itemId: 'iron-ore', quantity: 1, locked: false },
      { itemId: 'coal', quantity: 1, locked: false },
    ];
    const smithingResult = simulateElapsed(startSmithing(smithing, 'iron-bar', 1, 0), 3_800);
    expect(smithingResult.summary.itemsGained['iron-bar']).toBe(1);
  });

  it('counts accepted combat and offline loot once while ignoring rejected quantities', () => {
    const summary = emptySummary(60_000);
    summary.offlineContext = { activity: 'combat', enemyId: 'redknife-lookout' };
    summary.itemsGained = { 'redknife-token': 4, rejected: -2 };
    const game = createNewGame(0, 'Combat Lifetime');
    useGameStore.getState().setGame(game, summary);
    expect(useGameStore.getState().game?.statistics.totalItemsGained).toBe(4);
    expect(useGameStore.getState().game?.statistics.playTimeMs).toBe(0);
  });

  it('adds only clamped live heartbeat time, including idle time, and excludes offline time', () => {
    vi.spyOn(Date, 'now').mockReturnValue(10_000);
    const game = createNewGame(0, 'Playtime Lifetime');
    useGameStore.getState().setGame(game);
    useGameStore.getState().tick(10_750);
    useGameStore.getState().tick(12_750);
    expect(useGameStore.getState().game?.statistics.playTimeMs).toBe(1_750);
  });

  it('migrates missing lifetime fields to zero without estimating from other data', () => {
    const legacy = structuredClone(createNewGame(0, 'Legacy Lifetime')) as unknown as Record<string, unknown>;
    legacy.schemaVersion = 14;
    const statistics = legacy.statistics as Record<string, unknown>;
    delete statistics.totalItemsGained;
    delete statistics.playTimeMs;
    const migrated = parseGameState(JSON.stringify(legacy));
    expect(migrated.statistics.totalItemsGained).toBe(0);
    expect(migrated.statistics.playTimeMs).toBe(0);
  });
});
