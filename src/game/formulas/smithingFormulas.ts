import { recipeById } from '../../content/recipes';
import { getSmithingHammerDefinition, smithingToolByItemId } from '../../content/smithingTools';
import type { GameState, RecipeDefinition, SmithingState, SmithingToolDefinition } from '../types';
import { getItemQuantity } from '../systems/inventorySystem';

export const SMITHING_MIN_INTERVAL_MS = 250;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const hashSmithingInput = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 1;
};

export const createSmithingState = (seedInput = 'smithing'): SmithingState => ({
  rngSeed: hashSmithingInput(seedInput),
  rngCursor: 0,
});

export const normalizeSmithingState = (input: unknown): SmithingState => {
  const value = input && typeof input === 'object' ? (input as Partial<SmithingState>) : {};
  const seed = Number(value.rngSeed);
  const cursor = Number(value.rngCursor);
  return {
    rngSeed: Number.isFinite(seed) ? seed >>> 0 || 1 : createSmithingState().rngSeed,
    rngCursor: Number.isFinite(cursor) ? Math.max(0, Math.floor(cursor)) : 0,
  };
};

export const nextSmithingRandom = (state: Pick<SmithingState, 'rngSeed' | 'rngCursor'>): number => {
  const seed = state.rngSeed >>> 0 || 1;
  const value = (Math.imul(seed ^ (state.rngCursor + 1), 1_664_525) + 1_013_904_223) >>> 0;
  state.rngCursor += 1;
  return value / 4_294_967_296;
};

export const getSmithingHammer = (state: GameState): SmithingToolDefinition | null => {
  const itemId = state.equipment.tool;
  const definition = getSmithingHammerDefinition(itemId);
  return definition && state.skills.smithing.level >= definition.requiredSmithingLevel
    ? definition
    : null;
};

export const getSmithingHammerDefinitionByItemId = (
  itemId: string | undefined,
): SmithingToolDefinition | null =>
  itemId && smithingToolByItemId[itemId] ? smithingToolByItemId[itemId] : null;

export const getSmithingEffectiveInterval = (
  state: GameState,
  recipe: RecipeDefinition,
): number => {
  const hammer = getSmithingHammer(state);
  const multiplier = recipe.category === 'forging' ? 1 - (hammer?.speedBonus ?? 0) : 1;
  return Math.max(SMITHING_MIN_INTERVAL_MS, Math.floor(recipe.intervalMs * multiplier));
};

export const getSmithingPreservationChance = (
  state: GameState,
  recipe: RecipeDefinition,
): number =>
  recipe.category === 'forging'
    ? clamp(getSmithingHammer(state)?.materialPreservationChance ?? 0, 0, 1)
    : 0;

export const getSmithingMaxCraftable = (
  state: GameState,
  recipe: RecipeDefinition | undefined,
): number => {
  if (!recipe) return 0;
  const requirements = [...recipe.inputs];
  if (recipe.fuel) requirements.push(recipe.fuel);
  if (requirements.length === 0) return 0;
  return Math.max(
    0,
    Math.min(
      ...requirements.map((requirement) => {
        const quantity = Math.floor(requirement.quantity);
        return quantity > 0
          ? Math.floor(getItemQuantity(state.inventory, requirement.itemId) / quantity)
          : 0;
      }),
    ),
  );
};

export const getSmithingCycleRequirements = (
  recipe: RecipeDefinition | undefined,
): Array<{ itemId: string; quantity: number; fuel: boolean }> => {
  if (!recipe) return [];
  return [
    ...recipe.inputs.map((input) => ({ ...input, fuel: false })),
    ...(recipe.fuel ? [{ ...recipe.fuel, fuel: true }] : []),
  ];
};

export type SmithingStartBlockReason = 'level' | 'materials' | 'fuel' | null;

export const getSmithingStartBlockReason = (
  state: GameState,
  recipe: RecipeDefinition | undefined,
): SmithingStartBlockReason => {
  if (!recipe || state.skills.smithing.level < recipe.level) return 'level';
  if (
    recipe.inputs.some((input) => getItemQuantity(state.inventory, input.itemId) < input.quantity)
  )
    return 'materials';
  if (recipe.fuel && getItemQuantity(state.inventory, recipe.fuel.itemId) < recipe.fuel.quantity)
    return 'fuel';
  return null;
};

export const recipeCanStart = (state: GameState, recipe: RecipeDefinition | undefined): boolean =>
  getSmithingStartBlockReason(state, recipe) === null;

export interface SmithingRateEstimate {
  intervalMs: number;
  cyclesPerHour: number;
  xpPerHour: number;
}

export const getSmithingEstimatedRates = (
  state: GameState,
  recipe: RecipeDefinition,
): SmithingRateEstimate => {
  const intervalMs = getSmithingEffectiveInterval(state, recipe);
  const cyclesPerHour = 3_600_000 / Math.max(1, intervalMs);
  return { intervalMs, cyclesPerHour, xpPerHour: cyclesPerHour * Math.max(0, recipe.xp) };
};

export { getSmithingHammerDefinition };
export { recipeById };
