import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../config/gameConfig';
import { itemById } from '../content/items';
import { getDerivedStats } from '../game/formulas/statFormulas';
import {
  debugAddGold,
  debugAddItem,
  debugAddSkillLevels,
  debugAdvanceOneCycle,
  debugApplyPreset,
  debugClearEquipment,
  debugFillInventory,
  debugForceSetQuantity,
  debugGrantAndEquip,
  debugKillCurrentEnemy,
  debugSetHpAboveMaximum,
  debugSetSkillXp,
  debugStartCombat,
  debugStartMining,
  debugStartSmithing,
  debugSimulateFullInventoryUnequip,
  debugForceLargeStackQuantity,
  debugSetSkillLevel,
  debugUnequipSlot,
} from '../game/debug/debugActions';
import { DEBUG_PRESETS } from '../game/debug/debugPresets';
import { createNewGame } from '../game/state/initialState';
import {
  getItemQuantity,
  hasDuplicateInventoryItemIds,
  occupiedSlots,
} from '../game/systems/inventorySystem';
import { savePayloadSchema } from '../game/persistence/saveSchema';
import { getXpForLevel } from '../game/formulas/experienceFormulas';
import type { GameState } from '../game/types';

const fresh = (): GameState => createNewGame(0, 'Debug Tester', 1000);

