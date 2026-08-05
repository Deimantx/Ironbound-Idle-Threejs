export const formatNumber = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    notation: value > 9999 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(Math.floor(value));
