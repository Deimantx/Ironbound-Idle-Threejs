import type { ActiveEquipmentSlot } from '../../game/equipmentSlots';
import type { ScreenId } from '../../game/types';

import gold from '../../Assets/Art/Items/Currency/gold.png';

import rawWolfMeat from '../../Assets/Art/Items/Materials/raw-wolf-meat.png';
import tornCloth from '../../Assets/Art/Items/Materials/torn-cloth.png';
import goblinScrap from '../../Assets/Art/Items/Materials/goblin-scrap.png';
import redknifeToken from '../../Assets/Art/Items/Materials/redknife-token.png';
import frayedCloth from '../../Assets/Art/Items/Materials/frayed-cloth.png';
import traceOfNature from '../../Assets/Art/Items/Materials/trace-of-nature.png';
import blackStone from '../../Assets/Art/Items/Materials/black-stone.png';
import leatherScraps from '../../Assets/Art/Items/Materials/leather-scraps.png';
import ironMetalScraps from '../../Assets/Art/Items/Materials/iron-metal-scraps.png';
import wolfPelt from '../../Assets/Art/Items/Materials/wolf-pelt.png';
import vialOfWolfBlood from '../../Assets/Art/Items/Materials/vial-of-wolf-blood.png';
import ironBar from '../../Assets/Art/Items/Materials/iron-bar.png';
import steelBar from '../../Assets/Art/Items/Materials/steel-bar.png';

import magicCrystalBox from '../../Assets/Art/Items/Drops/magic-crystal-box.png';
import smallCoinPouch from '../../Assets/Art/Items/Drops/small-coin-pouch.png';
import stalkersClaw from '../../Assets/Art/Items/Drops/stalkers-claw.png';

import lookoutsSapphireRing from '../../Assets/Art/Items/Equipment/lookouts-sapphire-ring.png';
import redknifeCape from '../../Assets/Art/Items/Equipment/redknife-cape.png';
import redknifeHuntingBow from '../../Assets/Art/Items/Equipment/redknife-hunting-bow.png';
import redknifeReinforcedGreatsword from '../../Assets/Art/Items/Equipment/redknife-reinforced-greatsword.png';
import pristineWolfPelt from '../../Assets/Art/Items/Equipment/pristine-wolf-pelt.png';
import ironSword from '../../Assets/Art/Items/Equipment/iron-sword.png';
import steelSword from '../../Assets/Art/Items/Equipment/steel-sword.png';
import ironHelmet from '../../Assets/Art/Items/Equipment/iron-helmet.png';
import steelHelmet from '../../Assets/Art/Items/Equipment/steel-helmet.png';
import ironArmor from '../../Assets/Art/Items/Equipment/iron-armor.png';
import steelArmor from '../../Assets/Art/Items/Equipment/steel-armor.png';
import ironShield from '../../Assets/Art/Items/Equipment/iron-shield.png';
import steelShield from '../../Assets/Art/Items/Equipment/steel-shield.png';

import roughGem from '../../Assets/Art/Items/Resources/rough-gem.png';
import stoneOre from '../../Assets/Art/Items/Resources/stone-ore.png';
import ironOre from '../../Assets/Art/Items/Resources/iron-ore.png';
import coal from '../../Assets/Art/Items/Resources/coal.png';

import wornPickaxe from '../../Assets/Art/Items/Tools/worn-pickaxe.png';
import ironPickaxe from '../../Assets/Art/Items/Tools/iron-pickaxe.png';
import steelPickaxe from '../../Assets/Art/Items/Tools/steel-pickaxe.png';
import ironSmithingHammer from '../../Assets/Art/Items/Tools/iron-smithing-hammer.png';
import steelSmithingHammer from '../../Assets/Art/Items/Tools/steel-smithing-hammer.png';

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

export type ArtVariant =
  | 'item-small'
  | 'item-tile'
  | 'item-tooltip'
  | 'item-inventory'
  | 'item-collection'
  | 'item-detail'
  | 'item-row'
  | 'item-compact'
  | 'item-equipment'
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

