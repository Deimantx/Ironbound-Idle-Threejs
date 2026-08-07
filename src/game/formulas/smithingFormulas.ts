import { GAME_CONFIG } from '../../config/gameConfig';
import { SMITHING_TUNING } from '../../config/smithingTuning';
import { smithingFuelById } from '../../content/smithingFuels';
import { recipeById } from '../../content/recipes';
import { getSmithingHammerDefinition, smithingToolByItemId } from '../../content/smithingTools';
import type {
  ForgeFuelState,
  GameState,
  QuantityMode,
  RecipeDefinition,
  SmithingFuelDefinition,
  SmithingState,
  SmithingToolDefinition,
} from '../types';
import { addItem, getItemQuantity } from '../systems/inventorySystem';

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

export const createForgeFuelState = (): ForgeFuelState => ({
  selectedFuelItemId: 'coal',
  loadedFuelItemId: null,
  loadedFuelQuantity: 0,
  autoRefuel: true,
});

export const createSmithingState = (seedInput = 'smithing'): SmithingState => ({
  rngSeed: hashSmithingInput(seedInput),
  rngCursor: 0,
  forgeFuel: createForgeFuelState(),
});

export const normalizeSmithingState = (input: unknown): SmithingState => {
  const value = input && typeof input === 'object' ? (input as Partial<SmithingState>) : {};
  const rawFuel: Partial<ForgeFuelState> =
    value.forgeFuel && typeof value.forgeFuel === 'object'
      ? (value.forgeFuel as Partial<ForgeFuelState>)
      : {};
  const seed = Number(value.rngSeed);
  const cursor = Number(value.rngCursor);
  const selectedFuelItemId =
    typeof rawFuel.selectedFuelItemId === 'string' && smithingFuelById[rawFuel.selectedFuelItemId]
      ? rawFuel.selectedFuelItemId
      : 'coal';
  const loadedFuelItemId =
    typeof rawFuel.loadedFuelItemId === 'string' && smithingFuelById[rawFuel.loadedFuelItemId]
      ? rawFuel.loadedFuelItemId
      : null;
  const loadedFuelQuantity = Number(rawFuel.loadedFuelQuantity);
  return {
    rngSeed: Number.isFinite(seed) ? seed >>> 0 || 1 : createSmithingState().rngSeed,
    rngCursor: Number.isFinite(cursor) ? Math.max(0, Math.floor(cursor)) : 0,
    forgeFuel: {
      selectedFuelItemId,
      loadedFuelItemId: loadedFuelQuantity > 0 ? loadedFuelItemId : null,
      loadedFuelQuantity:
        loadedFuelItemId && Number.isFinite(loadedFuelQuantity)
          ? Math.min(
              SMITHING_TUNING.baseForgeFuelCapacity,
              Math.max(0, Math.floor(loadedFuelQuantity)),
            )
          : 0,
      autoRefuel: rawFuel.autoRefuel !== false,
    },
  };
};

export const getForgeFuelDefinition = (
  itemId: string | null | undefined,
): SmithingFuelDefinition | null => (itemId ? (smithingFuelById[itemId] ?? null) : null);

export const getSelectedForgeFuel = (state: GameState): SmithingFuelDefinition | null =>
  getForgeFuelDefinition(state.smithing.forgeFuel.selectedFuelItemId);

export const getForgeFuelCapacity = (_state: GameState): number =>
  SMITHING_TUNING.baseForgeFuelCapacity;

export const getForgeLoadedFuelValue = (state: GameState): number => {
  const fuel = getForgeFuelDefinition(state.smithing.forgeFuel.loadedFuelItemId);
  return fuel ? state.smithing.forgeFuel.loadedFuelQuantity * fuel.fuelValue : 0;
};

export const getForgeFuelUnitsRequired = (recipe: RecipeDefinition | undefined): number =>
  recipe?.category === 'smelting' ? Math.max(0, Math.floor(recipe.forgeFuelUnits ?? 0)) : 0;

const getUnlockedInventoryQuantity = (state: GameState, itemId: string): number => {
  const stack = state.inventory.find((entry) => entry.itemId === itemId);
  return stack && !stack.locked ? Math.max(0, Math.floor(stack.quantity)) : 0;
};

const removeUnlockedInventoryItem = (
  inventory: GameState['inventory'],
  itemId: string,
  quantity: number,
): GameState['inventory'] | null => {
  const stack = inventory.find((entry) => entry.itemId === itemId);
  if (!stack || stack.locked || stack.quantity < quantity) return null;
  const next = inventory.map((entry) => ({ ...entry }));
  const nextStack = next.find((entry) => entry.itemId === itemId);
  if (!nextStack) return null;
  nextStack.quantity -= quantity;
  return next.filter((entry) => entry.quantity > 0);
};

export interface ForgeFuelMutationResult {
  state: GameState;
  quantity: number;
  ok: boolean;
  message: string;
}

