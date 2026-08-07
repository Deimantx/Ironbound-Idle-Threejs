import { describe, expect, it } from 'vitest';
import { MINING_TUNING } from '../config/miningTuning';
import { miningNodeById } from '../content/miningNodes';
import { validateMiningContent } from '../content/miningValidation';
import {
  getMiningEffectiveness,
  getMiningPrimaryYield,
  getMiningSwingDamage,
  getMiningSwingXp,
  getMiningTool,
} from '../game/formulas/miningFormulas';
import { startMining } from '../game/engine/actionController';
import { simulateElapsed } from '../game/engine/simulation';
import { createNewGame } from '../game/state/initialState';
import { getItemQuantity } from '../game/systems/inventorySystem';
import type { GameState } from '../game/types';

describe('Mining 1.0 formulas and simulation', () => {
  it('keeps Mining content references and tuning valid', () => {
    expect(validateMiningContent()).toEqual([]);
  });

  it('starts each rock at its highest-durability stage and decreases by stage', () => {
    for (const node of Object.values(miningNodeById)) {
      expect(node.stages[0].durability).toBeGreaterThan(node.stages.at(-1)?.durability ?? 0);
      for (let index = 1; index < node.stages.length; index += 1)
        expect(node.stages[index].durability).toBeLessThan(node.stages[index - 1].durability);
    }
  });

  it('uses explicit penetration, damage, XP, and fractional primary yield formulas', () => {
    const node = miningNodeById['copper-vein'];
    const state = createNewGame(0, 'Formula Miner');
    const tool = getMiningTool(state);
    expect(getMiningEffectiveness(tool, node)).toBe(1);
    expect(getMiningSwingDamage(tool, node)).toBe(10);
    expect(getMiningSwingXp(node, 0.5)).toBe(4);
    expect(getMiningPrimaryYield(5, node, 0.5)).toEqual({ quantity: 1, remainingProgress: 0 });
    expect(getMiningPrimaryYield(1, node, 0)).toEqual({ quantity: 0, remainingProgress: 0.1 });
  });

  it('completes a swing with rewards, stage damage, XP, and stamina cost', () => {
    const result = simulateElapsed(startMining(createNewGame(0, 'Miner'), 'copper-vein', 0), 3_000);
    expect(result.state.mining.stamina).toBe(80);
    expect(getItemQuantity(result.state.inventory, 'copper-ore')).toBe(1);
    expect(result.state.skills.mining.xp).toBe(8);
    expect(result.state.mining.nodeStates['copper-vein']?.stageDurability).toBe(90);
    expect(result.summary.completed['mine-swing:copper-vein']).toBe(1);
  });

  it('rests at zero stamina, then resumes automatically', () => {
    let state = createNewGame(0, 'Resting Miner');
    state.mining.stamina = 20;
    state = startMining(state, 'copper-vein', 0);
    const afterSwing = simulateElapsed(state, 3_000).state;
    expect(afterSwing.mining.stamina).toBe(0);
    expect(afterSwing.activeAction.type === 'mining' && afterSwing.activeAction.phase).toBe('rest');
    const afterRest = simulateElapsed(afterSwing, MINING_TUNING.restDurationMs);
    expect(afterRest.state.mining.stamina).toBe(100);
    expect(
      afterRest.state.activeAction.type === 'mining' && afterRest.state.activeAction.phase,
    ).toBe('swing');
    expect(afterRest.summary.xpGained.mining ?? 0).toBe(0);
  });

  it('orders respawn before rest when the final swing also empties stamina', () => {
    let state = createNewGame(0, 'Respawn Miner');
    state.mining.stamina = 20;
    state.mining.nodeStates['copper-vein'] = {
      stageIndex: 4,
      stageDurability: 1,
      primaryYieldProgress: 0,
      respawnRemainingMs: 0,
      rngSeed: 1,
      rngCursor: 0,
    };
    state = startMining(state, 'copper-vein', 0);
    const depleted = simulateElapsed(state, 3_000).state;
    expect(depleted.activeAction.type === 'mining' && depleted.activeAction.phase).toBe('respawn');
    expect(depleted.mining.nodeStates['copper-vein']?.respawnRemainingMs).toBe(15_000);
    const respawned = simulateElapsed(depleted, 15_000).state;
    expect(respawned.activeAction.type === 'mining' && respawned.activeAction.phase).toBe('rest');
    expect(respawned.mining.nodeStates['copper-vein']?.stageIndex).toBe(0);
  });

  it('rejects a complete reward bundle atomically when inventory is full', () => {
    let state = createNewGame(0, 'Full Pack');
    state.inventory = Array.from({ length: 60 }, () => ({
      itemId: 'tin-ore',
      quantity: 1,
      locked: false,
    }));
    state = startMining(state, 'copper-vein', 0);
    const before = structuredClone(state.mining);
    const result = simulateElapsed(state, 3_000);
    expect(result.state.activeAction.type).toBe('none');
    expect(result.summary.stoppedReason).toBe('Inventory is full.');
    expect(result.state.mining).toEqual(before);
    expect(result.state.skills.mining.xp).toBe(0);
  });

  it('is deterministic and chunking elapsed time produces the same Mining state', () => {
    const initial = startMining(createNewGame(0, 'Deterministic Miner'), 'copper-vein', 0);
    const large = simulateElapsed(initial, 60_000);
    let chunked: GameState = initial;
    for (let index = 0; index < 60; index += 1) chunked = simulateElapsed(chunked, 1_000).state;
    expect(chunked.inventory).toEqual(large.state.inventory);
    expect(chunked.mining).toEqual(large.state.mining);
    expect(chunked.skills.mining).toEqual(large.state.skills.mining);
    expect(chunked.statistics).toEqual(large.state.statistics);
  });

  it('falls back safely to no-tool Mining', () => {
    const state = createNewGame(0, 'Barehanded Miner');
    state.equipment = {};
    const result = simulateElapsed(startMining(state, 'copper-vein', 0), 5_000);
    expect(result.summary.xpGained.mining).toBe(1);
    expect(getItemQuantity(result.state.inventory, 'copper-ore')).toBe(0);
    expect(result.state.mining.stamina).toBe(75);
  });
});
