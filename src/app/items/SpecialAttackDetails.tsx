import type { WeaponSpecial } from '../../game/types';
import { getSpecialAttackEffectRows } from './specialAttackPresentation';

export function SpecialAttackDetails({
  special,
  className = '',
}: {
  special: WeaponSpecial;
  className?: string;
}) {
  return (
    <div className={`special-attack-details ${className}`.trim()}>
      <div className="special-attack-effect-list">
        {getSpecialAttackEffectRows(special).map((row) => (
          <span key={row.id}>{row.label}</span>
        ))}
      </div>
    </div>
  );
}
