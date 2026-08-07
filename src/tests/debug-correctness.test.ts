import { describe, expect, it } from 'vitest';
import {
  createDebugController,
  debugAddGold,
  debugAddItem,
  debugAddLevelsToSkills,
  debugAdvanceElapsed,
  debugAdvanceOneCycle,
  debugKillCurrentEnemy,
  debugKillPlayer,
  debugSetSkillXp,
  debugStartCombat,
  debugToggleLock,
} from '../game/debug/debugActions';
import { getTimeUntilNextCombatEvent } from '../game/engine/simulation';
import { getXpForLevel } from '../game/formulas/experienceFormulas';
import { emptyCombatSession, type CombatVisualEvent, type GameState } from '../game/types';
import { createNewGame } from '../game/state/initialState';
import { useGameStore } from '../game/state/gameStore';

const fresh = (): GameState => createNewGame(0, 'Correctness Tester', 1000);

const combatState = (): GameState => {
  const state = debugStartCombat(fresh(), 'training-grounds', 'forest-rat').state!;
  for (const skill of ['attack', 'strength', 'defence', 'hitpoints'] as const)
    state.skills[skill] = { level: 100, xp: getXpForLevel(100) };
  state.player.currentHp = 100;
  return state;
};

const createStoreController = (saveNow: () => Promise<boolean> = async () => true) =>
  createDebugController({
    getGame: () => useGameStore.getState().game,
    applyMutation: (state, options) => useGameStore.getState().applyDebugState(state, options),
    saveNow,
  });

