import { itemById } from '../../content/items';
import type { InventoryStack } from '../types';

export interface InventoryResult {
  inventory: InventoryStack[];
  added: number;
  rejected: number;
}
export const occupiedSlots = (inventory: InventoryStack[]): number =>
  inventory.filter((stack) => stack.quantity > 0).length;

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
