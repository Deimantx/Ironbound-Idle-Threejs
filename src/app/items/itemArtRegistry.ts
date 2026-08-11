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
import roughLeather from '../../Assets/Art/Items/Materials/rough-leather.png';
import wolfPelt from '../../Assets/Art/Items/Materials/wolf-pelt.png';
import wolfFang from '../../Assets/Art/Items/Materials/wolf-fang.png';
import vialOfWolfBlood from '../../Assets/Art/Items/Materials/vial-of-wolf-blood.png';
import ironBar from '../../Assets/Art/Items/Materials/iron-bar.png';
import steelBar from '../../Assets/Art/Items/Materials/steel-bar.png';

import magicCrystalBox from '../../Assets/Art/Items/Drops/magic-crystal-box.png';
import smallCoinPouch from '../../Assets/Art/Items/Drops/small-coin-pouch.png';
import stalkersClaw from '../../Assets/Art/Items/Drops/stalkers-claw.png';
import greyfangTrophy from '../../Assets/Art/Items/Drops/greyfang-trophy.png';
import ravagerFang from '../../Assets/Art/Items/Drops/ravager-fang.png';

import lookoutsSapphireRing from '../../Assets/Art/Items/Equipment/lookouts-sapphire-ring.png';
import redknifeCape from '../../Assets/Art/Items/Equipment/redknife-cape.png';
import redknifeHuntingBow from '../../Assets/Art/Items/Equipment/redknife-hunting-bow.png';
import redknifeReinforcedGreatsword from '../../Assets/Art/Items/Equipment/redknife-reinforced-greatsword.png';
import pristineWolfPelt from '../../Assets/Art/Items/Equipment/pristine-wolf-pelt.png';
import boarhandlersHarness from '../../Assets/Art/Items/Equipment/boarhandlers-harness.png';
import jaggedGoblinSpear from '../../Assets/Art/Items/Equipment/jagged-goblin-spear.png';
import scavengersDagger from '../../Assets/Art/Items/Equipment/scavengers-dagger.png';
import trappersKnife from '../../Assets/Art/Items/Equipment/trappers-knife.png';
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
import coal from '../../Assets/Art/Items/Resources/coal.png';

import ironVein from '../../Assets/Art/Mining/Nodes/iron-vein.png';

import wornPickaxe from '../../Assets/Art/Items/Tools/worn-pickaxe.png';
import ironPickaxe from '../../Assets/Art/Items/Tools/iron-pickaxe.png';
import steelPickaxe from '../../Assets/Art/Items/Tools/steel-pickaxe.png';
import ironSmithingHammer from '../../Assets/Art/Items/Tools/iron-smithing-hammer.png';
import steelSmithingHammer from '../../Assets/Art/Items/Tools/steel-smithing-hammer.png';

/** The only geometry a gameplay item may own. Screens select a viewport size only. */
export interface ItemArtProfile {
  src: string;
  scale?: number;
  x?: number;
  y?: number;
  objectPosition?: string;
}

/** Central physical viewports shared by every item-bearing surface. */
export const ITEM_ARTWORK_SIZES = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 52,
  tile: 72,
} as const;

export type ItemArtworkSize = keyof typeof ITEM_ARTWORK_SIZES;

const itemArt = (src: string, profile: Omit<ItemArtProfile, 'src'> = {}): ItemArtProfile => ({
  src,
  ...profile,
});

/**
 * Canonical item artwork registry.
 *
 * Every entry is intentionally flat: one source image and one normalized pose.
 * Future gameplay item UI must render through ItemArtwork rather than reading this
 * registry or an image source directly.
 */
