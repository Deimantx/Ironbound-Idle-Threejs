import { describe, expect, it } from 'vitest';
import { createNewGame } from '../game/state/initialState';
import {
  getCombatSkillProgress,
  getProfessionSkillProgress,
  getTotalCombatLevels,
  getTotalLevel,
  getTotalProfessionLevels,
} from '../game/progression/progressionSelectors';
import { PROFESSION_SKILL_IDS } from '../game/progression/skillGroups';

describe('progression selectors', () => {
  it('keeps combat, profession, and total levels distinct while preserving the invariant', () => {
    const game = createNewGame(0, 'Progression Tester');
    game.skills.attack = { xp: 0, level: 10 };
    game.skills.strength = { xp: 0, level: 20 };
    game.skills.defence = { xp: 0, level: 30 };
    game.skills.hitpoints = { xp: 0, level: 40 };
    game.skills.mining = { xp: 0, level: 50 };
    game.skills.smithing = { xp: 0, level: 60 };

    expect(getTotalCombatLevels(game)).toBe(100);
    expect(getTotalProfessionLevels(game)).toBe(110);
    expect(getTotalLevel(game)).toBe(210);
    expect(getTotalLevel(game)).toBe(getTotalCombatLevels(game) + getTotalProfessionLevels(game));
  });

  it('only uses implemented structured profession skills', () => {
    const game = createNewGame(0, 'Future Skill Tester');
    const before = getTotalProfessionLevels(game);
    expect(PROFESSION_SKILL_IDS).toEqual(['mining', 'smithing']);
    expect(getTotalProfessionLevels({ skills: { ...game.skills } })).toBe(before);
  });

  it('returns grouped progress in stable skill order', () => {
    const game = createNewGame(0, 'Progress Tester');
    expect(getCombatSkillProgress(game).map((skill) => skill.id)).toEqual([
      'attack',
      'strength',
      'defence',
      'hitpoints',
    ]);
    expect(getProfessionSkillProgress(game).map((skill) => skill.id)).toEqual(['mining', 'smithing']);
    expect(getProfessionSkillProgress(game)[0]).toMatchObject({ level: 1, isMax: false });
  });
});
