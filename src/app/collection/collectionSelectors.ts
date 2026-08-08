import { AREAS, areaById } from '../../content/areas';
import { COMBAT_REGIONS } from '../../content/combatRegions';
import { ENEMIES } from '../../content/enemies';
import { ITEMS } from '../../content/items';
import { MINING_NODES } from '../../content/miningNodes';
import { MINING_TOOLS } from '../../content/miningTools';
import { RECIPES } from '../../content/recipes';
import { SMITHING_TOOLS } from '../../content/smithingTools';
import type { AreaId, CombatRegionId, EnemyDefinition, GameState, ItemDefinition, ScreenId } from '../../game/types';

export type CollectionItemCategory = 'Equipment' | 'Tools' | 'Resources' | 'Combat Drops';

export interface CollectionItemSourceNavigation {
  screen: Extract<ScreenId, 'combat' | 'mining' | 'smithing'>;
  label: 'Open Combat' | 'Open Mining' | 'Open Smithing';
}

const availableRegionIds = new Set(
  COMBAT_REGIONS.filter((region) => region.availability === 'available').map((region) => region.id),
);

const collectionEnemyIds = new Set(
  AREAS.filter((area) => availableRegionIds.has(area.regionId)).flatMap((area) => area.enemyIds),
);

const collectionItemIds = new Set<string>(['worn-pickaxe']);

for (const enemy of ENEMIES) {
  if (collectionEnemyIds.has(enemy.id))
    for (const loot of enemy.loot) collectionItemIds.add(loot.itemId);
}
for (const node of MINING_NODES) {
  collectionItemIds.add(node.primaryRewardItemId);
  for (const drop of node.bonusDrops) collectionItemIds.add(drop.itemId);
}
for (const recipe of RECIPES) if (!recipe.legacy) collectionItemIds.add(recipe.outputItemId);
for (const tool of [...MINING_TOOLS, ...SMITHING_TOOLS]) collectionItemIds.add(tool.itemId);

const sourceNavigationByItemId = new Map<string, CollectionItemSourceNavigation>();
for (const enemy of ENEMIES) {
  if (!collectionEnemyIds.has(enemy.id)) continue;
  for (const loot of enemy.loot)
    sourceNavigationByItemId.set(loot.itemId, { screen: 'combat', label: 'Open Combat' });
}
for (const node of MINING_NODES) {
  sourceNavigationByItemId.set(node.primaryRewardItemId, { screen: 'mining', label: 'Open Mining' });
  for (const drop of node.bonusDrops)
    sourceNavigationByItemId.set(drop.itemId, { screen: 'mining', label: 'Open Mining' });
}
for (const recipe of RECIPES) {
  if (!recipe.legacy)
    sourceNavigationByItemId.set(recipe.outputItemId, { screen: 'smithing', label: 'Open Smithing' });
}

export const getCollectionEligibleItemIds = (): string[] =>
  ITEMS.filter((item) => collectionItemIds.has(item.id)).map((item) => item.id);

export const getCollectionEligibleItems = (): ItemDefinition[] =>
  ITEMS.filter((item) => collectionItemIds.has(item.id));

export const getCollectionItemSourceNavigation = (
  itemId: string,
): CollectionItemSourceNavigation | null => sourceNavigationByItemId.get(itemId) ?? null;

export const getCollectionItemCategory = (item: ItemDefinition): CollectionItemCategory => {
  if (item.category === 'weapon' || item.category === 'armor' || item.category === 'shield')
    return 'Equipment';
  if (item.category === 'tool') return 'Tools';
  if (item.category === 'drop') return 'Combat Drops';
  return 'Resources';
};

export const getCollectionProgress = (
  eligibleIds: readonly string[],
  discoveredIds: readonly string[],
): { discovered: number; total: number; percent: number } => {
  const eligible = new Set(eligibleIds);
  const discovered = new Set(discoveredIds);
  const discoveredCount = [...eligible].filter((id) => discovered.has(id)).length;
  return {
    discovered: discoveredCount,
    total: eligible.size,
    percent: eligible.size ? Math.floor((discoveredCount / eligible.size) * 100) : 0,
  };
};

export const getItemCollectionProgress = (game: Pick<GameState, 'discoveredItems'>) =>
  getCollectionProgress(getCollectionEligibleItemIds(), game.discoveredItems);

export const getCollectionEligibleEnemies = (): EnemyDefinition[] =>
  ENEMIES.filter((enemy) => collectionEnemyIds.has(enemy.id));

export const getRegionCollectionEnemies = (regionId: CombatRegionId): EnemyDefinition[] =>
  AREAS.filter((area) => area.regionId === regionId && availableRegionIds.has(regionId)).flatMap((area) =>
    area.enemyIds.map((enemyId) => ENEMIES.find((enemy) => enemy.id === enemyId)).filter(
      (enemy): enemy is EnemyDefinition => Boolean(enemy),
    ),
  );

export const getAreaCollectionEnemies = (areaId: AreaId): EnemyDefinition[] =>
  (areaById[areaId]?.enemyIds ?? [])
    .map((enemyId) => ENEMIES.find((enemy) => enemy.id === enemyId))
    .filter((enemy): enemy is EnemyDefinition => Boolean(enemy));

export const getMonsterCollectionProgress = (game: Pick<GameState, 'discoveredMonsters'>) =>
  getCollectionProgress(
    getCollectionEligibleEnemies().map((enemy) => enemy.id),
    game.discoveredMonsters,
  );

export const getOverallCollectionProgress = (
  game: Pick<GameState, 'discoveredItems' | 'discoveredMonsters'>,
) => {
  return getCollectionProgress(
    [...getCollectionEligibleItemIds(), ...getCollectionEligibleEnemies().map((enemy) => enemy.id)],
    [...game.discoveredItems, ...game.discoveredMonsters],
  );
};

export const collectionItemMatchesSearch = (
  item: ItemDefinition,
  query: string,
  discovered: boolean,
): boolean => {
  if (!query.trim()) return true;
  if (!discovered) return false;
  const normalized = query.trim().toLocaleLowerCase();
  return [item.name, getCollectionItemCategory(item), item.source]
    .join(' ')
    .toLocaleLowerCase()
    .includes(normalized);
};

export const collectionEnemyMatchesSearch = (
  enemy: EnemyDefinition,
  query: string,
  discovered: boolean,
): boolean => {
  if (!query.trim()) return true;
  if (!discovered) return false;
  return enemy.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
};

export const getAreaForEnemy = (enemy: EnemyDefinition) => areaById[enemy.areaId];
