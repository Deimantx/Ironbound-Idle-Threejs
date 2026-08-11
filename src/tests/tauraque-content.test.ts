import { describe, expect, it } from 'vitest';
import { AREAS } from '../content/areas';
import { assertCombatContent } from '../content/combatValidation';
import { COMBAT_EFFECTS, combatEffectById } from '../content/combatEffects';
import { COMBAT_REGIONS } from '../content/combatRegions';
import { COMBAT_SUB_REGIONS } from '../content/combatSubRegions';
import { ENEMIES, enemyById } from '../content/enemies';
import { itemById } from '../content/items';
import {
  getResolvedEnemyLoot,
  getResolvedLootSections,
  getCombatGoldRange,
  sortLootByChance,
} from '../game/formulas/combatLoot';
import { createNewGame } from '../game/state/initialState';
import { migrateSave } from '../game/persistence/migrations';
import { parseGameState } from '../game/persistence/saveSchema';
import { equipItem, unequipItem } from '../game/systems/equipmentSystem';
import { GAME_CONFIG } from '../config/gameConfig';
import { startCombat } from '../game/engine/actionController';
import { getEnemyCombatStats } from '../game/formulas/combatStats';
import {
  getCollectionEligibleEnemies,
  getCollectionEligibleItemIds,
  getCollectionItemSourceLabel,
} from '../app/screens/collection/collectionSelectors';
import type { ActiveCombatEffect } from '../game/types';
import {
  createEnemyTraitState,
  getEnemyTraitModifiers,
  onEnemyAttackResolved,
  onEnemyDamaged,
} from '../game/systems/enemyTraitSystem';

describe('Tauraque combat content contract', () => {
  it('contains one Region, eight Sub-regions, and twenty-four Area cards', () => {
    expect(COMBAT_REGIONS.map((region) => region.id)).toEqual(['tauraque']);
    expect(COMBAT_SUB_REGIONS).toHaveLength(8);
    expect(AREAS).toHaveLength(24);
    expect(AREAS.filter((area) => area.availability === 'available')).toHaveLength(3);
    expect(ENEMIES).toHaveLength(12);
    expect(COMBAT_SUB_REGIONS.every((subRegion) => subRegion.areaIds.length === 3)).toBe(true);
    expect(AREAS.filter((area) => area.availability === 'locked').every((area) => area.enemyIds.length === 0)).toBe(true);
    expect(AREAS.filter((area) => area.availability === 'available').every((area) => area.enemyIds.length === 4)).toBe(true);
    expect('areaIds' in COMBAT_REGIONS[0]).toBe(false);
    expect(() => assertCombatContent()).not.toThrow();
  });

  it('resolves Region, Area, and Signature loot without cross-area leakage', () => {
    expect(itemById['rat-tail']).toBeUndefined();
    expect(itemById['wolf-pelt']).toBeDefined();
    expect(itemById['goblin-scrap']).toBeDefined();
    const lookoutLoot = getResolvedEnemyLoot('redknife-lookout');
    expect(lookoutLoot.map((loot) => loot.itemId)).toEqual([
      'black-stone', 'magic-crystal-box', 'redknife-token', 'torn-cloth',
      'leather-scraps', 'iron-metal-scraps', 'lookouts-sapphire-ring',
    ]);
    expect(getResolvedEnemyLoot('greyfang-wolf').map((loot) => loot.itemId)).toContain('trace-of-nature');
    expect(getResolvedEnemyLoot('brambletooth-scavenger').map((loot) => loot.itemId)).not.toContain('trace-of-nature');
    expect(getResolvedLootSections('redknife-lookout').map((section) => section.kind)).toEqual([
      'region', 'area', 'signature',
    ]);
    expect(getCombatGoldRange('redknife-lookout')).toEqual([2, 6]);
    expect(getCombatGoldRange('greyfang-wolf')).toBeUndefined();
    for (const enemy of ENEMIES) {
      for (const loot of getResolvedEnemyLoot(enemy.id)) expect(itemById[loot.itemId]).toBeDefined();
    }
  });

  it('sorts every enemy drop preview from most likely to rarest', () => {
    for (const enemy of ENEMIES) {
      const sorted = sortLootByChance(getResolvedEnemyLoot(enemy.id));
      expect(sorted.map((drop) => drop.chance)).toEqual(
        [...sorted].map((drop) => drop.chance).sort((left, right) => right - left),
      );
    }
  });

  it('defines the authored live effects and signature equipment', () => {
    expect(COMBAT_EFFECTS.map((effect) => effect.id)).toEqual([
      'serrated-bleed', 'crippled', 'rending-bleed', 'savage-bleed', 'throat-wound', 'dazed', 'stunned',
    ]);
    expect(combatEffectById.crippled.modifiers?.attackIntervalMultiplier).toBe(1.25);
    expect(combatEffectById.dazed.modifiers?.accuracyMultiplier).toBe(0.8);
    expect(itemById['redknife-reinforced-greatsword'].weaponHands).toBe(2);
    expect(itemById['jagged-goblin-spear'].weaponHands).toBe(2);
    expect(itemById['scavengers-dagger'].weaponHands).toBe(1);
    expect(enemyById['brambletooth-trapper'].specialAttack.effects?.[0]).toMatchObject({
      kind: 'player-attack-delay-fraction',
      fractionOfAttackInterval: 0.75,
    });
  });
});

