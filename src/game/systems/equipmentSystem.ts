import { itemById } from '../../content/items';
import { GAME_CONFIG } from '../../config/gameConfig';
import { getDerivedStats } from '../formulas/statFormulas';
import { addItem, removeItem } from './inventorySystem';
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
  const removed = removeItem(state.inventory, itemId, 1);
  if (removed.rejected) return { state, ok: false, message: 'That item is not in your inventory.' };
  const withDisplaced = displaced
    ? addItem(removed.inventory, displaced, 1, GAME_CONFIG.inventorySlots)
    : { inventory: removed.inventory, rejected: 0 };
  if (withDisplaced.rejected)
    return { state, ok: false, message: 'You need an inventory slot for the displaced equipment.' };
  const nextEquipment = { ...state.equipment, [item.slot]: itemId };
  const nextState = {
    ...state,
    inventory: withDisplaced.inventory,
    equipment: nextEquipment,
  };
  const maxHealth = getDerivedStats(nextState).maxHealth;
  return {
    state: {
      ...nextState,
      player: { ...nextState.player, currentHp: Math.min(nextState.player.currentHp, maxHealth) },
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
  const nextState = { ...state, inventory: result.inventory, equipment: nextEquipment };
  const maxHealth = getDerivedStats(nextState).maxHealth;
  return {
    state: {
      ...nextState,
      player: { ...nextState.player, currentHp: Math.min(nextState.player.currentHp, maxHealth) },
    },
    ok: true,
    message: 'Equipment returned to inventory.',
  };
};
