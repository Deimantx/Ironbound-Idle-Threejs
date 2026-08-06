import type { ItemCategory, ItemDefinition, InventoryStack } from '../game/types';

export type InventoryFilter = 'all' | 'materials' | 'equipment' | 'drops' | 'currency';
export type InventoryDisplayGroup = Exclude<InventoryFilter, 'all'>;

export const INVENTORY_FILTERS: Array<{ id: InventoryFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'materials', label: 'Materials' },
  { id: 'equipment', label: 'Equipment' },
  { id: 'drops', label: 'Drops' },
  { id: 'currency', label: 'Currency' },
];

export const getInventoryDisplayGroup = (
  category: ItemCategory | undefined,
): InventoryDisplayGroup | null => {
  if (category === 'material' || category === 'bar') return 'materials';
  if (category === 'weapon' || category === 'armor' || category === 'shield' || category === 'tool')
    return 'equipment';
  if (category === 'drop') return 'drops';
  if (category === 'currency') return 'currency';
  return null;
};

export const getInventoryFilterLabel = (filter: InventoryFilter): string =>
  INVENTORY_FILTERS.find((option) => option.id === filter)?.label ?? 'All';

export const getInventoryResultLabel = (
  visibleCount: number,
  filter: InventoryFilter,
  rawQuery: string,
): string => {
  const query = rawQuery.trim();
  if (query) return `${visibleCount} results for "${query}"`;
  if (filter === 'all') return `${visibleCount} stacks`;
  return `${visibleCount} ${getInventoryFilterLabel(filter).toLowerCase()} stacks`;
};

export const getInventoryValueLabel = (value: string): string =>
  value.replace(/[-_]/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());

export const matchesInventorySearch = (
  item: ItemDefinition | undefined,
  rawQuery: string,
): boolean => {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return true;
  const searchableFields = [
    item?.name ?? 'Unknown item',
    item?.source ?? '',
    item?.slot ?? '',
    item?.tier ?? '',
    item?.category ?? '',
  ];
  return searchableFields.some((field) => field.toLowerCase().includes(query));
};

export const matchesInventoryFilter = (
  item: ItemDefinition | undefined,
  filter: InventoryFilter,
): boolean => filter === 'all' || getInventoryDisplayGroup(item?.category) === filter;

export const getVisibleInventoryStacks = (
  stacks: InventoryStack[],
  definitions: Record<string, ItemDefinition>,
  filter: InventoryFilter,
  query: string,
): InventoryStack[] =>
  stacks.filter(
    (stack) =>
      stack.quantity > 0 &&
      matchesInventoryFilter(definitions[stack.itemId], filter) &&
      matchesInventorySearch(definitions[stack.itemId], query),
  );

export const getInventoryGroupCounts = (
  stacks: InventoryStack[],
  definitions: Record<string, ItemDefinition>,
): Record<InventoryFilter, number> => {
  const counts: Record<InventoryFilter, number> = {
    all: 0,
    materials: 0,
    equipment: 0,
    drops: 0,
    currency: 0,
  };
  for (const stack of stacks) {
    if (stack.quantity <= 0) continue;
    counts.all += 1;
    const group = getInventoryDisplayGroup(definitions[stack.itemId]?.category);
    if (group) counts[group] += 1;
  }
  return counts;
};
