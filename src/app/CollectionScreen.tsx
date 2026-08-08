import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { AREAS } from '../content/areas';
import { COMBAT_REGIONS } from '../content/combatRegions';
import { itemById } from '../content/items';
import { getEnemyCombatStats } from '../game/formulas/combatStats';
import { getItemQuantity } from '../game/systems/inventorySystem';
import type { CombatRegionId, EnemyDefinition, GameState, ItemDefinition } from '../game/types';
import { formatNumber } from './formatters';
import { ItemIcon } from './ItemIcon';
import { ItemTooltip } from './items/ItemTooltip';
import { ProfessionToolDetails } from './items/ProfessionToolDetails';
import { SpecialAttackDetails } from './items/SpecialAttackDetails';
import { EnemySpecialDetails } from './combat/EnemySpecialDetails';
import { EnemyTooltip } from './tooltips/EnemyTooltip';
import { formatDamageRange } from './combat/combatPresentation';
import {
  collectionEnemyMatchesSearch,
  collectionItemMatchesSearch,
  getAreaCollectionEnemies,
  getCollectionEligibleEnemies,
  getCollectionEligibleItems,
  getCollectionItemCategory,
  getCollectionProgress,
  getItemCollectionProgress,
  getMonsterCollectionProgress,
  getOverallCollectionProgress,
  getRegionCollectionEnemies,
  type CollectionItemCategory,
} from './collection/collectionSelectors';

type CollectionTab = 'items' | 'monsters';
type DiscoveryFilter = 'all' | 'discovered' | 'undiscovered';

const titleCase = (value: string): string =>
  value.replace(/[-_]/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());

const filterMatches = (filter: DiscoveryFilter, discovered: boolean): boolean =>
  filter === 'all' || (filter === 'discovered' && discovered) || (filter === 'undiscovered' && !discovered);

const ProgressBar = ({ percent }: { percent: number }) => (
  <div className="collection-progress" aria-label={`${percent}% discovered`}>
    <i style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
  </div>
);

function CollectionSummary({ game }: { game: GameState }) {
  const items = getItemCollectionProgress(game);
  const monsters = getMonsterCollectionProgress(game);
  const overall = getOverallCollectionProgress(game);
  return (
    <section className="panel collection-summary" aria-label="Collection completion">
      <div className="collection-summary-stat">
        <span className="eyebrow">Items</span>
        <strong>{items.discovered} / {items.total}</strong>
        <ProgressBar percent={items.percent} />
      </div>
      <div className="collection-summary-stat">
        <span className="eyebrow">Monsters</span>
        <strong>{monsters.discovered} / {monsters.total}</strong>
        <ProgressBar percent={monsters.percent} />
      </div>
      <div className="collection-summary-stat collection-summary-overall">
        <span className="eyebrow">Overall discovery</span>
        <strong>{overall.percent}%</strong>
        <ProgressBar percent={overall.percent} />
      </div>
    </section>
  );
}

