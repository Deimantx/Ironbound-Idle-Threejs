import { getLevelProgress } from '../formulas/experienceFormulas';
import type { GameState, SkillId, SkillState } from '../types';
import {
  COMBAT_SKILL_IDS,
  isCombatSkillId,
  isProfessionSkillId,
  PROFESSION_SKILL_IDS,
} from './skillGroups';

export interface SkillProgressSummary {
  id: SkillId;
  level: number;
  xp: number;
  current: number;
  next: number;
  percent: number;
  isMax: boolean;
}

const getSkillSummary = (id: SkillId, skill: SkillState): SkillProgressSummary => {
  const progress = getLevelProgress(skill);
  return {
    id,
    level: skill.level,
    xp: skill.xp,
    ...progress,
    isMax: progress.next === 0,
  };
};

export const getCombatSkillProgress = (game: Pick<GameState, 'skills'>): SkillProgressSummary[] =>
  COMBAT_SKILL_IDS.map((id) => getSkillSummary(id, game.skills[id]));

export const getProfessionSkillProgress = (
  game: Pick<GameState, 'skills'>,
): SkillProgressSummary[] => PROFESSION_SKILL_IDS.map((id) => getSkillSummary(id, game.skills[id]));

export const getTotalCombatLevels = (game: Pick<GameState, 'skills'>): number =>
  COMBAT_SKILL_IDS.reduce((total, skillId) => total + game.skills[skillId].level, 0);

export const getTotalProfessionLevels = (game: Pick<GameState, 'skills'>): number =>
  PROFESSION_SKILL_IDS.reduce((total, skillId) => total + game.skills[skillId].level, 0);

export const getTotalLevel = (game: Pick<GameState, 'skills'>): number =>
  getTotalCombatLevels(game) + getTotalProfessionLevels(game);

export { isCombatSkillId, isProfessionSkillId };
