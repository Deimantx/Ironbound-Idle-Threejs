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
  debugUnequipSlot,
} from '../game/debug/debugActions';
import { DEBUG_PRESETS } from '../game/debug/debugPresets';
import { createNewGame } from '../game/state/initialState';
import { getItemQuantity } from '../game/systems/inventorySystem';
import { savePayloadSchema } from '../game/persistence/saveSchema';
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
    expect(full.state?.inventory).toHaveLength(GAME_CONFIG.inventorySlots);
    expect(full.state?.inventory.every((stack) => itemById[stack.itemId])).toBe(true);
  });

  it('supports intentional over-capacity edge fixtures without negative quantities', () => {
    const state = debugForceSetQuantity(fresh(), 'iron-ore', 999).state!;
    expect(getItemQuantity(state.inventory, 'iron-ore')).toBe(999);
    const zero = debugForceSetQuantity(state, 'iron-ore', 0).state!;
    expect(getItemQuantity(zero.inventory, 'iron-ore')).toBe(0);
  });

  it('grants and equips through the authoritative equipment system', () => {
    const result = debugGrantAndEquip(fresh(), 'iron-sword');
    expect(result.result.ok).toBe(true);
    expect(result.state?.equipment.weapon).toBe('iron-sword');
    expect(getItemQuantity(result.state?.inventory ?? [], 'iron-sword')).toBe(0);
    const filled = debugFillInventory(result.state!).state!;
    const rejected = debugUnequipSlot(filled, 'weapon');
    expect(rejected.result.ok).toBe(false);
    expect(rejected.state).toBeUndefined();
  });

  it('sets exact XP through thresholds and clamps gold and HP safely', () => {
    let state = fresh();
    state = debugSetSkillXp(state, 'mining', 12_345).state!;
    expect(state.skills.mining.level).toBeGreaterThan(1);
    state = debugAddSkillLevels(state, 'mining', 10).state!;
    expect(state.skills.mining.xp).toBeGreaterThanOrEqual(state.skills.mining.level > 1 ? 0 : 1);
    state = debugAddGold(state, 1000).state!;
    expect(state.gold).toBe(1000);
    const invalidHp = debugSetHpAboveMaximum(state).state!;
    expect(invalidHp.player.currentHp).toBeGreaterThan(getDerivedStats(invalidHp).maxHealth);
  });

  it('advances one real Mining and Smithing cycle deterministically', () => {
    let mining = fresh();
    mining.skills.mining.level = 100;
    mining = debugStartMining(mining, 'copper-vein').state!;
    mining = debugAdvanceOneCycle(mining).state!;
    expect(getItemQuantity(mining.inventory, 'copper-ore')).toBe(1);

    let smithing = fresh();
    smithing.skills.smithing.level = 100;
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
      expect(savePayloadSchema.safeParse(result.state).success).toBe(true);
    }
  });

  it('does not stop active actions when changing unrelated debug state', () => {
    let state = fresh();
    state.skills.mining.level = 100;
    state = debugStartMining(state, 'copper-vein').state!;
    state = debugAddGold(state, 50).state!;
    expect(state.activeAction.type).toBe('mining');
    expect(state.gold).toBe(50);
  });

  it('resolves one current enemy through the normal combat reward pipeline', () => {
    let state = fresh();
    state.skills.attack.level = 100;
    state.skills.strength.level = 100;
    state.skills.defence.level = 100;
    state.skills.hitpoints.level = 100;
    state = debugStartCombat(state, 'training-grounds', 'forest-rat').state!;
    const result = debugKillCurrentEnemy(state);
    expect(result.result.ok).toBe(true);
    expect(result.summary?.enemiesDefeated).toBe(1);
    expect(result.state?.killCounts['forest-rat']).toBe(1);
  });

  it('clears equipment only through normal unequip actions', () => {
    let state = debugGrantAndEquip(fresh(), 'bronze-sword').state!;
    state = debugGrantAndEquip(state, 'bronze-helmet').state!;
    const result = debugClearEquipment(state);
    expect(result.result.ok).toBe(true);
    expect(result.state?.equipment).toEqual({});
    expect(getItemQuantity(result.state?.inventory ?? [], 'bronze-sword')).toBe(1);
  });
});