describe('central enemy Trait system', () => {
  it('applies Watchful opening speed and Pack Hunter hit stacks centrally', () => {
    const watchful = enemyById['redknife-lookout'];
    const watchfulState = createEnemyTraitState();
    expect(getEnemyTraitModifiers(watchful, { currentHp: 14, maxHp: 14, playerHealthPercent: 1, state: watchfulState }).attackIntervalMultiplier).toBe(0.6);
      onEnemyAttackResolved(watchful, watchfulState, true);
      expect(getEnemyTraitModifiers(watchful, { currentHp: 14, maxHp: 14, playerHealthPercent: 1, state: watchfulState }).attackIntervalMultiplier).toBe(0.6);
      onEnemyAttackResolved(watchful, watchfulState, true);
      expect(getEnemyTraitModifiers(watchful, { currentHp: 14, maxHp: 14, playerHealthPercent: 1, state: watchfulState }).attackIntervalMultiplier).toBe(1);
      expect(watchfulState.packHunterStacks).toBe(0);

    const packHunter = enemyById['greyfang-wolf'];
    const packState = createEnemyTraitState();
    onEnemyAttackResolved(packHunter, packState, true);
    onEnemyAttackResolved(packHunter, packState, true);
    expect(packState.packHunterStacks).toBe(2);
    expect(getEnemyTraitModifiers(packHunter, { currentHp: 36, maxHp: 36, playerHealthPercent: 1, state: packState }).damageMultiplier).toBeCloseTo(1.1025);
    onEnemyAttackResolved(packHunter, packState, false);
    expect(packState.packHunterStacks).toBe(0);
  });

  it('builds Scrappy speed above half health and clears at half maximum health', () => {
    const enemy = enemyById['brambletooth-scavenger'];
    const state = createEnemyTraitState();
    onEnemyDamaged(enemy, state, 55, 54, 55);
    expect(state.scrappyStacks).toBe(1);
    expect(getEnemyTraitModifiers(enemy, { currentHp: 54, maxHp: 55, playerHealthPercent: 1, state }).attackIntervalMultiplier).toBe(0.95);
    onEnemyDamaged(enemy, state, 54, 27, 55);
    expect(state.scrappyStacks).toBe(0);
  });

  it('covers every authored Trait modifier and negative-effect branch', () => {
    const negativeEffects: ActiveCombatEffect[] = [{
      instanceId: 'dazed-player', effectId: 'dazed', target: 'player', remainingMs: 1_000, stacks: 1,
    }];
    const context = { currentHp: 100, maxHp: 100, playerHealthPercent: 1, state: createEnemyTraitState() };
    expect(getEnemyTraitModifiers(enemyById['redknife-brigand'], { ...context, playerEffects: negativeEffects }).damageMultiplier).toBe(1.2);
    expect(getEnemyTraitModifiers(enemyById['redknife-bowhand'], context).accuracyMultiplier).toBe(1.2);
    expect(getEnemyTraitModifiers(enemyById['redknife-enforcer'], context)).toMatchObject({ maxHitMultiplier: 1.25, attackIntervalMultiplier: 1.15 });
    expect(getEnemyTraitModifiers(enemyById['greyfang-stalker'], context).defenceMultiplier).toBe(1.25);
    expect(getEnemyTraitModifiers(enemyById['greyfang-ravager'], { ...context, currentHp: 40 }).damageMultiplier).toBe(1.2);
    expect(getEnemyTraitModifiers(enemyById['greyfang-ravager'], { ...context, currentHp: 41 }).damageMultiplier).toBe(1);
    expect(getEnemyTraitModifiers(enemyById['greyfang-alpha'], { ...context, playerHealthPercent: 0.49 }).damageMultiplier).toBe(1.2);
    expect(getEnemyTraitModifiers(enemyById['brambletooth-spearman'], context).defenceMultiplier).toBe(1.25);
    expect(getEnemyTraitModifiers(enemyById['brambletooth-trapper'], { ...context, playerEffects: negativeEffects }).damageMultiplier).toBe(1.2);
    expect(getEnemyTraitModifiers(enemyById['brambletooth-boarhandler'], context).attackIntervalMultiplier).toBe(0.8);
  });
});

