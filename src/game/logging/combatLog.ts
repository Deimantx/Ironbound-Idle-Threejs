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
  const signature = encodeURIComponent(JSON.stringify(entry));
  const baseId = `combat-${entry.kind}-${entry.at}-${entry.enemyId}-${signature}`;
  const existingIds = new Set(state.activityLogs.combat.map((current) => current.id));
  let id = baseId;
  let collision = 2;
  while (existingIds.has(id)) id = `${baseId}-${collision++}`;
  appendBounded(
    state.activityLogs.combat,
    { ...entry, id } as RuntimeCombatLogEntry,
    COMBAT_LOG_LIMIT,
  );
};
