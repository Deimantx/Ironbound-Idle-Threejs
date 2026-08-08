import type { EnemySpecialDefinition } from '../../game/types';
import { getCombatEffectDefinition } from '../../game/formulas/combatEffects';
import { Sword } from 'lucide-react';

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
  for (const effect of special.effects ?? []) {
    const trigger = effect.applyOn === 'hit' ? 'On hit' : 'On use';
    if (effect.kind === 'player-attack-progress-pushback')
      rows.push(`${trigger}: pushes your attack progress back ${Math.round(effect.fractionOfAttackInterval * 100)}% of its interval`);
    else if (effect.kind === 'player-attack-delay')
      rows.push(`${trigger}: delays your next attack by ${(effect.amountMs / 1000).toFixed(2)}s`);
    else {
      const definition = getCombatEffectDefinition(effect.effectId);
      rows.push(`${trigger}: applies ${definition?.name ?? effect.effectId}`);
    }
  }
  if (special.delivery === 'self' && special.damageMultiplier === undefined) rows.push('No direct damage');
  return rows;
};

export function EnemySpecialDetails({
  special,
  includeChargeRule = false,
  includeNormalQualifier = false,
  emphasizeLabel = false,
}: {
  special: EnemySpecialDefinition;
  includeChargeRule?: boolean;
  includeNormalQualifier?: boolean;
  emphasizeLabel?: boolean;
}) {
  return (
    <div className={`enemy-special-details ${emphasizeLabel ? 'emphasized' : ''}`}>
      <span className={`item-tooltip-kicker enemy-special-kicker ${emphasizeLabel ? 'emphasized' : ''}`}>
        {emphasizeLabel && <Sword size={16} aria-hidden="true" />}
        Special Attack
      </span>
      <strong>{special.name}</strong>
      <span className="enemy-special-description">{special.description}</span>
      {getEnemySpecialRows(special, includeNormalQualifier).map((row) => (
        <span className="enemy-special-row" key={row}>{row}</span>
      ))}
      {includeChargeRule && <small>Used at full Special Charge on the enemy’s next attack.</small>}
    </div>
  );
}
