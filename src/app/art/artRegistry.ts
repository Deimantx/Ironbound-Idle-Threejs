import type { ActiveEquipmentSlot } from '../../game/equipmentSlots';
import type { ScreenId } from '../../game/types';

import stoneOutcrop from '../../Assets/Art/Mining/Nodes/stone-outcrop.png';
import ironVein from '../../Assets/Art/Mining/Nodes/iron-vein.png';
import coalSeam from '../../Assets/Art/Mining/Nodes/coal-seam.png';

import amuletSlot from '../../Assets/Art/UI/EquipmentSlots/amulet.png';
import armorSlot from '../../Assets/Art/UI/EquipmentSlots/armor.png';
import bootsSlot from '../../Assets/Art/UI/EquipmentSlots/boots.png';
import capeSlot from '../../Assets/Art/UI/EquipmentSlots/cape.png';
import glovesSlot from '../../Assets/Art/UI/EquipmentSlots/gloves.png';
import headSlot from '../../Assets/Art/UI/EquipmentSlots/head.png';
import offhandSlot from '../../Assets/Art/UI/EquipmentSlots/offhand.png';
import ringSlot from '../../Assets/Art/UI/EquipmentSlots/ring.png';
import toolSlot from '../../Assets/Art/UI/EquipmentSlots/tool.png';
import weaponSlot from '../../Assets/Art/UI/EquipmentSlots/weapon.png';

import collectionNavigation from '../../Assets/Art/UI/Navigation/collection.png';
import combatNavigation from '../../Assets/Art/UI/Navigation/combat.png';
import equipmentNavigation from '../../Assets/Art/UI/Navigation/equipment.png';
import homeNavigation from '../../Assets/Art/UI/Navigation/home.png';
import inventoryNavigation from '../../Assets/Art/UI/Navigation/inventory.png';
import miningNavigation from '../../Assets/Art/UI/Navigation/mining.png';
import smithingNavigation from '../../Assets/Art/UI/Navigation/smithing.png';

import forge from '../../Assets/Art/Smithing/Facilities/forge.png';
import anvil from '../../Assets/Art/Smithing/Facilities/anvil.png';

import tauraque from '../../Assets/Art/World/Regions/tauraque.png';
import alderwatch from '../../Assets/Art/World/SubRegions/alderwatch.png';
import brackenmoor from '../../Assets/Art/World/SubRegions/brackenmoor.png';
import crowmereHills from '../../Assets/Art/World/SubRegions/crowmere-hills.png';
import greymossWoods from '../../Assets/Art/World/SubRegions/greymoss-woods.png';
import lornwickVale from '../../Assets/Art/World/SubRegions/lornwick-vale.png';
import redwaterBasin from '../../Assets/Art/World/SubRegions/redwater-basin.png';
import veyranReach from '../../Assets/Art/World/SubRegions/veyran-reach.png';
import whitecliffCoast from '../../Assets/Art/World/SubRegions/whitecliff-coast.png';
import brambletoothCamp from '../../Assets/Art/World/Areas/brambletooth-camp.png';
import greyfangPastures from '../../Assets/Art/World/Areas/greyfang-pastures.png';
import redknifeRoadCamp from '../../Assets/Art/World/Areas/redknife-road-camp.png';

export type ArtSource = string;

export { GOLD_ART, ITEM_ART } from '../items/itemArtRegistry';
export { ENEMY_ART } from './enemyArtRegistry';

export const MINING_NODE_ART: Record<string, ArtSource> = {
  'stone-outcrop': stoneOutcrop,
  'iron-vein': ironVein,
  'coal-seam': coalSeam,
};

export const EQUIPMENT_SLOT_ART: Record<ActiveEquipmentSlot, ArtSource> = {
  head: headSlot,
  armor: armorSlot,
  gloves: glovesSlot,
  boots: bootsSlot,
  weapon: weaponSlot,
  offhand: offhandSlot,
  amulet: amuletSlot,
  ring: ringSlot,
  cape: capeSlot,
  tool: toolSlot,
};

export const NAVIGATION_ART: Partial<Record<ScreenId, ArtSource>> = {
  home: homeNavigation,
  combat: combatNavigation,
  inventory: inventoryNavigation,
  equipment: equipmentNavigation,
  collection: collectionNavigation,
  mining: miningNavigation,
  smithing: smithingNavigation,
};

export const REGION_ART: Record<string, ArtSource> = { tauraque };

export const SUB_REGION_ART: Record<string, ArtSource> = {
  'lornwick-vale': lornwickVale,
  'greymoss-woods': greymossWoods,
  'whitecliff-coast': whitecliffCoast,
  'redwater-basin': redwaterBasin,
  brackenmoor,
  'crowmere-hills': crowmereHills,
  alderwatch,
  'veyran-reach': veyranReach,
};

export const AREA_ART: Record<string, ArtSource> = {
  'redknife-road-camp': redknifeRoadCamp,
  'greyfang-pastures': greyfangPastures,
  'brambletooth-camp': brambletoothCamp,
};

export const SMITHING_FACILITY_ART: Record<'forge' | 'anvil', ArtSource> = {
  forge,
  anvil,
};
