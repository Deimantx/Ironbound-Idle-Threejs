import { z } from 'zod';
import type { GameState } from '../types';
import { GAME_CONFIG } from '../../config/gameConfig';
import { migrateSave } from './migrations';

export const saveRecordSchema = z.object({
  schemaVersion: z.number().int().positive(),
  profileId: z.string().min(1),
  slot: z.number().int().min(0).max(2),
  payload: z.string().min(2),
  updatedAt: z.number(),
  checksum: z.string().min(3),
});
const activeCombatStateBaseSchema = z
  .object({
    enemyHp: z.number().finite(),
    playerAttackMs: z.number().finite(),
    enemyAttackMs: z.number().finite(),
    respawnMs: z.number().finite(),
    enemyMaxHp: z.number().finite().optional(),
    rngSeed: z.number().finite().optional(),
    rngCursor: z.number().finite().optional(),
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
const activeCombatEffectSchema = z
  .object({
    instanceId: z.string().min(1),
    effectId: z.string().min(1),
    target: z.enum(['player', 'enemy']),
    sourceEnemyId: z.string().optional(),
    sourceSpecialId: z.string().optional(),
    remainingMs: z.number().finite().nullable(),
    stacks: z.number().int().positive(),
    nextTickMs: z.number().finite().optional(),
    magnitude: z.number().finite().optional(),
  })
  .passthrough();
const combatEffectsSchema = z.object({
  player: z.array(activeCombatEffectSchema),
  enemy: z.array(activeCombatEffectSchema),
});
const activeCombatStateSchema = activeCombatStateBaseSchema.extend({
  adrenaline: z.number().finite(),
  enemySpecialCharge: z.number().finite(),
  effects: combatEffectsSchema,
}).superRefine((combatState, context) => {
  if ('momentum' in combatState)
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['momentum'],
      message: 'Legacy Momentum field. Use adrenaline.',
    });
});
const legacyActiveCombatStateSchema = activeCombatStateBaseSchema.extend({
  momentum: z.number().finite().optional(),
  adrenaline: z.number().finite().optional(),
  enemySpecialCharge: z.number().finite().optional(),
  effects: combatEffectsSchema.optional(),
});
const activeActionSchema = z.union([
  z.object({ type: z.literal('none') }).passthrough(),
  z
    .object({
      type: z.literal('mining'),
      nodeId: z.string(),
      startedAt: z.number(),
      phase: z.enum(['swing', 'rest', 'respawn']),
      progressMs: z.number(),
    })
    .passthrough(),
  z
    .object({
      type: z.literal('smithing'),
      recipeId: z.string(),
      quantityMode: z.unknown(),
      remaining: z.number().nullable(),
      progressMs: z.number(),
    })
    .passthrough(),
  z
    .object({
      type: z.literal('combat'),
      enemyId: z.string(),
      areaId: z.string(),
      style: z.enum(['accurate', 'aggressive', 'defensive']),
      autoRepeat: z.boolean(),
      pendingStyle: z.enum(['accurate', 'aggressive', 'defensive']).nullable().optional(),
      autoSpecial: z.boolean().optional(),
      specialQueued: z.boolean().optional(),
      combatState: activeCombatStateSchema,
    })
    .passthrough(),
]);
const legacyActiveActionSchema = z.union([
  z.object({ type: z.literal('none') }).passthrough(),
  z
    .object({
      type: z.literal('mining'),
      nodeId: z.string(),
      startedAt: z.number(),
      phase: z.enum(['swing', 'rest', 'respawn']).optional(),
      progressMs: z.number(),
    })
    .passthrough(),
  z
    .object({
      type: z.literal('smithing'),
      recipeId: z.string(),
      quantityMode: z.unknown(),
      remaining: z.number().nullable(),
      progressMs: z.number(),
    })
    .passthrough(),
  z
    .object({
      type: z.literal('combat'),
      enemyId: z.string(),
      areaId: z.string(),
      style: z.enum(['accurate', 'aggressive', 'defensive']),
      autoRepeat: z.boolean(),
      pendingStyle: z.enum(['accurate', 'aggressive', 'defensive']).nullable().optional(),
      autoSpecial: z.boolean().optional(),
      specialQueued: z.boolean().optional(),
      combatState: legacyActiveCombatStateSchema,
    })
    .passthrough(),
]);
const legacyEquipmentSchema = z.record(z.string(), z.string());
const forgeFuelStateSchema = z.object({
  selectedFuelItemId: z.string().nullable(),
  loadedFuelItemId: z.string().nullable(),
  loadedFuelQuantity: z.number().int().nonnegative(),
  autoRefuel: z.boolean(),
});
const currentSmithingStateSchema = z.object({
  rngSeed: z.number().finite(),
  rngCursor: z.number().int().nonnegative(),
  forgeFuel: forgeFuelStateSchema,
});
const legacySmithingStateSchema = z
  .object({
    rngSeed: z.number().finite(),
    rngCursor: z.number().int().nonnegative(),
  })
  .passthrough();
