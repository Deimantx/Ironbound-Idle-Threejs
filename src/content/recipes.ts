import type { RecipeDefinition } from '../game/types';

const forge = (
  tier: 'bronze' | 'iron' | 'steel',
  item: string,
  name: string,
  level: number,
  bars: number,
  xp: number,
  intervalOverride?: number,
): RecipeDefinition => ({
  id: `${tier}-${item}`,
  name,
  category: 'forging',
  level,
  intervalMs: intervalOverride ?? (tier === 'bronze' ? 2800 : tier === 'iron' ? 4200 : 6000),
  inputs: [{ itemId: `${tier}-bar`, quantity: bars }],
  outputItemId: `${tier}-${item}`,
  outputQuantity: 1,
  xp,
  description: `Forge a ${tier} ${name.toLowerCase()} from prepared bars.`,
});

export const RECIPES: RecipeDefinition[] = [
  // Legacy Bronze-era Smithing remains valid for existing content and saves; Mining 1.1 only retires its source nodes.
  {
    id: 'bronze-bar',
    name: 'Bronze Bar',
    category: 'smelting',
    level: 1,
    intervalMs: 2400,
    inputs: [
      { itemId: 'copper-ore', quantity: 1 },
      { itemId: 'tin-ore', quantity: 1 },
    ],
    outputItemId: 'bronze-bar',
    outputQuantity: 1,
    xp: 24,
    description: 'Blend copper and tin into a durable alloy.',
  },
  {
    id: 'iron-bar',
    name: 'Iron Bar',
    category: 'smelting',
    level: 15,
    intervalMs: 3800,
    inputs: [{ itemId: 'iron-ore', quantity: 1 }],
    outputItemId: 'iron-bar',
    outputQuantity: 1,
    xp: 44,
    description: 'Refine iron ore into a strong bar.',
  },
  {
    id: 'steel-bar',
    name: 'Steel Bar',
    category: 'smelting',
    level: 30,
    intervalMs: 5200,
    inputs: [
      { itemId: 'iron-ore', quantity: 1 },
      { itemId: 'coal', quantity: 2 },
    ],
    outputItemId: 'steel-bar',
    outputQuantity: 1,
    xp: 76,
    description: 'Harden iron with coal in a hotter furnace.',
  },
  ...[
    ['bronze', 1, 3, 30],
    ['iron', 15, 4, 55],
    ['steel', 30, 5, 90],
  ].flatMap(([tier, level, bars, xp]) => [
    forge(
      tier as 'bronze' | 'iron' | 'steel',
      'sword',
      `${String(tier)[0].toUpperCase()}${String(tier).slice(1)} Sword`,
      Number(level),
      Number(bars),
      Number(xp),
    ),
    forge(
      tier as 'bronze' | 'iron' | 'steel',
      'helmet',
      `${String(tier)[0].toUpperCase()}${String(tier).slice(1)} Helm`,
      Number(level) + 2,
      Number(bars) - 1,
      Number(xp) + 4,
    ),
    forge(
      tier as 'bronze' | 'iron' | 'steel',
      'armor',
      `${String(tier)[0].toUpperCase()}${String(tier).slice(1)} Armor`,
      tier === 'bronze' ? 6 : tier === 'iron' ? 20 : 35,
      tier === 'bronze' ? 9 : tier === 'iron' ? 11 : 13,
      tier === 'bronze' ? 78 : tier === 'iron' ? 128 : 198,
      tier === 'bronze' ? 5600 : tier === 'iron' ? 8400 : 12000,
    ),
    forge(
      tier as 'bronze' | 'iron' | 'steel',
      'shield',
      `${String(tier)[0].toUpperCase()}${String(tier).slice(1)} Buckler`,
      Number(level) + 3,
      Number(bars) + 1,
      Number(xp) + 8,
    ),
    forge(
      tier as 'bronze' | 'iron' | 'steel',
      'pickaxe',
      `${String(tier)[0].toUpperCase()}${String(tier).slice(1)} Pick`,
      Number(level) + 7,
      Number(bars) + 1,
      Number(xp) + 12,
    ),
  ]),
];

export const recipeById = Object.fromEntries(RECIPES.map((recipe) => [recipe.id, recipe]));
