import { GAME_CONFIG } from '../../config/gameConfig';
import { enemyById } from '../../content/enemies';
import { itemById } from '../../content/items';
import { recipeById } from '../../content/recipes';
import { createCombatRng } from '../formulas/combatFormulas';
import { getDerivedStats } from '../formulas/statFormulas';
import {
  createMiningRuntimeState,
  getMiningTool,
  normalizeMiningState,
} from '../formulas/miningFormulas';
import {
  createSmithingState,
  getSmithingEffectiveInterval,
  getSmithingMaxCraftable,
  normalizeSmithingState,
} from '../formulas/smithingFormulas';
import {
  getXpForLevel,
  getLevelFromXp,
  normalizeSkillState,
  MAX_LEVEL,
} from '../formulas/experienceFormulas';
import { miningNodeById } from '../../content/miningNodes';
import { SKILL_IDS } from '../types';
import type { GameState, InventoryStack, SkillId } from '../types';

const LEGACY_MINING_NODE_MAP: Record<string, 'stone-outcrop' | null> = {
  'copper-vein': 'stone-outcrop',
  'tin-vein': 'stone-outcrop',
  'mithril-deposit': null,
};

export type SaveMigration = (input: GameState) => GameState;

export const LEGACY_ARMOR_ITEM_MAP: Record<string, string> = {
  'bronze-platebody': 'bronze-armor',
  'bronze-platelegs': 'bronze-armor',
  'iron-platebody': 'iron-armor',
  'iron-platelegs': 'iron-armor',
  'steel-platebody': 'steel-armor',
  'steel-platelegs': 'steel-armor',
};

export const LEGACY_ARMOR_RECIPE_MAP: Record<string, string> = { ...LEGACY_ARMOR_ITEM_MAP };

const getMigratedArmorId = (itemId: unknown): string | null => {
  if (typeof itemId !== 'string') return null;
  const mapped = LEGACY_ARMOR_ITEM_MAP[itemId] ?? itemId;
  return itemById[mapped]?.slot === 'armor' ? mapped : null;
};

const getTierRank = (itemId: string): number => {
  const tier = itemById[itemId]?.tier;
  return tier === 'steel' ? 3 : tier === 'iron' ? 2 : tier === 'bronze' ? 1 : 0;
};

const mergeMigratedStack = (
  inventory: InventoryStack[],
  itemId: string,
  quantity: number,
  locked: boolean,
): void => {
  if (quantity <= 0) return;
  const existing = inventory.find((stack) => stack.itemId === itemId);
  if (existing) {
    existing.quantity += quantity;
    existing.locked = existing.locked || locked;
    return;
  }
  inventory.push({ itemId, quantity, locked });
};

const migrateInventory = (inventory: InventoryStack[]): InventoryStack[] => {
  const next: InventoryStack[] = [];
  for (const stack of inventory) {
    const itemId = LEGACY_ARMOR_ITEM_MAP[stack.itemId] ?? stack.itemId;
    const existing = next.find((entry) => entry.itemId === itemId);
    if (existing) {
      existing.quantity += stack.quantity;
      existing.locked = existing.locked || stack.locked;
    } else {
      next.push({ ...stack, itemId });
    }
  }
  return next;
};

interface LegacyEquipmentCandidate {
  itemId: string;
  source: 'body' | 'legs' | 'armor';
}

const migrateEquipment = (
  input: GameState,
  inventory: InventoryStack[],
): { equipment: GameState['equipment']; inventory: InventoryStack[] } => {
  const legacy = input.equipment as Record<string, unknown>;
  const nextEquipment: GameState['equipment'] = {};
  for (const [slot, itemId] of Object.entries(legacy)) {
    if (slot !== 'body' && slot !== 'legs' && slot !== 'armor' && typeof itemId === 'string')
      nextEquipment[slot as keyof GameState['equipment']] = itemId;
  }

  const candidates: LegacyEquipmentCandidate[] = [];
  const invalidLegacyIds: string[] = [];
  const existingArmor =
    typeof legacy.armor === 'string' && itemById[legacy.armor]?.slot === 'armor'
      ? legacy.armor
      : undefined;
  for (const source of ['body', 'legs'] as const) {
    const value = legacy[source];
    if (typeof value !== 'string') continue;
    const itemId = getMigratedArmorId(value);
    if (itemId) candidates.push({ itemId, source });
    else invalidLegacyIds.push(value);
  }
  if (!existingArmor && typeof legacy.armor === 'string') {
    const itemId = getMigratedArmorId(legacy.armor);
    if (itemId) candidates.push({ itemId, source: 'armor' });
    else invalidLegacyIds.push(legacy.armor);
  }

  const selected = existingArmor
    ? undefined
    : candidates.slice().sort((left, right) => {
        const tierDelta = getTierRank(right.itemId) - getTierRank(left.itemId);
        if (tierDelta !== 0) return tierDelta;
        const sourceRank = { body: 0, legs: 1, armor: 2 } as const;
        return sourceRank[left.source] - sourceRank[right.source];
      })[0];

  if (existingArmor) nextEquipment.armor = existingArmor;
  else if (selected) nextEquipment.armor = selected.itemId;

  const retained = existingArmor
    ? candidates
    : candidates.filter((candidate) => candidate !== selected);
  for (const candidate of retained) mergeMigratedStack(inventory, candidate.itemId, 1, false);
  for (const itemId of invalidLegacyIds) mergeMigratedStack(inventory, itemId, 1, false);

  return { equipment: nextEquipment, inventory };
};

