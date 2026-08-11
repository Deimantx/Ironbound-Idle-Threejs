import { enemyById } from '../../content/enemies';
import { ENEMY_ART } from './artRegistry';
import { ArtImage } from './ArtImage';

export function EnemyArt({
  enemyId,
  discovered = true,
  large = false,
  className = '',
}: {
  enemyId: string;
  discovered?: boolean;
  large?: boolean;
  className?: string;
}) {
  const source = discovered ? ENEMY_ART[enemyId] : undefined;
  const enemyName = enemyById[enemyId]?.name ?? 'Unknown enemy';
  return (
    <span className={`enemy-art ${large ? 'enemy-art-detail' : ''} ${className}`.trim()}>
      {source ? (
        <ArtImage src={source} alt="" aria-hidden="true" />
      ) : (
        <span aria-hidden="true">?</span>
      )}
      <span className="sr-only">{discovered ? `${enemyName} art` : 'Undiscovered enemy'}</span>
    </span>
  );
}
