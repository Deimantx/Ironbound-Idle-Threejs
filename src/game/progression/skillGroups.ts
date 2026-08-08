import type { SkillId } from '../types';

/** Skill groups used by progression summaries. Keep these limited to implemented skills. */
export const COMBAT_SKILL_IDS = [
  'attack',
  'strength',
  'defence',
  'hitpoints',
] as const satisfies readonly SkillId[];

export const PROFESSION_SKILL_IDS = ['mining', 'smithing'] as const satisfies readonly SkillId[];

export type CombatSkillId = (typeof COMBAT_SKILL_IDS)[number];
export type ProfessionSkillId = (typeof PROFESSION_SKILL_IDS)[number];

const combatSkillSet = new Set<SkillId>(COMBAT_SKILL_IDS);
const professionSkillSet = new Set<SkillId>(PROFESSION_SKILL_IDS);

export const isCombatSkillId = (skillId: SkillId): skillId is CombatSkillId =>
  combatSkillSet.has(skillId);

export const isProfessionSkillId = (skillId: SkillId): skillId is ProfessionSkillId =>
  professionSkillSet.has(skillId);
