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
  getCollectionItemSourceNavigation,
  getCollectionProgress,
  getRegionCollectionEnemies,
} from '../app/collection/collectionSelectors';
import { formatRewardSummary } from '../app/combat/combatPresentation';

describe('Collection Log 2.0 selectors', () => {
  it('derives eligibility from implemented acquisition paths and excludes preview content', () => {
    const eligible = getCollectionEligibleItemIds();
    expect(eligible).toHaveLength(57);
    expect(eligible).toContain('stone-ore');
    expect(eligible).toContain('rough-gem');
    expect(eligible).toContain('iron-bar');
    expect(eligible).toContain('worn-pickaxe');
    expect(eligible).toContain('boar-tusk');
    expect(eligible).not.toContain('mithril-ore');
    expect(getCollectionEligibleEnemies()).toHaveLength(14);
  });

  it('uses functional item categories without creating generic item labels', () => {
    expect(getCollectionItemCategory(itemById['bronze-sword'])).toBe('Equipment');
    expect(getCollectionItemCategory(itemById['bronze-pickaxe'])).toBe('Tools');
    expect(getCollectionItemCategory(itemById['iron-ore'])).toBe('Resources');
    expect(getCollectionItemCategory(itemById['boar-tusk'])).toBe('Combat Drops');
  });

  it('normalizes stale discoveries and calculates combined progress', () => {
    expect(getCollectionProgress(['a', 'b', 'c'], ['a', 'a', 'future'])).toEqual({
      discovered: 1,
      total: 3,
      percent: 33,
    });
  });

  it('does not allow undiscovered item or monster names to match search', () => {
    expect(collectionItemMatchesSearch(itemById['boar-tusk'], 'Boar Tusk', false)).toBe(false);
    expect(collectionItemMatchesSearch(itemById['boar-tusk'], 'Boar Tusk', true)).toBe(true);
    expect(collectionEnemyMatchesSearch(enemyById['watchtower-captain'], 'Watchtower Captain', false)).toBe(false);
    expect(collectionEnemyMatchesSearch(enemyById['watchtower-captain'], 'Watchtower Captain', true)).toBe(true);
  });

  it('resolves source navigation from structured acquisition content', () => {
    expect(getCollectionItemSourceNavigation('iron-ore')).toEqual({
      screen: 'mining',
      label: 'Open Mining',
    });
    expect(getCollectionItemSourceNavigation('iron-bar')).toEqual({
      screen: 'smithing',
      label: 'Open Smithing',
    });
    expect(getCollectionItemSourceNavigation('boar-tusk')).toEqual({
      screen: 'combat',
      label: 'Open Combat',
    });
    expect(getCollectionItemSourceNavigation('worn-pickaxe')).toBeNull();
  });

  it('keeps monster organization authored by region and area', () => {
    expect(getRegionCollectionEnemies('stonehill').map((enemy) => enemy.id)).toEqual([
      ...areaById['rocky-foothills'].enemyIds,
      ...areaById['abandoned-mine'].enemyIds,
      ...areaById['mountain-pass'].enemyIds,
      ...areaById['ruined-watchtower'].enemyIds,
    ]);
  });
});

describe('tag-free combat content and Stonehill rewards', () => {
  it('has no generic enemy or combat-effect tag fields', () => {
    for (const enemy of Object.values(enemyById)) expect('tags' in enemy).toBe(false);
    for (const effect of Object.values(combatEffectById)) {
      expect('tags' in effect).toBe(false);
      expect(effect.kind).toBeTruthy();
    }
  });

  it('detects both bleed effects through explicit mechanic kind only', () => {
    const effects: CombatEffectsState = { player: [], enemy: [] };
    for (const effectId of ['rending-bleed', 'raking-wound'] as const) {
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
    expect(formatRewardSummary(12, 2)).toBe('12 Gold · 2 item drops');
  });
});
