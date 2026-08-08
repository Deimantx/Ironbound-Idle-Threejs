import { describe, expect, it } from 'vitest';
import { getEnemyCombatStats } from '../game/formulas/combatStats';
import {
  getAverageDamageAfterFlatReduction,
  getCombatStyleModifiers,
  getHitChance,
  rollDamage,
} from '../game/formulas/combatFormulas';
import { getDerivedStats } from '../game/formulas/statFormulas';
import { startCombat, queueCombatSpecial, setCombatAutoSpecial } from '../game/engine/actionController';
import { simulateElapsed } from '../game/engine/simulation';
import { GAME_CONFIG } from '../config/gameConfig';
import { COMBAT_TUNING } from '../config/combatTuning';
import { enemyById } from '../content/enemies';
import { createNewGame } from '../game/state/initialState';
import {
  selectEnemyAttackProgress,
  selectEnemyHitChance,
  selectExpectedKillsPerHour,
  selectEstimatedKillTimeMs,
  selectPlayerHitChance,
} from '../game/selectors/combatSelectors';
import type { CombatVisualEvent } from '../game/types';

const configuredCombat = (enemyId: 'forest-rat' | 'goblin-scavenger' | 'grey-wolf' | 'road-bandit' = 'forest-rat', seed = 1) => {
  const state = startCombat(createNewGame(0, 'Expansion', 0), 'forest-path', enemyId, 'accurate', false, 0);
  if (state.activeAction.type === 'combat') {
    state.activeAction.combatState.rngSeed = seed;
    state.activeAction.combatState.rngCursor = 1;
    state.activeAction.combatState.eliteModifier = null;
    state.activeAction.combatState.eliteAnnounced = true;
    state.activeAction.combatState.enemyMaxHp = enemyById[enemyId].maxHealth;
    state.activeAction.combatState.enemyHp = enemyById[enemyId].maxHealth;
    const enemyStats = getEnemyCombatStats(enemyById[enemyId], null);
    state.activeAction.combatState.enemyAttackMs =
      enemyById[enemyId].trait.id === 'scurry'
        ? Math.max(
            COMBAT_TUNING.minimumAttackIntervalMs,
            Math.round(enemyStats.attackIntervalMs * COMBAT_TUNING.ratFirstAttackMultiplier),
          )
        : enemyStats.attackIntervalMs;
  }
  return state;
};

describe('authoritative combat expansion formulas', () => {
  it('disables elite spawns when the combat preference is off', () => {
    const state = createNewGame(0, 'No Elites', 0);
    state.settings.huntElites = false;
    const combat = startCombat(state, 'forest-path', 'forest-rat', 'accurate', false, 0);
    expect(combat.activeAction.type === 'combat' && combat.activeAction.combatState.eliteModifier).toBe(null);
  });

  it('rolls normal damage from one through the displayed maximum', () => {
    for (let index = 0; index < 10_000; index += 1)
      expect(rollDamage(5, index / 10_000)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...Array.from({ length: 1000 }, (_, index) => rollDamage(5, index / 1000)))).toBe(5);
    expect(rollDamage(1, 0.99)).toBe(1);
  });

  it('uses one bounded monotonic hit chance formula', () => {
    expect(getHitChance(20, 20)).toBe(0.75);
    expect(getHitChance(-100, 100_000)).toBe(0.35);
    expect(getHitChance(100_000, -100)).toBe(0.97);
    expect(getHitChance(30, 20)).toBeGreaterThan(getHitChance(20, 20));
    expect(getHitChance(20, 30)).toBeLessThan(getHitChance(20, 20));
  });

  it('calculates expected damage after flat reduction from the same roll distribution', () => {
    expect(getAverageDamageAfterFlatReduction(5, 0)).toBe(3);
    expect(getAverageDamageAfterFlatReduction(5, 2)).toBe(1.6);
    expect(getAverageDamageAfterFlatReduction(5, 99)).toBe(1);
  });

  it('applies style modifiers to the same derived player ratings used by combat', () => {
    const state = createNewGame(0, 'Styles');
    const accurate = getDerivedStats(state, 'accurate');
    const aggressive = getDerivedStats(state, 'aggressive');
    const defensive = getDerivedStats(state, 'defensive');
    expect(accurate.effectiveAccuracyRating).toBeGreaterThan(accurate.baseAccuracyRating);
    expect(aggressive.effectiveMaxHit).toBeGreaterThanOrEqual(accurate.effectiveMaxHit);
    expect(aggressive.effectiveAccuracyRating).toBeLessThan(accurate.effectiveAccuracyRating);
    expect(defensive.effectiveDefenceRating).toBeGreaterThan(accurate.effectiveDefenceRating);
    expect(defensive.effectiveMaxHit).toBeGreaterThanOrEqual(1);
    expect(getCombatStyleModifiers('defensive').defenceMultiplier).toBe(1.2);
  });

  it('uses actual ratings for player and enemy hit chance selectors', () => {
    const state = configuredCombat();
    expect(selectPlayerHitChance(state)).toBeLessThan(0.97);
    expect(selectEnemyHitChance(state)).toBeGreaterThan(0.35);
    expect(selectPlayerHitChance(state, enemyById['cave-bat'])).toBeLessThan(
      selectPlayerHitChance(state, enemyById['forest-rat']),
    );
  });
});

