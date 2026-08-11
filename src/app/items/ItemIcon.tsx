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
}: {
  itemId?: string;
  discovered?: boolean;
  gold?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'tile';
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
  return (
    <span
      className={`loot-icon loot-icon-${size} loot-icon-${gold ? 'gold' : (item?.category ?? 'unknown')} loot-rarity-${rarity} ${!discovered ? 'is-hidden' : ''}`}
      aria-hidden="true"
    >
      {artSource ? (
        <ArtImage asset={artSource} defaultScale={0.86} alt="" aria-hidden="true" />
      ) : (
        <Icon
          size={size === 'xs' ? 12 : size === 'lg' ? 24 : size === 'tile' ? 32 : size === 'md' ? 18 : 15}
          strokeWidth={1.8}
        />
      )}
    </span>
  );
}
