import type { RecipeDefinition } from '../game/types';

const smithingRecipe = (
  recipe: Omit<RecipeDefinition, 'legacy'> & { legacy?: boolean },
): RecipeDefinition => recipe;

const forgeRecipe = (
  tier: 'bronze' | 'iron' | 'steel',
  item: string,
  name: string,
  level: number,
  bars: number,
  xp: number,
  intervalMs: number,
  legacy = false,
): RecipeDefinition =>
  smithingRecipe({
    id: `${tier}-${item}`,
    name,
    category: 'forging',
    level,
    intervalMs,
    inputs: [{ itemId: `${tier}-bar`, quantity: bars }],
    outputItemId: `${tier}-${item}`,
    outputQuantity: 1,
    xp,
    description: `Forge a ${tier} ${name.toLowerCase()} from prepared bars.`,
    legacy,
  });

export const RECIPES: RecipeDefinition[] = [
  // Bronze remains valid for old inventories and active old saves, but is no longer normal progression.
  smithingRecipe({
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
    legacy: true,
  }),
  smithingRecipe({
    id: 'iron-bar',
    name: 'Iron Bar',
    category: 'smelting',
    level: 1,
    intervalMs: 3800,
    inputs: [{ itemId: 'iron-ore', quantity: 1 }],
    outputItemId: 'iron-bar',
    outputQuantity: 1,
    xp: 12,
    description: 'Refine iron ore into a strong bar.',
    fuel: { itemId: 'coal', quantity: 1 },
  }),
  smithingRecipe({
    id: 'steel-bar',
    name: 'Steel Bar',
    category: 'smelting',
    level: 30,
    intervalMs: 5200,
    inputs: [{ itemId: 'iron-ore', quantity: 1 }],
    outputItemId: 'steel-bar',
    outputQuantity: 1,
    xp: 20,
    description: 'Harden iron with coal in a hotter furnace.',
    fuel: { itemId: 'coal', quantity: 2 },
  }),
  // Legacy Bronze equipment recipes retain their historical IDs and balance.
  forgeRecipe('bronze', 'sword', 'Bronze Sword', 1, 3, 30, 2800, true),
  forgeRecipe('bronze', 'helmet', 'Bronze Helm', 3, 2, 34, 2800, true),
  forgeRecipe('bronze', 'armor', 'Bronze Armor', 6, 9, 78, 5600, true),
  forgeRecipe('bronze', 'shield', 'Bronze Buckler', 4, 4, 38, 2800, true),
  forgeRecipe('bronze', 'pickaxe', 'Bronze Pick', 8, 4, 42, 2800, true),
  // Active Iron progression.
  forgeRecipe('iron', 'sword', 'Iron Sword', 15, 4, 55, 4200),
  forgeRecipe('iron', 'helmet', 'Iron Helm', 17, 3, 59, 4200),
  forgeRecipe('iron', 'shield', 'Iron Bulwark', 18, 5, 63, 4200),
  forgeRecipe('iron', 'armor', 'Iron Armor', 20, 11, 128, 8400),
  forgeRecipe('iron', 'pickaxe', 'Iron Pick', 22, 5, 67, 4200),
  forgeRecipe('iron', 'smithing-hammer', 'Iron Smithing Hammer', 15, 3, 45, 4200),
  // Active Steel progression.
  forgeRecipe('steel', 'sword', 'Steel Sword', 30, 5, 90, 6000),
  forgeRecipe('steel', 'helmet', 'Steel Helm', 32, 4, 94, 6000),
  forgeRecipe('steel', 'smithing-hammer', 'Steel Smithing Hammer', 32, 4, 90, 6000),
  forgeRecipe('steel', 'shield', 'Steel Bulwark', 33, 6, 98, 6000),
  forgeRecipe('steel', 'armor', 'Steel Armor', 35, 13, 198, 12000),
  forgeRecipe('steel', 'pickaxe', 'Steel Pick', 37, 6, 102, 6000),
];

export const recipeById = Object.fromEntries(RECIPES.map((recipe) => [recipe.id, recipe]));
export const ACTIVE_SMITHING_RECIPES = RECIPES.filter((recipe) => !recipe.legacy);
export const LEGACY_SMITHING_RECIPES = RECIPES.filter((recipe) => recipe.legacy);

export const getSmithingRecipesForCategory = (
  category: RecipeDefinition['category'],
  includeLegacy = false,
): RecipeDefinition[] =>
  RECIPES.filter((recipe) => recipe.category === category && (includeLegacy || !recipe.legacy));
