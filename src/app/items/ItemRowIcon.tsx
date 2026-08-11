import { ArtViewport } from '../art/ArtViewport';
import { ItemArtwork } from './ItemArtwork';

/** Row-surface convenience wrapper; it does not alter the item's canonical pose. */
export function ItemRowIcon({ itemId, discovered = true }: { itemId: string; discovered?: boolean }) {
  return (
    <ArtViewport className={`item-row-icon-viewport ${!discovered ? 'is-hidden' : ''}`} aria-hidden="true">
      <ItemArtwork itemId={itemId} discovered={discovered} size="md" />
    </ArtViewport>
  );
}
