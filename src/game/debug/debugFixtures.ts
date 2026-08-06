import { GAME_CONFIG } from '../../config/gameConfig';
import { createNewGame } from '../state/initialState';
import { LEGACY_ARMOR_ITEM_MAP, migrateSave } from '../persistence/migrations';
import { savePayloadSchema } from '../persistence/saveSchema';
import type { GameState } from '../types';

export type LegacyFixture = GameState & { equipment: Record<string, string> };

export const createLegacyArmorFixture = (): LegacyFixture => {
  const state = createNewGame(0, 'Legacy Armor Tester') as LegacyFixture;
  state.schemaVersion = 2;
  state.inventory = [
    { itemId: 'bronze-platebody', quantity: 1, locked: false },
    { itemId: 'iron-platelegs', quantity: 2, locked: true },
    { itemId: 'iron-bar', quantity: 20, locked: false },
  ];
  state.discoveredItems = ['bronze-platebody', 'iron-platelegs', 'iron-bar'];
  state.activeAction = {
    type: 'smithing',
    recipeId: 'iron-platebody',
    quantityMode: 10,
    remaining: 3,
    progressMs: 200,
  };
  state.equipment = { body: 'bronze-platebody', legs: 'iron-platelegs' };
  state.player.currentHp = 9999;
  return state;
};

export const createLegacyShieldFixture = (): LegacyFixture => {
  const state = createNewGame(0, 'Legacy Shield Tester') as LegacyFixture;
  state.schemaVersion = 3;
  state.inventory = [
    { itemId: 'bronze-shield', quantity: 1, locked: false },
    { itemId: 'steel-shield', quantity: 1, locked: false },
  ];
  state.discoveredItems = ['bronze-shield', 'steel-shield'];
  state.equipment = { shield: 'bronze-shield' };
  state.activeAction = {
    type: 'mining',
    nodeId: 'iron-vein',
    startedAt: state.updatedAt,
    progressMs: 300,
  };
  return state;
};

export const previewMigration = (fixture: LegacyFixture): string[] => {
  const migrated = migrateSave(fixture, fixture.schemaVersion);
  const changes: string[] = [
    `Save version ${fixture.schemaVersion} → ${GAME_CONFIG.currentSaveVersion}`,
  ];
  if (fixture.equipment.body || fixture.equipment.legs) changes.push('body/legs → armor');
  if (fixture.equipment.shield) changes.push('shield → offhand');
  const migratedInventoryIds = fixture.inventory.map(
    (stack) => LEGACY_ARMOR_ITEM_MAP[stack.itemId] ?? stack.itemId,
  );
  if (
    new Set(migratedInventoryIds).size < migratedInventoryIds.length ||
    fixture.inventory.some((stack) => LEGACY_ARMOR_ITEM_MAP[stack.itemId]) ||
    Object.values(fixture.equipment).some((itemId) => LEGACY_ARMOR_ITEM_MAP[itemId])
  )
    changes.push('inventory stacks merged');
  if (JSON.stringify(fixture.activeAction) !== JSON.stringify(migrated.activeAction))
    changes.push('active action normalized');
  return changes;
};

export const validateFixture = (fixture: LegacyFixture): { ok: boolean; message: string } => {
  try {
    const migrated = migrateSave(fixture, fixture.schemaVersion);
    const result = savePayloadSchema.safeParse(migrated);
    return result.success
      ? { ok: true, message: 'Fixture migrates to a current-schema-valid save.' }
      : { ok: false, message: 'Migrated fixture failed current save validation.' };
  } catch (cause) {
    return {
      ok: false,
      message: cause instanceof Error ? cause.message : 'Fixture validation failed.',
    };
  }
};

export const createCurrentSaveFixture = (state: GameState): GameState => structuredClone(state);
