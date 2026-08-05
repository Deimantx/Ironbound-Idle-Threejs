import { Lock } from 'lucide-react';
import type { InventoryStack, ItemDefinition } from '../game/types';
import { formatNumber } from './formatters';
import {
  getInventoryDisplayGroup,
  getInventoryFilterLabel,
  getInventoryValueLabel,
} from './inventoryView';
import { ItemIcon } from './ItemIcon';

export interface InventoryItemCardProps {
  stack: InventoryStack;
  item?: ItemDefinition;
  selected: boolean;
  onSelect: (itemId: string) => void;
  cardRef?: (element: HTMLButtonElement | null) => void;
}

export function InventoryItemCard({
  stack,
  item,
  selected,
  onSelect,
  cardRef,
}: InventoryItemCardProps) {
  const name = item?.name ?? 'Unknown item';
  const group = getInventoryDisplayGroup(item?.category);
  const context = item
    ? [
        group ? getInventoryFilterLabel(group) : null,
        item.slot ? `Slot ${getInventoryValueLabel(item.slot)}` : null,
        item.tier ? `Tier ${getInventoryValueLabel(item.tier)}` : null,
      ].filter(Boolean)
    : ['Unknown item'];
  const accessibleContext = context.join(', ');

  return (
    <button
      ref={cardRef}
      type="button"
      className={`item-card inventory-item-card inventory-rarity-${item?.rarity ?? 'unknown'} ${selected ? 'is-selected' : ''} ${stack.locked ? 'is-locked' : ''}`}
      onClick={() => onSelect(stack.itemId)}
      aria-label={`View ${name}, ${accessibleContext}, quantity ${formatNumber(stack.quantity)}${stack.locked ? ', locked' : ''}`}
      aria-pressed={selected}
    >
      <span className="inventory-card-top">
        <ItemIcon itemId={item?.id ?? stack.itemId} size="md" />
        <span className="quantity inventory-card-quantity">×{formatNumber(stack.quantity)}</span>
      </span>
      <strong>{name}</strong>
      <span className="inventory-card-context">{context.join(' · ')}</span>
      <span className={`inventory-card-rarity rarity-${item?.rarity ?? 'unknown'}`}>
        {item ? getInventoryValueLabel(item.rarity) : 'Unknown'}
      </span>
      {stack.locked && (
        <span className="item-card-lock" title="Locked stack" aria-label="Locked stack">
          <Lock size={14} aria-hidden="true" />
        </span>
      )}
    </button>
  );
}
