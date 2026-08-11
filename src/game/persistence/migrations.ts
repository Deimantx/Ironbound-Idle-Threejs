import { GAME_CONFIG } from '../../config/gameConfig';
import { COMBAT_TUNING } from '../../config/combatTuning';
import { enemyById } from '../../content/enemies';
import { combatEffectById } from '../../content/combatEffects';
import { itemById } from '../../content/items';
import { legacyItemById, RETIRED_PROFESSION_ITEM_IDS } from '../../content/legacyItems';
import { recipeById } from '../../content/recipes';
import { legacyRecipeById } from '../../content/legacyRecipes';
import { createCombatRng } from '../formulas/combatFormulas';
import { getDerivedStats } from '../formulas/statFormulas';
import { clampHealth } from '../systems/healthSystem';
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
import { AREAS } from '../../content/areas';
import { ENEMIES } from '../../content/enemies';
import { createEnemyTraitState } from '../systems/enemyTraitSystem';
import { SKILL_IDS } from '../types';
import type {
  ActivityLogsState,
  AreaId,
  CombatLogEntry,
  EnemyId,
  GameState,
  InventoryStack,
  LegacyGameLogEntry,
  MilestoneLogEntry,
  SkillId,
} from '../types';

const LEGACY_MINING_NODE_MAP: Record<string, 'stone-outcrop' | null> = {
  'copper-vein': 'stone-outcrop',
  'tin-vein': 'stone-outcrop',
  'mithril-deposit': null,
};

export type SaveMigration = (input: GameState) => GameState;

const migrationItemById = { ...legacyItemById, ...itemById };

export const LEGACY_ARMOR_ITEM_MAP: Record<string, string> = {
  'bronze-platebody': 'bronze-armor',
  'bronze-platelegs': 'bronze-armor',
  'iron-platebody': 'iron-armor',
  'iron-platelegs': 'iron-armor',
  'steel-platebody': 'steel-armor',
  'steel-platelegs': 'steel-armor',
};

export const LEGACY_ARMOR_RECIPE_MAP: Record<string, string> = { ...LEGACY_ARMOR_ITEM_MAP };

const LEGACY_AREA_MAP: Record<string, AreaId> = {
  'training-grounds': 'forest-path',
  'copper-hills': 'old-shrine',
  'ironwood-pass': 'wolf-den',
};

const COMBAT_AREA_BY_ENEMY: Record<string, AreaId> = {
  'forest-rat': 'forest-path',
  'goblin-scavenger': 'forest-path',
  'cave-bat': 'old-shrine',
  'stoneback-crab': 'old-shrine',
  'grey-wolf': 'wolf-den',
  'road-bandit': 'abandoned-camp',
  'hill-boar': 'rocky-foothills',
  'stonehide-ram': 'rocky-foothills',
  'tunnel-crawler': 'abandoned-mine',
  'forsaken-miner': 'abandoned-mine',
  'cliff-harpy': 'mountain-pass',
  'stonehill-marauder': 'mountain-pass',
  'ironbound-sentinel': 'ruined-watchtower',
  'watchtower-captain': 'ruined-watchtower',
};

const CURRENT_CONTENT_AREA_IDS = new Set(AREAS.map((area) => area.id));

const isCurrentAreaId = (value: unknown): value is AreaId =>
  (typeof value === 'string' && CURRENT_CONTENT_AREA_IDS.has(value as AreaId)) ||
  value === 'forest-path' ||
  value === 'wolf-den' ||
  value === 'abandoned-camp' ||
  value === 'old-shrine' ||
  value === 'rocky-foothills' ||
  value === 'abandoned-mine' ||
  value === 'mountain-pass' ||
  value === 'ruined-watchtower';

const migrateCombatAreaId = (areaId: unknown, enemyId: unknown): AreaId => {
  if (typeof enemyId === 'string' && enemyId in COMBAT_AREA_BY_ENEMY)
    return COMBAT_AREA_BY_ENEMY[enemyId as EnemyId];
  if (isCurrentAreaId(areaId)) return areaId;
  return LEGACY_AREA_MAP[String(areaId)] ?? 'forest-path';
};

const migrateCombatAreas = (input: GameState): GameState => {
  const activeAction = input.activeAction;
  const nextActiveAction =
    activeAction.type === 'combat'
      ? {
          ...activeAction,
          areaId: migrateCombatAreaId(activeAction.areaId, activeAction.enemyId),
        }
      : activeAction;
  const unlockedAreas = Array.from(
    new Set((input.unlockedAreas ?? []).map((areaId) => migrateCombatAreaId(areaId, undefined))),
  );
  return {
    ...input,
    activeAction: nextActiveAction,
    unlockedAreas: unlockedAreas.length ? unlockedAreas : ['forest-path'],
    schemaVersion: 9,
  };
};

