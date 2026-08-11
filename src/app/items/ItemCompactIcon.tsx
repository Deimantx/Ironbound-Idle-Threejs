import { ArtViewport } from '../art/ArtViewport';
import { ItemArtwork } from './ItemArtwork';

type ItemCompactSize = 'xs' | 'sm' | 'md' | 'lg';

/** Surface convenience wrapper; all item geometry is delegated to ItemArtwork. */
export function ItemCompactIcon({
  itemId,
  discovered = true,
  gold = false,
  size = 'sm',
}: {
  itemId?: string;
  discovered?: boolean;
  gold?: boolean;
  size?: ItemCompactSize;
}) {
  return (
    <ArtViewport
      className={`item-compact-icon-viewport item-compact-icon-${size} ${!discovered ? 'is-hidden' : ''}`}
      aria-hidden="true"
    >
      <ItemArtwork
        itemId={itemId}
        discovered={discovered}
        gold={gold}
        size={size}
      />
    </ArtViewport>
  );
}
