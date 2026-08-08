export const formatNumber = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    notation: value > 9999 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(Math.floor(value));

/** Player-facing health is always shown as a non-negative whole number. */
export const formatHealth = (value: number): string =>
  String(Math.ceil(Math.max(0, Number.isFinite(value) ? value : 0)));

export const formatDropChance = (chance: number): string => {
  const percent = Math.max(0, chance) * 100;
  if (percent >= 10) return `${percent.toFixed(0)}%`;
  if (percent >= 1) return `${percent.toFixed(1).replace(/\.0$/, '')}%`;
  return `${percent.toFixed(2)}%`;
};

export const formatRatePerHour = (value: number): string =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(
    Math.round(Math.max(0, value)),
  );

export const formatHoursMinutes = (milliseconds: number): string => {
  const totalMinutes = Math.max(
    0,
    Math.round((Number.isFinite(milliseconds) ? milliseconds : 0) / 60_000),
  );
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};
