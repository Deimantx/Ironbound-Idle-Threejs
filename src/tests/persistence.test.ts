import { describe, expect, it } from 'vitest';
import { createNewGame } from '../game/state/initialState';
import { parseGameState } from '../game/persistence/saveSchema';
import { migrateSave } from '../game/persistence/migrations';
import { startCombat, startSmithing } from '../game/engine/actionController';
import { getDerivedStats } from '../game/formulas/statFormulas';
import { getLevelProgress, getXpForLevel } from '../game/formulas/experienceFormulas';
import type { GameState, SkillId } from '../game/types';

const legacyXpForLevel = (level: number): number =>
  level === 1 ? 0 : Math.floor(100 * Math.pow(level - 1, 1.5));

const legacyState = (name = 'Legacy Progression'): GameState => {
  const state = createNewGame(0, name);
  state.schemaVersion = 5;
  return state;
};

const setLegacyLevel = (state: GameState, skill: SkillId, level: number, progress = 0): void => {
  const floor = legacyXpForLevel(level);
  const next = legacyXpForLevel(level + 1);
  state.skills[skill] = {
    level,
    xp: Math.round(floor + Math.max(0, Math.min(1, progress)) * (next - floor)),
  };
};

describe('save validation and migration', () => {
  it('round trips a representative current payload through Zod', () => {
    const state = createNewGame(0, 'Archivist');
    expect(parseGameState(JSON.stringify(state)).profileId).toBe(state.profileId);
  });
  it('applies the sequential migration entry point to an older fixture', () => {
    const state = createNewGame(0, 'Older');
    const migrated = migrateSave(
      { ...state, schemaVersion: 0, settings: { ...state.settings, threeQuality: 'low' } },
      0,
    );
    expect(migrated.schemaVersion).toBe(7);
    expect(migrated.unlockedAreas).toContain('training-grounds');
  });
  it('rejects malformed save data', () => {
    expect(() => parseGameState('{"nope":true}')).toThrow();
  });
  it('migrates an old active combat action with safe deterministic defaults', () => {
    const current = startCombat(
      createNewGame(0, 'Legacy', 0),
      'training-grounds',
      'forest-rat',
      'accurate',
      true,
      0,
    );
    const legacy = structuredClone(current) as GameState;
    legacy.schemaVersion = 1;
    legacy.activeAction = {
      type: 'combat',
      areaId: 'training-grounds',
      enemyId: 'forest-rat',
      style: 'accurate',
      autoRepeat: true,
      combatState: {
        enemyHp: 5,
        playerAttackMs: 100,
        enemyAttackMs: 200,
        respawnMs: 0,
      },
    } as unknown as GameState['activeAction'];
    const migrated = parseGameState(JSON.stringify(legacy));
    expect(migrated.schemaVersion).toBe(7);
    expect(
      migrated.activeAction.type === 'combat' && migrated.activeAction.combatState.momentum,
    ).toBe(0);
    expect(migrated.activeAction.type === 'combat' && migrated.activeAction.autoSpecial).toBe(true);
    expect(
      migrated.activeAction.type === 'combat' && migrated.activeAction.combatState.rngCursor,
    ).toBe(0);
  });

  it('adds Mining runtime state and converts legacy Copper Mining to Stone', () => {
    const legacy = structuredClone(createNewGame(0, 'Legacy Miner')) as unknown as Record<
      string,
      unknown
    >;
    legacy.schemaVersion = 4;
    delete legacy.mining;
    legacy.activeAction = {
      type: 'mining',
      nodeId: 'copper-vein',
      startedAt: 10,
      progressMs: 999_999,
    };
    const migrated = parseGameState(JSON.stringify(legacy));
    expect(migrated.mining.stamina).toBe(100);
    expect(migrated.mining.nodeStates['stone-outcrop']?.stageIndex).toBe(0);
    expect(migrated.mining.nodeStates['stone-outcrop']?.stageDurability).toBe(60);
    expect(migrated.activeAction).toMatchObject({
      type: 'mining',
      nodeId: 'stone-outcrop',
      phase: 'swing',
      progressMs: 2_999,
    });
  });

  it('maps legacy Tin Mining to Stone without granting rewards', () => {
    const legacy = structuredClone(createNewGame(0, 'Legacy Tin Miner')) as unknown as Record<
      string,
      unknown
    >;
    legacy.schemaVersion = 5;
    legacy.activeAction = {
      type: 'mining',
      nodeId: 'tin-vein',
      startedAt: 10,
      phase: 'rest',
      progressMs: 2_000,
    };
    const migrated = parseGameState(JSON.stringify(legacy));
    expect(migrated.activeAction).toMatchObject({ type: 'mining', nodeId: 'stone-outcrop' });
    expect(migrated.inventory).toEqual([]);
  });

  it('keeps Iron active and Coal valid at the updated Coal requirement', () => {
    const iron = createNewGame(0, 'Iron Miner');
    iron.skills.mining.level = 15;
    iron.activeAction = {
      type: 'mining',
      nodeId: 'iron-vein',
      startedAt: 0,
      phase: 'swing',
      progressMs: 10,
    };
    expect(parseGameState(JSON.stringify(iron)).activeAction).toMatchObject({
      type: 'mining',
      nodeId: 'iron-vein',
    });

    const coal = createNewGame(0, 'Coal Miner');
    coal.skills.mining.level = 30;
    coal.activeAction = {
      type: 'mining',
      nodeId: 'coal-seam',
      startedAt: 0,
      phase: 'swing',
      progressMs: 10,
    };
    expect(parseGameState(JSON.stringify(coal)).activeAction).toMatchObject({
      type: 'mining',
      nodeId: 'coal-seam',
    });
  });

  it('stops legacy Mithril Mining while preserving inventory and XP', () => {
    const legacy = createNewGame(0, 'Legacy Mithril Miner');
    legacy.skills.mining.level = 50;
    legacy.skills.mining.xp = 12_345;
    legacy.inventory = [{ itemId: 'mithril-ore', quantity: 7, locked: false }];
    legacy.activeAction = {
      type: 'mining',
      nodeId: 'mithril-deposit' as never,
      startedAt: 0,
      phase: 'swing',
      progressMs: 10,
    };
    const migrated = parseGameState(JSON.stringify(legacy));
    expect(migrated.activeAction).toEqual({ type: 'none' });
    expect(migrated.inventory).toContainEqual({
      itemId: 'mithril-ore',
      quantity: 7,
      locked: false,
    });
    expect(migrated.skills.mining.xp).toBe(12_345);
  });

  it('stops a save whose active Mining node no longer exists', () => {
    const invalid = structuredClone(createNewGame(0, 'Invalid Miner')) as unknown as Record<
      string,
      unknown
    >;
    invalid.activeAction = {
      type: 'mining',
      nodeId: 'removed-node',
      startedAt: 0,
      phase: 'swing',
      progressMs: 10,
    };
    const migrated = parseGameState(JSON.stringify(invalid));
    expect(migrated.activeAction).toEqual({ type: 'none' });
  });

  it('converts exact legacy level thresholds without changing the level', () => {
    for (const level of [1, 2, 15, 30, 50, 75, 99, 100]) {
      const state = legacyState();
      setLegacyLevel(state, 'mining', level);
      const migrated = migrateSave(state, 5);
      expect(migrated.skills.mining.level).toBe(level);
      expect(migrated.skills.mining.xp).toBe(getXpForLevel(level));
      expect(migrated.schemaVersion).toBe(7);
    }
  });

  it('preserves partial level progress across the new XP curve', () => {
    const progressBySkill: Array<[SkillId, number]> = [
      ['attack', 0.25],
      ['hitpoints', 0.5],
      ['mining', 0.75],
      ['smithing', 0.99],
    ];
    const state = legacyState();
    for (const [skill, progress] of progressBySkill) setLegacyLevel(state, skill, 30, progress);
    const migrated = migrateSave(state, 5);
    for (const [skill, expected] of progressBySkill) {
      expect(migrated.skills[skill].level).toBe(30);
      expect(getLevelProgress(migrated.skills[skill]).percent).toBeCloseTo(expected * 100, 0);
    }
  });

  it('keeps Level 100 and preserves XP beyond the old cap', () => {
    const state = legacyState();
    const excessXp = 12_345;
    setLegacyLevel(state, 'mining', 100);
    state.skills.mining.xp = legacyXpForLevel(100) + excessXp;
    const migrated = migrateSave(state, 5);
    expect(migrated.skills.mining.level).toBe(100);
    expect(migrated.skills.mining.xp).toBe(getXpForLevel(100) + excessXp);
    expect(getLevelProgress(migrated.skills.mining).percent).toBe(100);
  });

  it('keeps Combat Level and active activities stable during XP migration', () => {
    const state = legacyState('Active Legacy Character');
    setLegacyLevel(state, 'attack', 40);
    setLegacyLevel(state, 'strength', 35);
    setLegacyLevel(state, 'defence', 30);
    setLegacyLevel(state, 'hitpoints', 25);
    setLegacyLevel(state, 'mining', 30);
    setLegacyLevel(state, 'smithing', 20);
    state.player.currentHp = 7;
    state.mining.nodeStates['coal-seam'] = {
      stageIndex: 3,
      stageDurability: 99,
      primaryYieldProgress: 0.4,
      respawnRemainingMs: 0,
      rngSeed: 123,
      rngCursor: 5,
    };
    state.activeAction = {
      type: 'mining',
      nodeId: 'coal-seam',
      startedAt: 10,
      phase: 'swing',
      progressMs: 123,
    };
    const combatBefore = getDerivedStats(state).combatLevel;
    const miningBefore = structuredClone(state.activeAction);
    const miningRuntimeBefore = structuredClone(state.mining.nodeStates['coal-seam']);
    const migratedMining = migrateSave(state, 5);
    expect(getDerivedStats(migratedMining).combatLevel).toBe(combatBefore);
    expect(migratedMining.player.currentHp).toBe(7);
    expect(migratedMining.activeAction).toEqual(miningBefore);
    expect(migratedMining.mining.nodeStates['coal-seam']).toEqual(miningRuntimeBefore);

    const combatState = startCombat(
      legacyState('Legacy Combat'),
      'training-grounds',
      'forest-rat',
      'accurate',
      true,
      0,
    );
    for (const skill of ['attack', 'strength', 'defence', 'hitpoints'] as const)
      setLegacyLevel(combatState, skill, 20);
    combatState.schemaVersion = 5;
    const combatActionBefore = structuredClone(combatState.activeAction);
    const migratedCombat = migrateSave(combatState, 5);
    expect(migratedCombat.activeAction).toEqual(combatActionBefore);

    const smithingState = legacyState('Legacy Smithing');
    setLegacyLevel(smithingState, 'smithing', 20);
    smithingState.activeAction = startSmithing(
      smithingState,
      'iron-sword',
      'continuous',
      0,
    ).activeAction;
    const smithingActionBefore = structuredClone(smithingState.activeAction);
    const migratedSmithing = migrateSave(smithingState, 5);
    expect(migratedSmithing.activeAction).toEqual(smithingActionBefore);
  });

  it('does not convert an already migrated save twice', () => {
    const state = legacyState();
    setLegacyLevel(state, 'mining', 30, 0.5);
    const migrated = migrateSave(state, 5);
    const reloaded = migrateSave(migrated, migrated.schemaVersion);
    expect(reloaded.skills.mining).toEqual(migrated.skills.mining);
    expect(reloaded.activeAction).toEqual(migrated.activeAction);
    expect(reloaded.schemaVersion).toBe(7);
  });
});
