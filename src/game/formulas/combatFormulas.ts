import type { CombatStyle, SkillId } from '../types';

export const COMBAT_XP_PER_DAMAGE = 5;
export const HITPOINTS_XP_PER_DAMAGE = 1;

export const getCombatDamageXp = (damage: number): number =>
  Math.max(0, Math.floor(damage * COMBAT_XP_PER_DAMAGE));

export const getHitpointsDamageXp = (damage: number): number =>
  Math.max(0, Math.floor(damage * HITPOINTS_XP_PER_DAMAGE));

export const getCombatStyleSkill = (style: CombatStyle): SkillId =>
  style === 'accurate' ? 'attack' : style === 'aggressive' ? 'strength' : 'defence';

export const rollInteger = (max: number, random: number): number =>
  Math.max(0, Math.floor(random * (Math.max(0, max) + 1)));
export const deterministicRandom = (seed: number): number => {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
};
