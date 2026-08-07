import type { SkillId, SkillState } from '../types';

export const MAX_LEVEL = 100;
export const XP_CURVE_MULTIPLIER = 1.3;

const clampLevel = (level: number): number => {
  const normalized = Number.isFinite(level)
    ? Math.floor(level)
    : level === Infinity
      ? MAX_LEVEL
      : 1;
  return Math.max(1, Math.min(MAX_LEVEL, normalized));
};

// Classic RuneScape cumulative XP thresholds, scaled by 1.30 for Ironbound.
const getBaseRuneScapeXpForLevel = (level: number): number => {
  const safeLevel = clampLevel(level);
  if (safeLevel <= 1) return 0;

  let points = 0;
  for (let x = 1; x < safeLevel; x += 1) points += Math.floor(x + 300 * Math.pow(2, x / 7));
  return Math.floor(points / 4);
};

export const XP_THRESHOLDS = Array.from({ length: MAX_LEVEL + 1 }, (_, level) =>
  level <= 0 ? 0 : Math.round(getBaseRuneScapeXpForLevel(level) * XP_CURVE_MULTIPLIER),
);

export const getXpForLevel = (level: number): number => XP_THRESHOLDS[clampLevel(level)];

const normalizeXp = (xp: number): number => {
  if (xp === Infinity) return Number.MAX_SAFE_INTEGER;
  if (!Number.isFinite(xp)) return 0;
  return Math.max(0, Math.floor(xp));
};

export const normalizeSkillState = (input: unknown): SkillState => {
  const value = input && typeof input === 'object' ? (input as Partial<SkillState>) : {};
  const xp = normalizeXp(Number(value.xp));
  return { xp, level: getLevelFromXp(xp) };
};

export const getLevelFromXp = (xp: number): number => {
  const safeXp = normalizeXp(xp);
  let low = 1;
  let high = MAX_LEVEL;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (XP_THRESHOLDS[middle] <= safeXp) low = middle;
    else high = middle - 1;
  }
  return low;
};

export const getLevelProgress = (
  skill: SkillState,
): { current: number; next: number; percent: number } => {
  const level = clampLevel(skill.level);
  const xp = normalizeXp(skill.xp);
  if (level >= MAX_LEVEL)
    return { current: Math.max(0, xp - getXpForLevel(MAX_LEVEL)), next: 0, percent: 100 };
  const current = Math.max(0, xp - getXpForLevel(level));
  const next = getXpForLevel(level + 1) - getXpForLevel(level);
  return { current, next, percent: Math.max(0, Math.min(100, (current / next) * 100)) };
};

export const addSkillXp = (
  skills: Record<SkillId, SkillState>,
  skillId: SkillId,
  amount: number,
): number => {
  const skill = skills[skillId];
  const oldLevel = skill.level;
  skill.xp = Math.max(
    0,
    Math.floor(normalizeXp(skill.xp) + (Number.isFinite(amount) ? amount : 0)),
  );
  skill.level = getLevelFromXp(skill.xp);
  return skill.level - oldLevel;
};
