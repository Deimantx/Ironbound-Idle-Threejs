import { describe, expect, it } from 'vitest';
import { createNewGame } from '../game/state/initialState';
import { parseGameState } from '../game/persistence/saveSchema';
import { migrateSave } from '../game/persistence/migrations';
import { startCombat } from '../game/engine/actionController';
import type { GameState } from '../game/types';

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
    expect(migrated.schemaVersion).toBe(4);
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
    expect(migrated.schemaVersion).toBe(4);
    expect(
      migrated.activeAction.type === 'combat' && migrated.activeAction.combatState.momentum,
    ).toBe(0);
    expect(migrated.activeAction.type === 'combat' && migrated.activeAction.autoSpecial).toBe(true);
    expect(
      migrated.activeAction.type === 'combat' && migrated.activeAction.combatState.rngCursor,
    ).toBe(0);
  });
});
