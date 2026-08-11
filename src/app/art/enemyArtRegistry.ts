import brambletoothBoarhandler from '../../Assets/Art/Monsters/brambletooth-boarhandler.png';
import brambletoothScavenger from '../../Assets/Art/Monsters/brambletooth-scavenger.png';
import brambletoothSpearman from '../../Assets/Art/Monsters/brambletooth-spearman.png';
import brambletoothTrapper from '../../Assets/Art/Monsters/brambletooth-trapper.png';
import greyfangAlpha from '../../Assets/Art/Monsters/greyfang-alpha.png';
import greyfangRavager from '../../Assets/Art/Monsters/greyfang-ravager.png';
import greyfangStalker from '../../Assets/Art/Monsters/greyfang-stalker.png';
import greyfangWolf from '../../Assets/Art/Monsters/greyfang-wolf.png';
import redknifeBowhand from '../../Assets/Art/Monsters/redknife-bowhand.png';
import redknifeBrigand from '../../Assets/Art/Monsters/redknife-brigand.png';
import redknifeEnforcer from '../../Assets/Art/Monsters/redknife-enforcer.png';
import redknifeLookout from '../../Assets/Art/Monsters/redknife-lookout.png';

export interface EnemyArtProfile {
  src: string;
  scale: number;
  x: number;
  y: number;
  objectPosition?: string;
}

/** Central physical viewports shared by every enemy-bearing surface. */
export const ENEMY_ARTWORK_SIZES = {
  xs: 40,
  sm: 56,
  md: 80,
  lg: 112,
  xl: 120,
} as const;

export type EnemyArtworkSize = keyof typeof ENEMY_ARTWORK_SIZES;

const enemyArt = (
  src: string,
  profile: Omit<EnemyArtProfile, 'src'>,
): EnemyArtProfile => ({
  src,
  ...profile,
});

/**
 * ENEMY ART CALIBRATION
 *
 * This is the only place to tune the visual pose of gameplay monsters.
 *
 * scale:
 *   1.00 = normal
 *   <1   = smaller
 *   >1   = larger
 *
 * x:
 *   negative = move left
 *   positive = move right
 *   units are percentage of viewport
 *
 * y:
 *   negative = move up
 *   positive = move down
 *   units are percentage of viewport
 *
 * Edit these canonical values only. The same composition is used everywhere
 * EnemyArtwork renders the monster. Screens may choose viewport size only;
 * they must not add monster-specific scale or offset overrides.
 */
export const ENEMY_ART: Record<string, EnemyArtProfile> = {
  // ============================================================
  // REDKNIFE
  // ============================================================
  'redknife-bowhand': enemyArt(redknifeBowhand, { scale: 0.78, x: 0, y: -1 }),
  'redknife-brigand': enemyArt(redknifeBrigand, { scale: 0.78, x: 0, y: -1 }),
  'redknife-enforcer': enemyArt(redknifeEnforcer, { scale: 0.76, x: 0, y: -1 }),
  'redknife-lookout': enemyArt(redknifeLookout, { scale: 0.8, x: 0, y: -1 }),

  // ============================================================
  // GREYFANG
  // ============================================================
  'greyfang-alpha': enemyArt(greyfangAlpha, { scale: 0.8, x: 0, y: -1 }),
  'greyfang-ravager': enemyArt(greyfangRavager, { scale: 0.78, x: 0, y: -1 }),
  'greyfang-stalker': enemyArt(greyfangStalker, { scale: 0.82, x: 0, y: 0 }),
  'greyfang-wolf': enemyArt(greyfangWolf, { scale: 0.78, x: 0, y: -1 }),

  // ============================================================
  // BRAMBLETOOTH
  // ============================================================
  'brambletooth-boarhandler': enemyArt(brambletoothBoarhandler, { scale: 0.78, x: 0, y: -1 }),
  'brambletooth-scavenger': enemyArt(brambletoothScavenger, { scale: 0.8, x: 0, y: 0 }),
  'brambletooth-spearman': enemyArt(brambletoothSpearman, { scale: 0.78, x: 0, y: -1 }),
  'brambletooth-trapper': enemyArt(brambletoothTrapper, { scale: 0.78, x: 0, y: -1 }),
};
