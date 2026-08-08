import { Lock } from 'lucide-react';
import type { DragEvent, MouseEvent } from 'react';
import type { InventoryStack, ItemDefinition } from '../game/types';
import { formatNumber } from './formatters';
import type { InventoryDropPosition } from './inventoryOrdering';
import { ItemIcon } from './ItemIcon';
import { ItemTooltip } from './items/ItemTooltip';

export interface InventoryItemCardProps {
  stack: InventoryStack;
  item?: ItemDefinition;
  selected: boolean;
  onSelect: (itemId: string, event: MouseEvent<HTMLButtonElement>) => void;
  cardRef?: (element: HTMLButtonElement | null) => void;
  dragEnabled?: boolean;
  isDragSource?: boolean;
  dropPosition?: InventoryDropPosition;
  onDragStart?: (event: DragEvent<HTMLButtonElement>, itemId: string) => void;
  onDragOver?: (event: DragEvent<HTMLButtonElement>, itemId: string) => void;
  onDrop?: (event: DragEvent<HTMLButtonElement>, itemId: string) => void;
  onDragEnd?: () => void;
}

export function InventoryItemCard({
  stack,
  item,
  selected,
  onSelect,
  cardRef,
  dragEnabled = false,
  isDragSource = false,
  dropPosition,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: InventoryItemCardProps) {
  const name = item?.name ?? 'Unknown item';

  return (
    <ItemTooltip item={item}>
      <button
        ref={cardRef}
        type="button"
        className={`item-card inventory-item-card ${selected ? 'is-selected' : ''} ${stack.locked ? 'is-locked' : ''} ${isDragSource ? 'is-drag-source' : ''} ${dropPosition ? `is-drop-${dropPosition}` : ''}`}
        onClick={(event) => onSelect(stack.itemId, event)}
        onDragStart={dragEnabled ? (event) => onDragStart?.(event, stack.itemId) : undefined}
        onDragOver={dragEnabled ? (event) => onDragOver?.(event, stack.itemId) : undefined}
        onDrop={dragEnabled ? (event) => onDrop?.(event, stack.itemId) : undefined}
        onDragEnd={dragEnabled ? onDragEnd : undefined}
        draggable={dragEnabled ? true : undefined}
        title={name}
        aria-label={`View ${name}, quantity ${formatNumber(stack.quantity)}${stack.locked ? ', locked' : ''}`}
        aria-pressed={selected}
      >
        <span className="inventory-card-top">
          <ItemIcon itemId={item?.id ?? stack.itemId} size="md" />
          <span className="quantity inventory-card-quantity">×{formatNumber(stack.quantity)}</span>
        </span>
        <strong>{name}</strong>
        {stack.locked && (
          <span className="item-card-lock" title="Locked stack" aria-label="Locked stack">
            <Lock size={14} aria-hidden="true" />
          </span>
        )}
      </button>
    </ItemTooltip>
  );
}
