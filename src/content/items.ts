import type { ItemDefinition, WeaponSpecial } from '../game/types';

const material = (
  id: string,
  name: string,
  description: string,
  source: string,
): ItemDefinition => ({
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
  tier: ItemDefinition['tier'],
  bonuses: NonNullable<ItemDefinition['bonuses']>,
  level: string,
  specialAttack?: WeaponSpecial,
): ItemDefinition => ({
  id,
  name,
  category:
    slot === 'weapon'
      ? 'weapon'
      : slot === 'shield'
        ? 'shield'
        : slot === 'tool'
          ? 'tool'
          : 'armor',
  description: `${level} ${slot} forged for dependable field work.`,
  source: 'Smithing',
  stackable: true,
  rarity: tier === 'steel' ? 'rare' : tier === 'iron' ? 'uncommon' : 'common',
  presentation: {
    iconKey: slot === 'weapon' ? 'sword' : slot === 'shield' ? 'shield' : 'armor',
    visualCategory: 'equipment',
  },
  slot,
  tier,
  bonuses,
  specialAttack,
});

export const ITEMS: ItemDefinition[] = [
  material(
    'copper-ore',
    'Copper Ore',
    'Warm orange ore from shallow veins.',
    'Mining · Copper Vein',
  ),
  material('tin-ore', 'Tin Ore', 'Soft grey ore used with copper.', 'Mining · Tin Vein'),
  material('iron-ore', 'Iron Ore', 'Dense ore that takes a dark polish.', 'Mining · Iron Vein'),
  material('coal', 'Coal', 'Fuel for a hotter, cleaner forge.', 'Mining · Coal Seam'),
  material(
    'mithril-ore',
    'Mithril Ore',
    'A preview mineral from deeper strata.',
    'Mining · Mithril Deposit',
  ),
  bar('bronze-bar', 'Bronze Bar', 'A reliable copper-tin alloy.', 'Smithing · Smelting'),
  bar('iron-bar', 'Iron Bar', 'A strong foundation for practical gear.', 'Smithing · Smelting'),
  bar('steel-bar', 'Steel Bar', 'Coal-hardened iron for elite gear.', 'Smithing · Smelting'),
  gear(
    'bronze-sword',
    'Bronze Sword',
    'weapon',
    'bronze',
    { attack: 8, strength: 5, speed: 0 },
    'Bronze',
    {
      id: 'focused-slash',
      name: 'Focused Slash',
      description: 'A controlled strike with increased damage and accuracy.',
      damageMultiplier: 1.6,
      accuracyMultiplier: 1.25,
    },
    
  ),
  gear('bronze-helmet', 'Bronze Helm', 'head', 'bronze', { defence: 5, health: 2 }, 'Bronze'),
  gear('bronze-platebody', 'Bronze Cuirass', 'body', 'bronze', { defence: 9, health: 4 }, 'Bronze'),
  gear('bronze-platelegs', 'Bronze Greaves', 'legs', 'bronze', { defence: 7, health: 3 }, 'Bronze'),
  gear('bronze-shield', 'Bronze Buckler', 'shield', 'bronze', { defence: 10, health: 3 }, 'Bronze'),
  gear('bronze-pickaxe', 'Bronze Pick', 'tool', 'bronze', { speed: 0.1 }, 'Bronze'),
  gear(
    'iron-sword',
    'Iron Sword',
    'weapon',
    'iron',
    { attack: 18, strength: 12, speed: 0.05 },
    'Iron',
    {
      id: 'sundering-strike',
      name: 'Sundering Strike',
      description: 'A heavy blow that breaks through flat damage reduction.',
      damageMultiplier: 1.75,
      accuracyMultiplier: 1.15,
      ignoresFlatDamageReduction: true,
    },
    
  ),
  gear('iron-helmet', 'Iron Helm', 'head', 'iron', { defence: 12, health: 6 }, 'Iron'),
  gear('iron-platebody', 'Iron Cuirass', 'body', 'iron', { defence: 22, health: 10 }, 'Iron'),
  gear('iron-platelegs', 'Iron Greaves', 'legs', 'iron', { defence: 16, health: 8 }, 'Iron'),
  gear('iron-shield', 'Iron Bulwark', 'shield', 'iron', { defence: 24, health: 8 }, 'Iron'),
  gear('iron-pickaxe', 'Iron Pick', 'tool', 'iron', { speed: 0.2 }, 'Iron'),
  gear(
    'steel-sword',
    'Steel Sword',
    'weapon',
    'steel',
    { attack: 32, strength: 24, speed: 0.1 },
    'Steel',
    {
      id: 'executioners-cut',
      name: "Executioner's Cut",
      description: 'Deals greatly increased damage to wounded enemies.',
      damageMultiplier: 1.75,
      accuracyMultiplier: 1.1,
      executeThreshold: 0.35,
      executeDamageMultiplier: 2.25,
    },
    
  ),
  gear('steel-helmet', 'Steel Helm', 'head', 'steel', { defence: 21, health: 10 }, 'Steel'),
  gear('steel-platebody', 'Steel Cuirass', 'body', 'steel', { defence: 38, health: 18 }, 'Steel'),
  gear('steel-platelegs', 'Steel Greaves', 'legs', 'steel', { defence: 29, health: 14 }, 'Steel'),
  gear('steel-shield', 'Steel Bulwark', 'shield', 'steel', { defence: 42, health: 14 }, 'Steel'),
  gear('steel-pickaxe', 'Steel Pick', 'tool', 'steel', { speed: 0.3 }, 'Steel'),
  ...[
    ['rat-tail', 'Rat Tail', 'Training Grounds · Forest Rat'],
    ['tattered-hide', 'Tattered Hide', 'Training Grounds · Forest Rat'],
    ['goblin-scrap', 'Goblin Scrap', 'Training Grounds · Goblin Scavenger'],
    ['bat-wing', 'Bat Wing', 'Copper Hills · Cave Bat'],
    ['crab-shell', 'Crab Shell', 'Copper Hills · Stoneback Crab'],
    ['wolf-pelt', 'Wolf Pelt', 'Ironwood Pass · Grey Wolf'],
    ['bandit-token', 'Bandit Token', 'Ironwood Pass · Road Bandit'],
    ['rusted-emblem', 'Rusted Emblem', 'Ironwood Pass · Road Bandit'],
  ].map(([id, name, source]) => ({
    id,
    name,
    category: 'drop' as const,
    description: 'A curious field discovery with a story still waiting to be told.',
    source,
    stackable: true,
    rarity: 'uncommon' as const,
    presentation: { iconKey: 'creature-part', visualCategory: 'creature-part' },
  })),
];

export const itemById = Object.fromEntries(ITEMS.map((item) => [item.id, item])) as Record<
  string,
  ItemDefinition
>;