describe('Tauraque specials, gold, and Collection sources', () => {
  it('keeps all twelve Special definitions data-driven with authored mechanics', () => {
    const specials = Object.fromEntries(ENEMIES.map((enemy) => [enemy.id, enemy.specialAttack]));
    expect(specials['redknife-lookout']).toMatchObject({ id: 'quick-jab', damageMultiplier: 1, accuracyMultiplier: 1.5 });
    expect(specials['redknife-brigand'].effects?.[0]).toMatchObject({ effectId: 'serrated-bleed', applyOn: 'hit' });
    expect(specials['redknife-bowhand'].effects?.[0]).toMatchObject({ effectId: 'crippled', applyOn: 'hit' });
    expect(specials['redknife-enforcer']).toMatchObject({ id: 'crushing-blow', damageMultiplier: 1.6, accuracyMultiplier: 1.2 });
    expect(specials['greyfang-wolf'].effects?.[0]).toMatchObject({ effectId: 'rending-bleed' });
    expect(specials['greyfang-stalker']).toMatchObject({ id: 'pouncing-strike', accuracyMultiplier: 1.5 });
    expect(specials['greyfang-ravager'].effects?.[0]).toMatchObject({ effectId: 'savage-bleed' });
    expect(specials['greyfang-alpha']).toMatchObject({ playerHealthThreshold: 0.35, conditionalDamageMultiplier: 1.5 });
    expect(specials['greyfang-alpha'].effects?.[0]).toMatchObject({ effectId: 'throat-wound' });
    expect(specials['brambletooth-scavenger'].effects?.[0]).toMatchObject({ effectId: 'dazed' });
    expect(specials['brambletooth-spearman']).toMatchObject({ id: 'jagged-thrust', accuracyMultiplier: 1.5 });
    expect(specials['brambletooth-trapper'].effects?.[0]).toMatchObject({ kind: 'player-attack-delay-fraction', fractionOfAttackInterval: 0.75 });
    expect(specials['brambletooth-boarhandler'].effects?.[0]).toMatchObject({ kind: 'player-attack-progress-pushback', fractionOfAttackInterval: 0.5 });
  });

  it('only awards direct Gold to Redknife and applies the existing Wealthy multiplier there', () => {
    expect(getCombatGoldRange('redknife-lookout')).toEqual([2, 6]);
    expect(getCombatGoldRange('greyfang-wolf')).toBeUndefined();
    expect(getCombatGoldRange('brambletooth-scavenger')).toBeUndefined();
    expect(getEnemyCombatStats(enemyById['redknife-lookout'], 'wealthy').goldMultiplier).toBe(3.125);
    expect(getEnemyCombatStats(enemyById['greyfang-wolf'], 'wealthy').goldMultiplier).toBe(3.125);
  });

  it('deduplicates collection eligibility and uses hierarchy-aware combat sources', () => {
    const enemyIds = getCollectionEligibleEnemies().map((enemy) => enemy.id);
    const itemIds = getCollectionEligibleItemIds();
    expect(enemyIds).toHaveLength(12);
    expect(new Set(itemIds).size).toBe(itemIds.length);
    expect(getCollectionItemSourceLabel('black-stone')).toBe('Tauraque · Combat');
    expect(getCollectionItemSourceLabel('redknife-token')).toBe('Tauraque · Lornwick Vale · Redknife Road Camp · All targets');
    expect(getCollectionItemSourceLabel('redknife-reinforced-greatsword')).toBe('Tauraque · Lornwick Vale · Redknife Road Camp · Redknife Enforcer');
  });
});

