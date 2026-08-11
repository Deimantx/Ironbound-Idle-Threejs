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
import { itemById } from '../../content/items';
import { ArtImage } from '../art/ArtImage';
import { GOLD_ART, ITEM_ART } from '../art/artRegistry';
import type { ArtVariant } from '../art/artRegistry';

const iconByKey: Record<string, LucideIcon> = {
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

export function ItemIcon({
  itemId,
  discovered = true,
  gold = false,
  size = 'sm',
  framed = true,
  artVariant,
}: {
  itemId?: string;
  discovered?: boolean;
  gold?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'tile';
  /** Bare artwork lets the containing tile or slot own the visual frame. */
  framed?: boolean;
  artVariant?: ArtVariant;
}) {
  const item = itemId ? itemById[itemId] : undefined;
  const iconKey = gold
    ? 'gold'
    : discovered
      ? (item?.presentation?.iconKey ?? item?.category ?? 'drop')
      : '';
  const Icon = iconByKey[iconKey] ?? CircleHelp;
  const artSource = gold ? { src: GOLD_ART } : discovered && itemId ? ITEM_ART[itemId] : undefined;
  const rarity = item?.rarity ?? 'uncommon';
  const resolvedVariant = artVariant ?? (size === 'tile' ? 'item-tile' : 'item-small');
  const defaultArtScale =
    resolvedVariant === 'item-tooltip'
      ? 0.78
      : resolvedVariant === 'item-inventory'
        ? 0.94
        : resolvedVariant === 'item-collection'
          ? 0.88
          : resolvedVariant === 'item-detail'
            ? 0.9
            : resolvedVariant === 'item-row'
              ? 0.84
              : resolvedVariant === 'item-equipment'
                ? 0.92
                : framed
                  ? 0.86
                  : size === 'tile'
                    ? 0.94
                    : 1;
  const className = framed
    ? `loot-icon loot-icon-${size} loot-icon-${gold ? 'gold' : (item?.category ?? 'unknown')} loot-rarity-${rarity} ${!discovered ? 'is-hidden' : ''}`
    : `item-art item-art-${size} loot-rarity-${rarity} ${!discovered ? 'is-hidden' : ''}`;
  return (
    <span className={className.trim()} aria-hidden="true">
      {artSource ? (
        <ArtImage
          asset={artSource}
          defaultScale={defaultArtScale}
          variant={resolvedVariant}
          alt=""
          aria-hidden="true"
        />
      ) : (
        <Icon
          size={size === 'xs' ? 12 : size === 'lg' ? 24 : size === 'tile' ? 32 : size === 'md' ? 18 : 15}
          strokeWidth={1.8}
        />
      )}
    </span>
  );
}
