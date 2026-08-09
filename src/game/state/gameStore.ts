import { create } from 'zustand';
import { saveProfile } from '../persistence/saveManager';
import { simulateElapsed } from '../engine/simulation';
import { itemById } from '../../content/items';
import { miningNodeById } from '../../content/miningNodes';
import {
  setCombatAutoRepeat,
  setCombatAutoSpecial,
  setCombatStyle,
  queueCombatSpecial,
  startCombat,
  switchCombatTarget,
  startMining,
  startSmithing,
} from '../engine/actionController';
import { destroyItem, toggleItemLock } from '../systems/inventorySystem';
import { equipItem, unequipItem } from '../systems/equipmentSystem';
import { emptyCombatSession } from '../types';
import { normalizeSkillState } from '../formulas/experienceFormulas';
import { getClampedPlayerHealth } from '../systems/healthSystem';
import {
  loadForgeFuel as loadForgeFuelState,
  selectForgeFuel as selectForgeFuelState,
  unloadForgeFuel as unloadForgeFuelState,
} from '../formulas/smithingFormulas';
import type {
  AreaId,
  CombatStyle,
  CombatSessionStats,
  CombatVisualEvent,
  EnemyId,
  GameSettings,
  GameState,
  MiningNodeId,
  QuantityMode,
  SimulationSummary,
} from '../types';
import { SKILL_IDS } from '../types';

type SaveStatus = 'saved' | 'saving' | 'failed';
interface Store {
  game: GameState | null;
  saveStatus: SaveStatus;
  savedAt: number | null;
  toast: string | null;
  offlineSummary: SimulationSummary | null;
  setGame: (game: GameState | null, offlineSummary?: SimulationSummary | null) => void;
  applyDebugState: (
    game: GameState,
    options?: {
      summary?: SimulationSummary | null;
      events?: CombatVisualEvent[];
      replaceCombatSession?: boolean;
    },
  ) => void;
  tick: (now: number) => void;
  startMining: (nodeId: MiningNodeId) => void;
  startSmithing: (recipeId: string, mode: QuantityMode) => void;
  selectForgeFuel: (itemId: string) => void;
  loadForgeFuel: (quantity: number | 'max') => void;
  unloadForgeFuel: () => void;
  setForgeAutoRefuel: (enabled: boolean) => void;
  startCombat: (
    areaId: AreaId,
    enemyId: EnemyId,
    style: CombatStyle,
    autoRepeat: boolean,
    autoSpecial?: boolean,
  ) => void;
  switchCombatTarget: (
    areaId: AreaId,
    enemyId: EnemyId,
    style: CombatStyle,
    autoRepeat: boolean,
    autoSpecial?: boolean,
  ) => void;
  stopAction: () => void;
  equip: (itemId: string) => void;
  unequip: (slot: Parameters<typeof unequipItem>[1]) => void;
  destroy: (itemId: string, quantity: number) => void;
  toggleLock: (itemId: string) => void;
  setSettings: (settings: Partial<GameSettings>) => void;
  saveNow: () => Promise<boolean>;
  clearToast: () => void;
  clearOfflineSummary: () => void;
  combatEvents: CombatVisualEvent[];
  combatSession: CombatSessionStats;
  setCombatStyle: (style: CombatStyle) => void;
  setCombatAutoRepeat: (autoRepeat: boolean) => void;
  setCombatAutoSpecial: (autoSpecial: boolean) => void;
  queueCombatSpecial: () => void;
}

let lastTick = Date.now();
const notify = (message: string): void => {
  useGameStore.setState({ toast: message });
};

