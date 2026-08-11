import type { ItemDefinition, WeaponSpecial } from '../game/types';

const material = (id: string, name: string, description: string, source: string): ItemDefinition => ({
  id,
  name,
  category: 'material',
  description,
  source,
  stackable: true,
  rarity: 'common',
  presentation: { iconKey: 'ore', visualCategory: 'material' },
});

const bar = (id: string, name: string, description: string, source: string): ItemDefinition => ({
  id,
  name,
  category: 'bar',
  description,
  source,
  stackable: true,
  rarity: 'common',
  presentation: { iconKey: 'bar', visualCategory: 'metal' },
});

const gear = (
  id: string,
  name: string,
  slot: ItemDefinition['slot'],
  bonuses: NonNullable<ItemDefinition['bonuses']>,
  specialAttack?: WeaponSpecial,
): ItemDefinition => ({
  id,
  name,
  category: slot === 'weapon' ? 'weapon' : slot === 'tool' ? 'tool' : slot === 'offhand' ? 'shield' : 'armor',
  description: `Legacy Bronze ${slot} retained for old-save compatibility only.`,
  source: 'Legacy Smithing',
  stackable: true,
  rarity: 'common',
  presentation: {
    iconKey: slot === 'offhand' ? 'shield' : slot === 'tool' ? 'tool' : slot === 'weapon' ? 'sword' : 'armor',
    visualCategory: 'equipment',
  },
  slot,
  tier: 'bronze',
  bonuses,
  weaponHands: slot === 'weapon' ? 1 : undefined,
  specialAttack,
});

/** Historical definitions used only by save migrations and compatibility fixtures. */
export const LEGACY_ITEMS: ItemDefinition[] = [
  material('stone-fragment', 'Stone Fragment', 'Common chips shaken loose from worked rock.', 'Legacy Mining'),
  {
    ...material('sharpening-grit', 'Sharpening Grit', 'Abrasive mineral reserved for future tool work.', 'Legacy Mining'),
    rarity: 'uncommon',
  },
  material('copper-ore', 'Copper Ore', 'Warm orange ore from shallow veins.', 'Legacy Mining · Copper Vein'),
  material('tin-ore', 'Tin Ore', 'Soft grey ore used with copper.', 'Legacy Mining · Tin Vein'),
  material('mithril-ore', 'Mithril Ore', 'A preview mineral from deeper strata.', 'Legacy Mining · Mithril Deposit'),
  bar('bronze-bar', 'Bronze Bar', 'A reliable copper-tin alloy.', 'Legacy Smithing · Smelting'),
  gear('bronze-sword', 'Bronze Sword', 'weapon', { attack: 8, strength: 5, attackSpeed: 0 }, {
    id: 'focused-slash',
    name: 'Focused Slash',
    description: 'A controlled strike with increased damage and accuracy.',
    damageMultiplier: 1.6,
    accuracyMultiplier: 1.25,
  }),
  gear('bronze-helmet', 'Bronze Helm', 'head', { defence: 5, health: 2 }),
  gear('bronze-armor', 'Bronze Armor', 'armor', { defence: 16, health: 7 }),
  gear('bronze-shield', 'Bronze Buckler', 'offhand', { defence: 10, health: 3 }),
  gear('bronze-pickaxe', 'Bronze Pick', 'tool', {}),
];

export const legacyItemById = Object.fromEntries(LEGACY_ITEMS.map((item) => [item.id, item])) as Record<
  string,
  ItemDefinition
>;

export const RETIRED_PROFESSION_ITEM_IDS = new Set([
  ...LEGACY_ITEMS.map((item) => item.id),
  // Pre-equipment-schema Bronze armor aliases are still accepted by earlier migrations.
  'bronze-platebody',
  'bronze-platelegs',
]);
