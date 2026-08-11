import { ArtViewport } from '../art/ArtViewport';
import { ItemIcon } from './ItemIcon';

type ItemCompactSize = 'xs' | 'sm' | 'md' | 'lg';

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
      <ItemIcon
        itemId={itemId}
        discovered={discovered}
        gold={gold}
        size={size}
        framed={false}
        artVariant="item-compact"
      />
    </ArtViewport>
  );
}