export const mergeCombatSession = (
  current: CombatSessionStats,
  summary: ReturnType<typeof simulateElapsed>['summary'],
  events: CombatVisualEvent[],
): CombatSessionStats => {
  const next: CombatSessionStats = {
    ...current,
    xpGained: { ...current.xpGained },
    lootGained: { ...current.lootGained },
  };
  for (const [skill, amount] of Object.entries(summary.xpGained))
    next.xpGained[skill as keyof CombatSessionStats['xpGained']] =
      (next.xpGained[skill as keyof CombatSessionStats['xpGained']] ?? 0) + (amount ?? 0);
  next.enemiesDefeated += summary.enemiesDefeated;
  next.eliteEnemiesDefeated += summary.eliteEnemiesDefeated;
  next.goldGained += summary.goldGained;
  for (const [itemId, amount] of Object.entries(summary.itemsGained))
    next.lootGained[itemId] = (next.lootGained[itemId] ?? 0) + amount;
  next.playerAttacks += summary.combatStats.playerAttacks;
  next.playerHits += summary.combatStats.playerHits;
  next.enemyAttacks += summary.combatStats.enemyAttacks;
  next.enemyHits += summary.combatStats.enemyHits;
  next.specialAttempts += summary.combatStats.specialAttempts;
  next.specialHits += summary.combatStats.specialHits;
  next.damageDealt += summary.combatStats.damageDealt;
  next.damageTaken += summary.combatStats.damageTaken;
  void events;
  return next;
};

export const countSummaryItems = (summary: Pick<SimulationSummary, 'itemsGained'>): number =>
  Object.values(summary.itemsGained).reduce(
    (total, quantity) => total + (Number.isFinite(quantity) ? Math.floor(Math.max(0, quantity)) : 0),
    0,
  );

const addSimulationStatistics = (game: GameState, summary: SimulationSummary): GameState => ({
  ...game,
  statistics: {
    ...game.statistics,
    totalItemsGained: game.statistics.totalItemsGained + countSummaryItems(summary),
  },
});

const sessionForState = (game: GameState): CombatSessionStats => {
  if (game.activeAction.type !== 'combat') return emptyCombatSession();
  return emptyCombatSession(
    game.activeAction.enemyId,
    game.updatedAt,
    game.activeAction.combatState.encounterStartedAt,
  );
};

const hasCombatSimulation = (summary: SimulationSummary): boolean =>
  summary.enemiesDefeated > 0 ||
  summary.deaths > 0 ||
  Object.values(summary.combatStats).some((amount) => amount > 0);

const appendCombatEvents = (
  current: CombatVisualEvent[],
  events: CombatVisualEvent[] = [],
): CombatVisualEvent[] => [...current, ...events].slice(-64);

const normalizeGameSkills = (game: GameState): GameState => ({
  ...game,
  player: { ...game.player, currentHp: getClampedPlayerHealth(game) },
  statistics: {
    ...game.statistics,
    totalItemsGained: Number.isFinite(game.statistics.totalItemsGained)
      ? Math.floor(Math.max(0, game.statistics.totalItemsGained))
      : 0,
    playTimeMs: Number.isFinite(game.statistics.playTimeMs)
      ? Math.floor(Math.max(0, game.statistics.playTimeMs))
      : 0,
  },
  skills: Object.fromEntries(
    SKILL_IDS.map((skillId) => [skillId, normalizeSkillState(game.skills[skillId])]),
  ) as GameState['skills'],
});

export const getMiningFeedbackMessage = (summary: SimulationSummary): string | null => {
  const context = summary.offlineContext;
  if (context?.activity !== 'mining' || !context.miningNodeId) return null;
  const node = miningNodeById[context.miningNodeId];
  const roughGem = summary.itemsGained['rough-gem'] ?? 0;
  if (roughGem > 0) return `${itemById['rough-gem']?.name ?? 'Rough Gem'} found! +${roughGem}`;
  const traceIron =
    context.miningNodeId === 'stone-outcrop' ? (summary.itemsGained['iron-ore'] ?? 0) : 0;
  if (traceIron > 0) return `Iron Ore trace uncovered! +${traceIron}`;
  if (!node) return null;
  const stageEntry = Object.entries(summary.completed)
    .filter(([key, amount]) => key.startsWith(`mine-stage:${node.id}:`) && amount > 0)
    .sort((left, right) => left[0].localeCompare(right[0]))
    .at(-1);
  if (!stageEntry) return null;
  const index = Number(stageEntry[0].split(':').at(-1));
  const nextStage = Number.isInteger(index) ? node.stages[index + 1] : undefined;
  return nextStage ? `${nextStage.name} exposed!` : `${node.name} fully mined!`;
};