describe('Debug Tools action boundary', () => {
  it('uses normal inventory insertion, stack merging, removal, and capacity semantics', () => {
    let state = fresh();
    const first = debugAddItem(state, 'iron-sword', 1);
    expect(first.result.ok).toBe(true);
    state = first.state!;
    const second = debugAddItem(state, 'iron-sword', 2);
    state = second.state!;
    expect(getItemQuantity(state.inventory, 'iron-sword')).toBe(3);
    const full = debugFillInventory(state);
    expect(full.state?.inventory.length).toBeLessThanOrEqual(GAME_CONFIG.inventorySlots);
    expect(hasDuplicateInventoryItemIds(full.state?.inventory ?? [])).toBe(false);
    expect(full.state?.inventory.every((stack) => itemById[stack.itemId])).toBe(true);
  });

  it('supports intentional over-capacity edge fixtures without negative quantities', () => {
    const state = debugForceSetQuantity(fresh(), 'iron-ore', 999).state!;
    expect(getItemQuantity(state.inventory, 'iron-ore')).toBe(999);
    const zero = debugForceSetQuantity(state, 'iron-ore', 0).state!;
    expect(getItemQuantity(zero.inventory, 'iron-ore')).toBe(0);
  });

  it('grants and equips through the authoritative equipment system', () => {
    const equipped = debugGrantAndEquip(fresh(), 'iron-sword');
    expect(equipped.result.ok).toBe(true);
    expect(equipped.state?.equipment.weapon).toBe('iron-sword');
    expect(getItemQuantity(equipped.state?.inventory ?? [], 'iron-sword')).toBe(0);
    const inventoryBeforeSimulation = structuredClone(equipped.state!.inventory);
    const equipmentBeforeSimulation = structuredClone(equipped.state!.equipment);
    const simulated = debugSimulateFullInventoryUnequip(equipped.state!, 'weapon');
    expect(simulated.result).toEqual({
      ok: true,
      message: 'Unequip correctly rejected because no effective slot was available.',
      details: [
        'No equipment was lost.',
        'This was a read-only capacity simulation; Inventory and equipment were unchanged.',
      ],
    });
    expect(simulated.save).toBe(false);
    expect(simulated.state).toBeUndefined();
    expect(equipped.state?.inventory).toEqual(inventoryBeforeSimulation);
    expect(equipped.state?.equipment).toEqual(equipmentBeforeSimulation);
    const normal = debugUnequipSlot(equipped.state!, 'weapon');
    expect(normal.result.ok).toBe(true);
  });

  it('forces large quantities without changing occupied-slot capacity', () => {
    const added = debugAddItem(fresh(), 'iron-ore', 1).state!;
    const state = debugForceLargeStackQuantity(added, 'iron-ore').state!;
    expect(getItemQuantity(state.inventory, 'iron-ore')).toBe(999_999);
    expect(occupiedSlots(state.inventory)).toBe(1);
    expect(hasDuplicateInventoryItemIds(state.inventory)).toBe(false);
  });

  it('sets exact XP through thresholds and clamps gold and HP safely', () => {
    let state = fresh();
    state = debugSetSkillLevel(state, 'mining', 30).state!;
    expect(state.skills.mining).toEqual({ level: 30, xp: 17_372 });
    state = debugSetSkillLevel(state, 'attack', 50).state!;
    expect(state.skills.attack.xp).toBe(131_733);
    state = debugSetSkillXp(state, 'hitpoints', 1_500).state!;
    expect(state.skills.hitpoints).toEqual({ level: 10, xp: 1_500 });
    state = debugSetSkillLevel(state, 'smithing', 100).state!;
    expect(state.skills.smithing.xp).toBe(getXpForLevel(100));
    state = debugAddSkillLevels(state, 'mining', 10).state!;
    expect(state.skills.mining).toEqual({ level: 40, xp: getXpForLevel(40) });
    state = debugAddGold(state, 1000).state!;
    expect(state.gold).toBe(1000);
    const invalidHp = debugSetHpAboveMaximum(state).state!;
    expect(invalidHp.player.currentHp).toBeGreaterThan(getDerivedStats(invalidHp).maxHealth);
  });

  it('advances one real Mining and Smithing cycle deterministically', () => {
    let mining = fresh();
    mining.skills.mining = { level: 100, xp: getXpForLevel(100) };
    mining = debugStartMining(mining, 'stone-outcrop').state!;
    mining = debugAdvanceOneCycle(mining).state!;
    expect(getItemQuantity(mining.inventory, 'stone-ore')).toBe(1);

    let smithing = fresh();
    smithing.skills.smithing = { level: 100, xp: getXpForLevel(100) };
    smithing.inventory = [{ itemId: 'iron-bar', quantity: 10, locked: false }];
    smithing = debugStartSmithing(smithing, 'iron-sword', 1).state!;
    smithing = debugAdvanceOneCycle(smithing).state!;
    expect(getItemQuantity(smithing.inventory, 'iron-bar')).toBe(6);
    expect(getItemQuantity(smithing.inventory, 'iron-sword')).toBe(1);
  });

  it('keeps all eight presets current-schema-valid and preserves identity', () => {
    const original = fresh();
    for (const preset of DEBUG_PRESETS) {
      const result = debugApplyPreset(original, preset.id);
      expect(result.result.ok).toBe(true);
      expect(result.state?.profileId).toBe(original.profileId);
      expect(result.state?.player.name).toBe(original.player.name);
      expect(result.state?.player.currentHp).toBeLessThanOrEqual(
        getDerivedStats(result.state!).maxHealth,
      );
      expect(hasDuplicateInventoryItemIds(result.state?.inventory ?? [])).toBe(false);
      expect(result.state?.inventory.every((stack) => itemById[stack.itemId])).toBe(true);
      expect(savePayloadSchema.safeParse(result.state).success).toBe(true);
    }
  });

  it('does not stop active actions when changing unrelated debug state', () => {
    let state = fresh();
    state.skills.mining = { level: 100, xp: getXpForLevel(100) };
    state = debugStartMining(state, 'stone-outcrop').state!;
    state = debugAddGold(state, 50).state!;
    expect(state.activeAction.type).toBe('mining');
    expect(state.gold).toBe(50);
  });

  it('resolves one current enemy through the normal combat reward pipeline', () => {
    let state = fresh();
    for (const skill of ['attack', 'strength', 'defence', 'hitpoints'] as const)
      state.skills[skill] = { level: 100, xp: getXpForLevel(100) };
    state = debugStartCombat(state, 'redknife-road-camp', 'redknife-lookout').state!;
    const result = debugKillCurrentEnemy(state);
    expect(result.result.ok).toBe(true);
    expect(result.summary?.enemiesDefeated).toBe(1);
    expect(result.state?.killCounts['redknife-lookout']).toBe(1);
  });

  it('clears equipment only through normal unequip actions', () => {
    let state = debugGrantAndEquip(fresh(), 'iron-sword').state!;
    state = debugGrantAndEquip(state, 'iron-helmet').state!;
    const result = debugClearEquipment(state);
    expect(result.result.ok).toBe(true);
    expect(result.state?.equipment).toEqual({});
    expect(getItemQuantity(result.state?.inventory ?? [], 'iron-sword')).toBe(1);
  });
});
