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
import ironOre from '../../Assets/Art/Items/Resources/iron-ore.png';
import coal from '../../Assets/Art/Items/Resources/coal.png';

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

/**
 * ITEM ART CALIBRATION: scale controls the source image's size inside the shared
 * viewport; x and y control its normalized translation. Edit these values here
 * once so every ItemArtwork surface receives the same calibration.
 */
export const ITEM_ART: Record<string, ItemArtProfile> = {
  // ---------------------------------------------------------------------------
  // MATERIALS
  // ---------------------------------------------------------------------------
  'raw-wolf-meat': itemArt(rawWolfMeat, { scale: 0.94, x: 0, y: 0 }),
  'torn-cloth': itemArt(tornCloth, { scale: 0.94, x: 0, y: 0 }),
  'goblin-scrap': itemArt(goblinScrap, { scale: 0.94, x: 0, y: 0 }),
  'redknife-token': itemArt(redknifeToken, { scale: 0.705, x: 0, y: -15 }),
  'frayed-cloth': itemArt(frayedCloth, { scale: 0.818, x: 0, y: 0 }),
  'trace-of-nature': itemArt(traceOfNature, { scale: 0.94, x: 0, y: 0 }),
  'black-stone': itemArt(blackStone, { scale: 0.94, x: 0, y: 0 }),
  'leather-scraps': itemArt(leatherScraps, { scale: 0.94, x: 0, y: 0 }),
  'iron-metal-scraps': itemArt(ironMetalScraps, { scale: 0.94, x: 0, y: 0 }),
  'rough-leather': itemArt(roughLeather, { scale: 0.94, x: 0, y: 0 }),
  'wolf-fang': itemArt(wolfFang, { scale: 0.94, x: 0, y: 0 }),
  'wolf-pelt': itemArt(wolfPelt, { scale: 0.94, x: 0, y: 0 }),
  'vial-of-wolf-blood': itemArt(vialOfWolfBlood, { scale: 0.94, x: 0, y: 0 }),
  'iron-bar': itemArt(ironBar, { scale: 0.94, x: 0, y: 0 }),
  'steel-bar': itemArt(steelBar, { scale: 0.94, x: 0, y: 0 }),

  // ---------------------------------------------------------------------------
  // COMBAT DROPS
  // ---------------------------------------------------------------------------
  'magic-crystal-box': itemArt(magicCrystalBox, { scale: 0.94, x: 0, y: 0 }),
  'small-coin-pouch': itemArt(smallCoinPouch, { scale: 0.94, x: 0, y: 0 }),
  'stalkers-claw': itemArt(stalkersClaw, { scale: 0.94, x: 0, y: 0 }),
  'greyfang-trophy': itemArt(greyfangTrophy, { scale: 0.94, x: 0, y: 0 }),
  'ravager-fang': itemArt(ravagerFang, { scale: 0.94, x: 0, y: 0 }),

  // ---------------------------------------------------------------------------
  // EQUIPMENT
  // ---------------------------------------------------------------------------
  'lookouts-sapphire-ring': itemArt(lookoutsSapphireRing, { scale: 0.94, x: 0, y: 0 }),
  'redknife-hunting-bow': itemArt(redknifeHuntingBow, { scale: 0.771, x: 0, y: 0 }),
  'boarhandlers-harness': itemArt(boarhandlersHarness, { scale: 0.94, x: 0, y: 0 }),
  'jagged-goblin-spear': itemArt(jaggedGoblinSpear, { scale: 0.94, x: 0, y: 0 }),
  'scavengers-dagger': itemArt(scavengersDagger, { scale: 0.94, x: 0, y: 0 }),
  'trappers-knife': itemArt(trappersKnife, { scale: 0.94, x: 0, y: 0 }),
  'redknife-reinforced-greatsword': itemArt(redknifeReinforcedGreatsword, { scale: 0.752, x: 0, y: 0 }),
  'redknife-cape': itemArt(redknifeCape, { scale: 0.94, x: 0, y: 0 }),
  'pristine-wolf-pelt': itemArt(pristineWolfPelt, { scale: 0.94, x: 0, y: 0 }),
  'iron-sword': itemArt(ironSword, { scale: 0.865, x: 0, y: 0 }),
  'steel-sword': itemArt(steelSword, { scale: 0.808, x: 0, y: 0 }),
  'iron-helmet': itemArt(ironHelmet, { scale: 0.94, x: 0, y: 0 }),
  'steel-helmet': itemArt(steelHelmet, { scale: 0.94, x: 0, y: 0 }),
  'iron-armor': itemArt(ironArmor, { scale: 0.771, x: 0, y: 0 }),
  'steel-armor': itemArt(steelArmor, { scale: 0.771, x: 0, y: 0 }),
  'iron-shield': itemArt(ironShield, { scale: 0.771, x: 0, y: 0 }),
  'steel-shield': itemArt(steelShield, { scale: 0.771, x: 0, y: 0 }),

  // ---------------------------------------------------------------------------
  // RESOURCES
  // ---------------------------------------------------------------------------
  'rough-gem': itemArt(roughGem, { scale: 0.94, x: 0, y: 0 }),
  'stone-ore': itemArt(stoneOre, { scale: 0.94, x: 0, y: 0 }),
  'iron-ore': itemArt(ironOre, { scale: 0.94, x: 0, y: 0 }),
  coal: itemArt(coal, { scale: 0.94, x: 0, y: 0 }),

  // ---------------------------------------------------------------------------
  // TOOLS
  // ---------------------------------------------------------------------------
  'worn-pickaxe': itemArt(wornPickaxe, { scale: 0.846, x: 0, y: 0 }),
  'iron-pickaxe': itemArt(ironPickaxe, { scale: 0.79, x: 0, y: 0 }),
  'steel-pickaxe': itemArt(steelPickaxe, { scale: 0.808, x: 0, y: 0 }),
  'iron-smithing-hammer': itemArt(ironSmithingHammer, { scale: 0.846, x: 0, y: 0 }),
  'steel-smithing-hammer': itemArt(steelSmithingHammer, { scale: 0.808, x: 0, y: 0 }),
};

export const GOLD_ART = gold;
