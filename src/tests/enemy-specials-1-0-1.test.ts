import { describe, expect, it } from 'vitest';
import { combatRegionById } from '../content/combatRegions';
import { validateCombatContent } from '../content/combatValidation';
import { enemyById } from '../content/enemies';
import {
  applyCombatEffect,
  advanceCombatEffects,
  getCombatEffectModifiers,
  getTimeUntilNextCombatEffectEvent,
  resolveReadyCombatEffectTicks,
} from '../game/formulas/combatEffects';
import { startCombat } from '../game/engine/actionController';
import { simulateElapsed } from '../game/engine/simulation';
import { createNewGame } from '../game/state/initialState';
import type { AreaId, CombatEffectsState, GameState } from '../game/types';

describe('Enemy Specials 1.0.1 and Stonehill content', () => {
  it('validates the complete Stonehill region and its references', () => {
    expect(validateCombatContent()).toEqual([]);
    expect(combatRegionById.stonehill.availability).toBe('available');
    expect(combatRegionById.stonehill.areaIds).toHaveLength(4);
  });

  it('refreshes timed effects without multiplying stacks and stacks bleed predictably', () => {
    const effects: CombatEffectsState = { player: [], enemy: [] };
    const first = applyCombatEffect(effects, 'rending-bleed', 'player', {
      sourceEnemyId: 'tunnel-crawler',
      sourceSpecialId: 'rending-bite',
    });
    advanceCombatEffects(effects, 500);
    const refreshed = applyCombatEffect(effects, 'rending-bleed', 'player', {
      sourceEnemyId: 'tunnel-crawler',
      sourceSpecialId: 'rending-bite',
    });
    expect(refreshed).toBe(first);
    expect(refreshed.stacks).toBe(2);
    expect(refreshed.nextTickMs).toBe(1_500);
    expect(getCombatEffectModifiers(effects).damageMultiplier).toBe(1);
    expect(getTimeUntilNextCombatEffectEvent(effects)).toBe(1_500);
  });

  it('resolves periodic damage as a real event and records its typed source', () => {
    let state: GameState = createNewGame(0, 'Periodic effects', 0);
    for (const skill of ['attack', 'strength', 'defence', 'hitpoints'] as const)
      state.skills[skill].level = 100;
    state.player.currentHp = 20;
    state = startCombat(state, enemyById['tunnel-crawler'].areaId as AreaId, 'tunnel-crawler', 'accurate', true, 0);
    if (state.activeAction.type !== 'combat') throw new Error('Expected combat.');
    const combatState = state.activeAction.combatState;
    combatState.playerAttackMs = 100_000;
    combatState.enemyAttackMs = 100_000;
    applyCombatEffect(combatState.effects, 'rending-bleed', 'player', {
      sourceEnemyId: 'tunnel-crawler',
      sourceSpecialId: 'rending-bite',
    });
    const result = simulateElapsed(state, 2_000);
    expect(result.events.some((event) => event.type === 'combat-effect-damage' && event.damage === 2)).toBe(true);
    expect(result.state.player.currentHp).toBe(18);
    expect(result.state.activityLogs.combat.some((entry) => entry.kind === 'combat-effect-damage')).toBe(true);
  });

  it('lets periodic bleed damage defeat the player with a combat-effect cause', () => {
    let state: GameState = createNewGame(0, 'Periodic death', 0);
    for (const skill of ['attack', 'strength', 'defence', 'hitpoints'] as const)
      state.skills[skill].level = 100;
    state.player.currentHp = 2;
    state = startCombat(state, enemyById['tunnel-crawler'].areaId as AreaId, 'tunnel-crawler', 'accurate', true, 0);
    if (state.activeAction.type !== 'combat') throw new Error('Expected combat.');
    state.activeAction.combatState.playerAttackMs = 100_000;
    state.activeAction.combatState.enemyAttackMs = 100_000;
    applyCombatEffect(state.activeAction.combatState.effects, 'rending-bleed', 'player', {
      sourceEnemyId: 'tunnel-crawler',
      sourceSpecialId: 'rending-bite',
    });
    const result = simulateElapsed(state, 2_000);
    expect(result.state.activeAction.type).toBe('none');
    const defeat = result.state.activityLogs.combat.find((entry) => entry.kind === 'player-defeated');
    expect(defeat?.kind === 'player-defeated' ? defeat.cause.kind : null).toBe('combat-effect');
  });

  it('keeps the periodic event timer stable across save-shaped effect state', () => {
    const effects: CombatEffectsState = { player: [], enemy: [] };
    applyCombatEffect(effects, 'raking-wound', 'player', {
      sourceEnemyId: 'cliff-harpy',
      sourceSpecialId: 'raking-dive',
    });
    advanceCombatEffects(effects, 2_000);
    const ticks = resolveReadyCombatEffectTicks(effects);
    expect(ticks).toHaveLength(1);
    expect(ticks[0].damage).toBe(2);
    expect(effects.player[0].nextTickMs).toBe(2_000);
  });
});
