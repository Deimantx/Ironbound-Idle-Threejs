import { describe, expect, it } from 'vitest';
import { areaById } from '../content/areas';
import { enemyById } from '../content/enemies';
import { itemById } from '../content/items';

describe('Stonehill content contract', () => {
  it('uses the specified level progression and two-enemy area split', () => {
    expect(['rocky-foothills', 'abandoned-mine', 'mountain-pass', 'ruined-watchtower'].map((id) => areaById[id].requiredCombatLevel)).toEqual([34, 40, 47, 54]);
    expect(areaById['rocky-foothills'].enemyIds).toHaveLength(2);
    expect(areaById['abandoned-mine'].enemyIds).toHaveLength(2);
    expect(areaById['mountain-pass'].enemyIds).toHaveLength(2);
    expect(areaById['ruined-watchtower'].enemyIds).toHaveLength(2);
  });

  it('uses the authored Stonehill Gold roster and resolves every placeholder drop', () => {
    const goldEnemies = new Set(['forsaken-miner', 'stonehill-marauder', 'watchtower-captain']);
    for (const enemyId of [
      'hill-boar',
      'stonehide-ram',
      'tunnel-crawler',
      'forsaken-miner',
      'cliff-harpy',
      'stonehill-marauder',
      'ironbound-sentinel',
      'watchtower-captain',
    ] as const) {
      const enemy = enemyById[enemyId];
      expect(enemy.loot.length).toBeGreaterThanOrEqual(2);
      expect(enemy.loot.length).toBeLessThanOrEqual(4);
      for (const loot of enemy.loot) expect(itemById[loot.itemId]?.category).toBe('drop');
      expect(Boolean(enemy.gold)).toBe(goldEnemies.has(enemyId));
    }
  });
});
