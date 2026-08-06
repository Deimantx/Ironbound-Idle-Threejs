import {
  DEFAULT_INVENTORY_VIEW_PREFERENCES,
  type InventoryViewPreferences,
  sanitizeInventoryViewPreferences,
} from './inventoryOrderingPreferences';

export const INVENTORY_VIEW_STORAGE_KEY = 'ironbound-idle-inventory-view';
export const INVENTORY_PREFERENCES_RESET_EVENT = 'ironbound:inventory-preferences-reset';

export const getInventoryViewStorageKey = (profileId: string): string =>
  `${INVENTORY_VIEW_STORAGE_KEY}:${profileId}`;

export const loadInventoryViewPreferences = (profileId: string): InventoryViewPreferences => {
  if (typeof window === 'undefined') return { ...DEFAULT_INVENTORY_VIEW_PREFERENCES };
  try {
    const raw = window.localStorage.getItem(getInventoryViewStorageKey(profileId));
    return sanitizeInventoryViewPreferences(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_INVENTORY_VIEW_PREFERENCES };
  }
};

export const saveInventoryViewPreferences = (
  profileId: string,
  preferences: InventoryViewPreferences,
): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(getInventoryViewStorageKey(profileId), JSON.stringify(preferences));
  } catch {
    // Storage can be unavailable or full; Inventory remains usable in memory.
  }
};

export const resetInventoryViewPreferences = (profileId: string): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(getInventoryViewStorageKey(profileId));
  window.dispatchEvent(
    new CustomEvent(INVENTORY_PREFERENCES_RESET_EVENT, { detail: { profileId } }),
  );
};
