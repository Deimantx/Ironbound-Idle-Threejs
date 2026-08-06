import type { EquipmentSlot } from './types';

export const COMBAT_EQUIPMENT_SLOTS = [
  'head',
  'armor',
  'gloves',
  'boots',
  'weapon',
  'offhand',
  'amulet',
  'ring',
  'cape',
] as const;
export type CombatEquipmentSlot = (typeof COMBAT_EQUIPMENT_SLOTS)[number];

export const PROFESSION_EQUIPMENT_SLOTS = ['tool'] as const;
export type ProfessionEquipmentSlot = (typeof PROFESSION_EQUIPMENT_SLOTS)[number];

export const ACTIVE_EQUIPMENT_SLOTS = [
  ...COMBAT_EQUIPMENT_SLOTS,
  ...PROFESSION_EQUIPMENT_SLOTS,
] as const;
export type ActiveEquipmentSlot = (typeof ACTIVE_EQUIPMENT_SLOTS)[number];

export const COMBAT_GEAR_MAIN_SLOTS = [
  'head',
  'armor',
  'gloves',
  'boots',
  'weapon',
  'offhand',
] as const;
export const ACCESSORY_EQUIPMENT_SLOTS = ['amulet', 'ring', 'cape'] as const;

export const EQUIPMENT_SLOT_LABELS: Record<EquipmentSlot, string> = {
  head: 'Helmet',
  armor: 'Armor',
  gloves: 'Gloves',
  boots: 'Boots',
  weapon: 'Weapon',
  offhand: 'Off-hand',
  amulet: 'Amulet',
  ring: 'Ring',
  cape: 'Cape',
  tool: 'Tool',
};

export const getEquipmentSlotLabel = (slot: EquipmentSlot | string): string =>
  EQUIPMENT_SLOT_LABELS[slot as EquipmentSlot] ??
  slot.replace(/[-_]/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
