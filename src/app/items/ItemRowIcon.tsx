import { ArtViewport } from '../art/ArtViewport';
import { ItemIcon } from './ItemIcon';

export function ItemRowIcon({ itemId, discovered = true }: { itemId: string; discovered?: boolean }) {
  return (
    <ArtViewport className="item-row-icon-viewport" aria-hidden="true">
      <ItemIcon
        itemId={itemId}
        discovered={discovered}
        size="md"
        framed
        artVariant="item-row"
      />
    </ArtViewport>
  );
}
