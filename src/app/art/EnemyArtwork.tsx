import type { CSSProperties, HTMLAttributes } from 'react';
import { enemyById } from '../../content/enemies';
import {
  ENEMY_ART,
  ENEMY_ARTWORK_SIZES,
  type EnemyArtworkSize,
} from './enemyArtRegistry';

export interface EnemyArtworkProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children' | 'style'> {
  enemyId: string;
  discovered?: boolean;
  size?: EnemyArtworkSize;
}

/**
 * Canonical renderer for every gameplay monster image.
 *
 * Callers choose only the physical viewport size. Source-specific scale,
 * translation, and object position come from enemyArtRegistry.
 */
export function EnemyArtwork({
  enemyId,
  discovered = true,
  size = 'sm',
  className,
  ...props
}: EnemyArtworkProps) {
  const enemy = enemyById[enemyId];
  const profile = discovered ? ENEMY_ART[enemyId] : undefined;
  const style = {
    '--enemy-artwork-size': `${ENEMY_ARTWORK_SIZES[size]}px`,
    '--enemy-artwork-scale': profile?.scale ?? 1,
    '--enemy-artwork-x': `${profile?.x ?? 0}%`,
    '--enemy-artwork-y': `${profile?.y ?? 0}%`,
    '--enemy-artwork-position': profile?.objectPosition ?? 'center',
  } as CSSProperties;
  const label = !discovered
    ? 'Undiscovered enemy'
    : enemy
      ? `${enemy.name} art`
      : 'Unknown enemy';

  return (
    <span
      {...props}
      className={`enemy-artwork enemy-artwork-${size} ${!discovered ? 'is-hidden' : ''} ${className ?? ''}`.trim()}
      style={style}
      aria-hidden="true"
      data-debug-kind={profile ? 'enemy-artwork' : undefined}
      data-debug-enemy-id={profile ? enemyId : undefined}
      data-debug-label={profile ? enemy?.name : undefined}
    >
      {profile ? (
        <img
          className="enemy-artwork-image"
          src={profile.src}
          alt=""
          aria-hidden="true"
          decoding="async"
        />
      ) : (
        <span className="enemy-artwork-fallback" aria-hidden="true">?</span>
      )}
      <span className="sr-only">{label}</span>
    </span>
  );
}