export const ITEM_ART: Record<string, ItemArtProfile> = {
  'raw-wolf-meat': itemArt(rawWolfMeat, { scale: 0.94 }),
  'torn-cloth': itemArt(tornCloth, { scale: 0.94 }),
  'goblin-scrap': itemArt(goblinScrap, { scale: 0.94 }),
  'redknife-token': itemArt(redknifeToken, { scale: 0.705, y: -15 }),
  'frayed-cloth': itemArt(frayedCloth, { scale: 0.818 }),
  'lookouts-sapphire-ring': itemArt(lookoutsSapphireRing, { scale: 0.94 }),
  'magic-crystal-box': itemArt(magicCrystalBox, { scale: 0.94 }),
  'trace-of-nature': itemArt(traceOfNature, { scale: 0.94 }),
  'redknife-hunting-bow': itemArt(redknifeHuntingBow, { scale: 0.771 }),
  'small-coin-pouch': itemArt(smallCoinPouch, { scale: 0.94 }),
  'black-stone': itemArt(blackStone, { scale: 0.94 }),
  'stalkers-claw': itemArt(stalkersClaw, { scale: 0.94 }),
  'leather-scraps': itemArt(leatherScraps, { scale: 0.94 }),
  'iron-metal-scraps': itemArt(ironMetalScraps, { scale: 0.94 }),
  'rough-leather': itemArt(roughLeather, { scale: 0.94 }),
  'wolf-fang': itemArt(wolfFang, { scale: 0.94 }),
  'greyfang-trophy': itemArt(greyfangTrophy, { scale: 0.94 }),
  'ravager-fang': itemArt(ravagerFang, { scale: 0.94 }),
  'boarhandlers-harness': itemArt(boarhandlersHarness, { scale: 0.94 }),
  'jagged-goblin-spear': itemArt(jaggedGoblinSpear, { scale: 0.94 }),
  'scavengers-dagger': itemArt(scavengersDagger, { scale: 0.94 }),
  'trappers-knife': itemArt(trappersKnife, { scale: 0.94 }),
  'redknife-reinforced-greatsword': itemArt(redknifeReinforcedGreatsword, { scale: 0.752 }),
  'redknife-cape': itemArt(redknifeCape, { scale: 0.94 }),
  'wolf-pelt': itemArt(wolfPelt, { scale: 0.94 }),
  'vial-of-wolf-blood': itemArt(vialOfWolfBlood, { scale: 0.94 }),
  'pristine-wolf-pelt': itemArt(pristineWolfPelt, { scale: 0.94 }),
  'rough-gem': itemArt(roughGem, { scale: 0.94 }),
  'stone-ore': itemArt(stoneOre, { scale: 0.94 }),
  // The source files are named for the opposite presentation: the compact vein
  // chunk is the inventory resource icon, while the broad ore pile is node art.
  'iron-ore': itemArt(ironVein, { scale: 0.94 }),
  coal: itemArt(coal, { scale: 0.94 }),
  'worn-pickaxe': itemArt(wornPickaxe, { scale: 0.846 }),
  // Tool source files use the opposite material presentation; item IDs remain stable.
  'iron-pickaxe': itemArt(steelPickaxe, { scale: 0.79 }),
  'steel-pickaxe': itemArt(ironPickaxe, { scale: 0.808 }),
  'iron-smithing-hammer': itemArt(steelSmithingHammer, { scale: 0.846 }),
  'steel-smithing-hammer': itemArt(ironSmithingHammer, { scale: 0.808 }),
  'iron-bar': itemArt(ironBar, { scale: 0.94 }),
  'steel-bar': itemArt(steelBar, { scale: 0.94 }),
  'iron-sword': itemArt(ironSword, { scale: 0.865 }),
  'steel-sword': itemArt(steelSword, { scale: 0.808 }),
  'iron-helmet': itemArt(ironHelmet, { scale: 0.94 }),
  'steel-helmet': itemArt(steelHelmet, { scale: 0.94 }),
  'iron-armor': itemArt(ironArmor, { scale: 0.771 }),
  'steel-armor': itemArt(steelArmor, { scale: 0.771 }),
  'iron-shield': itemArt(ironShield, { scale: 0.771 }),
  'steel-shield': itemArt(steelShield, { scale: 0.771 }),
};

export const GOLD_ART = gold;
