import { ItemArtwork, type ItemArtworkProps } from './ItemArtwork';
import { itemById } from '../../content/items';

export function ItemIcon({
  itemId,
  discovered = true,
  gold = false,
  size = 'sm',
  framed = true,
}: {
  itemId?: ItemArtworkProps['itemId'];
  discovered?: ItemArtworkProps['discovered'];
  gold?: ItemArtworkProps['gold'];
  size?: ItemArtworkProps['size'];
  /** Bare artwork lets the containing tile or slot own the visual frame. */
  framed?: boolean;
}) {
  const item = itemId ? itemById[itemId] : undefined;
  const artwork = (
    <ItemArtwork
      itemId={itemId}
      discovered={discovered}
      gold={gold}
      size={size}
      data-legacy-item-icon
    />
  );
  if (!framed) return artwork;
  return (
    <span className={`loot-icon loot-icon-${size} loot-icon-${gold ? 'gold' : (item?.category ?? 'unknown')}`}>
      {artwork}
    </span>
  );
}
