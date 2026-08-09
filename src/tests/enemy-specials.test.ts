import { describe, expect, it } from 'vitest';
import { COMBAT_TUNING } from '../config/combatTuning';
import { enemyById } from '../content/enemies';
import { applyCombatEffect, getCombatEffectModifiers, tickCombatEffects } from '../game/formulas/combatEffects';
import { getEnemyCombatStats } from '../game/formulas/combatStats';
import { simulateElapsed } from '../game/engine/simulation';
import { startCombat } from '../game/engine/actionController';
import { parseGameState } from '../game/persistence/saveSchema';
import { createNewGame } from '../game/state/initialState';
import type { AreaId, CombatEffectsState, GameState } from '../game/types';

const readyBandit = (): GameState => {
  const state = createNewGame(0, 'Enemy Specials', 0);
  state.settings.huntElites = false;
  for (const skill of ['attack', 'strength', 'defence', 'hitpoints'] as const)
    state.skills[skill].level = 100;
  state.player.currentHp = 1_010;
  const started = startCombat(
    state,
    enemyById['road-bandit'].areaId as AreaId,
    'road-bandit',
    'accurate',
    false,
    0,
  );
  if (started.activeAction.type !== 'combat') throw new Error('Expected combat to start.');
  started.activeAction.combatState.enemyHp = 1_000;
  started.activeAction.combatState.enemyMaxHp = 1_000;
  started.activeAction.combatState.playerAttackMs = 100_000;
  started.activeAction.combatState.enemyAttackMs = 0;
  started.activeAction.combatState.rngSeed = 1;
  started.activeAction.combatState.rngCursor = 0;
  return started;
};

describe('Enemy Specials 1.0', () => {
  it('uses a full-charge special on the next enemy attack and resets charge', () => {
    const state = readyBandit();
    if (state.activeAction.type !== 'combat') throw new Error('Expected combat to start.');
    state.activeAction.combatState.enemySpecialCharge = COMBAT_TUNING.enemySpecialChargeMax;
    const result = simulateElapsed(state, 1);
    expect(result.events.some((event) => event.type.startsWith('enemy-special'))).toBe(true);
    expect(result.state.activeAction.type === 'combat' && result.state.activeAction.combatState.enemySpecialCharge).toBe(0);
    expect(result.state.activityLogs.combat.some((entry) => entry.kind === 'enemy-special-hit' || entry.kind === 'enemy-special-miss')).toBe(true);
  });

  it('charges only from normal attacks and successful direct player hits', () => {
    const state = readyBandit();
    const normal = simulateElapsed(state, 1);
    expect(normal.state.activeAction.type === 'combat' && normal.state.activeAction.combatState.enemySpecialCharge).toBe(
      COMBAT_TUNING.enemySpecialChargePerNormalAttack,
    );

    const playerHit = readyBandit();
    if (playerHit.activeAction.type !== 'combat') throw new Error('Expected combat to start.');
    playerHit.activeAction.combatState.enemyAttackMs = 100_000;
    playerHit.activeAction.combatState.playerAttackMs = 0;
    let directHit = simulateElapsed(playerHit, 1);
    for (let seed = 2; seed < 100 && !directHit.events.some((event) => event.type === 'player-hit'); seed += 1) {
      const retry = structuredClone(playerHit);
      if (retry.activeAction.type !== 'combat') throw new Error('Expected combat to start.');
      retry.activeAction.combatState.rngSeed = seed;
      directHit = simulateElapsed(retry, 1);
    }
    expect(directHit.events.some((event) => event.type === 'player-hit')).toBe(true);
    expect(directHit.state.activeAction.type === 'combat' && directHit.state.activeAction.combatState.enemySpecialCharge).toBe(
      COMBAT_TUNING.enemySpecialChargePerDirectPlayerHitTaken,
    );
  });

  it('applies Opportunist only below half health', () => {
    const enemy = enemyById['road-bandit'];
    expect(getEnemyCombatStats(enemy, null, enemy.maxHealth, 1).accuracyRating).toBe(enemy.accuracyRating);
    expect(getEnemyCombatStats(enemy, null, enemy.maxHealth, 0.49).accuracyRating).toBe(
      Math.round(enemy.accuracyRating * COMBAT_TUNING.banditOpportunistAccuracyMultiplier),
    );
  });

  it('supports persistent timed effects and their stat modifiers', () => {
    const effects: CombatEffectsState = { player: [], enemy: [] };
    applyCombatEffect(effects, 'enemy-damage-defence-up', 'enemy', { durationMs: 1_000 });
    expect(getCombatEffectModifiers(effects, 'enemy').damageMultiplier).toBe(1.15);
    expect(getCombatEffectModifiers(effects, 'enemy').defenceMultiplier).toBe(1.15);
    tickCombatEffects(effects, 1_000);
    expect(effects.enemy).toHaveLength(0);
  });

  it('migrates old active combat saves with zero charge and empty effect lanes', () => {
    const state = readyBandit();
    if (state.activeAction.type !== 'combat') throw new Error('Expected combat to start.');
    const legacy = structuredClone(state) as unknown as Record<string, unknown>;
    legacy.schemaVersion = 12;
    const action = legacy.activeAction as Record<string, unknown>;
    const combatState = action.combatState as Record<string, unknown>;
    delete combatState.enemySpecialCharge;
    delete combatState.effects;
    const migrated = parseGameState(JSON.stringify(legacy));
    expect(migrated.schemaVersion).toBe(15);
    expect(migrated.activeAction.type === 'combat' && migrated.activeAction.combatState.enemySpecialCharge).toBe(0);
    expect(migrated.activeAction.type === 'combat' && migrated.activeAction.combatState.effects).toEqual({ player: [], enemy: [] });
  });
});
