import { enemyById } from '../../content/enemies';
import { itemById } from '../../content/items';
import { recipeById } from '../../content/recipes';
import { createCombatRngForStart, initializeEnemySpawn } from './combatEncounter';
import { getDerivedStats } from '../formulas/statFormulas';
import { miningNodeById } from '../../content/miningNodes';
import { createMiningRuntimeState, normalizeMiningState } from '../formulas/miningFormulas';
import { getSmithingMaxCraftable, getSmithingStartBlockReason } from '../formulas/smithingFormulas';
import { appendCombatLog } from '../logging/combatLog';
import type { AreaId, CombatStyle, EnemyId, GameState, MiningNodeId, QuantityMode } from '../types';

export const startMining = (
  state: GameState,
  nodeId: MiningNodeId,
  now = Date.now(),
  ignoreRequirements = false,
): GameState => {
  const node = miningNodeById[nodeId];
  if (!node || (!ignoreRequirements && state.skills.mining.level < node.level))
    return { ...state, activeAction: { type: 'none' }, updatedAt: now };
  const mining = normalizeMiningState(state.mining);
  const runtime = mining.nodeStates[nodeId];
  if (!runtime) mining.nodeStates[nodeId] = createMiningRuntimeState(nodeId);
  const selected = mining.nodeStates[nodeId]!;
  const phase =
    selected.respawnRemainingMs > 0 ? 'respawn' : mining.stamina <= 0 ? 'rest' : 'swing';
  const progressMs =
    phase === 'respawn' ? Math.max(0, node.respawnMs - selected.respawnRemainingMs) : 0;
  return {
    ...state,
    mining,
    activeAction: { type: 'mining', nodeId, startedAt: now, phase, progressMs },
    updatedAt: now,
    lastSimulatedAt: now,
  };
};

export const startSmithing = (
  state: GameState,
  recipeId: string,
  quantityMode: QuantityMode,
  now = Date.now(),
): GameState => {
  const recipe = recipeById[recipeId];
  if (!recipe || state.skills.smithing.level < recipe.level)
    return { ...state, activeAction: { type: 'none' }, updatedAt: now };
  const remaining =
    quantityMode === 'continuous'
      ? null
      : quantityMode === 'all'
        ? getSmithingMaxCraftable(state, recipe)
        : quantityMode;
  return {
    ...state,
    activeAction: { type: 'smithing', recipeId, quantityMode, remaining, progressMs: 0 },
    updatedAt: now,
    lastSimulatedAt: now,
  };
};

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
  const nextCombatState = spawn.eliteModifier
    ? { ...spawn.combatState, eliteAnnounced: true }
    : spawn.combatState;
  const next: GameState = {
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
      combatState: nextCombatState,
    },
  };
  appendCombatLog(next, {
    kind: 'enemy-spawned',
    enemyId,
    at: now,
    encounterStartedAt: nextCombatState.encounterStartedAt,
    encounterIndex: nextCombatState.encounterIndex,
  });
  if (spawn.eliteModifier)
    appendCombatLog(next, {
      kind: 'elite-spawned',
      enemyId,
      at: now,
      encounterStartedAt: nextCombatState.encounterStartedAt,
      modifier: spawn.eliteModifier,
    });
  return next;
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
  return getSmithingStartBlockReason(state, recipe) === null;
};
