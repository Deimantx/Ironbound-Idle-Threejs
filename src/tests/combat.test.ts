import { describe, expect, it } from 'vitest';
import { startCombat } from '../game/engine/actionController';
import {
  getCombatDamageXp,
  getCombatStyleSkill,
  getHitpointsDamageXp,
} from '../game/formulas/combatFormulas';
import { simulateElapsed } from '../game/engine/simulation';
import {
  displayDropChance,
  selectAreaThreat,
  selectEnemyAttackProgress,
  selectPlayerAttackProgress,
  selectPlayerEstimatedDps,
  selectZoneUnlockProgress,
} from '../game/selectors/combatSelectors';
import { createNewGame } from '../game/state/initialState';

describe('combat selectors and visual events', () => {
  it('awards combat XP from damage, not from kill completion', () => {
    expect(getCombatDamageXp(7)).toBe(35);
    expect(getHitpointsDamageXp(7)).toBe(7);
    expect(getCombatStyleSkill('accurate')).toBe('attack');
    expect(getCombatStyleSkill('aggressive')).toBe('strength');
    expect(getCombatStyleSkill('defensive')).toBe('defence');
  });

  it('derives authoritative attack progress and estimates from combat state', () => {
    let state = createNewGame(0, 'Selector');
    state = startCombat(state, 'training-grounds', 'forest-rat', 'accurate', true);
    state.updatedAt = 1_000;
    expect(selectPlayerAttackProgress(state, 1_000).ratio).toBe(0);
    expect(selectEnemyAttackProgress(state, 1_000).ratio).toBe(0);
    expect(selectPlayerEstimatedDps(state)).toBeGreaterThan(0);
    expect(selectAreaThreat(state)).toMatch(/Trivial|Easy|Fair|Dangerous|Deadly/);
  });

  it('converts known drop probabilities without inventing certainty', () => {
    expect(displayDropChance(0.65)).toBe('65%');
    expect(displayDropChance(0.01)).toBe('1%');
  });

  it('exposes a bounded authoritative visual event stream from combat simulation', () => {
    const state = startCombat(createNewGame(0, 'Events'), 'training-grounds', 'forest-rat', 'accurate', true);
    const result = simulateElapsed(state, 60_000);
    expect(result.events.length).toBeGreaterThan(0);
    expect(result.events.length).toBeLessThanOrEqual(64);
    expect(result.events.some((event) => event.type === 'player-hit')).toBe(true);
  });

  it('tracks zone kill progress against the visible completion target', () => {
    const state = createNewGame(0, 'Progress');
    state.killCounts['forest-rat'] = 7;
    expect(selectZoneUnlockProgress(state)).toMatchObject({ killed: 7, target: 25 });
    expect(selectZoneUnlockProgress(state).percent).toBeCloseTo(28);
  });
});
