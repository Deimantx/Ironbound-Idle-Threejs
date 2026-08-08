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
  const signature = encodeURIComponent(JSON.stringify(entry));
  const baseId = `milestone-${entry.at}-${entry.skillId}-${entry.level}-${signature}`;
  const existingIds = new Set(state.activityLogs.milestones.map((current) => current.id));
  let id = baseId;
  let collision = 2;
  while (existingIds.has(id)) id = `${baseId}-${collision++}`;
  appendBounded(
    state.activityLogs.milestones,
    { ...entry, id, kind: 'level-up' },
    MILESTONE_LOG_LIMIT,
  );
};
