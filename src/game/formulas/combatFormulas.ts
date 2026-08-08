import { COMBAT_TUNING } from '../../config/combatTuning';
import type { CombatStyle, SkillId } from '../types';

export const COMBAT_XP_PER_DAMAGE = 5;
export const HITPOINTS_XP_PER_DAMAGE = 1;

export const getCombatDamageXp = (damage: number): number =>
  Math.max(0, Math.floor(damage * COMBAT_XP_PER_DAMAGE));

export const getHitpointsDamageXp = (damage: number): number =>
  Math.max(0, Math.floor(damage * HITPOINTS_XP_PER_DAMAGE));

export const getCombatStyleSkill = (
  style: CombatStyle,
): Extract<SkillId, 'attack' | 'strength' | 'defence'> =>
  style === 'accurate' ? 'attack' : style === 'aggressive' ? 'strength' : 'defence';

export const rollInteger = (max: number, random: number): number =>
  Math.max(0, Math.floor(random * (Math.max(0, max) + 1)));

export const rollDamage = (effectiveMaxHit: number, random: number): number => {
  const maxHit = Math.max(1, Math.floor(effectiveMaxHit));
  return maxHit <= 1 ? 1 : 1 + rollInteger(maxHit - 1, random);
};

/** Expected damage for a normal 1..maxHit roll after flat reduction. */
export const getAverageDamageAfterFlatReduction = (
  effectiveMaxHit: number,
  flatDamageReduction: number,
): number => {
  const maxHit = Math.max(1, Math.floor(effectiveMaxHit));
  const reduction = Math.max(0, Math.floor(flatDamageReduction));
  const reducedRolls = Math.min(maxHit, reduction);
  const unreducedRolls = maxHit - reducedRolls;
  const totalDamage = reducedRolls + (unreducedRolls * (unreducedRolls + 1)) / 2;
  return totalDamage / maxHit;
};

export const clampHitChance = (chance: number): number =>
  Math.min(COMBAT_TUNING.hitChanceMax, Math.max(COMBAT_TUNING.hitChanceMin, chance));

export const getHitChance = (attackerAccuracy: number, defenderDefence: number): number => {
  const accuracy = Math.max(0, Number.isFinite(attackerAccuracy) ? attackerAccuracy : 0);
  const defence = Math.max(0, Number.isFinite(defenderDefence) ? defenderDefence : 0);
  const denominator = 2 * (accuracy + defence + 20);
  return clampHitChance(0.75 + (accuracy - defence) / Math.max(1, denominator));
};

export const getCombatStyleModifiers = (
  style: CombatStyle,
): { accuracyMultiplier: number; defenceMultiplier: number; maxHitMultiplier: number } => {
  if (style === 'accurate')
    return {
      accuracyMultiplier: COMBAT_TUNING.accurateAccuracyMultiplier,
      defenceMultiplier: 1,
      maxHitMultiplier: 1,
    };
  if (style === 'aggressive')
    return {
      accuracyMultiplier: COMBAT_TUNING.aggressiveAccuracyMultiplier,
      defenceMultiplier: 1,
      maxHitMultiplier: COMBAT_TUNING.aggressiveMaxHitMultiplier,
    };
  return {
    accuracyMultiplier: 1,
    defenceMultiplier: COMBAT_TUNING.defensiveDefenceMultiplier,
    maxHitMultiplier: COMBAT_TUNING.defensiveMaxHitMultiplier,
  };
};

export const hashCombatInput = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) || 1;
};

export interface CombatRngState {
  rngSeed: number;
  rngCursor: number;
}

export const nextCombatRandom = (rng: CombatRngState): number => {
  const value = deterministicRandom(rng.rngSeed + rng.rngCursor * 0.6180339887);
  rng.rngCursor += 1;
  return value;
};

export const createCombatRng = (
  startedAt: number,
  profileId: string,
  enemyId: string,
): CombatRngState => ({
  rngSeed: hashCombatInput(`${startedAt}|${profileId}|${enemyId}`),
  rngCursor: 0,
});
export const deterministicRandom = (seed: number): number => {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
};
