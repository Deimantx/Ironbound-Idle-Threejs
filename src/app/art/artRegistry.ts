import type { ActiveEquipmentSlot } from '../../game/equipmentSlots';
import type { ScreenId } from '../../game/types';

import ironOre from '../../Assets/Art/Items/Resources/iron-ore.png';

import brambletoothBoarhandler from '../../Assets/Art/Monsters/brambletooth-boarhandler.png';
import brambletoothScavenger from '../../Assets/Art/Monsters/brambletooth-scavenger.png';
import brambletoothSpearman from '../../Assets/Art/Monsters/brambletooth-spearman.png';
import brambletoothTrapper from '../../Assets/Art/Monsters/brambletooth-trapper.png';
import greyfangAlpha from '../../Assets/Art/Monsters/greyfang-alpha.png';
import greyfangRavager from '../../Assets/Art/Monsters/greyfang-ravager.png';
import greyfangStalker from '../../Assets/Art/Monsters/greyfang-stalker.png';
import greyfangWolf from '../../Assets/Art/Monsters/greyfang-wolf.png';
import redknifeBowhand from '../../Assets/Art/Monsters/redknife-bowhand.png';
import redknifeBrigand from '../../Assets/Art/Monsters/redknife-brigand.png';
import redknifeEnforcer from '../../Assets/Art/Monsters/redknife-enforcer.png';
import redknifeLookout from '../../Assets/Art/Monsters/redknife-lookout.png';

import stoneOutcrop from '../../Assets/Art/Mining/Nodes/stone-outcrop.png';
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

export type ArtVariant =
  | 'equipment-slot'
  | 'enemy-roster'
  | 'enemy-target'
  | 'enemy-preview'
  | 'enemy-detail'
  | 'enemy-arena';

export interface ArtTransform {
  /** Visual scale inside its viewport. */
  scale?: number;
  /** Translation in percentage points inside the viewport. */
  x?: number;
  y?: number;
  objectPosition?: string;
}

export interface ArtAsset {
  src: string;
  /** Source-specific correction applied before the presentation context. */
  base?: ArtTransform;
  /** Optional correction for a particular presentation context. */
  variants?: Partial<Record<ArtVariant, ArtTransform>>;
}

const itemArt = (
  src: string,
  base: ArtTransform = {},
  variants: Partial<Record<ArtVariant, ArtTransform>> = {},
): ArtAsset => ({ src, base, variants });

export type ArtSource = string;

export { GOLD_ART, ITEM_ART } from '../items/itemArtRegistry';

export const ENEMY_ART: Record<string, ArtAsset> = {
  'brambletooth-boarhandler': itemArt(brambletoothBoarhandler, { scale: 0.78, y: -1 }),
  'brambletooth-scavenger': itemArt(brambletoothScavenger, { scale: 0.8 }),
  'brambletooth-spearman': itemArt(brambletoothSpearman, { scale: 0.78, y: -1 }),
  'brambletooth-trapper': itemArt(brambletoothTrapper, { scale: 0.78, y: -1 }),
  'greyfang-alpha': itemArt(greyfangAlpha, { scale: 0.8, y: -1 }),
  'greyfang-ravager': itemArt(greyfangRavager, { scale: 0.78, y: -1 }),
  'greyfang-stalker': itemArt(greyfangStalker, { scale: 0.82 }),
  'greyfang-wolf': itemArt(greyfangWolf, { scale: 0.78, y: -1 }),
  'redknife-bowhand': itemArt(redknifeBowhand, { scale: 0.78, y: -1 }),
  'redknife-brigand': itemArt(redknifeBrigand, { scale: 0.78, y: -1 }),
  'redknife-enforcer': itemArt(redknifeEnforcer, { scale: 0.76, y: -1 }),
  'redknife-lookout': itemArt(redknifeLookout, { scale: 0.8, y: -1 }),
};

export const MINING_NODE_ART: Record<string, ArtSource> = {
  'stone-outcrop': stoneOutcrop,
  'iron-vein': ironOre,
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
