import type { EquipmentSlot } from './types';

export const ACTIVE_EQUIPMENT_SLOTS = ['head', 'armor', 'weapon', 'shield', 'tool'] as const;
export type ActiveEquipmentSlot = (typeof ACTIVE_EQUIPMENT_SLOTS)[number];

export const FUTURE_EQUIPMENT_SLOTS = ['amulet', 'ring', 'cape'] as const;

export const COMBAT_EQUIPMENT_SLOTS = ['weapon', 'head', 'armor', 'shield'] as const;

export const EQUIPMENT_SLOT_LABELS: Record<EquipmentSlot, string> = {
  head: 'Helmet',
  armor: 'Armor',
  weapon: 'Weapon',
  shield: 'Shield',
  tool: 'Tool',
  amulet: 'Amulet',
  ring: 'Ring',
  cape: 'Cape',
};

export const getEquipmentSlotLabel = (slot: EquipmentSlot | string): string =>
  EQUIPMENT_SLOT_LABELS[slot as EquipmentSlot] ??
  slot.replace(/[-_]/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
