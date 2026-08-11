import type { EnemyDefinition } from '../../../game/types';
import { EnemyArt } from '../../art/EnemyArt';

export type CombatTargetPortraitContext = 'roster' | 'selected' | 'preview';

export function CombatTargetPortrait({
  enemy,
  context,
  ariaLabel,
}: {
  enemy: EnemyDefinition;
  context: CombatTargetPortraitContext;
  ariaLabel?: string;
}) {
  const labelled = Boolean(ariaLabel);

  return (
    <div
      className={`combat-target-portrait combat-target-portrait-${context} theme-${enemy.theme}`}
      role={labelled ? 'img' : undefined}
      aria-label={ariaLabel}
      aria-hidden={labelled ? undefined : true}
    >
      <EnemyArt enemyId={enemy.id} variant="target" />
    </div>
  );
}