const currentEquipmentSchema = z
  .record(z.string(), z.string())
  .superRefine((equipment, context) => {
    for (const slot of ['body', 'legs', 'shield']) {
      if (slot in equipment)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [slot],
          message: 'Legacy equipment slot.',
        });
      }
  });

const skillIdSchema = z.enum([
  'attack',
  'strength',
  'defence',
  'hitpoints',
  'mining',
  'smithing',
]);
const enemyIdSchema = z.enum([
  'forest-rat',
  'goblin-scavenger',
  'cave-bat',
  'stoneback-crab',
  'grey-wolf',
  'road-bandit',
  'hill-boar',
  'stonehide-ram',
  'tunnel-crawler',
  'forsaken-miner',
  'cliff-harpy',
  'stonehill-marauder',
  'ironbound-sentinel',
  'watchtower-captain',
]);
const eliteModifierSchema = z.enum([
  'savage',
  'armoured',
  'swift',
  'wealthy',
  'treasure-touched',
]);
const milestoneLogEntrySchema = z.object({
  id: z.string().min(1),
  kind: z.literal('level-up'),
  at: z.number().finite(),
  skillId: skillIdSchema,
  level: z.number().int().positive(),
});
const combatLogBaseShape = {
  id: z.string().min(1),
  at: z.number().finite(),
  enemyId: enemyIdSchema,
  encounterStartedAt: z.number().finite(),
};
const combatDefeatCauseSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('enemy-hit'), damage: z.number().finite().nonnegative(), heavy: z.boolean() }),
  z.object({ kind: z.literal('enemy-special'), specialId: z.string().min(1), damage: z.number().finite().nonnegative() }),
  z.object({ kind: z.literal('bleed'), damage: z.number().finite().nonnegative() }),
  z.object({
    kind: z.literal('combat-effect'),
    effectId: z.string().min(1),
    sourceEnemyId: enemyIdSchema.optional(),
    sourceSpecialId: z.string().min(1).optional(),
    damage: z.number().finite().nonnegative(),
  }),
]);
const combatLogEntrySchema = z.discriminatedUnion('kind', [
  z.object({ ...combatLogBaseShape, kind: z.literal('player-hit'), damage: z.number().finite().nonnegative(), special: z.boolean() }),
  z.object({ ...combatLogBaseShape, kind: z.literal('player-miss'), special: z.boolean() }),
  z.object({ ...combatLogBaseShape, kind: z.literal('enemy-hit'), damage: z.number().finite().nonnegative(), heavy: z.boolean() }),
  z.object({ ...combatLogBaseShape, kind: z.literal('enemy-miss') }),
  z.object({ ...combatLogBaseShape, kind: z.literal('enemy-special-hit'), specialId: z.string().min(1), damage: z.number().finite().nonnegative() }),
  z.object({ ...combatLogBaseShape, kind: z.literal('enemy-special-miss'), specialId: z.string().min(1) }),
  z.object({ ...combatLogBaseShape, kind: z.literal('enemy-special-used'), specialId: z.string().min(1) }),
  z.object({ ...combatLogBaseShape, kind: z.literal('enemy-bleed'), damage: z.number().finite().nonnegative() }),
  z.object({
    ...combatLogBaseShape,
    kind: z.literal('combat-effect-damage'),
    effectId: z.string().min(1),
    sourceEnemyId: enemyIdSchema.optional(),
    sourceSpecialId: z.string().min(1).optional(),
    damage: z.number().finite().nonnegative(),
  }),
  z.object({
    ...combatLogBaseShape,
    kind: z.literal('enemy-defeated'),
    gold: z.number().finite().nonnegative(),
    eliteModifier: eliteModifierSchema.nullable(),
  }),
  z.object({ ...combatLogBaseShape, kind: z.literal('loot'), itemId: z.string().min(1), quantity: z.number().int().positive() }),
  z.object({ ...combatLogBaseShape, kind: z.literal('gold'), amount: z.number().finite().nonnegative() }),
  z.object({ ...combatLogBaseShape, kind: z.literal('elite-spawned'), modifier: eliteModifierSchema }),
  z.object({ ...combatLogBaseShape, kind: z.literal('enemy-spawned'), encounterIndex: z.number().int().positive() }),
  z.object({ ...combatLogBaseShape, kind: z.literal('player-defeated'), cause: combatDefeatCauseSchema }),
  z.object({
    id: z.string().min(1),
    kind: z.literal('legacy'),
    at: z.number().finite(),
    message: z.string(),
    encounterStartedAt: z.number().finite(),
    enemyId: enemyIdSchema.optional(),
  }),
]);
const activityLogsSchema = z.object({
  milestones: z.array(milestoneLogEntrySchema).max(50),
  combat: z.array(combatLogEntrySchema).max(120),
});
const legacyLogEntrySchema = z.object({
  id: z.string(),
  at: z.number(),
  text: z.string(),
  tone: z.enum(['neutral', 'success', 'warning', 'danger']),
  combatEncounterStartedAt: z.number().finite().optional(),
});