export const selectForgeFuel = (state: GameState, itemId: string): ForgeFuelMutationResult => {
  const fuel = getForgeFuelDefinition(itemId);
  const current = state.smithing.forgeFuel;
  if (!fuel) return { state, quantity: 0, ok: false, message: 'That fuel is not available.' };
  if (current.loadedFuelQuantity > 0 && current.loadedFuelItemId !== itemId)
    return {
      state,
      quantity: 0,
      ok: false,
      message: 'Unload the Forge hopper before switching fuel.',
    };
  const next = structuredClone(state);
  next.smithing.forgeFuel.selectedFuelItemId = itemId;
  return { state: next, quantity: 0, ok: true, message: `${fuel.name} selected for the Forge.` };
};

export const loadForgeFuel = (
  state: GameState,
  quantity: number | 'max',
): ForgeFuelMutationResult => {
  const next = structuredClone(state);
  next.smithing = normalizeSmithingState(next.smithing);
  const fuelState = next.smithing.forgeFuel;
  const selected = getSelectedForgeFuel(next);
  if (!selected) return { state, quantity: 0, ok: false, message: 'Select a Forge fuel first.' };
  if (fuelState.loadedFuelQuantity > 0 && fuelState.loadedFuelItemId !== selected.itemId)
    return {
      state,
      quantity: 0,
      ok: false,
      message: 'Unload the Forge hopper before switching fuel.',
    };
  const remainingCapacity = Math.max(0, getForgeFuelCapacity(next) - fuelState.loadedFuelQuantity);
  const available = getUnlockedInventoryQuantity(next, selected.itemId);
  const requested = quantity === 'max' ? remainingCapacity : Math.max(0, Math.floor(quantity));
  const amount = Math.min(requested, remainingCapacity, available);
  if (amount <= 0) {
    const message =
      remainingCapacity <= 0 ? 'Forge hopper is full.' : `Not enough ${selected.name}.`;
    return { state, quantity: 0, ok: false, message };
  }
  const inventory = removeUnlockedInventoryItem(next.inventory, selected.itemId, amount);
  if (!inventory) return { state, quantity: 0, ok: false, message: `Not enough ${selected.name}.` };
  next.inventory = inventory;
  fuelState.loadedFuelItemId = selected.itemId;
  fuelState.loadedFuelQuantity += amount;
  return {
    state: next,
    quantity: amount,
    ok: true,
    message: `Loaded ${amount} ${selected.name} into the Forge.`,
  };
};

export const unloadForgeFuel = (state: GameState): ForgeFuelMutationResult => {
  const next = structuredClone(state);
  next.smithing = normalizeSmithingState(next.smithing);
  const fuelState = next.smithing.forgeFuel;
  const itemId = fuelState.loadedFuelItemId;
  const quantity = fuelState.loadedFuelQuantity;
  if (!itemId || quantity <= 0)
    return { state, quantity: 0, ok: false, message: 'Forge hopper is already empty.' };
  const result = addItem(next.inventory, itemId, quantity, GAME_CONFIG.inventorySlots);
  if (result.rejected > 0)
    return {
      state,
      quantity: 0,
      ok: false,
      message: 'Make inventory space before unloading fuel.',
    };
  next.inventory = result.inventory;
  fuelState.loadedFuelItemId = null;
  fuelState.loadedFuelQuantity = 0;
  return { state: next, quantity, ok: true, message: 'Forge fuel unloaded.' };
};

export const stageForgeAutoRefuel = (
  inventory: GameState['inventory'],
  forgeFuel: ForgeFuelState,
  capacity: number,
): { inventory: GameState['inventory']; forgeFuel: ForgeFuelState; quantity: number } => {
  const nextFuel = { ...forgeFuel };
  const selected = getForgeFuelDefinition(nextFuel.selectedFuelItemId);
  if (!selected) return { inventory, forgeFuel: nextFuel, quantity: 0 };
  if (nextFuel.loadedFuelQuantity > 0 && nextFuel.loadedFuelItemId !== selected.itemId)
    return { inventory, forgeFuel: nextFuel, quantity: 0 };
  const stack = inventory.find((entry) => entry.itemId === selected.itemId);
  const available = stack && !stack.locked ? Math.max(0, stack.quantity) : 0;
  const amount = Math.min(Math.max(0, capacity - nextFuel.loadedFuelQuantity), available);
  if (amount <= 0) return { inventory, forgeFuel: nextFuel, quantity: 0 };
  const nextInventory = removeUnlockedInventoryItem(inventory, selected.itemId, amount);
  if (!nextInventory) return { inventory, forgeFuel: nextFuel, quantity: 0 };
  nextFuel.loadedFuelItemId = selected.itemId;
  nextFuel.loadedFuelQuantity += amount;
  return { inventory: nextInventory, forgeFuel: nextFuel, quantity: amount };
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
): number => getSmithingProductionEstimate(state, recipe).baseCraftsAvailable;