const migrateDiscoveredItems = (discoveredItems: string[]): string[] => {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const itemId of discoveredItems) {
    const mapped = LEGACY_ARMOR_ITEM_MAP[itemId] ?? itemId;
    if (!seen.has(mapped)) {
      seen.add(mapped);
      next.push(mapped);
    }
  }
  return next;
};

const migrateActiveSmithing = (input: GameState): GameState['activeAction'] => {
  if (input.activeAction.type !== 'smithing') return input.activeAction;
  const recipeId = LEGACY_ARMOR_RECIPE_MAP[input.activeAction.recipeId];
  if (!recipeId) return input.activeAction;
  const interval = recipeById[recipeId]?.intervalMs ?? input.activeAction.progressMs + 1;
  const progressMs = Number.isFinite(input.activeAction.progressMs)
    ? Math.max(0, Math.min(interval - 1, input.activeAction.progressMs))
    : 0;
  return { ...input.activeAction, recipeId, progressMs };
};

const migrateEquipmentAndClampHealth = (input: GameState): GameState => {
  const inventory = migrateInventory(input.inventory);
  const migrated = migrateEquipment(input, inventory);
  const next = {
    ...input,
    inventory: migrated.inventory,
    equipment: migrated.equipment,
    discoveredItems: migrateDiscoveredItems(input.discoveredItems),
    activeAction: migrateActiveSmithing(input),
    schemaVersion: 3,
  };
  const maxHealth = getDerivedStats(next).maxHealth;
  return {
    ...next,
    player: { ...next.player, currentHp: Math.min(next.player.currentHp, maxHealth) },
  };
};

const isValidOffhandItem = (itemId: unknown): itemId is string =>
  typeof itemId === 'string' && itemById[itemId]?.slot === 'offhand';

const migrateShieldSlot = (input: GameState): GameState => {
  const legacy = input.equipment as Record<string, unknown>;
  const inventory = input.inventory.slice();
  const nextEquipment: GameState['equipment'] = {};
  const invalidOffhandIds: string[] = [];

  for (const [slot, itemId] of Object.entries(legacy)) {
    if (slot === 'shield' || slot === 'offhand') continue;
    if (typeof itemId === 'string') nextEquipment[slot as keyof GameState['equipment']] = itemId;
  }

  if (isValidOffhandItem(legacy.offhand)) nextEquipment.offhand = legacy.offhand;
  else if (typeof legacy.offhand === 'string') invalidOffhandIds.push(legacy.offhand);

  if (isValidOffhandItem(legacy.shield)) {
    if (nextEquipment.offhand) mergeMigratedStack(inventory, legacy.shield, 1, false);
    else nextEquipment.offhand = legacy.shield;
  } else if (typeof legacy.shield === 'string') {
    mergeMigratedStack(inventory, legacy.shield, 1, false);
  }
  for (const itemId of invalidOffhandIds) mergeMigratedStack(inventory, itemId, 1, false);

  return { ...input, equipment: nextEquipment, inventory, schemaVersion: 4 };
};

