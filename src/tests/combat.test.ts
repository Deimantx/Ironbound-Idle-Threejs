import { describe, expect, it } from 'vitest';
import { startCombat } from '../game/engine/actionController';
import {
  getCombatDamageXp,
  getCombatStyleSkill,
  getHitpointsDamageXp,
} from '../game/formulas/combatFormulas';
import { simulateElapsed } from '../game/engine/simulation';
import { areaById } from '../content/areas';
import {
  displayDropChance,
  getHealthPercent,
  getHealthState,
  getLootRarity,
  selectEnemyAttackProgress,
  selectPlayerAttackProgress,
  selectPlayerEstimatedDps,
  isCombatAreaUnlocked,
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
    state = startCombat(state, 'redknife-road-camp', 'redknife-lookout', 'accurate', true);
    state.updatedAt = 1_000;
    expect(selectPlayerAttackProgress(state, 1_000).ratio).toBe(0);
    expect(selectEnemyAttackProgress(state, 1_000).ratio).toBe(0);
    expect(selectPlayerEstimatedDps(state)).toBeGreaterThan(0);
    expect(selectPlayerAttackProgress(state, 4_000).state).toMatch(/active|ready/);
    if (state.activeAction.type === 'combat') state.activeAction.combatState.respawnMs = 500;
    expect(selectEnemyAttackProgress(state, 1_000).state).toBe('respawning');
  });

  it('exposes readable health states for the combat UI', () => {
    expect(getHealthPercent(20, 24)).toBe(83);
    expect(getHealthState(24, 24)).toBe('healthy');
    expect(getHealthState(12, 24)).toBe('wounded');
    expect(getHealthState(7, 24)).toBe('critical');
    expect(getHealthState(2, 24)).toBe('near-death');
    expect(getHealthState(0, 24)).toBe('defeated');
  });

  it('converts known drop probabilities without inventing certainty', () => {
    expect(displayDropChance(0.65)).toBe('65%');
    expect(displayDropChance(0.01)).toBe('1%');
    expect(getLootRarity(0.65)).toBe('Common');
    expect(getLootRarity(0.3)).toBe('Uncommon');
    expect(getLootRarity(0.12)).toBe('Rare');
    expect(getLootRarity(0.01)).toBe('Very Rare');
  });

  it('exposes a bounded authoritative visual event stream from combat simulation', () => {
    const state = startCombat(
      createNewGame(0, 'Events'),
      'redknife-road-camp',
      'redknife-lookout',
      'accurate',
      true,
    );
    const result = simulateElapsed(state, 60_000);
    expect(result.events.length).toBeGreaterThan(0);
    expect(result.events.length).toBeLessThanOrEqual(64);
    expect(result.events.some((event) => event.type === 'player-hit')).toBe(true);
  });

  it('uses Combat Level only for normal area availability', () => {
    const state = createNewGame(0, 'Progress');
    const greyfangPastures = areaById['greyfang-pastures'];
    state.killCounts['redknife-lookout'] = 10_000;
    expect(isCombatAreaUnlocked(state, greyfangPastures)).toBe(false);
    state.skills.attack.level = 18;
    state.skills.strength.level = 18;
    state.skills.defence.level = 18;
    state.skills.hitpoints.level = 18;
    expect(isCombatAreaUnlocked(state, greyfangPastures)).toBe(true);
  });
});
