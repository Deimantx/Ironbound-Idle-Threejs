import { describe, expect, it } from 'vitest';
import { enemyById } from '../content/enemies';
import { getEnemyCombatStats } from '../game/formulas/combatStats';
import { getCombatDamageXp, getHitChance } from '../game/formulas/combatFormulas';
import { getDerivedStats } from '../game/formulas/statFormulas';
import {
  selectCombatSkillXpPerHour,
  selectExpectedKillsPerHour,
} from '../game/selectors/combatSelectors';
import { startCombat, setCombatStyle, switchCombatTarget } from '../game/engine/actionController';
import { simulateElapsed } from '../game/engine/simulation';
import { createNewGame } from '../game/state/initialState';
import type { AreaId, CombatStyle, EnemyId, GameState } from '../game/types';

const readyCombat = (
  enemyId: EnemyId = 'redknife-lookout',
  style: CombatStyle = 'accurate',
): GameState => {
  const state = createNewGame(0, 'Combat 2.2', 0);
  state.settings.huntElites = false;
  for (const skill of ['attack', 'strength', 'defence', 'hitpoints'] as const)
    state.skills[skill].level = 100;
  const combat = startCombat(state, enemyById[enemyId].areaId as AreaId, enemyId, style, false, 0);
  if (combat.activeAction.type !== 'combat') throw new Error('Expected active combat.');
  combat.activeAction.combatState = {
    ...combat.activeAction.combatState,
    enemyHp: 1_000,
    enemyMaxHp: 1_000,
    playerAttackMs: 0,
    enemyAttackMs: 100_000,
    eliteModifier: null,
    eliteAnnounced: true,
    rngSeed: 1,
    rngCursor: 0,
  };
  return combat;
};

