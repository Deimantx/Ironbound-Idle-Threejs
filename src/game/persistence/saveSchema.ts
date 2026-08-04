import { z } from 'zod';
import type { GameState } from '../types';
import { migrateSave } from './migrations';

export const saveRecordSchema = z.object({
  schemaVersion: z.number().int().positive(),
  profileId: z.string().min(1),
  slot: z.number().int().min(0).max(2),
  payload: z.string().min(2),
  updatedAt: z.number(),
  checksum: z.string().min(3),
});
const activeCombatStateSchema = z
  .object({
    enemyHp: z.number().finite(),
    playerAttackMs: z.number().finite(),
    enemyAttackMs: z.number().finite(),
    respawnMs: z.number().finite(),
    enemyMaxHp: z.number().finite().optional(),
    rngSeed: z.number().finite().optional(),
    rngCursor: z.number().finite().optional(),
    momentum: z.number().finite().optional(),
    eliteModifier: z.string().nullable().optional(),
    eliteAnnounced: z.boolean().optional(),
    traitState: z
      .object({
        firstAttackPending: z.boolean().optional(),
        enemyAttackCount: z.number().finite().optional(),
        bleedStacks: z.number().finite().optional(),
      })
      .optional(),
    encounterIndex: z.number().finite().optional(),
    encounterStartedAt: z.number().finite().optional(),
  })
  .passthrough();
const activeActionSchema = z.union([
  z.object({ type: z.literal('none') }).passthrough(),
  z.object({ type: z.literal('mining'), nodeId: z.string(), startedAt: z.number(), progressMs: z.number() }).passthrough(),
  z.object({ type: z.literal('smithing'), recipeId: z.string(), quantityMode: z.unknown(), remaining: z.number().nullable(), progressMs: z.number() }).passthrough(),
  z.object({
    type: z.literal('combat'),
    enemyId: z.string(),
    areaId: z.string(),
    style: z.enum(['accurate', 'aggressive', 'defensive']),
    autoRepeat: z.boolean(),
    pendingStyle: z.enum(['accurate', 'aggressive', 'defensive']).nullable().optional(),
    autoSpecial: z.boolean().optional(),
    specialQueued: z.boolean().optional(),
    combatState: activeCombatStateSchema,
  }).passthrough(),
]);
export const savePayloadSchema = z.object({
  schemaVersion: z.number().int().positive(),
  profileId: z.string().min(1),
  profileSlot: z.number().int().min(0).max(2),
  createdAt: z.number(),
  updatedAt: z.number(),
  lastSimulatedAt: z.number(),
  player: z.object({ name: z.string(), currentHp: z.number().finite() }),
  skills: z.record(z.string(), z.object({ xp: z.number(), level: z.number() })),
  inventory: z.array(
    z.object({ itemId: z.string(), quantity: z.number().int().nonnegative(), locked: z.boolean() }),
  ),
  equipment: z.record(z.string(), z.string()),
  discoveredItems: z.array(z.string()),
  discoveredMonsters: z.array(z.string()),
  killCounts: z.record(z.string(), z.number()),
  statistics: z.object({
    mined: z.number(),
    smelted: z.number(),
    forged: z.number(),
    deaths: z.number(),
    totalKills: z.number(),
  }),
  gold: z.number().nonnegative(),
  activeAction: activeActionSchema,
  unlockedAreas: z.array(z.string()),
  settings: z.object({
    sound: z.boolean(),
    music: z.boolean(),
    reducedMotion: z.boolean(),
    compactNumbers: z.boolean(),
    huntElites: z.boolean().optional(),
    threeQuality: z.enum(['off', 'low', 'high']),
  }),
  log: z.array(
    z.object({
      id: z.string(),
      at: z.number(),
      text: z.string(),
      tone: z.enum(['neutral', 'success', 'warning', 'danger']),
      combatEncounterStartedAt: z.number().finite().optional(),
    }),
  ),
});

export const parseGameState = (payload: string): GameState => {
  const value: unknown = JSON.parse(payload);
  const result = savePayloadSchema.safeParse(value);
  if (!result.success) throw new Error('Save payload failed validation.');
  return migrateSave(result.data as GameState, result.data.schemaVersion);
};
