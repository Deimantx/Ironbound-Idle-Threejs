export const formatNumber = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    notation: value > 9999 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(Math.floor(value));

export const formatDropChance = (chance: number): string => {
  const percent = Math.max(0, chance) * 100;
  if (percent >= 10) return `${percent.toFixed(0)}%`;
  if (percent >= 1) return `${percent.toFixed(1).replace(/\.0$/, '')}%`;
  return `${percent.toFixed(2)}%`;
};
