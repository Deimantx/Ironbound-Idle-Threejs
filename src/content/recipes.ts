import type { RecipeDefinition } from '../game/types';
import { getSmithingXpPerBar } from '../config/smithingTuning';

const smithingRecipe = (recipe: RecipeDefinition): RecipeDefinition => recipe;

const forgeRecipe = (
  tier: 'iron' | 'steel',
  item: string,
  name: string,
  level: number,
  bars: number,
  intervalMs: number,
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
    xp: bars * getSmithingXpPerBar(tier),
    description: `Forge a ${tier} ${name.toLowerCase()} from prepared bars.`,
  });

export const RECIPES: RecipeDefinition[] = [
  smithingRecipe({
    id: 'iron-bar',
    name: 'Iron Bar',
    category: 'smelting',
    level: 1,
    intervalMs: 3800,
    inputs: [{ itemId: 'iron-ore', quantity: 1 }],
    outputItemId: 'iron-bar',
    outputQuantity: 1,
    xp: 20,
    description: 'Refine iron ore into a strong bar.',
    forgeFuelUnits: 1,
    fuel: { itemId: 'coal', quantity: 1 },
  }),
  smithingRecipe({
    id: 'steel-bar',
    name: 'Steel Bar',
    category: 'smelting',
    level: 30,
    intervalMs: 5200,
    inputs: [{ itemId: 'iron-ore', quantity: 2 }],
    outputItemId: 'steel-bar',
    outputQuantity: 1,
    xp: 40,
    description: 'Harden iron with coal in a hotter furnace.',
    forgeFuelUnits: 2,
    fuel: { itemId: 'coal', quantity: 2 },
  }),
  // Active Iron progression.
  forgeRecipe('iron', 'sword', 'Iron Sword', 15, 4, 4200),
  forgeRecipe('iron', 'helmet', 'Iron Helm', 17, 3, 4200),
  forgeRecipe('iron', 'shield', 'Iron Bulwark', 18, 5, 4200),
  forgeRecipe('iron', 'armor', 'Iron Armor', 20, 11, 8400),
  forgeRecipe('iron', 'pickaxe', 'Iron Pick', 22, 5, 4200),
  forgeRecipe('iron', 'smithing-hammer', 'Iron Smithing Hammer', 15, 3, 4200),
  // Active Steel progression.
  forgeRecipe('steel', 'sword', 'Steel Sword', 30, 5, 6000),
  forgeRecipe('steel', 'helmet', 'Steel Helm', 32, 4, 6000),
  forgeRecipe('steel', 'smithing-hammer', 'Steel Smithing Hammer', 32, 4, 6000),
  forgeRecipe('steel', 'shield', 'Steel Bulwark', 33, 6, 6000),
  forgeRecipe('steel', 'armor', 'Steel Armor', 35, 13, 12000),
  forgeRecipe('steel', 'pickaxe', 'Steel Pick', 37, 6, 6000),
];

export const ACTIVE_SMITHING_RECIPES = RECIPES;
export const recipeById = Object.fromEntries(RECIPES.map((recipe) => [recipe.id, recipe]));

export const getSmithingRecipesForCategory = (
  category: RecipeDefinition['category'],
): RecipeDefinition[] =>
  RECIPES
    .map((recipe, index) => ({ recipe, index }))
    .filter(({ recipe }) => recipe.category === category)
    .sort(
      (left, right) => left.recipe.level - right.recipe.level || left.index - right.index,
    )
    .map(({ recipe }) => recipe);
