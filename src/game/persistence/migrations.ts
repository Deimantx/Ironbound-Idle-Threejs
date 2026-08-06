import { GAME_CONFIG } from '../../config/gameConfig';
import { enemyById } from '../../content/enemies';
import { itemById } from '../../content/items';
import { recipeById } from '../../content/recipes';
import { createCombatRng } from '../formulas/combatFormulas';
import { getDerivedStats } from '../formulas/statFormulas';
import type { GameState, InventoryStack } from '../types';

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