const getMaterialCraftsAvailable = (state: GameState, recipe: RecipeDefinition): number => {
  if (recipe.inputs.length === 0) return 0;
  return Math.max(
    0,
    Math.min(
      ...recipe.inputs.map((input) => {
        const quantity = Math.max(0, Math.floor(input.quantity));
        return quantity > 0
          ? Math.floor(getItemQuantity(state.inventory, input.itemId) / quantity)
          : 0;
      }),
    ),
  );
};

export const getForgeFuelCraftsAvailable = (
  state: GameState,
  recipe: RecipeDefinition | undefined,
  includeInventory = false,
): number => {
  const unitsRequired = getForgeFuelUnitsRequired(recipe);
  if (unitsRequired <= 0) return Number.MAX_SAFE_INTEGER;
  let fuelValue = getForgeLoadedFuelValue(state);
  if (includeInventory) {
    const selected = getSelectedForgeFuel(state);
    const loadedId = state.smithing.forgeFuel.loadedFuelItemId;
    if (selected && (!loadedId || loadedId === selected.itemId))
      fuelValue += getUnlockedInventoryQuantity(state, selected.itemId) * selected.fuelValue;
  }
  return Math.max(0, Math.floor(fuelValue / unitsRequired));
};

export const getForgeFuelTimeEstimate = (
  state: GameState,
  recipe: RecipeDefinition | undefined,
): number => {
  if (!recipe || getForgeFuelUnitsRequired(recipe) <= 0) return 0;
  const crafts = getForgeFuelCraftsAvailable(state, recipe);
  return Math.min(crafts, Number.MAX_SAFE_INTEGER) * getSmithingEffectiveInterval(state, recipe);
};

export interface SmithingProductionEstimate {
  baseCraftsAvailable: number;
  intervalMs: number;
  xpPerCraft: number;
  xpPerHour: number;
  totalBaseXp: number;
  totalBaseTimeMs: number;
}

export const getSmithingProductionEstimate = (
  state: GameState,
  recipe: RecipeDefinition | undefined,
  mode?: QuantityMode,
): SmithingProductionEstimate => {
  if (!recipe)
    return {
      baseCraftsAvailable: 0,
      intervalMs: 0,
      xpPerCraft: 0,
      xpPerHour: 0,
      totalBaseXp: 0,
      totalBaseTimeMs: 0,
    };
  const materialCrafts = getMaterialCraftsAvailable(state, recipe);
  const fuelCrafts =
    recipe.category === 'smelting'
      ? getForgeFuelCraftsAvailable(state, recipe, state.smithing.forgeFuel.autoRefuel)
      : Number.MAX_SAFE_INTEGER;
  const baseCraftsAvailable = Math.min(materialCrafts, fuelCrafts);
  const requested =
    mode === 1 || mode === 10 ? mode : mode === 'all' ? baseCraftsAvailable : baseCraftsAvailable;
  const crafts = Math.min(baseCraftsAvailable, requested);
  const intervalMs = getSmithingEffectiveInterval(state, recipe);
  const xpPerHour = (3_600_000 / Math.max(1, intervalMs)) * Math.max(0, recipe.xp);
  return {
    baseCraftsAvailable,
    intervalMs,
    xpPerCraft: Math.max(0, recipe.xp),
    xpPerHour,
    totalBaseXp: crafts * Math.max(0, recipe.xp),
    totalBaseTimeMs: crafts * intervalMs,
  };
};

export const getSmithingCycleRequirements = (
  recipe: RecipeDefinition | undefined,
): Array<{ itemId: string; quantity: number }> => {
  if (!recipe) return [];
  return recipe.inputs.map((input) => ({ ...input }));
};

export type SmithingStartBlockReason = 'level' | 'materials' | 'load-fuel' | 'fuel' | null;

export const getSmithingStartBlockReason = (
  state: GameState,
  recipe: RecipeDefinition | undefined,
): SmithingStartBlockReason => {
  if (!recipe || state.skills.smithing.level < recipe.level) return 'level';
  if (
    recipe.inputs.some((input) => getItemQuantity(state.inventory, input.itemId) < input.quantity)
  )
    return 'materials';
  const fuelRequired = getForgeFuelUnitsRequired(recipe);
  if (fuelRequired > 0) {
    const loaded = getForgeLoadedFuelValue(state);
    if (loaded < fuelRequired) {
      const selected = getSelectedForgeFuel(state);
      const loadedId = state.smithing.forgeFuel.loadedFuelItemId;
      const inventoryValue =
        selected && (!loadedId || loadedId === selected.itemId)
          ? getUnlockedInventoryQuantity(state, selected.itemId) * selected.fuelValue
          : 0;
      if (state.smithing.forgeFuel.autoRefuel && loaded + inventoryValue >= fuelRequired)
        return null;
      if (!state.smithing.forgeFuel.autoRefuel && inventoryValue > 0) return 'load-fuel';
      return 'fuel';
    }
  }
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
