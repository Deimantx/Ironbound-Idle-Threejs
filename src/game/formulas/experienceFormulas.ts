import type { SkillId, SkillState } from '../types';

export const MAX_LEVEL = 100;
export const getXpForLevel = (level: number): number => {
  const safeLevel = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  return safeLevel === 1 ? 0 : Math.floor(100 * Math.pow(safeLevel - 1, 1.5));
};

export const getLevelFromXp = (xp: number): number => {
  const safeXp = Math.max(0, Math.floor(xp));
  let low = 1;
  let high = MAX_LEVEL;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (getXpForLevel(middle) <= safeXp) low = middle;
    else high = middle - 1;
  }
  return low;
};

export const getLevelProgress = (
  skill: SkillState,
): { current: number; next: number; percent: number } => {
  if (skill.level >= MAX_LEVEL)
    return { current: skill.xp - getXpForLevel(MAX_LEVEL), next: 0, percent: 100 };
  const current = Math.max(0, skill.xp - getXpForLevel(skill.level));
  const next = getXpForLevel(skill.level + 1) - getXpForLevel(skill.level);
  return { current, next, percent: Math.min(100, (current / next) * 100) };
};

export const addSkillXp = (
  skills: Record<SkillId, SkillState>,
  skillId: SkillId,
  amount: number,
): number => {
  const skill = skills[skillId];
  const oldLevel = skill.level;
  skill.xp = Math.max(0, Math.floor(skill.xp + amount));
  skill.level = getLevelFromXp(skill.xp);
  return skill.level - oldLevel;
};
