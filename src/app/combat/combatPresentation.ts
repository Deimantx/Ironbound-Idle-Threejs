export const formatDamageRange = (maxHit: number): string =>
  `1–${Math.max(1, Math.floor(Number.isFinite(maxHit) ? maxHit : 1))}`;

export const formatRewardSummary = (goldGained: number, itemDropCount: number): string => {
  const segments: string[] = [];
  if (goldGained > 0) segments.push(`${goldGained} Gold`);
  if (itemDropCount > 0)
    segments.push(`${itemDropCount} item drop${itemDropCount === 1 ? '' : 's'}`);
  return segments.join(' · ');
};