function CollectionToolbar({
  tab,
  query,
  onQueryChange,
  filter,
  onFilterChange,
  category,
  onCategoryChange,
}: {
  tab: CollectionTab;
  query: string;
  onQueryChange: (value: string) => void;
  filter: DiscoveryFilter;
  onFilterChange: (value: DiscoveryFilter) => void;
  category?: CollectionItemCategory | 'All Items';
  onCategoryChange?: (value: CollectionItemCategory | 'All Items') => void;
}) {
  const filters: DiscoveryFilter[] = ['all', 'discovered', 'undiscovered'];
  const categories: Array<CollectionItemCategory | 'All Items'> = [
    'All Items',
    'Equipment',
    'Tools',
    'Resources',
    'Combat Drops',
  ];
  return (
    <div className="collection-toolbar">
      <label className="collection-search">
        <Search size={15} aria-hidden="true" />
        <span className="sr-only">Search {tab}</span>
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={tab === 'items' ? 'Search collection…' : 'Search monsters…'}
        />
      </label>
      <div className="collection-control-group" aria-label="Discovery status">
        {filters.map((option) => (
          <button
            type="button"
            className={`button ${filter === option ? 'gold' : 'ghost'}`}
            key={option}
            onClick={() => onFilterChange(option)}
          >
            {titleCase(option)}
          </button>
        ))}
      </div>
      {tab === 'items' && onCategoryChange && (
        <div className="collection-control-group" aria-label="Item category">
          {categories.map((option) => (
            <button
              type="button"
              className={`button ${category === option ? 'gold' : 'ghost'}`}
              key={option}
              onClick={() => onCategoryChange(option)}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ItemCollection({ game }: { game: GameState }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<DiscoveryFilter>('all');
  const [category, setCategory] = useState<CollectionItemCategory | 'All Items'>('All Items');
  const eligibleItems = getCollectionEligibleItems();
  const visibleItems = useMemo(
    () =>
      eligibleItems.filter((item) => {
        const discovered = game.discoveredItems.includes(item.id);
        return (
          filterMatches(filter, discovered) &&
          (category === 'All Items' || getCollectionItemCategory(item) === category) &&
          collectionItemMatchesSearch(item, query, discovered)
        );
      }),
    [category, eligibleItems, filter, game.discoveredItems, query],
  );
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const firstDiscovered = visibleItems.find((item) => game.discoveredItems.includes(item.id));
  useEffect(() => {
    if (selectedItemId && visibleItems.some((item) => item.id === selectedItemId)) return;
    setSelectedItemId(firstDiscovered?.id ?? visibleItems[0]?.id ?? null);
  }, [firstDiscovered?.id, selectedItemId, visibleItems]);
  const selectedItem = selectedItemId ? itemById[selectedItemId] : undefined;
  return (
    <>
      <CollectionToolbar
        tab="items"
        query={query}
        onQueryChange={setQuery}
        filter={filter}
        onFilterChange={setFilter}
        category={category}
        onCategoryChange={setCategory}
      />
      <div className="collection-category-progress">
        {(['Equipment', 'Tools', 'Resources', 'Combat Drops'] as CollectionItemCategory[]).map((group) => {
          const ids = eligibleItems.filter((item) => getCollectionItemCategory(item) === group).map((item) => item.id);
          const progress = getCollectionProgress(ids, game.discoveredItems);
          return <span key={group}>{group} {progress.discovered}/{progress.total}</span>;
        })}
      </div>
      <div className="collection-browser">
        <div className="collection-grid" aria-label="Item collection">
          {visibleItems.map((item) => {
            const discovered = game.discoveredItems.includes(item.id);
            return (
              <ItemTooltip item={item} disabled={!discovered} key={item.id}>
                <button
                  type="button"
                  className={`collection-card ${!discovered ? 'unknown' : ''} ${selectedItemId === item.id ? 'selected' : ''}`}
                  onClick={() => setSelectedItemId(item.id)}
                  aria-label={discovered ? item.name : 'Unknown item'}
                >
                  <ItemIcon itemId={item.id} discovered={discovered} size="md" />
                  <span><strong>{discovered ? item.name : '???'}</strong><small>{discovered ? getCollectionItemCategory(item) : 'Undiscovered'}</small></span>
                </button>
              </ItemTooltip>
            );
          })}
          {!visibleItems.length && <div className="collection-empty">No discovered items match these filters.</div>}
        </div>
        <ItemCollectionDetails item={selectedItem} game={game} />
      </div>
    </>
  );
}

function ItemCollectionDetails({ item, game }: { item?: ItemDefinition; game: GameState }) {
  if (!item || !game.discoveredItems.includes(item.id))
    return <div className="collection-detail"><span className="eyebrow">Collection record</span><h2>UNKNOWN ITEM</h2><p className="subtle">Discover this item to reveal its record.</p></div>;
  const bonuses = Object.entries(item.bonuses ?? {}).filter(([, value]) => value !== 0);
  return (
    <aside className="collection-detail" aria-label={`${item.name} details`}>
      <div className="collection-detail-heading">
        <ItemIcon itemId={item.id} size="lg" />
        <div><span className="eyebrow">{getCollectionItemCategory(item)}</span><h2>{item.name}</h2><span className="muted">{titleCase(item.rarity)}{item.slot ? ` · ${titleCase(item.slot)}` : ''}{item.tier ? ` · ${titleCase(item.tier)}` : ''}</span></div>
      </div>
      <p>{item.description}</p>
      <div className="collection-detail-row"><span>Owned</span><strong>{formatNumber(getItemQuantity(game.inventory, item.id))}</strong></div>
      <div className="collection-detail-row"><span>Source</span><strong>{item.source}</strong></div>
      {bonuses.length > 0 && <div className="collection-detail-section"><span className="item-tooltip-kicker">Bonuses</span>{bonuses.map(([key, value]) => <span key={key}>{titleCase(key)} <strong>{value}</strong></span>)}</div>}
      <ProfessionToolDetails itemId={item.id} className="collection-detail-section" />
      {item.specialAttack && <div className="collection-detail-section"><span className="item-tooltip-kicker">Special Attack</span><strong>{item.specialAttack.name}</strong><p>{item.specialAttack.description}</p><SpecialAttackDetails special={item.specialAttack} /></div>}
    </aside>
  );
}

function RegionProgress({ regionId, game }: { regionId: CombatRegionId; game: GameState }) {
  const enemies = getRegionCollectionEnemies(regionId);
  const progress = getCollectionProgress(enemies.map((enemy) => enemy.id), game.discoveredMonsters);
  return <span className="collection-region-progress">{progress.discovered}/{progress.total}</span>;
}

function MonsterCollection({ game }: { game: GameState }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<DiscoveryFilter>('all');
  const availableRegions = COMBAT_REGIONS.filter((region) => region.availability === 'available');
  const [regionId, setRegionId] = useState<CombatRegionId>(availableRegions[0]?.id ?? 'greenvale');
  const regionEnemies = getRegionCollectionEnemies(regionId);
  const visibleEnemies = useMemo(
    () => regionEnemies.filter((enemy) => {
      const discovered = game.discoveredMonsters.includes(enemy.id);
      return filterMatches(filter, discovered) && collectionEnemyMatchesSearch(enemy, query, discovered);
    }),
    [filter, game.discoveredMonsters, query, regionEnemies],
  );
  const [selectedEnemyId, setSelectedEnemyId] = useState<string | null>(null);
  const firstDiscovered = visibleEnemies.find((enemy) => game.discoveredMonsters.includes(enemy.id));
  useEffect(() => {
    if (selectedEnemyId && visibleEnemies.some((enemy) => enemy.id === selectedEnemyId)) return;
    setSelectedEnemyId(firstDiscovered?.id ?? visibleEnemies[0]?.id ?? null);
  }, [firstDiscovered?.id, selectedEnemyId, visibleEnemies]);
  const selectedEnemy = selectedEnemyId ? getCollectionEligibleEnemies().find((enemy) => enemy.id === selectedEnemyId) : undefined;
  return (
    <>
      <CollectionToolbar tab="monsters" query={query} onQueryChange={setQuery} filter={filter} onFilterChange={setFilter} />
      <div className="collection-region-tabs" aria-label="Collection regions">
        {availableRegions.map((region) => <button type="button" className={`button ${region.id === regionId ? 'gold' : 'ghost'}`} key={region.id} onClick={() => setRegionId(region.id)}>{region.name} <RegionProgress regionId={region.id} game={game} /></button>)}
      </div>
      <div className="collection-browser">
        <div className="collection-monster-browser" aria-label={`${regionId} monsters`}>
          {AREAS.filter((area) => area.regionId === regionId).map((area) => {
            const enemies = getAreaCollectionEnemies(area.id).filter((enemy) => {
              const discovered = game.discoveredMonsters.includes(enemy.id);
              return filterMatches(filter, discovered) && collectionEnemyMatchesSearch(enemy, query, discovered);
            });
            const allAreaEnemies = getAreaCollectionEnemies(area.id);
            const progress = getCollectionProgress(allAreaEnemies.map((enemy) => enemy.id), game.discoveredMonsters);
            return (
              <section className="collection-area-section" key={area.id}>
                <div className="collection-area-heading"><h3>{area.name}</h3><span>{progress.discovered}/{progress.total}</span></div>
                <div className="collection-grid collection-monster-grid">
                  {enemies.map((enemy) => {
                    const discovered = game.discoveredMonsters.includes(enemy.id);
                    return (
                      <EnemyTooltip enemy={enemy} kills={game.killCounts[enemy.id] ?? 0} disabled={!discovered} key={enemy.id}>
                        <button type="button" className={`collection-card ${!discovered ? 'unknown' : ''} ${selectedEnemyId === enemy.id ? 'selected' : ''}`} onClick={() => setSelectedEnemyId(enemy.id)} aria-label={discovered ? enemy.name : 'Unknown foe'}>
                          <span className="enemy-art">{discovered ? '◈' : '?'}</span>
                          <span><strong>{discovered ? enemy.name : 'Unknown foe'}</strong><small>{discovered ? `Level ${enemy.displayLevel} · ${formatNumber(game.killCounts[enemy.id] ?? 0)} kills` : 'Undiscovered'}</small></span>
                        </button>
                      </EnemyTooltip>
                    );
                  })}
                  {!enemies.length && <span className="collection-empty">Nothing discovered here yet.</span>}
                </div>
              </section>
            );
          })}
        </div>
        <MonsterCollectionDetails enemy={selectedEnemy} game={game} />
      </div>
    </>
  );
}

function MonsterCollectionDetails({ enemy, game }: { enemy?: EnemyDefinition; game: GameState }) {
  if (!enemy || !game.discoveredMonsters.includes(enemy.id))
    return <div className="collection-detail"><span className="eyebrow">Bestiary record</span><h2>UNKNOWN FOE</h2><p className="subtle">Defeat this enemy to reveal its record.</p></div>;
  const area = AREAS.find((candidate) => candidate.id === enemy.areaId);
  const region = COMBAT_REGIONS.find((candidate) => candidate.id === area?.regionId);
  const stats = getEnemyCombatStats(enemy);
  return (
    <aside className="collection-detail" aria-label={`${enemy.name} details`}>
      <div className="collection-detail-heading"><span className="enemy-art enemy-art-large">◈</span><div><span className="eyebrow">Bestiary record</span><h2>{enemy.name}</h2><span className="muted">{region?.name} · {area?.name}</span></div></div>
      <div className="collection-detail-row"><span>Level</span><strong>{enemy.displayLevel}</strong></div>
      <div className="collection-detail-row"><span>Lifetime kills</span><strong>{formatNumber(game.killCounts[enemy.id] ?? 0)}</strong></div>
      <div className="collection-detail-section"><span className="item-tooltip-kicker">Combat</span><div className="collection-stat-grid"><span>Health <strong>{stats.maxHealth}</strong></span><span>Damage <strong>{formatDamageRange(stats.maxHit)}</strong></span><span>Accuracy <strong>{stats.accuracyRating}</strong></span><span>Defence <strong>{stats.defenceRating}</strong></span><span>Attack interval <strong>{(stats.attackIntervalMs / 1000).toFixed(1)}s</strong></span></div></div>
      <div className="collection-detail-section"><span className="item-tooltip-kicker">Trait · {enemy.trait.name}</span><p>{enemy.trait.description}</p></div>
      {enemy.specialAttack && <div className="collection-detail-section"><EnemySpecialDetails special={enemy.specialAttack} includeNormalQualifier /></div>}
      <div className="collection-detail-section"><span className="item-tooltip-kicker">Drops</span>{enemy.loot.map((drop) => { const item = itemById[drop.itemId]; const discovered = game.discoveredItems.includes(drop.itemId); return <ItemTooltip item={item} disabled={!discovered} key={drop.itemId}><div className="collection-drop-row"><ItemIcon itemId={drop.itemId} discovered={discovered} size="xs" /><span>{discovered ? item?.name : 'Undiscovered drop'}</span><small>{Math.round(drop.chance * 100)}%</small></div></ItemTooltip>; })}{enemy.gold && <div className="collection-drop-row gold"><ItemIcon gold size="xs" /><span>Gold</span><small>{enemy.gold[0]}–{enemy.gold[1]}</small></div>}</div>
    </aside>
  );
}

export function CollectionScreen({ game }: { game: GameState }) {
  const [tab, setTab] = useState<CollectionTab>('items');
  return (
    <div className="collection-screen">
      <div className="screen-heading"><div><div className="eyebrow">Records of the road</div><h1>Collection Log</h1><p className="subtle">Records of creatures and items discovered across Ironbound.</p></div></div>
      <CollectionSummary game={game} />
      <section className="panel panel-pad collection-panel">
        <div className="tabs" role="tablist" aria-label="Collection categories">
          {(['items', 'monsters'] as CollectionTab[]).map((option) => <button type="button" role="tab" aria-selected={tab === option} className={`tab ${tab === option ? 'active' : ''}`} onClick={() => setTab(option)} key={option}>{option === 'items' ? 'Items' : 'Monsters'}</button>)}
        </div>
        {tab === 'items' ? <ItemCollection game={game} /> : <MonsterCollection game={game} />}
      </section>
    </div>
  );
}
