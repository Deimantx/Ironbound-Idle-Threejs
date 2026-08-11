import { AREA_ART, REGION_ART, SUB_REGION_ART } from './artRegistry';
import { ArtImage } from './ArtImage';

type WorldArtKind = 'region' | 'sub-region' | 'area';

export function WorldArt({
  kind,
  id,
  className = '',
}: {
  kind: WorldArtKind;
  id: string;
  className?: string;
}) {
  const source = (kind === 'region' ? REGION_ART : kind === 'sub-region' ? SUB_REGION_ART : AREA_ART)[id];
  return source ? (
    <ArtImage
      className={`world-art world-art-${kind} ${className}`.trim()}
      src={source}
      alt=""
      aria-hidden="true"
    />
  ) : null;
}