const LEGACY_SKILL_NAME_MAP: Record<string, SkillId> = {
  attack: 'attack',
  strength: 'strength',
  defence: 'defence',
  defense: 'defence',
  hitpoints: 'hitpoints',
  mining: 'mining',
  smithing: 'smithing',
};

const migrateLegacyLog = (legacyLog: LegacyGameLogEntry[]): ActivityLogsState => {
  const milestones: MilestoneLogEntry[] = [];
  const combat: CombatLogEntry[] = [];
  for (const entry of legacyLog) {
    const levelUp = entry.text.match(/^([A-Za-z]+) reached level (\d+)\.?$/i);
    if (levelUp) {
      const skillId = LEGACY_SKILL_NAME_MAP[levelUp[1].toLowerCase()];
      const level = Number(levelUp[2]);
      if (skillId && Number.isInteger(level) && level > 0)
        milestones.push({ id: entry.id, kind: 'level-up', at: entry.at, skillId, level });
    }
    if (Number.isFinite(entry.combatEncounterStartedAt))
      combat.push({
        id: entry.id,
        kind: 'legacy',
        at: entry.at,
        message: entry.text,
        encounterStartedAt: entry.combatEncounterStartedAt!,
      });
  }
  return { milestones: milestones.slice(0, 50), combat: combat.slice(0, 120) };
};

const normalizeRetiredCombatLogEntries = (entries: unknown[]): CombatLogEntry[] => entries.map((entry, index) => {
  const candidate = entry as { kind?: unknown; id?: unknown; at?: unknown; encounterStartedAt?: unknown };
  if (candidate.kind !== 'enemy-bleed') return entry as CombatLogEntry;
  const at = Number(candidate.at);
  const encounterStartedAt = Number(candidate.encounterStartedAt);
  return {
    id: typeof candidate.id === 'string' ? candidate.id : `legacy-enemy-bleed-${index}`,
    kind: 'legacy',
    at: Number.isFinite(at) ? at : 0,
    message: 'Legacy combat event: retired bleed damage.',
    encounterStartedAt: Number.isFinite(encounterStartedAt) ? encounterStartedAt : 0,
  };
});

const migrateActivityLogs = (input: GameState): GameState => {
  const raw = input as unknown as Record<string, unknown>;
  const existing = raw.activityLogs as Partial<ActivityLogsState> | undefined;
  const legacyLog = Array.isArray(raw.log) ? (raw.log as LegacyGameLogEntry[]) : undefined;
  const activityLogs: ActivityLogsState = existing
    ? {
        milestones: Array.isArray(existing.milestones) ? existing.milestones.slice(0, 50) : [],
        combat: Array.isArray(existing.combat)
          ? normalizeRetiredCombatLogEntries(existing.combat.slice(0, 120))
          : [],
      }
    : migrateLegacyLog(legacyLog ?? []);
  const next = { ...input, activityLogs, schemaVersion: 10 } as GameState;
  delete (next as unknown as Record<string, unknown>).log;
  return next;
};

const migrateMomentumToAdrenaline = (input: GameState): GameState => {
  if (input.activeAction.type !== 'combat') return { ...input, schemaVersion: 11 };
  const rawCombatState = input.activeAction.combatState as unknown as Record<string, unknown>;
  const legacyValue = rawCombatState.adrenaline ?? rawCombatState.momentum;
  const adrenaline = Number.isFinite(Number(legacyValue)) ? Number(legacyValue) : 0;
  const combatState = { ...rawCombatState, adrenaline };
  delete (combatState as Record<string, unknown>).momentum;
  return {
    ...input,
    activeAction: {
      ...input.activeAction,
      combatState: combatState as Extract<GameState['activeAction'], { type: 'combat' }>['combatState'],
    },
    schemaVersion: 11,
  };
};

const getMigratedArmorId = (itemId: unknown): string | null => {
  if (typeof itemId !== 'string') return null;
  const mapped = LEGACY_ARMOR_ITEM_MAP[itemId] ?? itemId;
  return migrationItemById[mapped]?.slot === 'armor' ? mapped : null;
};

const getTierRank = (itemId: string): number => {
  const tier = migrationItemById[itemId]?.tier;
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
    typeof legacy.armor === 'string' && migrationItemById[legacy.armor]?.slot === 'armor'
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
  const interval =
    (recipeById[recipeId] ?? legacyRecipeById[recipeId])?.intervalMs ??
    input.activeAction.progressMs + 1;
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
    player: { ...next.player, currentHp: clampHealth(next.player.currentHp, maxHealth) },
  };
};

const isValidOffhandItem = (itemId: unknown): itemId is string =>
  typeof itemId === 'string' && migrationItemById[itemId]?.slot === 'offhand';

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
    const recipe = recipeById[activeAction.recipeId] ?? legacyRecipeById[activeAction.recipeId];
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

