import type { GameState, MilestoneLogEntry } from '../types';
import { appendBounded, MILESTONE_LOG_LIMIT } from './activityLogTypes';

const ensureActivityLogs = (state: GameState): void => {
  state.activityLogs ??= { milestones: [], combat: [] };
  state.activityLogs.milestones ??= [];
  state.activityLogs.combat ??= [];
};

export const appendMilestone = (
  state: GameState,
  entry: Omit<MilestoneLogEntry, 'id' | 'kind'> & { kind?: 'level-up' },
): void => {
  ensureActivityLogs(state);
  const id = `milestone-${entry.at}-${state.activityLogs.milestones.length}-${entry.skillId}-${entry.level}`;
  appendBounded(
    state.activityLogs.milestones,
    { ...entry, id, kind: 'level-up' },
    MILESTONE_LOG_LIMIT,
  );
};
