import type { CombatLogEntry, GameState } from '../types';
import { appendBounded, COMBAT_LOG_LIMIT } from './activityLogTypes';

type RuntimeCombatLogEntry = Exclude<CombatLogEntry, { kind: 'legacy' }>;
type RuntimeCombatLogInput<T> = T extends unknown ? Omit<T, 'id'> : never;

const ensureActivityLogs = (state: GameState): void => {
  state.activityLogs ??= { milestones: [], combat: [] };
  state.activityLogs.milestones ??= [];
  state.activityLogs.combat ??= [];
};

export const appendCombatLog = (
  state: GameState,
  entry: RuntimeCombatLogInput<RuntimeCombatLogEntry>,
): void => {
  ensureActivityLogs(state);
  const id = `combat-${entry.kind}-${entry.at}-${state.activityLogs.combat.length}-${entry.enemyId}`;
  appendBounded(state.activityLogs.combat, { ...entry, id } as RuntimeCombatLogEntry, COMBAT_LOG_LIMIT);
};
