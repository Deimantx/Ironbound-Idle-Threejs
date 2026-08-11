import type { ScreenId } from '../../game/types';
import { NAVIGATION_ART } from './artRegistry';
import { ArtImage } from './ArtImage';

export function NavigationArt({ screenId, fallback }: { screenId: ScreenId; fallback: string }) {
  const source = NAVIGATION_ART[screenId];
  return source ? (
    <ArtImage className="nav-icon-image" src={source} alt="" aria-hidden="true" />
  ) : (
    <span aria-hidden="true">{fallback}</span>
  );
}
