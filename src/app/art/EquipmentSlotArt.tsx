import type { ActiveEquipmentSlot } from '../../game/equipmentSlots';
import { EQUIPMENT_SLOT_ART } from './artRegistry';
import { ArtImage } from './ArtImage';

export function EquipmentSlotArt({ slot }: { slot: ActiveEquipmentSlot }) {
  const source = EQUIPMENT_SLOT_ART[slot];
  return <ArtImage className="equipment-slot-art" src={source} alt="" aria-hidden="true" />;
}
