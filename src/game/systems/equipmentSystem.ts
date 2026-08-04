import { itemById } from '../../content/items';
import { GAME_CONFIG } from '../../config/gameConfig';
import { addItem, canAddItem, removeItem } from './inventorySystem';
import type { EquipmentLoadout, EquipmentSlot, GameState } from '../types';

export interface EquipmentResult {
  state: GameState;
  ok: boolean;
  message: string;
}
export const equipItem = (state: GameState, itemId: string): EquipmentResult => {
  const item = itemById[itemId];
  if (!item?.slot) return { state, ok: false, message: 'That item cannot be equipped.' };
  const stack = state.inventory.find((entry) => entry.itemId === itemId);
  if (!stack) return { state, ok: false, message: 'That item is not in your inventory.' };
  const displaced = state.equipment[item.slot];
  if (
    displaced &&
    !canAddItem(
      state.inventory.filter((entry) => entry.itemId !== itemId),
      displaced,
      GAME_CONFIG.inventorySlots,
    )
  )
    return { state, ok: false, message: 'You need an inventory slot for the displaced equipment.' };
  const nextInventory = removeItem(state.inventory, itemId, 1).inventory;
  const withDisplaced = displaced
    ? addItem(nextInventory, displaced, 1, GAME_CONFIG.inventorySlots).inventory
    : nextInventory;
  return {
    state: {
      ...state,
      inventory: withDisplaced,
      equipment: { ...state.equipment, [item.slot]: itemId },
      player: { ...state.player, currentHp: Math.min(state.player.currentHp, 9999) },
    },
    ok: true,
    message: `${item.name} equipped.`,
  };
};

export const unequipItem = (state: GameState, slot: EquipmentSlot): EquipmentResult => {
  const itemId = state.equipment[slot];
  if (!itemId) return { state, ok: false, message: 'That slot is already empty.' };
  const result = addItem(state.inventory, itemId, 1, GAME_CONFIG.inventorySlots);
  if (result.rejected)
    return { state, ok: false, message: 'Make room in your inventory before unequipping.' };
  const nextEquipment: EquipmentLoadout = { ...state.equipment };
  delete nextEquipment[slot];
  return {
    state: { ...state, inventory: result.inventory, equipment: nextEquipment },
    ok: true,
    message: 'Equipment returned to inventory.',
  };
};