export const useGameStore = create<Store>((set, get) => ({
  game: null,
  saveStatus: 'saved',
  savedAt: null,
  toast: null,
  offlineSummary: null,
  combatEvents: [],
  combatSession: emptyCombatSession(),
  setGame: (game, offlineSummary = null) => {
    const normalizedGame = game ? normalizeGameSkills(game) : null;
    const accountedGame = normalizedGame && offlineSummary
      ? addSimulationStatistics(normalizedGame, offlineSummary)
      : normalizedGame;
    lastTick = Date.now();
    const loadedCombat =
      accountedGame?.activeAction.type === 'combat' ? accountedGame.activeAction : null;
    set({
      game: accountedGame,
      offlineSummary,
      saveStatus: 'saved',
      combatEvents: [],
      combatSession: emptyCombatSession(
        loadedCombat?.enemyId ?? null,
        loadedCombat && accountedGame ? accountedGame.updatedAt : null,
        loadedCombat?.combatState.encounterStartedAt ??
          (loadedCombat && accountedGame ? accountedGame.updatedAt : null),
      ),
    });
  },
  applyDebugState: (game, options = {}) => {
    const normalizedGame = normalizeGameSkills(game);
    lastTick = Date.now();
    const replaceCombatSession = options.replaceCombatSession ?? false;
    const nextSession = replaceCombatSession
      ? sessionForState(normalizedGame)
      : get().combatSession;
    const session =
      options.summary && hasCombatSimulation(options.summary)
        ? mergeCombatSession(nextSession, options.summary, options.events ?? [])
        : nextSession;
    if (normalizedGame.activeAction.type === 'combat')
      session.encounterStartedAt = normalizedGame.activeAction.combatState.encounterStartedAt;
    set({
      game: normalizedGame,
      combatEvents: replaceCombatSession
        ? (options.events ?? [])
        : appendCombatEvents(get().combatEvents, options.events),
      combatSession: session,
    });
  },
  tick: (now) => {
    const game = get().game;
    if (!game) return;
    const elapsed = Math.max(0, Math.min(1000, now - lastTick));
    lastTick = now;
    if (elapsed <= 0) return;
    const result = simulateElapsed(game, elapsed);
    result.state.statistics.totalItemsGained += countSummaryItems(result.summary);
    result.state.statistics.playTimeMs += elapsed;
    const isCombat = game.activeAction.type === 'combat';
    const nextCombatSession = isCombat
      ? mergeCombatSession(get().combatSession, result.summary, result.events)
      : get().combatSession;
    const miningFeedback = getMiningFeedbackMessage(result.summary);
    if (result.state.activeAction.type === 'combat')
      nextCombatSession.encounterStartedAt =
        result.state.activeAction.combatState.encounterStartedAt;
    set({
      game: result.state,
      combatEvents: result.events.length
        ? [...get().combatEvents, ...result.events].slice(-64)
        : get().combatEvents,
      combatSession: nextCombatSession,
      toast: miningFeedback ?? get().toast,
    });
  },
  startMining: (nodeId) => {
    const game = get().game;
    if (game) set({ game: startMining(game, nodeId) });
  },
  startSmithing: (recipeId, mode) => {
    const game = get().game;
    if (game) set({ game: startSmithing(game, recipeId, mode) });
  },
  selectForgeFuel: (itemId) => {
    const game = get().game;
    if (!game) return;
    const result = selectForgeFuelState(game, itemId);
    if (result.ok) set({ game: result.state });
    notify(result.message);
  },
  loadForgeFuel: (quantity) => {
    const game = get().game;
    if (!game) return;
    const result = loadForgeFuelState(game, quantity);
    if (result.ok) set({ game: result.state });
    notify(result.message);
  },
  unloadForgeFuel: () => {
    const game = get().game;
    if (!game) return;
    const result = unloadForgeFuelState(game);
    if (result.ok) set({ game: result.state });
    notify(result.message);
  },
  setForgeAutoRefuel: (enabled) => {
    const game = get().game;
    if (!game) return;
    set({
      game: {
        ...game,
        smithing: {
          ...game.smithing,
          forgeFuel: { ...game.smithing.forgeFuel, autoRefuel: enabled },
        },
      },
    });
    notify(`Auto-refuel ${enabled ? 'enabled' : 'disabled'}.`);
  },
  startCombat: (areaId, enemyId, style, autoRepeat, autoSpecial = true) => {
    const game = get().game;
    if (game) {
      const startedAt = Date.now();
      const nextGame = startCombat(
        game,
        areaId,
        enemyId,
        style,
        autoRepeat,
        startedAt,
        autoSpecial,
      );
      nextGame.lastSimulatedAt = startedAt;
      set({
        game: nextGame,
        combatEvents: [],
        combatSession: emptyCombatSession(enemyId, startedAt, startedAt),
      });
    }
  },
  switchCombatTarget: (areaId, enemyId, style, autoRepeat, autoSpecial = true) => {
    const game = get().game;
    if (game?.activeAction.type !== 'combat') return;
    const startedAt = Date.now();
    const nextGame = switchCombatTarget(
      game,
      areaId,
      enemyId,
      style,
      autoRepeat,
      startedAt,
      autoSpecial,
    );
    nextGame.lastSimulatedAt = startedAt;
    set({
      game: nextGame,
      combatEvents: [],
      combatSession: emptyCombatSession(enemyId, startedAt, startedAt),
    });
  },
  setCombatStyle: (style) => {
    const game = get().game;
    if (game) set({ game: setCombatStyle(game, style) });
  },
  setCombatAutoRepeat: (autoRepeat) => {
    const game = get().game;
    if (game) set({ game: setCombatAutoRepeat(game, autoRepeat) });
  },
  setCombatAutoSpecial: (autoSpecial) => {
    const game = get().game;
    if (game) set({ game: setCombatAutoSpecial(game, autoSpecial) });
  },
  queueCombatSpecial: () => {
    const game = get().game;
    if (game) set({ game: queueCombatSpecial(game) });
  },
  stopAction: () => {
    const game = get().game;
    if (game) set({ game: { ...game, activeAction: { type: 'none' } } });
  },
  equip: (itemId) => {
    const game = get().game;
    if (!game) return;
    const result = equipItem(game, itemId);
    if (result.ok) set({ game: result.state });
    notify(result.message);
  },
  unequip: (slot) => {
    const game = get().game;
    if (!game) return;
    const result = unequipItem(game, slot);
    if (result.ok) set({ game: result.state });
    notify(result.message);
  },
  destroy: (itemId, quantity) => {
    const game = get().game;
    if (!game) return;
    const result = destroyItem(game.inventory, itemId, quantity);
    if (result.rejected === 0) set({ game: { ...game, inventory: result.inventory } });
    else notify('That item is locked or unavailable.');
  },
  toggleLock: (itemId) => {
    const game = get().game;
    if (game) set({ game: { ...game, inventory: toggleItemLock(game.inventory, itemId) } });
  },
  setSettings: (settings) => {
    const game = get().game;
    if (game) set({ game: { ...game, settings: { ...game.settings, ...settings } } });
  },
  saveNow: async () => {
    const game = get().game;
    if (!game) return false;
    set({ saveStatus: 'saving' });
    try {
      const saved = await saveProfile(game);
      set({ saveStatus: 'saved', savedAt: saved.updatedAt });
      return true;
    } catch (error) {
      console.error(error);
      set({ saveStatus: 'failed' });
      return false;
    }
  },
  clearToast: () => set({ toast: null }),
  clearOfflineSummary: () => set({ offlineSummary: null }),
}));

export const setStoreToast = notify;
