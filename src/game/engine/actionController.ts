import { enemyById } from '../../content/enemies';
import { itemById } from '../../content/items';
import { recipeById } from '../../content/recipes';
import { createCombatRngForStart, initializeEnemySpawn } from './combatEncounter';
import { getDerivedStats } from '../formulas/statFormulas';
import type { AreaId, CombatStyle, EnemyId, GameState, MiningNodeId, QuantityMode } from '../types';
import { getItemQuantity } from '../systems/inventorySystem';

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
  autoSpecial = true,
): GameState => {
  const enemy = enemyById[enemyId];
  if (!enemy) return { ...state, activeAction: { type: 'none' }, updatedAt: now };
  const rng = createCombatRngForStart(state, now, enemyId);
  const spawn = initializeEnemySpawn(state, enemyId, style, rng, 1, undefined, 0, now);
  return {
    ...state,
    updatedAt: now,
    player: { ...state.player, currentHp: getDerivedStats(state, style).maxHealth },
    activeAction: {
      type: 'combat',
      areaId,
      enemyId,
      style,
      pendingStyle: null,
      autoRepeat,
      autoSpecial,
      specialQueued: false,
      combatState: spawn.combatState,
    },
  };
};

export const setCombatStyle = (state: GameState, style: CombatStyle): GameState => {
  if (state.activeAction.type !== 'combat') return state;
  const active = state.activeAction;
  const inEncounter = active.combatState.enemyHp > 0 && active.combatState.respawnMs <= 0;
  return {
    ...state,
    activeAction: {
      ...active,
      style: inEncounter ? active.style : style,
      pendingStyle: inEncounter ? style : null,
    },
  };
};

export const setCombatAutoRepeat = (state: GameState, autoRepeat: boolean): GameState =>
  state.activeAction.type === 'combat'
    ? { ...state, activeAction: { ...state.activeAction, autoRepeat } }
    : state;

export const setCombatAutoSpecial = (state: GameState, autoSpecial: boolean): GameState =>
  state.activeAction.type === 'combat'
    ? { ...state, activeAction: { ...state.activeAction, autoSpecial } }
    : state;

export const queueCombatSpecial = (state: GameState): GameState => {
  if (state.activeAction.type !== 'combat') return state;
  const weapon = itemById[state.equipment.weapon ?? ''];
  if (!weapon?.specialAttack) return state;
  if (state.activeAction.combatState.momentum < 100) return state;
  return { ...state, activeAction: { ...state.activeAction, specialQueued: true } };
};

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
