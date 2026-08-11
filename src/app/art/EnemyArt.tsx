import { enemyById } from '../../content/enemies';
import { ENEMY_ART } from './artRegistry';
import { ArtImage } from './ArtImage';

export function EnemyArt({
  enemyId,
  discovered = true,
  large = false,
  variant,
  className = '',
}: {
  enemyId: string;
  discovered?: boolean;
  large?: boolean;
  variant?: 'roster' | 'preview' | 'detail' | 'arena';
  className?: string;
}) {
  const source = discovered ? ENEMY_ART[enemyId] : undefined;
  const enemyName = enemyById[enemyId]?.name ?? 'Unknown enemy';
  const resolvedVariant = variant ?? (large ? 'detail' : 'roster');
  const defaultScale =
    resolvedVariant === 'roster' ? 0.82 : resolvedVariant === 'preview' ? 0.88 : 0.92;
  return (
    <span className={`enemy-art enemy-art-${resolvedVariant} ${large ? 'enemy-art-detail' : ''} ${className}`.trim()}>
      {source ? (
        <ArtImage asset={source} defaultScale={defaultScale} alt="" aria-hidden="true" />
      ) : (
        <span aria-hidden="true">?</span>
      )}
      <span className="sr-only">{discovered ? `${enemyName} art` : 'Undiscovered enemy'}</span>
    </span>
  );
}
