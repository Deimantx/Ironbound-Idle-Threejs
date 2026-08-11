import {
  Bone,
  CircleHelp,
  Coins,
  Gem,
  Hexagon,
  Pickaxe,
  Shield,
  Shirt,
  Sparkles,
  Sword,
  type LucideIcon,
} from 'lucide-react';
import type { CSSProperties, HTMLAttributes } from 'react';
import { itemById } from '../../content/items';
import { GOLD_ART, ITEM_ART, ITEM_ARTWORK_SIZES, type ItemArtworkSize } from './itemArtRegistry';

const fallbackIconByKey: Record<string, LucideIcon> = {
  armor: Shirt,
  bar: Hexagon,
  'creature-part': Bone,
  gold: Coins,
  gem: Gem,
  ore: Gem,
  relic: Sparkles,
  shield: Shield,
  sword: Sword,
  tool: Pickaxe,
};

const fallbackIconSize: Record<ItemArtworkSize, number> = {
  xs: 13,
  sm: 16,
  md: 20,
  lg: 25,
  tile: 34,
};

export interface ItemArtworkProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children' | 'style'> {
  itemId?: string;
  discovered?: boolean;
  gold?: boolean;
  size?: ItemArtworkSize;
}

/**
 * Canonical renderer for every gameplay item image.
 *
 * Callers choose only the physical viewport size. Source-specific scale,
 * translation, and object position are read from the item's one registry entry.
 */
export function ItemArtwork({
  itemId,
  discovered = true,
  gold = false,
  size = 'sm',
  className,
  ...props
}: ItemArtworkProps) {
  const item = itemId ? itemById[itemId] : undefined;
  const profile = gold ? { src: GOLD_ART } : discovered && itemId ? ITEM_ART[itemId] : undefined;
  const iconKey = gold
    ? 'gold'
    : discovered
      ? (item?.presentation?.iconKey ?? item?.category ?? 'drop')
      : '';
  const FallbackIcon = fallbackIconByKey[iconKey] ?? CircleHelp;
  const style = {
    '--item-artwork-size': `${ITEM_ARTWORK_SIZES[size]}px`,
    '--item-artwork-scale': profile && 'scale' in profile ? profile.scale ?? 1 : 1,
    '--item-artwork-x': profile && 'x' in profile ? `${profile.x ?? 0}%` : '0%',
    '--item-artwork-y': profile && 'y' in profile ? `${profile.y ?? 0}%` : '0%',
    '--item-artwork-position': profile && 'objectPosition' in profile ? profile.objectPosition ?? 'center' : 'center',
  } as CSSProperties;

  return (
    <span
      {...props}
      className={`item-artwork item-artwork-${size} ${!discovered ? 'is-hidden' : ''} ${className ?? ''}`.trim()}
      style={style}
      aria-hidden="true"
      data-debug-kind={gold ? 'currency' : item && discovered ? 'item-artwork' : undefined}
      data-debug-id={gold ? 'gold' : undefined}
      data-debug-item-id={!gold && item && discovered ? item.id : undefined}
      data-debug-label={gold ? 'Gold' : item && discovered ? item.name : undefined}
    >
      {profile ? (
        <img
          className="item-artwork-image"
          src={profile.src}
          alt=""
          aria-hidden="true"
          decoding="async"
        />
      ) : (
        <FallbackIcon
          className="item-artwork-fallback"
          size={fallbackIconSize[size]}
          strokeWidth={1.8}
          aria-hidden="true"
        />
      )}
    </span>
  );
}