const savePayloadShape = {
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
  equipment: currentEquipmentSchema,
  discoveredItems: z.array(z.string()),
  discoveredMonsters: z.array(z.string()),
  killCounts: z.record(z.string(), z.number()),
  statistics: z.object({
    mined: z.number(),
    miningSwings: z.number(),
    miningStagesDepleted: z.number(),
    miningRocksDepleted: z.number(),
    smelted: z.number(),
    forged: z.number(),
    deaths: z.number(),
    totalKills: z.number(),
    totalItemsGained: z.number().int().nonnegative(),
    playTimeMs: z.number().int().nonnegative(),
  }),
  gold: z.number().nonnegative(),
  mining: z.object({
    stamina: z.number().finite(),
    nodeStates: z.record(
      z.object({
        stageIndex: z.number().int().nonnegative(),
        stageDurability: z.number().finite().nonnegative(),
        primaryYieldProgress: z.number().finite().nonnegative(),
        respawnRemainingMs: z.number().finite().nonnegative(),
        rngSeed: z.number().finite(),
        rngCursor: z.number().int().nonnegative(),
      }),
    ),
  }),
  smithing: currentSmithingStateSchema,
  activeAction: activeActionSchema,
  unlockedAreas: z.array(z.string()),
  settings: z.object({
    sound: z.boolean(),
    music: z.boolean(),
    reducedMotion: z.boolean(),
    compactNumbers: z.boolean(),
    showHelpIcons: z.boolean(),
    huntElites: z.boolean().optional(),
    threeQuality: z.enum(['off', 'low', 'high']),
  }),
  activityLogs: activityLogsSchema,
};

export const savePayloadSchema = z.object(savePayloadShape);
export const legacySavePayloadSchema = z.object({
  ...savePayloadShape,
  settings: savePayloadShape.settings.extend({ showHelpIcons: z.boolean().optional() }),
  activityLogs: activityLogsSchema.optional(),
  log: z.array(legacyLogEntrySchema).optional(),
  smithing: legacySmithingStateSchema.optional(),
  statistics: z.object({
    mined: z.number(),
    miningSwings: z.number().optional(),
    miningStagesDepleted: z.number().optional(),
    miningRocksDepleted: z.number().optional(),
    smelted: z.number(),
    forged: z.number(),
    deaths: z.number(),
    totalKills: z.number(),
    totalItemsGained: z.number().int().nonnegative().optional(),
    playTimeMs: z.number().int().nonnegative().optional(),
  }),
  mining: savePayloadShape.mining.optional(),
  activeAction: legacyActiveActionSchema,
  equipment: legacyEquipmentSchema,
});

export const parseGameState = (payload: string): GameState => {
  const value: unknown = JSON.parse(payload);
  const version =
    typeof value === 'object' &&
    value !== null &&
    'schemaVersion' in value &&
    typeof value.schemaVersion === 'number'
      ? value.schemaVersion
      : Number.NaN;
  const schema =
    version < GAME_CONFIG.currentSaveVersion ? legacySavePayloadSchema : savePayloadSchema;
  const result = schema.safeParse(value);
  if (!result.success) throw new Error('Save payload failed validation.');
  const migrated = migrateSave(result.data as GameState, result.data.schemaVersion);
  const current = savePayloadSchema.safeParse(migrated);
  if (!current.success) throw new Error('Migrated save payload failed validation.');
  return current.data as GameState;
};
