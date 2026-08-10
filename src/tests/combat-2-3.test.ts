import { describe, expect, it } from 'vitest';
import { startCombat, startMining, startSmithing } from '../game/engine/actionController';
import { simulateElapsed } from '../game/engine/simulation';
import { createNewGame } from '../game/state/initialState';
import { addItem } from '../game/systems/inventorySystem';

const woundedState = () => {
  const state = createNewGame(0, 'Combat 2.3', 0);
  state.skills.hitpoints = { xp: 0, level: 9 };
  state.player.currentHp = 40;
  return state;
};

describe('Combat 2.3 health attrition', () => {
  it('recovers 1% of maximum HP per second while idle and clamps at maximum', () => {
    const state = woundedState();
    const result = simulateElapsed(state, 10_000);

    expect(result.state.player.currentHp).toBeCloseTo(50, 8);

    result.state.player.currentHp = 99;
    expect(simulateElapsed(result.state, 10_000).state.player.currentHp).toBe(100);
  });

  it('recovers while mining and smithing while those activities progress', () => {
    const mining = simulateElapsed(startMining(woundedState(), 'stone-outcrop', 0), 5_000);
    expect(mining.state.player.currentHp).toBeCloseTo(45, 8);
    expect(mining.summary.completed['mine-swing:stone-outcrop']).toBe(1);

    const smithingState = woundedState();
    smithingState.inventory = addItem([], 'copper-ore', 2, 60).inventory;
    smithingState.inventory = addItem(smithingState.inventory, 'tin-ore', 2, 60).inventory;
    const smithing = simulateElapsed(
      startSmithing(smithingState, 'bronze-bar', 'continuous', 0),
      3_000,
    );
    expect(smithing.state.player.currentHp).toBeCloseTo(43, 8);
    expect(smithing.summary.completed['smelting:bronze-bar']).toBe(1);
  });

  it('does not recover during combat, including when auto-repeat is respawning', () => {
    const state = startCombat(woundedState(), 'redknife-road-camp', 'redknife-lookout', 'accurate', true, 0);
    if (state.activeAction.type !== 'combat') throw new Error('Expected combat.');
    state.activeAction.combatState = {
      ...state.activeAction.combatState,
      enemyHp: 1,
      enemyMaxHp: 1,
      playerAttackMs: 0,
      enemyAttackMs: 100_000,
      rngSeed: 1,
      rngCursor: 1,
    };
    const result = simulateElapsed(state, 100);
    expect(result.state.player.currentHp).toBe(40);
    expect(
      result.state.activeAction.type === 'combat' &&
        result.state.activeAction.combatState.respawnMs,
    ).toBeGreaterThan(0);

    const duringCombat = simulateElapsed(result.state, 1_000);
    expect(duringCombat.state.player.currentHp).toBe(40);
  });

  it('recovers after death without automatically resuming combat', () => {
    const state = startCombat(woundedState(), 'redknife-road-camp', 'redknife-lookout', 'accurate', false, 0);
    if (state.activeAction.type !== 'combat') throw new Error('Expected combat.');
    state.player.currentHp = 1;
    state.activeAction.combatState = {
      ...state.activeAction.combatState,
      playerAttackMs: 100_000,
      enemyAttackMs: 0,
      rngSeed: 2,
      rngCursor: 0,
    };
    const death = simulateElapsed(state, 20_000);
    expect(death.state.activeAction.type).toBe('none');
    expect(death.state.player.currentHp).toBe(25);

    const recovery = simulateElapsed(death.state, 10_000);
    expect(recovery.state.activeAction.type).toBe('none');
    expect(recovery.state.player.currentHp).toBeCloseTo(35, 8);
  });
});
