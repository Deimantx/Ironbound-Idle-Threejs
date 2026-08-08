export const MILESTONE_LOG_LIMIT = 50;
export const COMBAT_LOG_LIMIT = 120;

export const appendBounded = <T>(entries: T[], entry: T, limit: number): void => {
  entries.unshift(entry);
  if (entries.length > limit) entries.length = limit;
};
