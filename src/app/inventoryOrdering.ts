import type { InventoryStack, ItemDefinition } from '../game/types';
import { getInventoryDisplayGroup } from './inventoryView';

export type InventorySortMode = 'manual' | 'name' | 'quantity' | 'category' | 'rarity' | 'tier';

export type InventoryAutoSortMode = Exclude<InventorySortMode, 'manual'>;
export type InventorySortDirection = 'asc' | 'desc';
export type InventoryDropPosition = 'before' | 'after';

export const INVENTORY_SORT_MODES: Array<{ id: InventorySortMode; label: string }> = [
  { id: 'manual', label: 'Manual' },
  { id: 'name', label: 'Name' },
  { id: 'quantity', label: 'Quantity' },
  { id: 'category', label: 'Category' },
  { id: 'rarity', label: 'Rarity' },
  { id: 'tier', label: 'Tier' },
];

export const INVENTORY_AUTO_SORT_MODES: InventoryAutoSortMode[] = [
  'name',
  'quantity',
  'category',
  'rarity',
  'tier',
];

export const isInventorySortMode = (value: unknown): value is InventorySortMode =>
  typeof value === 'string' && INVENTORY_SORT_MODES.some((mode) => mode.id === value);

export const isInventoryAutoSortMode = (value: unknown): value is InventoryAutoSortMode =>
  typeof value === 'string' && INVENTORY_AUTO_SORT_MODES.includes(value as InventoryAutoSortMode);

export const isInventorySortDirection = (value: unknown): value is InventorySortDirection =>
  value === 'asc' || value === 'desc';

export const reconcileManualOrder = (manualOrder: string[], currentIds: string[]): string[] => {
  const currentIdSet = new Set(currentIds);
  const seen = new Set<string>();
  const next: string[] = [];

  for (const itemId of manualOrder) {
    if (currentIdSet.has(itemId) && !seen.has(itemId)) {
      seen.add(itemId);
      next.push(itemId);
    }
  }
  for (const itemId of currentIds) {
    if (!seen.has(itemId)) {
      seen.add(itemId);
      next.push(itemId);
    }
  }
  return next;
};

const compareText = (left: string, right: string): number =>
  left.localeCompare(right, undefined, { sensitivity: 'base' });

const categoryRank = (item: ItemDefinition | undefined): number => {
  const group = getInventoryDisplayGroup(item?.category);
  if (group === 'materials') return 0;
  if (group === 'equipment') return 1;
  if (group === 'drops') return 2;
  if (group === 'currency') return 3;
  return 4;
};

const categorySubtypeRank = (item: ItemDefinition | undefined): number => {
  if (!item) return 99;
  const order = ['material', 'bar', 'weapon', 'armor', 'shield', 'tool', 'drop', 'currency'];
  const rank = order.indexOf(item.category);
  return rank < 0 ? 99 : rank;
};

const rarityRank = (item: ItemDefinition | undefined): number => {
  if (!item) return 4;
  return ['common', 'uncommon', 'rare', 'epic'].indexOf(item.rarity);
};

const tierRank = (item: ItemDefinition | undefined): number => {
  if (!item) return 4;
  if (!item.tier) return 3;
  return ['bronze', 'iron', 'steel'].indexOf(item.tier);
};

const comparePrimary = (
  left: InventoryStack,
  right: InventoryStack,
  definitions: Record<string, ItemDefinition>,
  mode: InventoryAutoSortMode,
): number => {
  const leftItem = definitions[left.itemId];
  const rightItem = definitions[right.itemId];

  switch (mode) {
    case 'name':
      return compareText(leftItem?.name ?? 'Unknown item', rightItem?.name ?? 'Unknown item');
    case 'quantity':
      return left.quantity - right.quantity;
    case 'category':
      return categoryRank(leftItem) - categoryRank(rightItem);
    case 'rarity':
      return rarityRank(leftItem) - rarityRank(rightItem);
    case 'tier':
      return tierRank(leftItem) - tierRank(rightItem);
  }
};

export const sortInventoryStacks = (
  stacks: InventoryStack[],
  definitions: Record<string, ItemDefinition>,
  mode: InventorySortMode,
  direction: InventorySortDirection,
  manualOrder: string[],
): InventoryStack[] => {
  const currentIds = stacks.filter((stack) => stack.quantity > 0).map((stack) => stack.itemId);
  const reconciledOrder = reconcileManualOrder(manualOrder, currentIds);
  const manualRanks = new Map(reconciledOrder.map((itemId, index) => [itemId, index]));

  return [...stacks].sort((left, right) => {
    if (mode === 'manual') {
      return (
        (manualRanks.get(left.itemId) ?? Number.MAX_SAFE_INTEGER) -
        (manualRanks.get(right.itemId) ?? Number.MAX_SAFE_INTEGER)
      );
    }

    const primary = comparePrimary(left, right, definitions, mode);
    if (primary !== 0) {
      if (mode === 'tier') {
        const leftTier = tierRank(definitions[left.itemId]);
        const rightTier = tierRank(definitions[right.itemId]);
        const leftKnown = leftTier < 3;
        const rightKnown = rightTier < 3;
        if (leftKnown !== rightKnown) return leftKnown ? -1 : 1;
        if (!leftKnown) return leftTier - rightTier;
      }
      return direction === 'desc' ? -primary : primary;
    }

    const subtypeTie =
      mode === 'category'
        ? categorySubtypeRank(definitions[left.itemId]) -
          categorySubtypeRank(definitions[right.itemId])
        : 0;
    const leftName = definitions[left.itemId]?.name ?? 'Unknown item';
    const rightName = definitions[right.itemId]?.name ?? 'Unknown item';
    return subtypeTie || compareText(leftName, rightName) || compareText(left.itemId, right.itemId);
  });
};

export const reorderVisibleSubset = (
  fullOrder: string[],
  visibleIds: string[],
  draggedId: string,
  targetId: string,
  position: InventoryDropPosition,
): string[] => {
  const normalizedFullOrder = [...new Set(fullOrder)];
  const fullIdSet = new Set(normalizedFullOrder);
  const visibleOrder = visibleIds.filter(
    (itemId, index, ids) => fullIdSet.has(itemId) && ids.indexOf(itemId) === index,
  );
  if (
    draggedId === targetId ||
    !visibleOrder.includes(draggedId) ||
    !visibleOrder.includes(targetId)
  ) {
    return normalizedFullOrder;
  }

  const nextVisibleOrder = visibleOrder.filter((itemId) => itemId !== draggedId);
  const targetIndex = nextVisibleOrder.indexOf(targetId);
  nextVisibleOrder.splice(targetIndex + (position === 'after' ? 1 : 0), 0, draggedId);

  let visibleIndex = 0;
  return normalizedFullOrder.map((itemId) => {
    if (!visibleOrder.includes(itemId)) return itemId;
    return nextVisibleOrder[visibleIndex++];
  });
};