describe('Debug Tools 2.0.1 correctness', () => {
  it('preserves Combat session totals and visual history for ordinary mutations', async () => {
    const state = combatState();
    useGameStore.getState().setGame(state);
    const visualEvent: CombatVisualEvent = {
      id: 'existing-event',
      type: 'enemy-miss',
      enemyId: 'forest-rat',
      damage: 0,
      at: 1000,
    };
    useGameStore.setState({
      combatEvents: [visualEvent],
      combatSession: {
        ...emptyCombatSession('forest-rat', 1000, 1000),
        playerAttacks: 7,
        damageDealt: 12,
        goldGained: 4,
      },
    });
    const controller = createStoreController();

    controller.execute((current) => debugAddGold(current, 10));
    controller.execute((current) => debugAddItem(current, 'iron-ore', 1));
    controller.execute((current) => debugSetSkillXp(current, 'mining', 12_345));
    controller.execute((current) => debugToggleLock(current, 'iron-ore'));
    await controller.save();

    const store = useGameStore.getState();
    expect(store.game?.activeAction.type).toBe('combat');
    expect(store.combatSession.playerAttacks).toBe(7);
    expect(store.combatSession.damageDealt).toBe(12);
    expect(store.combatSession.goldGained).toBe(4);
    expect(store.combatEvents).toEqual([visualEvent]);
    expect(store.game?.inventory.find((stack) => stack.itemId === 'iron-ore')?.locked).toBe(true);
  });

  it('merges debug Combat simulation summaries and appends visual events', async () => {
    useGameStore.getState().setGame(combatState());
    useGameStore.setState({
      combatSession: { ...emptyCombatSession('forest-rat', 1000, 1000), playerAttacks: 3 },
      combatEvents: [],
    });
    const controller = createStoreController();
    const before = useGameStore.getState().combatSession.playerAttacks;

    controller.execute((state) => debugAdvanceElapsed(state, 5_000));
    await controller.save();

    const store = useGameStore.getState();
    expect(store.combatSession.playerAttacks).toBeGreaterThan(before);
    expect(store.combatEvents.length).toBeGreaterThan(0);
    expect(store.game?.activeAction.type).toBe('combat');
  });

  it('serializes debug saves and continues after a failed save', async () => {
    let state = fresh();
    let activeSaves = 0;
    let maximumConcurrentSaves = 0;
    let calls = 0;
    const savedGold: number[] = [];
    const controller = createDebugController({
      getGame: () => state,
      applyMutation: (next) => {
        state = next;
      },
      saveNow: async () => {
        activeSaves += 1;
        maximumConcurrentSaves = Math.max(maximumConcurrentSaves, activeSaves);
        calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 2));
        savedGold.push(state.gold);
        activeSaves -= 1;
        if (calls === 1) return false;
        return true;
      },
    });

    controller.execute((current) => debugAddGold(current, 1));
    controller.execute((current) => debugAddGold(current, 2));
    await controller.save();

    expect(maximumConcurrentSaves).toBe(1);
    expect(calls).toBe(3);
    expect(savedGold.at(-1)).toBe(3);
  });

  it('batches multi-skill level changes into one mutation and save', async () => {
    let state = fresh();
    let saves = 0;
    let resolveSaveStarted: (() => void) | undefined;
    const saveStarted = new Promise<void>((resolve) => {
      resolveSaveStarted = resolve;
    });
    const controller = createDebugController({
      getGame: () => state,
      applyMutation: (next) => {
        state = next;
      },
      saveNow: async () => {
        saves += 1;
        resolveSaveStarted?.();
        return true;
      },
    });
    const result = controller.execute((current) =>
      debugAddLevelsToSkills(current, ['attack', 'strength', 'defence', 'hitpoints'], 2),
    );

    await saveStarted;
    expect(result.ok).toBe(true);
    expect(saves).toBe(1);
    expect(state.skills.attack.level).toBe(3);
    expect(state.skills.strength.level).toBe(3);
    expect(state.skills.defence.level).toBe(3);
    expect(state.skills.hitpoints.level).toBe(3);
  });

  it('advances to each actual Combat event instead of a hard-coded second', () => {
    const playerFirst = combatState();
    if (playerFirst.activeAction.type !== 'combat') throw new Error('Combat did not start');
    playerFirst.activeAction.combatState.playerAttackMs = 250;
    playerFirst.activeAction.combatState.enemyAttackMs = 900;
    expect(getTimeUntilNextCombatEvent(playerFirst)).toBe(250);
    const playerResult = debugAdvanceOneCycle(playerFirst);
    if (!playerResult.summary) throw new Error('Expected combat summary');
    expect(playerResult.summary.combatStats.playerAttacks).toBe(1);
    expect(playerResult.summary.combatStats.enemyAttacks).toBe(0);

    const enemyFirst = combatState();
    if (enemyFirst.activeAction.type !== 'combat') throw new Error('Combat did not start');
    enemyFirst.activeAction.combatState.playerAttackMs = 800;
    enemyFirst.activeAction.combatState.enemyAttackMs = 200;
    expect(getTimeUntilNextCombatEvent(enemyFirst)).toBe(200);
    const enemyResult = debugAdvanceOneCycle(enemyFirst);
    if (!enemyResult.summary) throw new Error('Expected combat summary');
    expect(enemyResult.summary.combatStats.enemyAttacks).toBe(1);
    expect(enemyResult.summary.combatStats.playerAttacks).toBe(0);

    const respawning = combatState();
    if (respawning.activeAction.type !== 'combat') throw new Error('Combat did not start');
    respawning.activeAction.combatState.respawnMs = 500;
    expect(getTimeUntilNextCombatEvent(respawning)).toBe(500);
  });

  it('kills the current enemy without healing low player HP', () => {
    const state = combatState();
    state.player.currentHp = 3;
    const result = debugKillCurrentEnemy(state);
    expect(result.result.ok).toBe(true);
    expect(result.summary?.enemiesDefeated).toBe(1);
    expect(result.events?.some((event) => event.type === 'enemy-defeated')).toBe(true);
    expect(result.state?.player.currentHp).toBe(3);
  });

  it('rejects killing the current enemy when player HP is already zero', () => {
    const state = combatState();
    state.player.currentHp = 0;
    const result = debugKillCurrentEnemy(state);
    expect(result.result).toEqual({
      ok: false,
      message: 'The player has no HP and cannot kill the current enemy.',
    });
    expect(result.state).toBeUndefined();
    expect(result.summary).toBeUndefined();
    expect(result.events).toBeUndefined();
  });

  it('resolves Combat death immediately and rejects the action outside Combat', () => {
    const result = debugKillPlayer(combatState());
    expect(result.result.ok).toBe(true);
    expect(result.summary?.deaths).toBe(1);
    expect(result.state?.activeAction.type).toBe('none');
    expect(result.state?.player.currentHp).toBeGreaterThan(0);
    expect(result.events?.some((event) => event.type === 'player-defeated')).toBe(true);
    expect(debugKillPlayer(fresh()).result).toEqual({
      ok: false,
      message: 'Combat is not active.',
    });
  });
});