describe('Combat 2.2 stance timing', () => {
  it('applies Accurate → Aggressive after the current attack and assigns XP by attack style', () => {
    let state = readyCombat();
    state = setCombatStyle(state, 'aggressive');
    expect(state.activeAction.type === 'combat' && state.activeAction.style).toBe('accurate');
    expect(state.activeAction.type === 'combat' && state.activeAction.pendingStyle).toBe(
      'aggressive',
    );

    const first = simulateElapsed(state, 1);
    expect(first.summary.xpGained.attack).toBe(
      getCombatDamageXp(first.events.find((event) => event.type === 'player-hit')?.damage ?? 0),
    );
    expect(first.summary.xpGained.strength ?? 0).toBe(0);
    expect(first.state.activeAction.type === 'combat' && first.state.activeAction.style).toBe(
      'aggressive',
    );
    expect(
      first.state.activeAction.type === 'combat' && first.state.activeAction.pendingStyle,
    ).toBeNull();

    const second = simulateElapsed(first.state, 2_401);
    expect(second.summary.xpGained.strength).toBeGreaterThan(0);
    expect(second.summary.xpGained.attack ?? 0).toBe(0);
  });

  it('applies Aggressive → Defensive after the current attack', () => {
    let state = readyCombat('redknife-lookout', 'aggressive');
    state = setCombatStyle(state, 'defensive');
    expect(state.activeAction.type === 'combat' && state.activeAction.style).toBe('aggressive');
    expect(state.activeAction.type === 'combat' && state.activeAction.pendingStyle).toBe(
      'defensive',
    );
    const result = simulateElapsed(state, 1);
    expect(result.state.activeAction.type === 'combat' && result.state.activeAction.style).toBe(
      'defensive',
    );
    expect(
      result.state.activeAction.type === 'combat' && result.state.activeAction.pendingStyle,
    ).toBeNull();
    expect(result.summary.xpGained.strength).toBeGreaterThan(0);
    expect(result.summary.xpGained.defence ?? 0).toBe(0);
  });

  it('keeps only the latest queued style and lets the active style cancel it', () => {
    let state = readyCombat();
    state = setCombatStyle(state, 'aggressive');
    state = setCombatStyle(state, 'defensive');
    expect(state.activeAction.type === 'combat' && state.activeAction.pendingStyle).toBe(
      'defensive',
    );
    state = setCombatStyle(state, 'accurate');
    expect(state.activeAction.type === 'combat' && state.activeAction.style).toBe('accurate');
    expect(state.activeAction.type === 'combat' && state.activeAction.pendingStyle).toBeNull();
  });

  it('applies a style immediately during respawn', () => {
    const state = readyCombat();
    if (state.activeAction.type !== 'combat') throw new Error('Expected active combat.');
    state.activeAction.combatState.enemyHp = 0;
    state.activeAction.combatState.respawnMs = 500;
    const next = setCombatStyle(state, 'defensive');
    expect(next.activeAction.type === 'combat' && next.activeAction.style).toBe('defensive');
    expect(next.activeAction.type === 'combat' && next.activeAction.pendingStyle).toBeNull();
  });

  it('completes a queued style switch after a miss and after a special attack', () => {
    let missed = readyCombat();
    missed.skills.attack.level = 1;
    missed = setCombatStyle(missed, 'aggressive');
    const missResult = simulateElapsed(missed, 1);
    expect(missResult.events.some((event) => event.type === 'player-miss')).toBe(true);
    expect(
      missResult.state.activeAction.type === 'combat' && missResult.state.activeAction.style,
    ).toBe('aggressive');

    let special = readyCombat();
    special.equipment.weapon = 'bronze-sword';
    if (special.activeAction.type !== 'combat') throw new Error('Expected active combat.');
    special.activeAction.combatState.adrenaline = 100;
    special = setCombatStyle(special, 'aggressive');
    const specialResult = simulateElapsed(special, 1);
    expect(specialResult.events.some((event) => event.type === 'player-hit' && event.special)).toBe(
      true,
    );
    expect(
      specialResult.state.activeAction.type === 'combat' && specialResult.state.activeAction.style,
    ).toBe('aggressive');
  });

  it('uses the newly active Defensive style for an enemy attack at the same timestamp', () => {
    const state = readyCombat('brambletooth-boarhandler');
    state.skills.attack.level = 1;
    state.skills.defence.level = 50;
    state.player.currentHp = getDerivedStats(state).maxHealth;
    if (state.activeAction !== undefined && state.activeAction.type === 'combat') {
      state.activeAction.combatState.playerAttackMs = 0;
      state.activeAction.combatState.enemyAttackMs = 0;
      state.activeAction.combatState.rngSeed = 30;
      state.activeAction.combatState.rngCursor = 0;
    }
    const accurateChance = getHitChance(
      getEnemyCombatStats(enemyById['brambletooth-boarhandler']).accuracyRating,
      getDerivedStats(state, 'accurate').effectiveDefenceRating,
    );
    const defensiveChance = getHitChance(
      getEnemyCombatStats(enemyById['brambletooth-boarhandler']).accuracyRating,
      getDerivedStats(state, 'defensive').effectiveDefenceRating,
    );
    expect(defensiveChance).toBeLessThan(accurateChance);
    const queued = setCombatStyle(state, 'defensive');
    const result = simulateElapsed(queued, 1);
    expect(result.events.some((event) => event.type === 'player-miss')).toBe(true);
    expect(result.events.some((event) => event.type === 'enemy-miss')).toBe(true);
    expect(result.state.activeAction.type === 'combat' && result.state.activeAction.style).toBe(
      'defensive',
    );
  });
});

describe('Combat 2.2 target switching and selectors', () => {
  it('preserves current HP when switching from one active target to another', () => {
    const state = createNewGame(0, 'Target HP', 0);
    state.skills.hitpoints.level = 4;
    state.equipment.head = 'bronze-helmet';
    const active = startCombat(state, 'redknife-road-camp', 'redknife-lookout', 'accurate', true, 0);
    active.player.currentHp = 31;
    const inventoryBefore = structuredClone(active.inventory);
    const next = switchCombatTarget(
      active,
      'redknife-road-camp',
      'redknife-brigand',
      'accurate',
      true,
      10,
    );
    expect(getDerivedStats(active).maxHealth).toBe(52);
    expect(next.player.currentHp).toBe(31);
    expect(next.activeAction.type === 'combat' && next.activeAction.enemyId).toBe(
      'redknife-brigand',
    );
    expect(
      next.activeAction.type === 'combat' && next.activeAction.combatState.enemyHp,
    ).toBeGreaterThan(0);
    expect(next.inventory).toEqual(inventoryBefore);
  });

  it('estimates selected-style combat XP/hour from realistic kill throughput', () => {
    const state = readyCombat();
    const xpPerHour = selectCombatSkillXpPerHour(state, enemyById['redknife-lookout'], 'accurate');
    expect(xpPerHour).toBeGreaterThan(0);
    expect(xpPerHour).toBeCloseTo(
      selectExpectedKillsPerHour(state, enemyById['redknife-lookout'], 'accurate') *
        getCombatDamageXp(getEnemyCombatStats(enemyById['redknife-lookout']).maxHealth),
      0,
    );
  });
});