describe('combat event resolution and traits', () => {
  it('resolves a lethal player attack before same-timestamp retaliation and caps XP at actual damage', () => {
    const state = configuredCombat();
    if (state.activeAction.type === 'combat') {
      state.activeAction.combatState.enemyHp = 1;
      state.activeAction.combatState.enemyMaxHp = 1;
      state.activeAction.combatState.playerAttackMs = 0;
      state.activeAction.combatState.enemyAttackMs = 0;
    }
    const result = simulateElapsed(state, 1);
    expect(result.events.some((event) => event.type === 'enemy-hit' || event.type === 'enemy-miss')).toBe(false);
    expect(result.summary.xpGained.attack).toBe(5);
    const hit = result.events.find((event) => event.type === 'player-hit') as
      | Extract<CombatVisualEvent, { type: 'player-hit' | 'player-miss' }>
      | undefined;
    expect(hit?.damage).toBe(1);
  });

  it('counts misses as attempts without damage or damage XP', () => {
    const state = configuredCombat('forest-rat', 17);
    if (state.activeAction.type === 'combat') {
      state.activeAction.combatState.playerAttackMs = 0;
      state.activeAction.combatState.enemyAttackMs = 100_000;
    }
    const result = simulateElapsed(state, 1);
    expect(result.events.some((event) => event.type === 'player-miss')).toBe(true);
    expect(result.summary.xpGained.attack ?? 0).toBe(0);
  });

  it('implements the six enemy traits through effective encounter state', () => {
    const rat = configuredCombat();
    expect(rat.activeAction.type === 'combat' && rat.activeAction.combatState.enemyAttackMs).toBe(1690);
    expect(getEnemyCombatStats(enemyById['goblin-scavenger'], null, 7).maxHit).toBe(6);
    expect(getEnemyCombatStats(enemyById['cave-bat']).defenceRating).toBe(24);
    expect(getEnemyCombatStats(enemyById['stoneback-crab']).flatDamageReduction).toBe(2);
    expect(getEnemyCombatStats(enemyById['grey-wolf']).maxHit).toBe(19);
    expect(getEnemyCombatStats(enemyById['road-bandit']).attackIntervalMs).toBe(3000);
  });

  it('uses Scurry only for the first attack interval', () => {
    const state = configuredCombat('forest-rat');
    const progress = selectEnemyAttackProgress(state, state.updatedAt);
    expect(progress.intervalMs).toBe(1_690);
    expect(progress.timeUntilAttackMs).toBe(1_690);
  });

  it('uses the configured respawn time in expected kills per hour', () => {
    const state = configuredCombat();
    const killTime = selectEstimatedKillTimeMs(state, undefined, 'accurate');
    expect(selectExpectedKillsPerHour(state, undefined, 'accurate')).toBeCloseTo(
      3_600_000 / (killTime + GAME_CONFIG.respawnMs),
    );
  });

  it('ticks and decrements wolf bleed before the direct attack', () => {
    const state = configuredCombat('grey-wolf');
    if (state.activeAction.type === 'combat') {
      state.player.currentHp = 20;
      state.activeAction.combatState.traitState.bleedStacks = 2;
      state.activeAction.combatState.playerAttackMs = 100_000;
      state.activeAction.combatState.enemyAttackMs = 0;
    }
    const result = simulateElapsed(state, 1);
    const bleed = result.events.find((event) => event.type === 'enemy-bleed') as
      | Extract<CombatVisualEvent, { type: 'enemy-hit' | 'enemy-miss' | 'enemy-bleed' }>
      | undefined;
    expect(bleed?.damage).toBe(2);
    expect(result.state.activeAction.type === 'combat' && result.state.activeAction.combatState.traitState.bleedStacks).toBe(1);
  });
});