const migrateHelpIcons = (input: GameState): GameState => ({
  ...input,
  settings: { ...input.settings, showHelpIcons: input.settings.showHelpIcons ?? true },
  schemaVersion: 12,
});

const normalizePersistedEffects = (value: unknown, target: 'player' | 'enemy') => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw, index) => {
    if (!raw || typeof raw !== 'object') return [];
    const effect = raw as Record<string, unknown>;
    const effectId = typeof effect.effectId === 'string' ? effect.effectId : null;
    if (!effectId) return [];
    const remainingMs = effect.remainingMs === null ? null : Number(effect.remainingMs);
    return [
      {
        ...effect,
        instanceId:
          typeof effect.instanceId === 'string' && effect.instanceId.length
            ? effect.instanceId
            : `${effectId}-${target}-${index}`,
        effectId,
        target,
        remainingMs: Number.isFinite(remainingMs) ? remainingMs : null,
        stacks: Math.max(1, Math.floor(Number(effect.stacks) || 1)),
      },
    ];
  });
};

const migrateEnemySpecialFoundation = (input: GameState): GameState => {
  if (input.activeAction.type !== 'combat') return { ...input, schemaVersion: 13 };
  const rawCombatState = input.activeAction.combatState as unknown as Record<string, unknown>;
  const rawEffects = rawCombatState.effects as Record<string, unknown> | undefined;
  const rawCharge = Number(rawCombatState.enemySpecialCharge);
  const combatState = {
    ...rawCombatState,
    enemySpecialCharge: Number.isFinite(rawCharge)
      ? Math.max(0, Math.min(COMBAT_TUNING.enemySpecialChargeMax, rawCharge))
      : 0,
    effects: {
      player: normalizePersistedEffects(rawEffects?.player, 'player'),
      enemy: normalizePersistedEffects(rawEffects?.enemy, 'enemy'),
    },
  };
  return {
    ...input,
    activeAction: {
      ...input.activeAction,
      combatState: combatState as Extract<GameState['activeAction'], { type: 'combat' }>['combatState'],
    },
    schemaVersion: 13,
  };
};

const migratePeriodicCombatEffects = (input: GameState): GameState => {
  if (input.activeAction.type !== 'combat') return { ...input, schemaVersion: 14 };
  const combatState = input.activeAction.combatState;
  const normalizeLane = (effects: typeof combatState.effects.player) =>
    effects.map((effect) => {
      const interval = combatEffectById[effect.effectId]?.periodicDamage?.intervalMs;
      const nextTickMs = Number(effect.nextTickMs);
      return interval !== undefined
        ? {
            ...effect,
            nextTickMs: Number.isFinite(nextTickMs) ? Math.max(0, nextTickMs) : interval,
          }
        : effect;
    });
  return {
    ...input,
    activeAction: {
      ...input.activeAction,
      combatState: {
        ...combatState,
        effects: {
          player: normalizeLane(combatState.effects.player),
          enemy: normalizeLane(combatState.effects.enemy),
        },
      },
    },
    schemaVersion: 14,
  };
};

const normalizeLifetimeStatistic = (value: unknown): number => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
};

const migrateLifetimeStatistics = (input: GameState): GameState => ({
  ...input,
  statistics: {
    ...input.statistics,
    totalItemsGained: normalizeLifetimeStatistic(
      (input.statistics as GameState['statistics'] & { totalItemsGained?: unknown })
        .totalItemsGained,
    ),
    playTimeMs: normalizeLifetimeStatistic(
      (input.statistics as GameState['statistics'] & { playTimeMs?: unknown }).playTimeMs,
    ),
  },
  schemaVersion: 15,
});

const CURRENT_AREA_IDS = new Set(AREAS.filter((area) => area.availability === 'available').map((area) => area.id));
const CURRENT_ENEMY_IDS = new Set(ENEMIES.map((enemy) => enemy.id));
const REMOVED_COMBAT_ITEM_IDS = new Set([
  'rat-tail', 'tattered-hide', 'bat-wing', 'crab-shell', 'bandit-token', 'rusted-emblem',
  'coarse-boar-hide', 'boar-tusk', 'stonehill-bristle', 'stonewool-fleece', 'ram-horn',
  'dense-hoof-fragment', 'crawler-carapace', 'burrow-claw', 'glow-sac', 'bent-pick-head',
  'miners-badge', 'blackened-lantern', 'old-claim-token', 'harpy-feather', 'hooked-talon',
  'windworn-pinion', 'cliff-nest-trinket', 'marauder-insignia', 'riveted-leather-scrap',
  'warband-token', 'notched-whetstone', 'sentinel-plate-fragment', 'rusted-gear', 'runed-rivet',
  'watchtower-core', 'captains-sigil', 'watchtower-key-fragment', 'commanders-strap', 'old-garrison-seal',
]);

