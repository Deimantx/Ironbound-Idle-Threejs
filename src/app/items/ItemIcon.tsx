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
  size?: 'xs' | 'sm' | 'md' | 'lg';
}) {
  const item = itemId ? itemById[itemId] : undefined;
  const iconKey = gold
    ? 'gold'
    : discovered
      ? (item?.presentation?.iconKey ?? item?.category ?? 'drop')
      : '';
  const Icon = iconByKey[iconKey] ?? CircleHelp;
  const rarity = item?.rarity ?? 'uncommon';
  return (
    <span
      className={`loot-icon loot-icon-${size} loot-icon-${gold ? 'gold' : (item?.category ?? 'unknown')} loot-rarity-${rarity} ${!discovered ? 'is-hidden' : ''}`}
      aria-hidden="true"
    >
      <Icon
        size={size === 'xs' ? 12 : size === 'lg' ? 24 : size === 'md' ? 18 : 15}
        strokeWidth={1.8}
      />
    </span>
  );
}
