import type { EnemyDefinition } from '../../../game/types';
import { EnemyArtwork } from '../../art/EnemyArtwork';

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
  const size = context === 'roster' ? 'sm' : context === 'selected' ? 'lg' : 'xl';

  return (
    <div
      className={`combat-target-portrait combat-target-portrait-${context} theme-${enemy.theme}`}
      data-debug-kind="enemy"
      data-debug-enemy-id={enemy.id}
      data-debug-label={enemy.name}
      role={labelled ? 'img' : undefined}
      aria-label={ariaLabel}
      aria-hidden={labelled ? undefined : true}
    >
      <EnemyArtwork enemyId={enemy.id} size={size} />
    </div>
  );
}