const migrateTauraqueContentReset = (input: GameState): GameState => {
  const activeAction = input.activeAction.type === 'combat' &&
    (!CURRENT_AREA_IDS.has(input.activeAction.areaId as never) || !CURRENT_ENEMY_IDS.has(input.activeAction.enemyId as never))
    ? { type: 'none' as const }
    : input.activeAction;
  const discoveredMonsters = input.discoveredMonsters.filter((id) => CURRENT_ENEMY_IDS.has(id as never));
  const killCounts = Object.fromEntries(Object.entries(input.killCounts).filter(([id]) => CURRENT_ENEMY_IDS.has(id as never))) as GameState['killCounts'];
  const activityLogs = {
    ...input.activityLogs,
    combat: input.activityLogs.combat.filter((entry) => !entry.enemyId || CURRENT_ENEMY_IDS.has(entry.enemyId as never)),
  };
  const inventory = input.inventory.filter((stack) => !REMOVED_COMBAT_ITEM_IDS.has(stack.itemId));
  const discoveredItems = input.discoveredItems.filter((id) => !REMOVED_COMBAT_ITEM_IDS.has(id));
  const normalizedActive = activeAction.type === 'combat'
    ? {
        ...activeAction,
        combatState: {
          ...activeAction.combatState,
          traitState: { ...createEnemyTraitState(), ...activeAction.combatState.traitState },
        },
      }
    : activeAction;
  return {
    ...input,
    activeAction: normalizedActive,
    unlockedAreas: ['redknife-road-camp', 'greyfang-pastures', 'brambletooth-camp'],
    discoveredMonsters,
    killCounts,
    inventory,
    discoveredItems,
    activityLogs,
    schemaVersion: 16,
  };
};

const migrateRetiredProfessionContent = (input: GameState): GameState => {
  const inventory = input.inventory.filter((stack) => !RETIRED_PROFESSION_ITEM_IDS.has(stack.itemId));
  const discoveredItems = input.discoveredItems.filter(
    (itemId) => !RETIRED_PROFESSION_ITEM_IDS.has(itemId),
  );
  const equipment = { ...input.equipment };
  const retiredToolWasEquipped = equipment.tool
    ? RETIRED_PROFESSION_ITEM_IDS.has(equipment.tool)
    : false;
  for (const [slot, itemId] of Object.entries(equipment)) {
    if (itemId && RETIRED_PROFESSION_ITEM_IDS.has(itemId))
      delete equipment[slot as keyof GameState['equipment']];
  }
  if (retiredToolWasEquipped) {
    equipment.tool = 'worn-pickaxe';
    if (!discoveredItems.includes('worn-pickaxe')) discoveredItems.push('worn-pickaxe');
  }

  const activeAction =
    input.activeAction.type === 'smithing' && legacyRecipeById[input.activeAction.recipeId]
      ? { type: 'none' as const }
      : input.activeAction;

  return {
    ...input,
    inventory,
    discoveredItems,
    equipment,
    activeAction,
    schemaVersion: 17,
  };
};

export const migrations: Record<number, SaveMigration> = {
  1: (input) => ({
    ...input,
    schemaVersion: 1,
    settings: { ...input.settings },
    unlockedAreas: input.unlockedAreas?.length ? input.unlockedAreas : ['forest-path'],
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
          adrenaline: 0,
          enemySpecialCharge: 0,
          effects: { player: [], enemy: [] },
          eliteModifier: null,
          eliteAnnounced: true,
          traitState: {
            enemyAttackCount: 0,
            consecutiveEnemyHits: 0,
            packHunterStacks: 0,
            scrappyStacks: 0,
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
  9: migrateCombatAreas,
  10: migrateActivityLogs,
  11: migrateMomentumToAdrenaline,
  12: migrateHelpIcons,
  13: migrateEnemySpecialFoundation,
  14: migratePeriodicCombatEffects,
  15: migrateLifetimeStatistics,
  16: migrateTauraqueContentReset,
  17: migrateRetiredProfessionContent,
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
  current = migrateMomentumToAdrenaline(current);
  current = normalizeSkillStates(current);
  current = migrateCombatAreas(current);
  current = migrateActivityLogs(current);
  current = migrateEnemySpecialFoundation(current);
  current = migratePeriodicCombatEffects(current);
  current = migrateLifetimeStatistics(current);
  current.settings.showHelpIcons = current.settings.showHelpIcons ?? true;
  const maxHealth = getDerivedStats(current).maxHealth;
  current.player.currentHp = clampHealth(current.player.currentHp, maxHealth);
  current.schemaVersion = GAME_CONFIG.currentSaveVersion;
  return current;
};
