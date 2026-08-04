import { describe, expect, it } from 'vitest';
import { createNewGame } from '../game/state/initialState';
import { parseGameState } from '../game/persistence/saveSchema';
import { migrateSave } from '../game/persistence/migrations';

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
    expect(migrated.schemaVersion).toBe(1);
    expect(migrated.unlockedAreas).toContain('training-grounds');
  });
  it('rejects malformed save data', () => {
    expect(() => parseGameState('{"nope":true}')).toThrow();
  });
});