describe('Tauraque migration and equipment contracts', () => {
  it('resets removed combat progress while preserving reused item IDs', () => {
    const state = createNewGame(0, 'Legacy Tauraque', 0);
    state.schemaVersion = 15;
    state.unlockedAreas = ['forest-path'];
    state.inventory = [
      { itemId: 'rat-tail', quantity: 2, locked: false },
      { itemId: 'wolf-pelt', quantity: 3, locked: false },
    ];
    state.discoveredItems = ['worn-pickaxe', 'rat-tail', 'wolf-pelt'];
    state.discoveredMonsters = ['forest-rat', 'grey-wolf'];
    state.killCounts = { 'forest-rat': 4, 'grey-wolf': 2 };
    state.activeAction = {
      type: 'combat',
      areaId: 'forest-path',
      enemyId: 'forest-rat',
      style: 'accurate',
      pendingStyle: null,
      autoRepeat: true,
      autoSpecial: true,
      specialQueued: false,
      combatState: {} as never,
    };
    const migrated = migrateSave(state, 15);
    expect(migrated.schemaVersion).toBe(17);
    expect(migrated.activeAction).toEqual({ type: 'none' });
    expect(migrated.unlockedAreas).toEqual(['redknife-road-camp', 'greyfang-pastures', 'brambletooth-camp']);
    expect(migrated.inventory).toEqual([{ itemId: 'wolf-pelt', quantity: 3, locked: false }]);
    expect(migrated.discoveredMonsters).toEqual([]);
    expect(migrated.killCounts).toEqual({});
  });

  it('parses a v15 old-enemy payload before applying the v16 reset', () => {
    const state = createNewGame(0, 'Legacy Payload', 0);
    state.schemaVersion = 15;
    state.activeAction = {
      type: 'combat',
      areaId: 'forest-path',
      enemyId: 'forest-rat',
      style: 'accurate',
      autoRepeat: true,
      autoSpecial: true,
      specialQueued: false,
      combatState: {
        enemyHp: 5,
        playerAttackMs: 100,
        enemyAttackMs: 200,
        respawnMs: 0,
      },
    } as never;
    expect(parseGameState(JSON.stringify(state)).activeAction).toEqual({ type: 'none' });
  });

  it('rejects deleted enemy IDs in a current-version payload', () => {
    const state = createNewGame(0, 'Invalid Current Payload', 0);
    state.activeAction = {
      type: 'combat',
      areaId: 'forest-path',
      enemyId: 'forest-rat',
      style: 'accurate',
      pendingStyle: null,
      autoRepeat: true,
      autoSpecial: true,
      specialQueued: false,
      combatState: {} as never,
    } as never;
    expect(() => parseGameState(JSON.stringify(state))).toThrow();
  });

  it('returns an offhand to inventory when equipping a two-handed weapon', () => {
    const state = createNewGame(0, 'Two-Handed Test', 0);
    state.equipment = { weapon: 'iron-sword', offhand: 'iron-shield', tool: 'worn-pickaxe' };
    state.inventory = [{ itemId: 'redknife-reinforced-greatsword', quantity: 1, locked: false }];
    const result = equipItem(state, 'redknife-reinforced-greatsword');
    expect(result.ok).toBe(true);
    expect(result.state.equipment.weapon).toBe('redknife-reinforced-greatsword');
    expect(result.state.equipment.offhand).toBeUndefined();
    expect(result.state.inventory).toContainEqual({ itemId: 'iron-sword', quantity: 1, locked: false });
    expect(result.state.inventory).toContainEqual({ itemId: 'iron-shield', quantity: 1, locked: false });
  });

  it('supports empty-offhand 2H equip, atomic displacement failure, and normal unequip', () => {
    const emptyOffhand = createNewGame(0, 'Empty Offhand Test', 0);
    emptyOffhand.equipment = { weapon: 'iron-sword', tool: 'worn-pickaxe' };
    emptyOffhand.inventory = [{ itemId: 'redknife-reinforced-greatsword', quantity: 1, locked: false }];
    const equipped = equipItem(emptyOffhand, 'redknife-reinforced-greatsword');
    expect(equipped.ok).toBe(true);
    const unequipped = unequipItem(equipped.state, 'weapon');
    expect(unequipped.ok).toBe(true);
    expect(unequipped.state.equipment.weapon).toBeUndefined();
    expect(unequipped.state.inventory).toContainEqual({ itemId: 'redknife-reinforced-greatsword', quantity: 1, locked: false });

    const oneHanded = createNewGame(0, 'One Handed Test', 0);
    oneHanded.equipment = { weapon: 'iron-sword', offhand: 'iron-shield', tool: 'worn-pickaxe' };
    oneHanded.inventory = [{ itemId: 'scavengers-dagger', quantity: 1, locked: false }];
    const dagger = equipItem(oneHanded, 'scavengers-dagger');
    expect(dagger.ok).toBe(true);
    expect(dagger.state.equipment.weapon).toBe('scavengers-dagger');
    expect(dagger.state.equipment.offhand).toBe('iron-shield');

    const full = createNewGame(0, 'Full Inventory Test', 0);
    full.equipment = { weapon: 'iron-sword', offhand: 'iron-shield', tool: 'worn-pickaxe' };
    full.inventory = [
      { itemId: 'redknife-reinforced-greatsword', quantity: 1, locked: false },
      ...Array.from({ length: GAME_CONFIG.inventorySlots - 1 }, (_, index) => ({ itemId: `junk-${index}`, quantity: 1, locked: false })),
    ];
    const failed = equipItem(full, 'redknife-reinforced-greatsword');
    expect(failed.ok).toBe(false);
    expect(failed.message).toMatch(/inventory slot/i);
    expect(failed.state.equipment).toEqual(full.equipment);
    expect(failed.state.inventory).toEqual(full.inventory);
  });

  it('rejects an offhand while a two-handed weapon is equipped', () => {
    const state = createNewGame(0, 'Offhand Test', 0);
    state.equipment.weapon = 'redknife-reinforced-greatsword';
    state.inventory = [{ itemId: 'iron-shield', quantity: 1, locked: false }];
    const result = equipItem(state, 'iron-shield');
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/two-handed/i);
    expect(result.state).toBe(state);
    expect(GAME_CONFIG.inventorySlots).toBeGreaterThan(0);
  });

  it('allows the starting Area and rejects locked or under-level targets', () => {
    const state = createNewGame(0, 'Combat Gate Test', 0);
    expect(startCombat(state, 'redknife-road-camp', 'redknife-lookout', 'accurate', false, 0).activeAction.type).toBe('combat');
      expect(startCombat(state, 'mossfang-encampment', 'redknife-lookout', 'accurate', false, 0).activeAction).toEqual({ type: 'none' });
      expect(startCombat(state, 'greyfang-pastures', 'greyfang-wolf', 'accurate', false, 0).activeAction).toEqual({ type: 'none' });
      expect(startCombat(state, 'greyfang-pastures', 'redknife-lookout', 'accurate', false, 0, true, true).activeAction).toEqual({ type: 'none' });
  });
});
