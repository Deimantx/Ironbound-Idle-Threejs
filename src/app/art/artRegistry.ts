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

import bronzePickaxe from '../../Assets/Art/Items/Tools/bronze-pickaxe.png';
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

export type ArtSource = string;

export const GOLD_ART = gold;

export const ITEM_ART: Record<string, ArtSource> = {
  'raw-wolf-meat': rawWolfMeat,
  'torn-cloth': tornCloth,
  'goblin-scrap': goblinScrap,
  'redknife-token': redknifeToken,
  'frayed-cloth': frayedCloth,
  'lookouts-sapphire-ring': lookoutsSapphireRing,
  'magic-crystal-box': magicCrystalBox,
  'trace-of-nature': traceOfNature,
  'redknife-hunting-bow': redknifeHuntingBow,
  'small-coin-pouch': smallCoinPouch,
  'black-stone': blackStone,
  'stalkers-claw': stalkersClaw,
  'leather-scraps': leatherScraps,
  'iron-metal-scraps': ironMetalScraps,
  'redknife-reinforced-greatsword': redknifeReinforcedGreatsword,
  'redknife-cape': redknifeCape,
  'wolf-pelt': wolfPelt,
  'vial-of-wolf-blood': vialOfWolfBlood,
  'pristine-wolf-pelt': pristineWolfPelt,
  'rough-gem': roughGem,
  'stone-ore': stoneOre,
  'iron-ore': ironOre,
  coal,
  'bronze-pickaxe': bronzePickaxe,
  'worn-pickaxe': wornPickaxe,
  'iron-pickaxe': ironPickaxe,
  'steel-pickaxe': steelPickaxe,
  'iron-smithing-hammer': ironSmithingHammer,
  'steel-smithing-hammer': steelSmithingHammer,
  'iron-bar': ironBar,
  'steel-bar': steelBar,
  'iron-sword': ironSword,
  'steel-sword': steelSword,
  'iron-helmet': ironHelmet,
  'steel-helmet': steelHelmet,
  'iron-armor': ironArmor,
  'steel-armor': steelArmor,
  'iron-shield': ironShield,
  'steel-shield': steelShield,
};

export const ENEMY_ART: Record<string, ArtSource> = {
  'brambletooth-boarhandler': brambletoothBoarhandler,
  'brambletooth-scavenger': brambletoothScavenger,
  'brambletooth-spearman': brambletoothSpearman,
  'brambletooth-trapper': brambletoothTrapper,
  'greyfang-alpha': greyfangAlpha,
  'greyfang-ravager': greyfangRavager,
  'greyfang-stalker': greyfangStalker,
  'greyfang-wolf': greyfangWolf,
  'redknife-bowhand': redknifeBowhand,
  'redknife-brigand': redknifeBrigand,
  'redknife-enforcer': redknifeEnforcer,
  'redknife-lookout': redknifeLookout,
};

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
