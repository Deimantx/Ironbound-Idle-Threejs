import { AREAS, areaById } from '../../../content/areas';
import { COMBAT_REGIONS } from '../../../content/combatRegions';
import { combatSubRegionById } from '../../../content/combatSubRegions';
import { ENEMIES } from '../../../content/enemies';
import { ITEMS, itemById } from '../../../content/items';
import { MINING_NODES } from '../../../content/miningNodes';
import { MINING_TOOLS } from '../../../content/miningTools';
import { RECIPES } from '../../../content/recipes';
import { SMITHING_TOOLS } from '../../../content/smithingTools';
import { getResolvedEnemyLoot } from '../../../game/formulas/combatLoot';
import type { AreaId, CombatRegionId, EnemyDefinition, GameState, ItemDefinition, ScreenId } from '../../../game/types';

export type CollectionItemCategory = 'Equipment' | 'Tools' | 'Resources' | 'Combat Drops';
export interface CollectionItemSourceNavigation {
  screen: Extract<ScreenId, 'combat' | 'mining' | 'smithing'>;
  label: 'Open Combat' | 'Open Mining' | 'Open Smithing';
}

const playableAreas = AREAS.filter((area) => area.availability === 'available');
const collectionEnemyIds = new Set(playableAreas.flatMap((area) => area.enemyIds));
const collectionItemIds = new Set<string>(['worn-pickaxe']);
for (const enemyId of collectionEnemyIds) for (const loot of getResolvedEnemyLoot(enemyId)) collectionItemIds.add(loot.itemId);
for (const node of MINING_NODES) {
  collectionItemIds.add(node.primaryRewardItemId);
  for (const drop of node.bonusDrops) collectionItemIds.add(drop.itemId);
}
for (const recipe of RECIPES) if (!recipe.legacy) collectionItemIds.add(recipe.outputItemId);
for (const tool of [...MINING_TOOLS, ...SMITHING_TOOLS]) collectionItemIds.add(tool.itemId);

const collectionCombatSourceByItemId = new Map<string, string>();
const sourceNavigationByItemId = new Map<string, CollectionItemSourceNavigation>();
for (const enemyId of collectionEnemyIds) {
  const enemy = ENEMIES.find((candidate) => candidate.id === enemyId);
  const area = enemy ? areaById[enemy.areaId] : undefined;
  const subRegion = area ? combatSubRegionById[area.subRegionId] : undefined;
  const region = subRegion ? COMBAT_REGIONS.find((candidate) => candidate.id === subRegion.regionId) : undefined;
  if (!enemy || !area || !subRegion || !region) continue;
  const sections = getResolvedEnemyLoot(enemy.id);
  for (const loot of sections) {
    if (!collectionCombatSourceByItemId.has(loot.itemId)) {
      const isSignature = loot.itemId === enemy.signatureLoot.itemId;
      collectionCombatSourceByItemId.set(
        loot.itemId,
        isSignature
          ? `${region.name} · ${subRegion.name} · ${area.name} · ${enemy.name}`
          : loot.itemId === 'black-stone' || loot.itemId === 'magic-crystal-box'
            ? `${region.name} · Combat`
            : `${region.name} · ${subRegion.name} · ${area.name} · All targets`,
      );
    }
    sourceNavigationByItemId.set(loot.itemId, { screen: 'combat', label: 'Open Combat' });
  }
}
for (const node of MINING_NODES) {
  sourceNavigationByItemId.set(node.primaryRewardItemId, { screen: 'mining', label: 'Open Mining' });
  for (const drop of node.bonusDrops) sourceNavigationByItemId.set(drop.itemId, { screen: 'mining', label: 'Open Mining' });
}
for (const recipe of RECIPES) if (!recipe.legacy) sourceNavigationByItemId.set(recipe.outputItemId, { screen: 'smithing', label: 'Open Smithing' });

const collectionEligibleItems = [...new Map(ITEMS.filter((item) => collectionItemIds.has(item.id)).map((item) => [item.id, item])).values()];
export const getCollectionEligibleItemIds = (): string[] => collectionEligibleItems.map((item) => item.id);
export const getCollectionEligibleItems = (): ItemDefinition[] => collectionEligibleItems;
export const getCollectionItemSourceNavigation = (itemId: string): CollectionItemSourceNavigation | null => sourceNavigationByItemId.get(itemId) ?? null;
export const getCollectionItemSourceLabel = (itemId: string): string => collectionCombatSourceByItemId.get(itemId) ?? itemById[itemId]?.source ?? '';
export const getCollectionItemCategory = (item: ItemDefinition): CollectionItemCategory => {
  if (item.category === 'weapon' || item.category === 'armor' || item.category === 'shield') return 'Equipment';
  if (item.category === 'tool') return 'Tools';
  if (item.category === 'drop') return 'Combat Drops';
  return 'Resources';
};
export const getCollectionProgress = (eligibleIds: readonly string[], discoveredIds: readonly string[]) => {
  const eligible = new Set(eligibleIds);
  const discovered = new Set(discoveredIds);
  const discoveredCount = [...eligible].filter((id) => discovered.has(id)).length;
  return { discovered: discoveredCount, total: eligible.size, percent: eligible.size ? Math.floor((discoveredCount / eligible.size) * 100) : 0 };
};
export const getItemCollectionProgress = (game: Pick<GameState, 'discoveredItems'>) => getCollectionProgress(getCollectionEligibleItemIds(), game.discoveredItems);
export const getCollectionEligibleEnemies = (): EnemyDefinition[] => ENEMIES.filter((enemy) => collectionEnemyIds.has(enemy.id));
export const getRegionCollectionEnemies = (regionId: CombatRegionId): EnemyDefinition[] => playableAreas.filter((area) => area.regionId === regionId).flatMap((area) => area.enemyIds.map((id) => ENEMIES.find((enemy) => enemy.id === id)).filter((enemy): enemy is EnemyDefinition => Boolean(enemy)));
export const getAreaCollectionEnemies = (areaId: AreaId): EnemyDefinition[] => (areaById[areaId]?.enemyIds ?? []).map((id) => ENEMIES.find((enemy) => enemy.id === id)).filter((enemy): enemy is EnemyDefinition => Boolean(enemy));
export const getMonsterCollectionProgress = (game: Pick<GameState, 'discoveredMonsters'>) => getCollectionProgress(getCollectionEligibleEnemies().map((enemy) => enemy.id), game.discoveredMonsters);
export const getOverallCollectionProgress = (game: Pick<GameState, 'discoveredItems' | 'discoveredMonsters'>) => getCollectionProgress([...getCollectionEligibleItemIds(), ...getCollectionEligibleEnemies().map((enemy) => enemy.id)], [...game.discoveredItems, ...game.discoveredMonsters]);
export const collectionItemMatchesSearch = (item: ItemDefinition, query: string, discovered: boolean): boolean => !query.trim() || (discovered && [item.name, getCollectionItemCategory(item), getCollectionItemSourceLabel(item.id)].join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
export const collectionEnemyMatchesSearch = (enemy: EnemyDefinition, query: string, discovered: boolean): boolean => !query.trim() || (discovered && enemy.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
export const getAreaForEnemy = (enemy: EnemyDefinition) => areaById[enemy.areaId];
