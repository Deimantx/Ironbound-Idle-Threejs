import { GOLD_ART } from './artRegistry';
import { ArtImage } from './ArtImage';

export function GoldArt() {
  return <ArtImage className="header-gold-art" src={GOLD_ART} alt="" aria-hidden="true" />;
}
