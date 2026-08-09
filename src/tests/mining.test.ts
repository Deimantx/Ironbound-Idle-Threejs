import { describe, expect, it } from 'vitest';
import { MINING_TUNING } from '../config/miningTuning';
import { MINING_NODES, miningNodeById } from '../content/miningNodes';
import { validateMiningContent } from '../content/miningValidation';
import {
  getMiningEffectiveness,
  getMiningPrimaryYield,
  getMiningStageBonusChance,
  getMiningSwingsBeforeRest,
  getMiningSwingDamage,
  getMiningSwingXp,
  getMiningTool,
  getRecommendedMiningToolForNode,
  nextMiningRandom,
} from '../game/formulas/miningFormulas';
import { startMining } from '../game/engine/actionController';
import { simulateElapsed } from '../game/engine/simulation';
import { createNewGame } from '../game/state/initialState';
import { getItemQuantity } from '../game/systems/inventorySystem';
import type { GameState } from '../game/types';
import { formatDropChance } from '../app/shared/formatters';

describe('Mining 1.1 formulas and simulation', () => {
  it('authored Phase One content is exactly Stone, Iron, and Coal', () => {
    expect(MINING_NODES.map((node) => node.id)).toEqual([
      'stone-outcrop',
      'iron-vein',
      'coal-seam',
    ]);
    expect(miningNodeById['stone-outcrop']).toMatchObject({
      name: 'Stone Outcrop',
      level: 1,
      primaryRewardItemId: 'stone-ore',
    });
    expect(miningNodeById['iron-vein'].level).toBe(15);
    expect(miningNodeById['coal-seam']).toMatchObject({ name: 'Coal Seam', level: 30 });
  });

  it('keeps Mining content references and tuning valid', () => {
    expect(validateMiningContent()).toEqual([]);
  });

  it('uses intentional centerward durability and bonus progression', () => {
    for (const node of MINING_NODES) {
      expect(node.stages.map((stage) => stage.durability)).toEqual(
        [...node.stages]
          .sort((left, right) => left.durability - right.durability)
          .map((stage) => stage.durability),
      );
      expect(node.stages.map((stage) => stage.bonusChanceMultiplier)).toEqual([
        0.5, 0.75, 1, 1.35, 1.8,
      ]);
    }
    expect(miningNodeById['stone-outcrop'].stages.map((stage) => stage.durability)).toEqual([
      60, 70, 80, 90, 100,
    ]);
  });

  it('uses explicit penetration, damage, XP, and fractional primary yield formulas', () => {
    const node = miningNodeById['stone-outcrop'];
    const state = createNewGame(0, 'Formula Miner');
    const tool = getMiningTool(state);
    expect(getMiningEffectiveness(tool, node)).toBe(1);
    expect(getMiningSwingDamage(tool, node)).toBe(10);
    expect(getMiningSwingXp(node, 0.5)).toBe(4);
    expect(getMiningPrimaryYield(5, node, 0.5)).toEqual({ quantity: 1, remainingProgress: 0 });
    expect(getMiningPrimaryYield(1, node, 0)).toEqual({ quantity: 0, remainingProgress: 0.1 });
  });

  it('counts the final swing before rest correctly', () => {
    expect(getMiningSwingsBeforeRest(100, 20)).toBe(5);
    expect(getMiningSwingsBeforeRest(80, 20)).toBe(4);
    expect(getMiningSwingsBeforeRest(20, 20)).toBe(1);
    expect(getMiningSwingsBeforeRest(10, 20)).toBe(1);
    expect(getMiningSwingsBeforeRest(0, 20)).toBe(0);
  });

  it('recommends the lowest full-penetration pickaxe and formats drop chances compactly', () => {
    expect(getRecommendedMiningToolForNode(miningNodeById['stone-outcrop'])?.itemId).toBe(
      'worn-pickaxe',
    );
    expect(getRecommendedMiningToolForNode(miningNodeById['iron-vein'])?.itemId).toBe(
      'iron-pickaxe',
    );
    expect(getRecommendedMiningToolForNode(miningNodeById['coal-seam'])?.itemId).toBe(
      'iron-pickaxe',
    );
    expect(formatDropChance(0.144)).toBe('14%');
    expect(formatDropChance(0.08)).toBe('8%');
    expect(formatDropChance(0.0126)).toBe('1.3%');
    expect(formatDropChance(0.0072)).toBe('0.72%');
    expect(formatDropChance(0.003)).toBe('0.30%');
  });

  it('completes a Stone swing with primary rewards, stage damage, XP, and stamina cost', () => {
    const result = simulateElapsed(
      startMining(createNewGame(0, 'Miner'), 'stone-outcrop', 0),
      3_000,
    );
    expect(result.state.mining.stamina).toBe(80);
    expect(getItemQuantity(result.state.inventory, 'stone-ore')).toBe(1);
    expect(result.state.skills.mining.xp).toBe(8);
    expect(result.state.mining.nodeStates['stone-outcrop']?.stageDurability).toBe(50);
    expect(result.summary.completed['mine-swing:stone-outcrop']).toBe(1);
  });

  it('uses the Stone Iron Ore byproduct and scales its Stage 5 chance', () => {
    const node = miningNodeById['stone-outcrop'];
    expect(getMiningStageBonusChance(node.bonusDrops[0], node.stages[4])).toBeCloseTo(0.144);

    let seed = 1;
    while (true) {
      const sample = { rngSeed: seed, rngCursor: 0 };
      if (nextMiningRandom(sample) < node.bonusDrops[0].chance) break;
      seed += 1;
    }
    const state = createNewGame(0, 'Byproduct Miner');
    state.mining.nodeStates['stone-outcrop'] = {
      stageIndex: 0,
      stageDurability: 60,
      primaryYieldProgress: 0,
      respawnRemainingMs: 0,
      rngSeed: seed,
      rngCursor: 0,
    };
    const result = simulateElapsed(startMining(state, 'stone-outcrop', 0), 3_000);
    expect(getItemQuantity(result.state.inventory, 'stone-ore')).toBe(1);
    expect(getItemQuantity(result.state.inventory, 'iron-ore')).toBe(1);
  });

  it('transitions to a tougher inner stage with its authored maximum', () => {
    const state = createNewGame(0, 'Stage Miner');
    state.mining.nodeStates['stone-outcrop'] = {
      stageIndex: 0,
      stageDurability: 1,
      primaryYieldProgress: 0,
      respawnRemainingMs: 0,
      rngSeed: 1,
      rngCursor: 0,
    };
    const result = simulateElapsed(startMining(state, 'stone-outcrop', 0), 3_000);
    expect(result.state.mining.nodeStates['stone-outcrop']).toMatchObject({
      stageIndex: 1,
      stageDurability: 61,
    });
  });

  it('rests at zero stamina, then resumes automatically', () => {
    let state = createNewGame(0, 'Resting Miner');
    state.mining.stamina = 20;
    state = startMining(state, 'stone-outcrop', 0);
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
    state.mining.nodeStates['stone-outcrop'] = {
      stageIndex: 4,
      stageDurability: 1,
      primaryYieldProgress: 0,
      respawnRemainingMs: 0,
      rngSeed: 1,
      rngCursor: 0,
    };
    state = startMining(state, 'stone-outcrop', 0);
    const depleted = simulateElapsed(state, 3_000).state;
    expect(depleted.activeAction.type === 'mining' && depleted.activeAction.phase).toBe('respawn');
    expect(depleted.mining.nodeStates['stone-outcrop']?.respawnRemainingMs).toBe(15_000);
    const respawned = simulateElapsed(depleted, 15_000).state;
    expect(respawned.activeAction.type === 'mining' && respawned.activeAction.phase).toBe('rest');
    expect(respawned.mining.nodeStates['stone-outcrop']?.stageIndex).toBe(0);
    expect(respawned.mining.nodeStates['stone-outcrop']?.stageDurability).toBe(60);
  });

  it('rejects a complete reward bundle atomically when inventory is full', () => {
    let state = createNewGame(0, 'Full Pack');
    state.inventory = Array.from({ length: 60 }, () => ({
      itemId: 'iron-ore',
      quantity: 1,
      locked: false,
    }));
    state = startMining(state, 'stone-outcrop', 0);
    const before = structuredClone(state.mining);
    const result = simulateElapsed(state, 3_000);
    expect(result.state.activeAction.type).toBe('none');
    expect(result.summary.stoppedReason).toBe('Inventory is full.');
    expect(result.state.mining).toEqual(before);
    expect(result.state.skills.mining.xp).toBe(0);
  });

  it('is deterministic and chunking elapsed time produces the same Mining state', () => {
    const initial = startMining(createNewGame(0, 'Deterministic Miner'), 'stone-outcrop', 0);
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
    const result = simulateElapsed(startMining(state, 'stone-outcrop', 0), 5_000);
    expect(result.summary.xpGained.mining).toBe(1);
    expect(getItemQuantity(result.state.inventory, 'stone-ore')).toBe(0);
    expect(result.state.mining.stamina).toBe(75);
  });
});
