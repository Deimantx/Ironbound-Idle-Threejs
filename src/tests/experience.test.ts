import { describe, expect, it } from 'vitest';
import {
  addSkillXp,
  getLevelFromXp,
  getLevelProgress,
  getXpForLevel,
  MAX_LEVEL,
  XP_THRESHOLDS,
} from '../game/formulas/experienceFormulas';
import type { SkillId, SkillState } from '../game/types';

const EXPECTED_XP = [
  0, 0, 108, 226, 359, 504, 666, 845, 1041, 1260, 1500, 1765, 2059, 2383, 2739, 3134, 3570, 4050,
  4580, 5165, 5811, 6523, 7311, 8178, 9136, 10195, 11362, 12649, 14071, 15640, 17372, 19283, 21393,
  23721, 26291, 29128, 32260, 35715, 39530, 43742, 48391, 53522, 59188, 65441, 72344, 79966, 88378,
  97665, 107918, 119237, 131733, 145529, 160758, 177572, 196134, 216627, 239252, 264230, 291806,
  322252, 355865, 392974, 433945, 479179, 529120, 584256, 645130, 712339, 786542, 868466, 958915,
  1058779, 1169034, 1290764, 1425161, 1573547, 1737376, 1918255, 2117960, 2338450, 2581888, 2850663,
  3147413, 3475048, 3836785, 4236172, 4677130, 5163982, 5701509, 6294984, 6950232, 7673680, 8472429,
  9354318, 10327998, 11403025, 12589950, 13900418, 15347288, 16944760, 18708508,
];

describe('experience formulas', () => {
  it('matches the complete RuneScape plus 30% threshold table', () => {
    expect(MAX_LEVEL).toBe(100);
    expect(XP_THRESHOLDS).toEqual(EXPECTED_XP);
    for (let level = 1; level <= MAX_LEVEL; level += 1)
      expect(getXpForLevel(level)).toBe(EXPECTED_XP[level]);
  });

  it('keeps thresholds integral, increasing, and capped at level 100', () => {
    expect(EXPECTED_XP).toHaveLength(MAX_LEVEL + 1);
    expect(EXPECTED_XP[1]).toBe(0);
    expect(EXPECTED_XP[100]).toBe(18_708_508);
    for (let level = 1; level <= MAX_LEVEL; level += 1) {
      expect(EXPECTED_XP[level]).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(EXPECTED_XP[level])).toBe(true);
      if (level > 1) expect(EXPECTED_XP[level]).toBeGreaterThan(EXPECTED_XP[level - 1]);
    }
  });

  it('resolves XP boundaries with the lower-level rule and level cap', () => {
    for (const level of [2, 10, 30, 50, 75, 92, 99, 100]) {
      const threshold = getXpForLevel(level);
      expect(getLevelFromXp(threshold)).toBe(level);
      if (level > 1) expect(getLevelFromXp(threshold - 1)).toBe(level - 1);
    }
    expect(getLevelFromXp(0)).toBe(1);
    expect(getLevelFromXp(-1)).toBe(1);
    expect(getLevelFromXp(50_000_000)).toBe(100);
    expect(getLevelFromXp(Number.POSITIVE_INFINITY)).toBe(100);
  });

  it('calculates progress within the current level rather than total XP', () => {
    const level = 30;
    const floor = getXpForLevel(level);
    const span = getXpForLevel(level + 1) - floor;
    const atStart = getLevelProgress({ level, xp: floor });
    const halfway = getLevelProgress({ level, xp: floor + Math.floor(span / 2) });
    const beforeNext = getLevelProgress({ level, xp: getXpForLevel(level + 1) - 1 });
    expect(atStart).toEqual({ current: 0, next: span, percent: 0 });
    expect(halfway.percent).toBeCloseTo(50, 0);
    expect(beforeNext.percent).toBeLessThan(100);
    expect(getLevelProgress({ level: 100, xp: getXpForLevel(100) })).toEqual({
      current: 0,
      next: 0,
      percent: 100,
    });
  });

  it('handles multi-level gains through the shared XP award helper', () => {
    const skills = {
      attack: { level: 1, xp: 0 },
      strength: { level: 1, xp: 0 },
      defence: { level: 1, xp: 0 },
      hitpoints: { level: 1, xp: 0 },
      mining: { level: 1, xp: 0 },
      smithing: { level: 1, xp: 0 },
    } as Record<SkillId, SkillState>;
    expect(addSkillXp(skills, 'mining', getXpForLevel(10))).toBe(9);
    expect(skills.mining).toEqual({ level: 10, xp: getXpForLevel(10) });

    skills.mining = { level: 90, xp: getXpForLevel(90) };
    expect(addSkillXp(skills, 'mining', getXpForLevel(92) - getXpForLevel(90))).toBe(2);
    expect(skills.mining).toEqual({ level: 92, xp: getXpForLevel(92) });
  });
});
