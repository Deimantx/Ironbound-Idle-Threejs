import { areaById } from '../../content/areas';
import { combatRegionById } from '../../content/combatRegions';
import { combatSubRegionById } from '../../content/combatSubRegions';
import { enemyById } from '../../content/enemies';
import type { AreaDefinition, EnemyId, LootEntry } from '../types';

export interface ResolvedLootSection {
  kind: 'region' | 'area' | 'signature';
  label: string;
  entries: LootEntry[];
}

export const getAreaForEnemy = (enemyId: EnemyId): AreaDefinition | undefined => {
  const enemy = enemyById[enemyId];
  return enemy ? areaById[enemy.areaId] : undefined;
};

export const getResolvedLootSections = (enemyId: EnemyId): ResolvedLootSection[] => {
  const enemy = enemyById[enemyId];
  const area = enemy ? areaById[enemy.areaId] : undefined;
  const subRegion = area ? combatSubRegionById[area.subRegionId] : undefined;
  const region = subRegion ? combatRegionById[subRegion.regionId] : undefined;
  if (!enemy || !area || !subRegion || !region) return [];
  return [
    { kind: 'region', label: `${region.name} · Combat`, entries: region.sharedLoot },
    {
      kind: 'area',
      label: `${region.name} · ${subRegion.name} · ${area.name} · All targets`,
      entries: area.sharedLoot,
    },
    {
      kind: 'signature',
      label: `${region.name} · ${subRegion.name} · ${area.name} · ${enemy.name}`,
      entries: [enemy.signatureLoot],
    },
  ];
};

export const getResolvedEnemyLoot = (enemyId: EnemyId): LootEntry[] =>
  getResolvedLootSections(enemyId).flatMap((section) => section.entries.map((entry) => ({ ...entry })));

export const getCombatGoldRange = (enemyId: EnemyId): [number, number] | undefined => {
  const area = getAreaForEnemy(enemyId);
  return area?.gold;
};

