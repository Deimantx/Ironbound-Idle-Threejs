import { create } from 'zustand';
import { saveProfile } from '../persistence/saveManager';
import { simulateElapsed } from '../engine/simulation';
import { setCombatAutoRepeat, setCombatStyle, startCombat, startMining, startSmithing } from '../engine/actionController';
import { destroyItem, toggleItemLock } from '../systems/inventorySystem';
import { equipItem, unequipItem } from '../systems/equipmentSystem';
import { emptyCombatSession } from '../types';
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

type SaveStatus = 'saved' | 'saving' | 'failed';
interface Store {
  game: GameState | null;
  saveStatus: SaveStatus;
  savedAt: number | null;
  toast: string | null;
  offlineSummary: SimulationSummary | null;
  setGame: (game: GameState | null, offlineSummary?: SimulationSummary | null) => void;
  tick: (now: number) => void;
  startMining: (nodeId: MiningNodeId) => void;
  startSmithing: (recipeId: string, mode: QuantityMode) => void;
  startCombat: (areaId: AreaId, enemyId: EnemyId, style: CombatStyle, autoRepeat: boolean) => void;
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
}

let lastTick = Date.now();
const notify = (message: string): void => {
  useGameStore.setState({ toast: message });
};

const mergeCombatSession = (
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
  next.goldGained += summary.goldGained;
  for (const [itemId, amount] of Object.entries(summary.itemsGained))
    next.lootGained[itemId] = (next.lootGained[itemId] ?? 0) + amount;
  for (const event of events) {
    if (event.type === 'player-hit') {
      next.playerAttacks += 1;
      next.playerHits += 1;
      next.damageDealt += event.damage;
    } else if (event.type === 'enemy-hit') {
      next.enemyAttacks += 1;
      next.enemyHits += 1;
      next.damageTaken += event.damage;
    }
  }
  return next;
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
    lastTick = Date.now();
    set({
      game,
      offlineSummary,
      saveStatus: 'saved',
      combatEvents: [],
      combatSession: emptyCombatSession(),
    });
  },
  tick: (now) => {
    const game = get().game;
    if (!game) return;
    const elapsed = Math.max(0, Math.min(1000, now - lastTick));
    lastTick = now;
    if (elapsed <= 0) return;
    const result = simulateElapsed(game, elapsed);
    const isCombat = game.activeAction.type === 'combat';
    set({
      game: result.state,
      combatEvents: result.events.length
        ? [...get().combatEvents, ...result.events].slice(-64)
        : get().combatEvents,
      combatSession: isCombat
        ? mergeCombatSession(get().combatSession, result.summary, result.events)
        : get().combatSession,
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
  startCombat: (areaId, enemyId, style, autoRepeat) => {
    const game = get().game;
    if (game)
      set({
        game: startCombat(game, areaId, enemyId, style, autoRepeat),
        combatEvents: [],
        combatSession: emptyCombatSession(enemyId, Date.now()),
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
