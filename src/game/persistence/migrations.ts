import { GAME_CONFIG } from '../../config/gameConfig';
import type { GameState } from '../types';

export type SaveMigration = (input: GameState) => GameState;
export const migrations: Record<number, SaveMigration> = {
  1: (input) => ({
    ...input,
    schemaVersion: 1,
    settings: { ...input.settings },
    unlockedAreas: input.unlockedAreas?.length ? input.unlockedAreas : ['training-grounds'],
  }),
};

export const migrateSave = (input: GameState, fromVersion = input.schemaVersion): GameState => {
  let current = structuredClone(input);
  for (let version = fromVersion + 1; version <= GAME_CONFIG.currentSaveVersion; version += 1) {
    const migration = migrations[version];
    if (migration) current = migration(current);
  }
  current.schemaVersion = GAME_CONFIG.currentSaveVersion;
  return current;
};
