import { GAME_CONFIG } from '../../config/gameConfig';
import { enemyById } from '../../content/enemies';
import { createCombatRng } from '../formulas/combatFormulas';
import type { GameState } from '../types';

export type SaveMigration = (input: GameState) => GameState;
export const migrations: Record<number, SaveMigration> = {
  1: (input) => ({
    ...input,
    schemaVersion: 1,
    settings: { ...input.settings },
    unlockedAreas: input.unlockedAreas?.length ? input.unlockedAreas : ['training-grounds'],
  }),
  2: (input) => {
    const settings = { ...input.settings, huntElites: input.settings.huntElites ?? true };
    if (input.activeAction.type !== 'combat') return { ...input, schemaVersion: 2, settings };
    const legacy = input.activeAction as Extract<GameState['activeAction'], { type: 'combat' }> & {
      combatState: Record<string, unknown>;
    };
    const enemy = enemyById[legacy.enemyId];
    const oldCombat = legacy.combatState;
    const maxHp = Math.max(1, Number(oldCombat.enemyMaxHp ?? enemy?.maxHealth ?? oldCombat.enemyHp ?? 1));
    const rng = createCombatRng(input.lastSimulatedAt, input.profileId, legacy.enemyId);
    return {
      ...input,
      schemaVersion: 2,
      settings,
      activeAction: {
        ...legacy,
        pendingStyle: legacy.pendingStyle ?? null,
        autoSpecial: legacy.autoSpecial ?? true,
        specialQueued: legacy.specialQueued ?? false,
        combatState: {
          enemyHp: Math.max(0, Math.min(maxHp, Number(oldCombat.enemyHp ?? maxHp))),
          enemyMaxHp: maxHp,
          playerAttackMs: Math.max(0, Number(oldCombat.playerAttackMs ?? 0)),
          enemyAttackMs: Math.max(0, Number(oldCombat.enemyAttackMs ?? enemy?.attackIntervalMs ?? 0)),
          respawnMs: Math.max(0, Number(oldCombat.respawnMs ?? 0)),
          rngSeed: rng.rngSeed,
          rngCursor: 0,
          momentum: 0,
          eliteModifier: null,
          eliteAnnounced: true,
          traitState: {
            firstAttackPending: enemy?.trait.id === 'scurry',
            enemyAttackCount: 0,
            bleedStacks: 0,
          },
          encounterIndex: 1,
          encounterStartedAt: input.lastSimulatedAt,
        },
      },
    };
  },
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
