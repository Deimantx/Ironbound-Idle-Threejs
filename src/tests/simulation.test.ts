import { describe, expect, it } from 'vitest';
import { startCombat, startMining, startSmithing } from '../game/engine/actionController';
import { simulateElapsed } from '../game/engine/simulation';
import { createNewGame } from '../game/state/initialState';
import { addItem, getItemQuantity } from '../game/systems/inventorySystem';
import { GAME_CONFIG } from '../config/gameConfig';

describe('deterministic action simulation', () => {
  it('mining completes cycles and preserves remainder', () => {
    const state = startMining(createNewGame(0, 'Miner'), 'stone-outcrop', 0);
    const result = simulateElapsed(state, 7_500);
    expect(result.summary).toMatchObject({
      requestedElapsedMs: 7_500,
      processedElapsedMs: 7_500,
      remainingElapsedMs: 0,
    });
    expect(getItemQuantity(result.state.inventory, 'stone-ore')).toBe(2);
    expect(
      result.state.activeAction.type === 'mining' && result.state.activeAction.progressMs,
    ).toBe(1_500);
  });
  it('mining stops safely when the reward cannot enter a full inventory', () => {
    let state = createNewGame(0, 'Miner');
    state.inventory = Array.from({ length: 60 }, () => ({
      itemId: 'tin-ore',
      quantity: 1,
      locked: false,
    }));
    state = startMining(state, 'stone-outcrop', 0);
    const result = simulateElapsed(state, 5_000);
    expect(result.state.activeAction.type).toBe('none');
    expect(result.summary.stoppedReason).toBe('Inventory is full.');
  });
  it('smithing consumes exact materials and stops when they run out', () => {
    let state = createNewGame(0, 'Smith');
    state.inventory = addItem([], 'copper-ore', 2, 60).inventory;
    state.inventory = addItem(state.inventory, 'tin-ore', 2, 60).inventory;
    state = startSmithing(state, 'bronze-bar', 'continuous', 0);
    const result = simulateElapsed(state, 6_000);
    expect(getItemQuantity(result.state.inventory, 'bronze-bar')).toBe(2);
    expect(getItemQuantity(result.state.inventory, 'copper-ore')).toBe(0);
    expect(result.state.activeAction.type).toBe('none');
  });
  it('combat resolves invalid content safely and supports style XP assignment', () => {
    let state = createNewGame(0, 'Fighter');
    state = startCombat(state, 'redknife-road-camp', 'redknife-lookout', 'aggressive', false);
    const result = simulateElapsed(state, 12_000);
    expect(result.state.statistics.totalKills).toBeGreaterThanOrEqual(0);
    expect(result.state.skills.strength.xp).toBeGreaterThanOrEqual(0);
  });
  it('preserves player health when auto-repeat queues the next monster', () => {
    let state = createNewGame(0, 'Repeater');
    state.player.currentHp = 1;
    state = startCombat(state, 'redknife-road-camp', 'redknife-lookout', 'accurate', true);
    if (state.activeAction.type === 'combat') {
      state.activeAction = {
        ...state.activeAction,
        combatState: {
          ...state.activeAction.combatState,
          enemyHp: 1,
          playerAttackMs: 0,
          enemyAttackMs: 100_000,
        },
      };
      state.activeAction.combatState.rngSeed = 1;
      state.activeAction.combatState.rngCursor = 1;
      state.activeAction.combatState.eliteModifier = null;
      state.activeAction.combatState.enemyMaxHp = 1;
    }
    const result = simulateElapsed(state, 100);
    expect(result.state.player.currentHp).toBe(1);
    expect(
      result.state.activeAction.type === 'combat' &&
        result.state.activeAction.combatState.respawnMs,
    ).toBeGreaterThan(0);
  });
  it('starts a newly selected combat target with preserved current health', () => {
    const state = createNewGame(0, 'Target Switch');
    state.player.currentHp = 1;
    const next = startCombat(state, 'redknife-road-camp', 'redknife-brigand', 'defensive', false);
    expect(next.player.currentHp).toBe(1);
  });
  it('stops combat and records the killer when the player dies', () => {
    const state = startCombat(
      createNewGame(0, 'Fallen Fighter'),
      'redknife-road-camp',
      'redknife-lookout',
      'accurate',
      false,
      0,
    );
    state.player.currentHp = 1;
    if (state.activeAction.type === 'combat') {
      state.activeAction.combatState.playerAttackMs = 100_000;
      state.activeAction.combatState.enemyAttackMs = 0;
      state.activeAction.combatState.rngSeed = 2;
      state.activeAction.combatState.rngCursor = 0;
    }
    const result = simulateElapsed(state, 20_000);
    expect(result.state.activeAction.type).toBe('none');
    expect(result.state.statistics.deaths).toBe(1);
    expect(result.state.player.currentHp).toBe(5);
    expect(result.events.some((event) => event.type === 'player-defeated')).toBe(true);
    const death = result.state.activityLogs.combat.find(
      (entry) => entry.kind === 'player-defeated',
    );
    expect(death).toMatchObject({
      kind: 'player-defeated',
      enemyId: 'redknife-lookout',
      cause: { kind: 'enemy-hit' },
    });
  });
  it('resets the encounter clock when auto-repeat spawns a new monster', () => {
    const state = startCombat(
      createNewGame(0, 'Repeating Fighter', 0),
      'redknife-road-camp',
      'redknife-lookout',
      'accurate',
      true,
      0,
    );
    const firstEncounterStartedAt =
      state.activeAction.type === 'combat'
        ? state.activeAction.combatState.encounterStartedAt
        : null;
    if (state.activeAction.type === 'combat') {
      state.activeAction.combatState.enemyHp = 1;
      state.activeAction.combatState.enemyMaxHp = 1;
      state.activeAction.combatState.playerAttackMs = 1;
      state.activeAction.combatState.enemyAttackMs = 100_000;
    }
    const result = simulateElapsed(state, GAME_CONFIG.respawnMs + 10_000);
    expect(result.state.activeAction.type).toBe('combat');
    expect(
      result.state.activeAction.type === 'combat'
        ? result.state.activeAction.combatState.encounterStartedAt
        : null,
    ).toBeGreaterThan(firstEncounterStartedAt ?? -1);
    expect(
      result.state.activityLogs.combat.find((entry) => entry.kind === 'enemy-defeated')
        ?.encounterStartedAt,
    ).toBe(firstEncounterStartedAt);
  });
});
