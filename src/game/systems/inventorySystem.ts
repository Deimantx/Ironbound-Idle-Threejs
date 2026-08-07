import { itemById } from '../../content/items';
import type { InventoryStack } from '../types';

export interface InventoryResult {
  inventory: InventoryStack[];
  added: number;
  rejected: number;
}
export interface InventoryBundleEntry {
  itemId: string;
  quantity: number;
}
export const occupiedSlots = (inventory: InventoryStack[]): number =>
  inventory.filter((stack) => stack.quantity > 0).length;

export const hasDuplicateInventoryItemIds = (inventory: InventoryStack[]): boolean => {
  const ids = inventory.filter((stack) => stack.quantity > 0).map((stack) => stack.itemId);
  return new Set(ids).size !== ids.length;
};

export const addItem = (
  inventory: InventoryStack[],
  itemId: string,
  quantity: number,
  capacity: number,
): InventoryResult => {
  const amount = Math.max(0, Math.floor(quantity));
  if (amount === 0 || !itemById[itemId])
    return { inventory: [...inventory], added: 0, rejected: amount };
  const next = inventory.map((stack) => ({ ...stack }));
  const existing = next.find((stack) => stack.itemId === itemId);
  if (existing) {
    existing.quantity += amount;
    return { inventory: next, added: amount, rejected: 0 };
  }
  if (occupiedSlots(next) >= capacity) return { inventory: next, added: 0, rejected: amount };
  next.push({ itemId, quantity: amount, locked: false });
  return { inventory: next, added: amount, rejected: 0 };
};

export const removeItem = (
  inventory: InventoryStack[],
  itemId: string,
  quantity: number,
): InventoryResult => {
  const amount = Math.max(0, Math.floor(quantity));
  const next = inventory.map((stack) => ({ ...stack }));
  const stack = next.find((entry) => entry.itemId === itemId);
  if (!stack || stack.quantity < amount)
    return { inventory: inventory.map((entry) => ({ ...entry })), added: 0, rejected: amount };
  stack.quantity -= amount;
  return { inventory: next.filter((entry) => entry.quantity > 0), added: amount, rejected: 0 };
};

export const getItemQuantity = (inventory: InventoryStack[], itemId: string): number =>
  inventory.find((stack) => stack.itemId === itemId)?.quantity ?? 0;
export const canAddItem = (
  inventory: InventoryStack[],
  itemId: string,
  capacity: number,
): boolean =>
  Boolean(
    inventory.find((stack) => stack.itemId === itemId) || occupiedSlots(inventory) < capacity,
  );

export const canAddItemBundle = (
  inventory: InventoryStack[],
  bundle: InventoryBundleEntry[],
  capacity: number,
): boolean => {
  const occupied = new Set(
    inventory.filter((stack) => stack.quantity > 0).map((stack) => stack.itemId),
  );
  for (const entry of bundle) {
    const quantity = Math.max(0, Math.floor(entry.quantity));
    if (quantity === 0) continue;
    if (!itemById[entry.itemId]) return false;
    if (!occupied.has(entry.itemId)) {
      if (occupied.size >= capacity) return false;
      occupied.add(entry.itemId);
    }
  }
  return true;
};

export const addItemBundle = (
  inventory: InventoryStack[],
  bundle: InventoryBundleEntry[],
  capacity: number,
): { inventory: InventoryStack[]; rejected: boolean } => {
  if (!canAddItemBundle(inventory, bundle, capacity))
    return { inventory: inventory.map((stack) => ({ ...stack })), rejected: true };
  let next = inventory.map((stack) => ({ ...stack }));
  for (const entry of bundle) {
    const result = addItem(next, entry.itemId, entry.quantity, capacity);
    if (result.rejected > 0)
      return { inventory: inventory.map((stack) => ({ ...stack })), rejected: true };
    next = result.inventory;
  }
  return { inventory: next, rejected: false };
};
export const toggleItemLock = (inventory: InventoryStack[], itemId: string): InventoryStack[] =>
  inventory.map((stack) => (stack.itemId === itemId ? { ...stack, locked: !stack.locked } : stack));
export const destroyItem = (
  inventory: InventoryStack[],
  itemId: string,
  quantity: number,
): InventoryResult => {
  const stack = inventory.find((entry) => entry.itemId === itemId);
  if (stack?.locked)
    return { inventory: inventory.map((entry) => ({ ...entry })), added: 0, rejected: quantity };
  return removeItem(inventory, itemId, quantity);
};
