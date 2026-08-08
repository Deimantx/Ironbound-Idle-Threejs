import type { EnemySpecialDefinition } from '../../game/types';

export const getEnemySpecialRows = (
  special: EnemySpecialDefinition,
  includeNormalQualifier = false,
): string[] => {
  const rows: string[] = [];
  if (special.damageMultiplier !== undefined)
    rows.push(
      `Deals ${Math.round(special.damageMultiplier * 100)}%${includeNormalQualifier ? ' normal' : ''} damage`,
    );
  if (special.accuracyMultiplier !== undefined && special.accuracyMultiplier !== 1) {
    const amount = Math.round((special.accuracyMultiplier - 1) * 100);
    rows.push(`${amount >= 0 ? '+' : ''}${amount}% Accuracy`);
  }
  return rows;
};

export function EnemySpecialDetails({
  special,
  includeChargeRule = false,
  includeNormalQualifier = false,
}: {
  special: EnemySpecialDefinition;
  includeChargeRule?: boolean;
  includeNormalQualifier?: boolean;
}) {
  return (
    <div className="enemy-special-details">
      <span className="item-tooltip-kicker">Special Attack</span>
      <strong>{special.name}</strong>
      <span>{special.description}</span>
      {getEnemySpecialRows(special, includeNormalQualifier).map((row) => <span key={row}>{row}</span>)}
      {includeChargeRule && <small>Used at full Special Charge on the enemy’s next attack.</small>}
    </div>
  );
}
