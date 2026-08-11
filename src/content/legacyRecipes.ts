import { LEGACY_SMITHING_RECIPES } from './recipes';

/** Compatibility-only recipe definitions; normal runtime selectors must use recipes.ts. */
export { LEGACY_SMITHING_RECIPES };
export const legacyRecipeById = Object.fromEntries(
  LEGACY_SMITHING_RECIPES.map((recipe) => [recipe.id, recipe]),
);
