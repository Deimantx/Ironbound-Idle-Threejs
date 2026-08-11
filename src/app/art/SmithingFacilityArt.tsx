import { SMITHING_FACILITY_ART } from './artRegistry';
import { ArtImage } from './ArtImage';

export function SmithingFacilityArt({ facility }: { facility: 'forge' | 'anvil' }) {
  return (
    <ArtImage
      className="smithing-facility-art"
      src={SMITHING_FACILITY_ART[facility]}
      alt=""
      aria-hidden="true"
    />
  );
}
