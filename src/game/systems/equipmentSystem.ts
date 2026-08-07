import { itemById } from '../../content/items';
import { GAME_CONFIG } from '../../config/gameConfig';
import { getDerivedStats } from '../formulas/statFormulas';
import { getMiningToolDefinition } from '../../content/miningTools';
import { getSmithingHammerDefinition } from '../../content/smithingTools';
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
  const miningTool = item.slot === 'tool' ? getMiningToolDefinition(itemId) : null;
  if (miningTool && state.skills.mining.level < miningTool.requiredMiningLevel)
    return {
      state,
      ok: false,
      message: `Mining level ${miningTool.requiredMiningLevel} is required for ${item.name}.`,
    };
  const smithingHammer = item.slot === 'tool' ? getSmithingHammerDefinition(itemId) : null;
  if (smithingHammer && state.skills.smithing.level < smithingHammer.requiredSmithingLevel)
    return {
      state,
      ok: false,
      message: `Smithing level ${smithingHammer.requiredSmithingLevel} is required for ${item.name}.`,
    };
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

export const unequipItem = (
  state: GameState,
  slot: EquipmentSlot,
  inventoryCapacity: number = GAME_CONFIG.inventorySlots,
): EquipmentResult => {
  const itemId = state.equipment[slot];
  if (!itemId) return { state, ok: false, message: 'That slot is already empty.' };
  const result = addItem(state.inventory, itemId, 1, inventoryCapacity);
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
