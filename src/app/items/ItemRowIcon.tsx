import { ArtViewport } from '../art/ArtViewport';
import { ItemIcon } from './ItemIcon';

export function ItemRowIcon({ itemId, discovered = true }: { itemId: string; discovered?: boolean }) {
  return (
    <ArtViewport className={`item-row-icon-viewport ${!discovered ? 'is-hidden' : ''}`} aria-hidden="true">
      <ItemIcon
        itemId={itemId}
        discovered={discovered}
        size="md"
        framed={false}
        artVariant="item-row"
      />
    </ArtViewport>
  );
}