const collectionOnly = (scale: number): Partial<Record<ArtVariant, ArtTransform>> => ({
  'item-collection': { scale },
});

export type ArtSource = string;

export const GOLD_ART = gold;

export const ITEM_ART: Record<string, ArtAsset> = {
  'raw-wolf-meat': itemArt(rawWolfMeat, {}, collectionOnly(0.9)),
  'torn-cloth': itemArt(tornCloth, {}, collectionOnly(0.86)),
  'goblin-scrap': itemArt(goblinScrap),
  'redknife-token': itemArt(redknifeToken, {}, {
    'item-inventory': { scale: 0.9 },
    'item-collection': { scale: 0.84 },
    'item-detail': { scale: 0.86 },
  }),
  'frayed-cloth': itemArt(frayedCloth, {}, collectionOnly(0.84)),
  'lookouts-sapphire-ring': itemArt(lookoutsSapphireRing, {}, collectionOnly(0.86)),
  'magic-crystal-box': itemArt(magicCrystalBox),
  'trace-of-nature': itemArt(traceOfNature),
  'redknife-hunting-bow': itemArt(redknifeHuntingBow, { scale: 0.82 }),
  'small-coin-pouch': itemArt(smallCoinPouch),
  'black-stone': itemArt(blackStone, {}, collectionOnly(0.9)),
  'stalkers-claw': itemArt(stalkersClaw),
  'leather-scraps': itemArt(leatherScraps, {}, collectionOnly(0.86)),
  'iron-metal-scraps': itemArt(ironMetalScraps, {}, collectionOnly(0.86)),
  'redknife-reinforced-greatsword': itemArt(redknifeReinforcedGreatsword, { scale: 0.8 }, collectionOnly(0.9)),
  'redknife-cape': itemArt(redknifeCape, {}, collectionOnly(0.84)),
  'wolf-pelt': itemArt(wolfPelt, {}, collectionOnly(0.88)),
  'vial-of-wolf-blood': itemArt(vialOfWolfBlood),
  'pristine-wolf-pelt': itemArt(pristineWolfPelt, {}, collectionOnly(0.9)),
  'rough-gem': itemArt(roughGem, {}, {
    ...collectionOnly(0.88),
    'item-detail': { scale: 0.86 },
  }),
  'stone-ore': itemArt(stoneOre, {}, collectionOnly(0.84)),
  // The source files are named for the opposite presentation: the compact vein
  // chunk is the inventory resource icon, while the broad ore pile is the node art.
  'iron-ore': itemArt(ironVein, {}, collectionOnly(0.88)),
  coal: itemArt(coal),
  'worn-pickaxe': itemArt(wornPickaxe, { scale: 0.9 }),
  'iron-pickaxe': itemArt(ironPickaxe, { scale: 0.86 }),
  'steel-pickaxe': itemArt(steelPickaxe, { scale: 0.84 }),
  'iron-smithing-hammer': itemArt(ironSmithingHammer, { scale: 0.86 }, collectionOnly(0.88)),
  'steel-smithing-hammer': itemArt(steelSmithingHammer, { scale: 0.9 }),
  'iron-bar': itemArt(ironBar, {}, collectionOnly(0.88)),
  'steel-bar': itemArt(steelBar, {}, collectionOnly(0.88)),
  'iron-sword': itemArt(ironSword, { scale: 0.92 }),
  'steel-sword': itemArt(steelSword, { scale: 0.86 }),
  'iron-helmet': itemArt(ironHelmet),
  'steel-helmet': itemArt(steelHelmet, {}, collectionOnly(0.9)),
  'iron-armor': itemArt(ironArmor, { scale: 0.82 }),
  'steel-armor': itemArt(steelArmor, { scale: 0.82 }, collectionOnly(0.9)),
  'iron-shield': itemArt(ironShield, { scale: 0.82 }),
  'steel-shield': itemArt(steelShield, { scale: 0.82 }, collectionOnly(0.86)),
};

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
