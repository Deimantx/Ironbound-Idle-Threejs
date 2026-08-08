export const formatDamageRange = (maxHit: number): string =>
  `1–${Math.max(1, Math.floor(Number.isFinite(maxHit) ? maxHit : 1))}`;
