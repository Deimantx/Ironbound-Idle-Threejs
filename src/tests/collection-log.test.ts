import { describe, expect, it } from 'vitest';
import { itemById } from '../content/items';
import { enemyById } from '../content/enemies';
import { areaById } from '../content/areas';
import { combatEffectById } from '../content/combatEffects';
import { hasCombatEffectKind } from '../game/formulas/combatEffects';
import type { CombatEffectsState } from '../game/types';
import {
  collectionEnemyMatchesSearch,
  collectionItemMatchesSearch,
  getCollectionEligibleEnemies,
  getCollectionEligibleItemIds,
  getCollectionItemCategory,
  getCollectionItemSourceLabel,
  getCollectionItemSourceNavigation,
  getCollectionProgress,
  getRegionCollectionEnemies,
} from '../app/screens/collection/collectionSelectors';
import { formatRewardSummary } from '../app/combat/combatPresentation';

describe('Tauraque Collection Log selectors', () => {
  it('derives eligibility from implemented current acquisition paths', () => {
    const eligible = getCollectionEligibleItemIds();
    expect(eligible).toHaveLength(47);
    expect(eligible).toContain('stone-ore');
    expect(eligible).toContain('rough-gem');
    expect(eligible).toContain('iron-bar');
    expect(eligible).toContain('worn-pickaxe');
    expect(eligible).toContain('redknife-token');
    expect(eligible).not.toContain('mithril-ore');
    expect(getCollectionEligibleEnemies()).toHaveLength(12);
  });

  it('uses functional item categories and hides undiscovered names', () => {
    expect(getCollectionItemCategory(itemById['bronze-sword'])).toBe('Equipment');
    expect(getCollectionItemCategory(itemById['bronze-pickaxe'])).toBe('Tools');
    expect(getCollectionItemCategory(itemById['iron-ore'])).toBe('Resources');
    expect(getCollectionItemCategory(itemById['goblin-scrap'])).toBe('Combat Drops');
    expect(collectionItemMatchesSearch(itemById['goblin-scrap'], 'Goblin Scrap', false)).toBe(false);
    expect(collectionItemMatchesSearch(itemById['goblin-scrap'], 'Goblin Scrap', true)).toBe(true);
    expect(collectionEnemyMatchesSearch(enemyById['redknife-lookout'], 'Redknife Lookout', false)).toBe(false);
    expect(collectionEnemyMatchesSearch(enemyById['redknife-lookout'], 'Redknife Lookout', true)).toBe(true);
  });

  it('normalizes stale discoveries and calculates combined progress', () => {
    expect(getCollectionProgress(['a', 'b', 'c'], ['a', 'a', 'future'])).toEqual({
      discovered: 1,
      total: 3,
      percent: 33,
    });
  });

  it('resolves current source navigation and labels', () => {
    expect(getCollectionItemSourceNavigation('iron-ore')).toEqual({
      screen: 'mining',
      label: 'Open Mining',
    });
    expect(getCollectionItemSourceNavigation('iron-bar')).toEqual({
      screen: 'smithing',
      label: 'Open Smithing',
    });
    expect(getCollectionItemSourceNavigation('goblin-scrap')).toEqual({
      screen: 'combat',
      label: 'Open Combat',
    });
    expect(getCollectionItemSourceNavigation('worn-pickaxe')).toBeNull();

    for (const itemId of ['redknife-token', 'torn-cloth', 'goblin-scrap', 'wolf-pelt']) {
      expect(getCollectionItemSourceLabel(itemId)).toMatch(/Tauraque/);
      expect(getCollectionItemSourceLabel(itemId)).toMatch(/Lornwick Vale/);
      expect(getCollectionItemSourceLabel(itemId)).not.toMatch(/Greenvale|Stonehill|Ashmoor/);
    }
    expect(getCollectionItemSourceLabel('iron-ore')).toBe(itemById['iron-ore'].source);
    expect(getCollectionItemSourceLabel('iron-bar')).toBe(itemById['iron-bar'].source);
    expect(collectionItemMatchesSearch(itemById['redknife-token'], 'Redknife Road Camp', true)).toBe(true);
    expect(collectionItemMatchesSearch(itemById['redknife-token'], 'Training Grounds', true)).toBe(false);
  });

  it('keeps monster organization authored by current Region and Areas', () => {
    expect(getRegionCollectionEnemies('tauraque').map((enemy) => enemy.id)).toEqual([
      ...areaById['redknife-road-camp'].enemyIds,
      ...areaById['greyfang-pastures'].enemyIds,
      ...areaById['brambletooth-camp'].enemyIds,
    ]);
  });
});

describe('current combat content metadata', () => {
  it('has no generic enemy or combat-effect tag fields', () => {
    for (const enemy of Object.values(enemyById)) expect('tags' in enemy).toBe(false);
    for (const effect of Object.values(combatEffectById)) {
      expect('tags' in effect).toBe(false);
      expect(effect.kind).toBeTruthy();
    }
  });

  it('detects bleed effects through explicit mechanic kind only', () => {
    const effects: CombatEffectsState = { player: [], enemy: [] };
    for (const effectId of ['rending-bleed', 'savage-bleed'] as const) {
      effects.player.push({
        instanceId: effectId,
        effectId,
        target: 'player',
        remainingMs: 1_000,
        stacks: 1,
      });
    }
    expect(hasCombatEffectKind(effects, 'bleed')).toBe(true);
    expect(hasCombatEffectKind({ player: [{ ...effects.player[0], effectId: 'stunned' }], enemy: [] }, 'bleed')).toBe(false);
  });

  it('formats reward summaries without zero-gold or orphan separators', () => {
    expect(formatRewardSummary(0, 1)).toBe('1 item drop');
    expect(formatRewardSummary(0, 0)).toBe('');
    expect(formatRewardSummary(12, 2)).toContain('12 Gold');
    expect(formatRewardSummary(12, 2)).toContain('2 item drops');
  });
});
