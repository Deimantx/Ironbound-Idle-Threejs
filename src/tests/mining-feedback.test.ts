import { afterEach, describe, expect, it } from 'vitest';
import { createNewGame } from '../game/state/initialState';
import { getMiningFeedbackMessage, useGameStore } from '../game/state/gameStore';
import { emptySummary } from '../game/types';

const miningSummary = () => {
  const summary = emptySummary(3_000);
  summary.offlineContext = { activity: 'mining', miningNodeId: 'stone-outcrop' };
  return summary;
};

afterEach(() => {
  useGameStore.getState().setGame(null);
  useGameStore.setState({ toast: null });
});

describe('Mining feedback', () => {
  it('keeps ordinary primary-resource gains quiet', () => {
    const summary = miningSummary();
    summary.itemsGained['stone-ore'] = 1;
    expect(getMiningFeedbackMessage(summary)).toBeNull();
  });

  it('announces a stage break and prioritizes rare finds', () => {
    const stageSummary = miningSummary();
    stageSummary.completed['mine-stage:stone-outcrop:2'] = 1;
    expect(getMiningFeedbackMessage(stageSummary)).toBe('Rich Core exposed!');

    const rareSummary = miningSummary();
    rareSummary.completed['mine-stage:stone-outcrop:2'] = 1;
    rareSummary.itemsGained['rough-gem'] = 1;
    expect(getMiningFeedbackMessage(rareSummary)).toBe('Rough Gem found! +1');
  });

  it('does not turn an offline report into a foreground toast', () => {
    const game = createNewGame(0, 'Offline Feedback Tester');
    const summary = miningSummary();
    summary.itemsGained['rough-gem'] = 1;
    useGameStore.getState().setGame(game, summary);
    expect(useGameStore.getState().toast).toBeNull();
  });
});
