import type { WeaponSpecial } from '../../game/types';

export interface SpecialAttackEffectRow {
  id: string;
  label: string;
}

const formatPercent = (value: number): number => Math.round(value * 100);

export const getSpecialAttackEffectRows = (
  special: WeaponSpecial,
): SpecialAttackEffectRow[] => {
  const rows: SpecialAttackEffectRow[] = [
    { id: 'damage', label: `Deals ${formatPercent(special.damageMultiplier)}% damage` },
    {
      id: 'accuracy',
      label: `+${formatPercent(special.accuracyMultiplier - 1)}% Accuracy`,
    },
  ];
  if (special.ignoresFlatDamageReduction)
    rows.push({ id: 'flat-reduction', label: 'Ignores flat damage reduction' });
  if (special.executeThreshold !== undefined && special.executeDamageMultiplier !== undefined) {
    const totalMultiplier = special.damageMultiplier * special.executeDamageMultiplier;
    rows.push({
      id: 'execute',
      label: `Below ${formatPercent(special.executeThreshold)}% HP: ~${formatPercent(totalMultiplier)}% total damage`,
    });
  }
  return rows;
};