const migrateMining = (input: GameState): GameState => {
  const raw = input as unknown as Record<string, unknown>;
  const hadMiningState = raw.mining !== undefined;
  const mining = normalizeMiningState(raw.mining);
  const rawMining = raw.mining as { nodeStates?: Record<string, unknown> } | undefined;
  const oldStatistics = input.statistics as GameState['statistics'] & {
    miningSwings?: number;
    miningStagesDepleted?: number;
    miningRocksDepleted?: number;
  };
  const statistics = {
    ...oldStatistics,
    mined: Number.isFinite(oldStatistics.mined) ? oldStatistics.mined : 0,
    miningSwings: Number.isFinite(oldStatistics.miningSwings)
      ? oldStatistics.miningSwings
      : Math.max(0, oldStatistics.mined ?? 0),
    miningStagesDepleted: Number.isFinite(oldStatistics.miningStagesDepleted)
      ? oldStatistics.miningStagesDepleted
      : 0,
    miningRocksDepleted: Number.isFinite(oldStatistics.miningRocksDepleted)
      ? oldStatistics.miningRocksDepleted
      : 0,
  };
  let activeAction = input.activeAction;
  if (activeAction.type === 'mining') {
    const sourceNodeId = String(activeAction.nodeId);
    const mappedLegacyNode = LEGACY_MINING_NODE_MAP[sourceNodeId];
    const migratedNodeId = mappedLegacyNode === undefined ? sourceNodeId : mappedLegacyNode;
    if (migratedNodeId === 'stone-outcrop' && sourceNodeId !== migratedNodeId) {
      const legacyRuntime = rawMining?.nodeStates?.[sourceNodeId];
      mining.nodeStates['stone-outcrop'] = createMiningRuntimeState('stone-outcrop');
      if (legacyRuntime && typeof legacyRuntime === 'object') {
        const value = legacyRuntime as Partial<ReturnType<typeof createMiningRuntimeState>>;
        const nextRuntime = mining.nodeStates['stone-outcrop']!;
        nextRuntime.stageIndex = Math.max(
          0,
          Math.min(4, Math.floor(Number(value.stageIndex) || 0)),
        );
        const stage = miningNodeById['stone-outcrop'].stages[nextRuntime.stageIndex];
        const legacyDurability = Number(value.stageDurability);
        nextRuntime.stageDurability = Number.isFinite(legacyDurability)
          ? Math.max(0, Math.min(stage.durability, legacyDurability))
          : stage.durability;
        nextRuntime.primaryYieldProgress = Number.isFinite(Number(value.primaryYieldProgress))
          ? Math.max(0, Math.min(0.999999999, Number(value.primaryYieldProgress)))
          : 0;
        nextRuntime.rngSeed = Number.isFinite(Number(value.rngSeed))
          ? Number(value.rngSeed) >>> 0 || nextRuntime.rngSeed
          : nextRuntime.rngSeed;
        nextRuntime.rngCursor = Number.isFinite(Number(value.rngCursor))
          ? Math.max(0, Math.floor(Number(value.rngCursor)))
          : 0;
      }
    }
    const node = migratedNodeId
      ? miningNodeById[migratedNodeId as keyof typeof miningNodeById]
      : undefined;
    if (!migratedNodeId || !node || input.skills.mining.level < node.level) {
      activeAction = { type: 'none' };
    } else {
      if (!hadMiningState || !mining.nodeStates[migratedNodeId as keyof typeof mining.nodeStates])
        mining.nodeStates[migratedNodeId as keyof typeof mining.nodeStates] =
          createMiningRuntimeState(migratedNodeId as keyof typeof miningNodeById);
      const runtime = mining.nodeStates[migratedNodeId as keyof typeof mining.nodeStates]!;
      const phase =
        'phase' in activeAction && activeAction.phase
          ? activeAction.phase
          : runtime.respawnRemainingMs > 0
            ? 'respawn'
            : mining.stamina <= 0
              ? 'rest'
              : 'swing';
      const phaseDuration =
        phase === 'respawn'
          ? node.respawnMs
          : phase === 'rest'
            ? 10_000
            : getMiningTool(input).swingIntervalMs;
      const progressMs = Number.isFinite(activeAction.progressMs)
        ? Math.max(0, Math.min(Math.max(0, phaseDuration - 1), activeAction.progressMs))
        : 0;
      activeAction = {
        type: 'mining',
        nodeId: migratedNodeId as 'stone-outcrop' | 'iron-vein' | 'coal-seam',
        startedAt: Number.isFinite(activeAction.startedAt)
          ? activeAction.startedAt
          : input.lastSimulatedAt,
        phase,
        progressMs,
      };
    }
  }
  return {
    ...input,
    mining,
    statistics,
    activeAction,
    schemaVersion: 5,
  };
};

const LEGACY_MAX_LEVEL = 100;
const EXPERIENCE_SKILLS: readonly SkillId[] = SKILL_IDS;

// Frozen copy of the retired runtime curve. This is migration-only and must not be used for awards.
const getLegacyXpForLevel = (level: number): number => {
  const safeLevel = Math.max(1, Math.min(LEGACY_MAX_LEVEL, Math.floor(level)));
  return safeLevel === 1 ? 0 : Math.floor(100 * Math.pow(safeLevel - 1, 1.5));
};

const getLegacyLevelFromXp = (xp: number): number => {
  const safeXp = Number.isFinite(xp) ? Math.max(0, Math.floor(xp)) : 0;
  let low = 1;
  let high = LEGACY_MAX_LEVEL;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (getLegacyXpForLevel(middle) <= safeXp) low = middle;
    else high = middle - 1;
  }
  return low;
};

