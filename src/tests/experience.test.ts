import { describe, expect, it } from 'vitest';
import {
  getLevelFromXp,
  getLevelProgress,
  getXpForLevel,
} from '../game/formulas/experienceFormulas';

describe('experience formulas', () => {
  it('starts at level one and reaches level two at exactly 100 XP', () => {
    expect(getLevelFromXp(0)).toBe(1);
    expect(getXpForLevel(2)).toBe(100);
    expect(getLevelFromXp(99)).toBe(1);
    expect(getLevelFromXp(100)).toBe(2);
  });
  it('has stable boundary values and a level cap', () => {
    expect(getXpForLevel(50)).toBeGreaterThan(getXpForLevel(2));
    expect(getXpForLevel(100)).toBeGreaterThan(getXpForLevel(50));
    expect(getLevelFromXp(getXpForLevel(100))).toBe(100);
    expect(getLevelFromXp(Number.MAX_SAFE_INTEGER)).toBe(100);
    expect(getLevelProgress({ level: 100, xp: getXpForLevel(100) })).toEqual({
      current: 0,
      next: 0,
      percent: 100,
    });
  });
});
