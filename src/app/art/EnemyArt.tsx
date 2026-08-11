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
    resolvedVariant === 'roster'
      ? 0.78
      : resolvedVariant === 'preview'
        ? 0.94
        : resolvedVariant === 'detail'
          ? 1.08
          : 1.16;
  const artVariant = `enemy-${resolvedVariant}` as const;
  return (
    <span className={`enemy-art enemy-art-${resolvedVariant} ${large ? 'enemy-art-detail' : ''} ${className}`.trim()}>
      {source ? (
        <ArtImage
          asset={source}
          defaultScale={defaultScale}
          variant={artVariant}
          alt=""
          aria-hidden="true"
        />
      ) : (
        <span aria-hidden="true">?</span>
      )}
      <span className="sr-only">{discovered ? `${enemyName} art` : 'Undiscovered enemy'}</span>
    </span>
  );
}
