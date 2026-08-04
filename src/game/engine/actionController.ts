import { enemyById } from '../../content/enemies';
import { recipeById } from '../../content/recipes';
import type { AreaId, CombatStyle, EnemyId, GameState, MiningNodeId, QuantityMode } from '../types';
import { getItemQuantity } from '../systems/inventorySystem';
import { getDerivedStats } from '../formulas/statFormulas';

export const startMining = (
  state: GameState,
  nodeId: MiningNodeId,
  now = Date.now(),
): GameState => ({
  ...state,
  activeAction: { type: 'mining', nodeId, startedAt: now, progressMs: 0 },
});
export const startSmithing = (
  state: GameState,
  recipeId: string,
  quantityMode: QuantityMode,
  now = Date.now(),
): GameState => ({
  ...state,
  activeAction: {
    type: 'smithing',
    recipeId,
    quantityMode,
    remaining: quantityMode === 'continuous' || quantityMode === 'all' ? null : quantityMode,
    progressMs: 0,
  },
  updatedAt: now,
});
export const startCombat = (
  state: GameState,
  areaId: AreaId,
  enemyId: EnemyId,
  style: CombatStyle,
  autoRepeat: boolean,
  now = Date.now(),
): GameState => ({
  ...state,
  updatedAt: now,
  player: {
    ...state.player,
    currentHp: getDerivedStats(state).maxHealth,
  },
  activeAction: {
    type: 'combat',
    areaId,
    enemyId,
    style,
    autoRepeat,
    combatState: {
      enemyHp: enemyById[enemyId].maxHealth,
      playerAttackMs: getDerivedStats(state).attackIntervalMs,
      enemyAttackMs: enemyById[enemyId].attackIntervalMs,
      respawnMs: 0,
    },
  },
});

export const setCombatStyle = (state: GameState, style: CombatStyle): GameState =>
  state.activeAction.type === 'combat'
    ? { ...state, activeAction: { ...state.activeAction, style } }
    : state;

export const setCombatAutoRepeat = (state: GameState, autoRepeat: boolean): GameState =>
  state.activeAction.type === 'combat'
    ? { ...state, activeAction: { ...state.activeAction, autoRepeat } }
    : state;
export const recipeCanStart = (state: GameState, recipeId: string): boolean => {
  const recipe = recipeById[recipeId];
  return Boolean(
    recipe &&
    state.skills.smithing.level >= recipe.level &&
    recipe.inputs.every(
      (input) => getItemQuantity(state.inventory, input.itemId) >= input.quantity,
    ),
  );
};
