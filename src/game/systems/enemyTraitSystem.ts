import { COMBAT_TUNING } from '../../config/combatTuning';
import { getCombatEffectDefinition } from '../formulas/combatEffects';
import type { ActiveCombatEffect, CombatTraitState, EnemyDefinition } from '../types';

export interface EnemyTraitModifiers {
  accuracyMultiplier: number;
  defenceMultiplier: number;
  damageMultiplier: number;
  maxHitMultiplier: number;
  attackIntervalMultiplier: number;
}

export interface EnemyTraitContext {
  currentHp: number;
  maxHp: number;
  playerHealthPercent: number;
  playerEffects?: ActiveCombatEffect[];
  state?: CombatTraitState;
}

export const createEnemyTraitState = (): CombatTraitState => ({
  enemyAttackCount: 0,
  consecutiveEnemyHits: 0,
  packHunterStacks: 0,
  scrappyStacks: 0,
});

export const hasNegativeCombatEffect = (effects: ActiveCombatEffect[] = []): boolean =>
  effects.some((effect) => {
    const definition = getCombatEffectDefinition(effect.effectId);
    return definition?.polarity === 'debuff' || definition?.kind === 'bleed';
  });

export const getEnemyTraitModifiers = (
  enemy: EnemyDefinition,
  context: EnemyTraitContext,
): EnemyTraitModifiers => {
  const result: EnemyTraitModifiers = {
    accuracyMultiplier: 1,
    defenceMultiplier: 1,
    damageMultiplier: 1,
    maxHitMultiplier: 1,
    attackIntervalMultiplier: 1,
  };
  const state = context.state ?? createEnemyTraitState();
  const healthRatio = context.currentHp / Math.max(1, context.maxHp);
  switch (enemy.trait.id) {
    case 'watchful':
      if (state.enemyAttackCount < COMBAT_TUNING.watchfulOpeningAttacks)
        result.attackIntervalMultiplier *= COMBAT_TUNING.watchfulIntervalMultiplier;
      break;
    case 'dirty-fighter':
    case 'opportunist':
      if (hasNegativeCombatEffect(context.playerEffects)) result.damageMultiplier *= 1.2;
      break;
    case 'precise':
      result.accuracyMultiplier *= 1.2;
      break;
    case 'heavy-hitter':
      result.maxHitMultiplier *= 1.25;
      result.attackIntervalMultiplier *= 1.15;
      break;
    case 'pack-hunter':
      result.damageMultiplier *= Math.pow(COMBAT_TUNING.packHunterDamageMultiplierPerStack, state.packHunterStacks);
      break;
    case 'evasive':
    case 'cautious-fighter':
      result.defenceMultiplier *= 1.25;
      break;
    case 'ferocious':
      if (healthRatio <= 0.4) result.damageMultiplier *= 1.2;
      break;
    case 'apex-predator':
      if (context.playerHealthPercent < 0.5) result.damageMultiplier *= 1.2;
      break;
    case 'scrappy':
      result.attackIntervalMultiplier *= Math.pow(COMBAT_TUNING.scrappyIntervalMultiplierPerStack, state.scrappyStacks);
      break;
    case 'beast-handler':
      result.attackIntervalMultiplier *= 0.8;
      break;
  }
  return result;
};

export const onEnemyAttackResolved = (state: CombatTraitState, didHit: boolean): void => {
  state.enemyAttackCount += 1;
  if (didHit) {
    state.consecutiveEnemyHits += 1;
    state.packHunterStacks = Math.min(COMBAT_TUNING.packHunterMaxStacks, state.packHunterStacks + 1);
  } else {
    state.consecutiveEnemyHits = 0;
    state.packHunterStacks = 0;
  }
};

export const onEnemyDamaged = (
  enemy: EnemyDefinition,
  state: CombatTraitState,
  hpBefore: number,
  hpAfter: number,
  maxHp?: number,
): void => {
  if (enemy.trait.id !== 'scrappy') return;
  if (maxHp !== undefined && hpAfter <= maxHp * 0.5) {
    state.scrappyStacks = 0;
    return;
  }
  if (hpBefore > hpAfter && hpBefore > 0) {
    state.scrappyStacks = Math.min(COMBAT_TUNING.scrappyMaxStacks, state.scrappyStacks + 1);
  }
};

export const syncEnemyTraitState = (enemy: EnemyDefinition, state: CombatTraitState, currentHp: number, maxHp: number): void => {
  if (enemy.trait.id === 'scrappy' && currentHp <= maxHp * 0.5) state.scrappyStacks = 0;
};