const migrateSkillExperience = (input: GameState): GameState => {
  const skills = { ...input.skills };
  for (const skillId of EXPERIENCE_SKILLS) {
    const oldSkill = input.skills[skillId];
    const oldXp = Number.isFinite(oldSkill.xp) ? Math.max(0, Math.floor(oldSkill.xp)) : 0;
    const oldLevel = getLegacyLevelFromXp(oldXp);

    if (oldLevel >= LEGACY_MAX_LEVEL) {
      const legacyCapXp = getLegacyXpForLevel(LEGACY_MAX_LEVEL);
      const excessXp = Math.max(0, oldXp - legacyCapXp);
      skills[skillId] = {
        level: MAX_LEVEL,
        xp: getXpForLevel(MAX_LEVEL) + excessXp,
      };
      continue;
    }

    const oldFloor = getLegacyXpForLevel(oldLevel);
    const oldNext = getLegacyXpForLevel(oldLevel + 1);
    const oldSpan = Math.max(1, oldNext - oldFloor);
    const oldProgress = Math.max(0, Math.min(1, (oldXp - oldFloor) / oldSpan));
    const newFloor = getXpForLevel(oldLevel);
    const newNext = getXpForLevel(oldLevel + 1);
    const newXp = Math.round(newFloor + oldProgress * (newNext - newFloor));
    skills[skillId] = { level: getLevelFromXp(newXp), xp: newXp };
  }
  return { ...input, skills, schemaVersion: 6 };
};

const migrateExperience = (input: GameState): GameState =>
  migrateSkillExperience(migrateMining(input));

const migrateSmithing = (input: GameState): GameState => {
  const smithing = normalizeSmithingState(
    (input as unknown as Record<string, unknown>).smithing ?? createSmithingState(input.profileId),
  );
  let activeAction = input.activeAction;
  if (activeAction.type === 'smithing') {
    const recipe = recipeById[activeAction.recipeId];
    const quantityMode =
      activeAction.quantityMode === 1 ||
      activeAction.quantityMode === 10 ||
      activeAction.quantityMode === 'all' ||
      activeAction.quantityMode === 'continuous'
        ? activeAction.quantityMode
        : 1;
    const remaining =
      quantityMode === 'continuous'
        ? null
        : quantityMode === 'all' && activeAction.remaining === null
          ? getSmithingMaxCraftable({ ...input, smithing }, recipe)
          : quantityMode === 'all'
            ? Math.max(0, Math.floor(activeAction.remaining ?? 0))
            : quantityMode;
    const interval = recipe ? getSmithingEffectiveInterval({ ...input, smithing }, recipe) : 1;
    const progressMs = Number.isFinite(activeAction.progressMs)
      ? Math.max(0, Math.min(Math.max(0, interval - 1), activeAction.progressMs))
      : 0;
    activeAction = { ...activeAction, quantityMode, remaining, progressMs };
  }
  return { ...input, smithing, activeAction, schemaVersion: 7 };
};

const migrateForgeFuel = (input: GameState): GameState => ({
  ...input,
  smithing: normalizeSmithingState(input.smithing),
  schemaVersion: 8,
});

const normalizeSkillStates = (input: GameState): GameState => {
  const skills = { ...input.skills };
  for (const skillId of EXPERIENCE_SKILLS)
    skills[skillId] = normalizeSkillState(input.skills[skillId]);
  return { ...input, skills };
};

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
    const maxHp = Math.max(
      1,
      Number(oldCombat.enemyMaxHp ?? enemy?.maxHealth ?? oldCombat.enemyHp ?? 1),
    );
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
          enemyAttackMs: Math.max(
            0,
            Number(oldCombat.enemyAttackMs ?? enemy?.attackIntervalMs ?? 0),
          ),
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
  3: migrateEquipmentAndClampHealth,
  4: migrateShieldSlot,
  5: migrateMining,
  6: migrateExperience,
  7: migrateSmithing,
  8: migrateForgeFuel,
};

export const migrateSave = (input: GameState, fromVersion = input.schemaVersion): GameState => {
  let current = structuredClone(input);
  for (let version = fromVersion + 1; version <= GAME_CONFIG.currentSaveVersion; version += 1) {
    const migration = migrations[version];
    if (migration) current = migration(current);
  }
  if (fromVersion >= GAME_CONFIG.currentSaveVersion) {
    current = migrateMining(current);
    current = migrateSmithing(current);
    current = migrateForgeFuel(current);
  }
  current = normalizeSkillStates(current);
  current.schemaVersion = GAME_CONFIG.currentSaveVersion;
  return current;
};
