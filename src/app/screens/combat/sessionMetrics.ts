export const getActualDps = (damageDealt: number, elapsedMs: number): number =>
  elapsedMs > 0 && Number.isFinite(damageDealt) && Number.isFinite(elapsedMs)
    ? (damageDealt * 1_000) / elapsedMs
    : 0;

export const getActualKillsPerHour = (kills: number, elapsedMs: number): number =>
  elapsedMs > 0 && Number.isFinite(kills) && Number.isFinite(elapsedMs)
    ? (kills * 3_600_000) / elapsedMs
    : 0;