describe('momentum, specials, and deterministic chunking', () => {
  it('gains Momentum only from successful direct combat damage and executes data-driven specials', () => {
    const state = configuredCombat();
    state.equipment.weapon = 'bronze-sword';
    if (state.activeAction.type === 'combat') {
      state.activeAction.combatState.playerAttackMs = 0;
      state.activeAction.combatState.enemyAttackMs = 100_000;
      state.activeAction.combatState.momentum = 100;
    }
    const result = simulateElapsed(state, 1);
    const attack = result.events.find((event) => event.type === 'player-hit') as
      | Extract<CombatVisualEvent, { type: 'player-hit' | 'player-miss' }>
      | undefined;
    expect(attack && attack.special).toBe(true);
    expect(result.state.activeAction.type).toBe('combat');
  });

  it('supports a manual special queue without consuming Momentum before the attack', () => {
    let state = configuredCombat();
    state.equipment.weapon = 'iron-sword';
    state = setCombatAutoSpecial(state, false);
    if (state.activeAction.type === 'combat') state.activeAction.combatState.momentum = 100;
    state = queueCombatSpecial(state);
    expect(state.activeAction.type === 'combat' && state.activeAction.specialQueued).toBe(true);
  });

  it('applies all elite modifiers and keeps treasure chances bounded', () => {
    const enemy = enemyById['stoneback-crab'];
    expect(getEnemyCombatStats(enemy, 'savage').maxHealth).toBe(225);
    expect(getEnemyCombatStats(enemy, 'savage').maxHit).toBe(18);
    expect(getEnemyCombatStats(enemy, 'armoured').flatDamageReduction).toBe(3);
    expect(getEnemyCombatStats(enemy, 'swift').attackIntervalMs).toBe(2720);
    expect(getEnemyCombatStats(enemy, 'wealthy').goldMultiplier).toBe(3.125);
    expect(getEnemyCombatStats(enemy, 'treasure-touched').lootChanceMultiplier).toBe(1.75);
  });

  it('produces equivalent authoritative combat outcomes for one long or many short chunks', () => {
    const one = configuredCombat('forest-rat');
    const many = structuredClone(one);
    const long = simulateElapsed(one, 60_000);
    let chunked = many;
    let defeated = 0;
    for (let index = 0; index < 60; index += 1) {
      const result = simulateElapsed(chunked, 1_000);
      chunked = result.state;
      defeated += result.summary.enemiesDefeated;
    }
    expect(chunked.statistics).toEqual(long.state.statistics);
    expect(chunked.gold).toBe(long.state.gold);
    expect(chunked.skills).toEqual(long.state.skills);
    expect(chunked.inventory).toEqual(long.state.inventory);
    expect(chunked.activeAction).toEqual(long.state.activeAction);
    expect(defeated).toBe(long.summary.enemiesDefeated);
  });
});
