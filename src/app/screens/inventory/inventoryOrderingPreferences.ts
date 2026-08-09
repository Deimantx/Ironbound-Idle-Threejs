import {
  isInventoryAutoSortMode,
  isInventorySortDirection,
  isInventorySortMode,
  type InventoryAutoSortMode,
  type InventorySortDirection,
  type InventorySortMode,
} from './inventoryOrdering';

export interface InventoryViewPreferences {
  version: 1;
  sortMode: InventorySortMode;
  sortDirection: InventorySortDirection;
  lastAutoSortMode: InventoryAutoSortMode;
  manualOrder: string[];
}

export const DEFAULT_INVENTORY_VIEW_PREFERENCES: InventoryViewPreferences = {
  version: 1,
  sortMode: 'category',
  sortDirection: 'asc',
  lastAutoSortMode: 'category',
  manualOrder: [],
};

const uniqueStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((entry): entry is string => typeof entry === 'string'))];
};

export const sanitizeInventoryViewPreferences = (value: unknown): InventoryViewPreferences => {
  if (!value || typeof value !== 'object' || (value as { version?: unknown }).version !== 1) {
    return { ...DEFAULT_INVENTORY_VIEW_PREFERENCES };
  }

  const candidate = value as Record<string, unknown>;
  return {
    version: 1,
    sortMode: isInventorySortMode(candidate.sortMode)
      ? candidate.sortMode
      : DEFAULT_INVENTORY_VIEW_PREFERENCES.sortMode,
    sortDirection: isInventorySortDirection(candidate.sortDirection)
      ? candidate.sortDirection
      : DEFAULT_INVENTORY_VIEW_PREFERENCES.sortDirection,
    lastAutoSortMode: isInventoryAutoSortMode(candidate.lastAutoSortMode)
      ? candidate.lastAutoSortMode
      : DEFAULT_INVENTORY_VIEW_PREFERENCES.lastAutoSortMode,
    manualOrder: uniqueStringArray(candidate.manualOrder),
  };
};
