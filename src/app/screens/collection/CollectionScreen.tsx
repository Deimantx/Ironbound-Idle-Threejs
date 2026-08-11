import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowUpRight, Search } from 'lucide-react';
import { AREAS } from '../../../content/areas';
import { COMBAT_REGIONS } from '../../../content/combatRegions';
import { combatSubRegionById } from '../../../content/combatSubRegions';
import { itemById } from '../../../content/items';
import { getEnemyCombatStats } from '../../../game/formulas/combatStats';
import { getResolvedEnemyLoot } from '../../../game/formulas/combatLoot';
import { getItemQuantity } from '../../../game/systems/inventorySystem';
import type {
  CombatRegionId,
  EnemyDefinition,
  GameState,
  ItemDefinition,
  ScreenId,
} from '../../../game/types';
import { formatNumber } from '../../shared/formatters';
import { getEquipmentBonusLabel, formatEquipmentBonus } from '../../shared/equipmentView';
import { ArtViewport } from '../../art/ArtViewport';
import { ItemDetailHeader } from '../../items/ItemDetailHeader';
import { ItemArtwork } from '../../items/ItemArtwork';
import { EnemyArtwork } from '../../art/EnemyArtwork';
import { ItemTooltip } from '../../items/ItemTooltip';
import { ProfessionToolDetails } from '../../items/ProfessionToolDetails';
import { SpecialAttackDetails } from '../../items/SpecialAttackDetails';
import { EnemySpecialDetails } from '../../combat/EnemySpecialDetails';
import { EnemyTooltip } from '../../tooltips/EnemyTooltip';
import { formatDamageRange } from '../../combat/combatPresentation';
import { UiPanelGrid } from '../../ui-editor/UiPanelGrid';
import { UiPanelSlot } from '../../ui-editor/UiPanelSlot';
import { UiPanelRegionGrid } from '../../ui-editor/UiPanelRegionGrid';
import { UiPanelRegionSlot } from '../../ui-editor/UiPanelRegionSlot';
import { DEFAULT_UI_LAYOUT, type UiLayout } from '../../ui-editor/uiLayout';
import {
  collectionEnemyMatchesSearch,
  collectionItemMatchesSearch,
  getAreaCollectionEnemies,
  getCollectionEligibleEnemies,
  getCollectionEligibleItems,
  getCollectionItemCategory,
  getCollectionItemSourceNavigation,
  getCollectionItemSourceLabel,
  getCollectionProgress,
  getItemCollectionProgress,
  getMonsterCollectionProgress,
  getOverallCollectionProgress,
  getRegionCollectionEnemies,
  type CollectionItemCategory,
} from './collectionSelectors';

type CollectionTab = 'items' | 'monsters';
type DiscoveryFilter = 'all' | 'discovered' | 'undiscovered';
type ItemCategoryFilter = CollectionItemCategory | 'All Items';

const DISCOVERY_FILTERS: DiscoveryFilter[] = ['all', 'discovered', 'undiscovered'];
const ITEM_CATEGORIES: ItemCategoryFilter[] = [
  'All Items',
  'Equipment',
  'Tools',
  'Resources',
  'Combat Drops',
];

const titleCase = (value: string): string =>
  value.replace(/[-_]/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());

const filterMatches = (filter: DiscoveryFilter, discovered: boolean): boolean =>
  filter === 'all' || (filter === 'discovered' && discovered) || (filter === 'undiscovered' && !discovered);

const ProgressBar = ({ percent }: { percent: number }) => (
  <div className="collection-progress" aria-label={`${percent}% discovered`}>
    <i style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
  </div>
);

function CollectionSummary({ game, uiLayout }: { game: GameState; uiLayout: UiLayout }) {
  const items = getItemCollectionProgress(game);
  const monsters = getMonsterCollectionProgress(game);
  const overall = getOverallCollectionProgress(game);
  return (
    <section className="panel collection-summary" aria-label="Collection completion">
      <UiPanelRegionGrid screen="collection" panelId="collectionSummary" layout={uiLayout} className="collection-summary-regions">
        <UiPanelRegionSlot screen="collection" panelId="collectionSummary" regionId="collectionSummaryItems" layout={uiLayout}>
          <div className="collection-summary-stat">
            <span className="eyebrow">Items</span>
            <strong>{items.discovered} / {items.total}</strong>
            <ProgressBar percent={items.percent} />
          </div>
        </UiPanelRegionSlot>
        <UiPanelRegionSlot screen="collection" panelId="collectionSummary" regionId="collectionSummaryMonsters" layout={uiLayout}>
          <div className="collection-summary-stat">
            <span className="eyebrow">Monsters</span>
            <strong>{monsters.discovered} / {monsters.total}</strong>
            <ProgressBar percent={monsters.percent} />
          </div>
        </UiPanelRegionSlot>
        <UiPanelRegionSlot screen="collection" panelId="collectionSummary" regionId="collectionSummaryOverall" layout={uiLayout}>
          <div className="collection-summary-stat collection-summary-overall">
            <span className="eyebrow">Overall discovery</span>
            <strong>{overall.percent}%</strong>
            <ProgressBar percent={overall.percent} />
          </div>
        </UiPanelRegionSlot>
      </UiPanelRegionGrid>
    </section>
  );
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="collection-filter-group" role="group" aria-label={label}>
      <div className="collection-filter-buttons">{children}</div>
    </div>
  );
}

function DiscoveryFilterGroup({
  filter,
  onChange,
}: {
  filter: DiscoveryFilter;
  onChange: (value: DiscoveryFilter) => void;
}) {
  return (
    <FilterGroup label="Discovery Status">
      {DISCOVERY_FILTERS.map((option) => (
        <button
          type="button"
          className={`inventory-filter ${filter === option ? 'is-active' : ''}`}
          aria-pressed={filter === option}
          key={option}
          onClick={() => onChange(option)}
        >
          {titleCase(option)}
        </button>
      ))}
    </FilterGroup>
  );
}

function SearchField({
  tab,
  query,
  onChange,
}: {
  tab: CollectionTab;
  query: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="collection-search">
      <Search size={15} aria-hidden="true" />
      <span className="sr-only">Search {tab}</span>
      <input
        type="search"
        value={query}
        onChange={(event) => onChange(event.target.value)}
        placeholder={tab === 'items' ? 'Search collection…' : 'Search monsters…'}
      />
    </label>
  );
}

function CollectionResultsBar({
  visible,
  total,
  noun,
  showClear,
  onClear,
}: {
  visible: number;
  total: number;
  noun: string;
  showClear: boolean;
  onClear: () => void;
}) {
  return (
    <div className="collection-results-bar" aria-live="polite">
      <span>Showing {visible} of {total} {noun}</span>
      {showClear && (
        <button type="button" className="button ghost collection-clear" onClick={onClear}>
          Clear Filters
        </button>
      )}
    </div>
  );
}

function ItemToolbar({
  game,
  eligibleItems,
  filter,
  onFilterChange,
  category,
  onCategoryChange,
}: {
  game: GameState;
  eligibleItems: ItemDefinition[];
  filter: DiscoveryFilter;
  onFilterChange: (value: DiscoveryFilter) => void;
  category: ItemCategoryFilter;
  onCategoryChange: (value: ItemCategoryFilter) => void;
}) {
  const allProgress = getItemCollectionProgress(game);
  return (
    <div className="collection-filter-row">
      <DiscoveryFilterGroup filter={filter} onChange={onFilterChange} />
      <span className="collection-filter-divider" aria-hidden="true" />
      <FilterGroup label="Category">
        {ITEM_CATEGORIES.map((option) => {
          const ids = eligibleItems
            .filter((item) => option === 'All Items' || getCollectionItemCategory(item) === option)
            .map((item) => item.id);
          const progress = option === 'All Items'
            ? allProgress
            : getCollectionProgress(ids, game.discoveredItems);
          return (
            <button
              type="button"
              className={`inventory-filter ${category === option ? 'is-active' : ''} ${progress.total === 0 ? 'is-empty' : ''}`}
              aria-pressed={category === option}
              key={option}
              onClick={() => onCategoryChange(option)}
            >
              <span>{option}</span>
              <small className="inventory-filter-count">{progress.discovered}/{progress.total}</small>
            </button>
          );
        })}
      </FilterGroup>
    </div>
  );
}

function ItemCard({
  item,
  discovered,
  selected,
  onSelect,
}: {
  item: ItemDefinition;
  discovered: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const card = (
    <button
      type="button"
      className={`collection-card collection-item-card item-rarity-${item.rarity} ${!discovered ? 'unknown' : ''} ${selected ? 'selected' : ''}`}
      data-debug-kind={discovered ? 'item-card' : undefined}
      data-debug-item-id={discovered ? item.id : undefined}
      data-debug-label={discovered ? item.name : undefined}
      aria-label={discovered ? item.name : 'Unknown item'}
      aria-current={selected ? 'true' : undefined}
      onClick={onSelect}
    >
      <ArtViewport className="collection-item-art-viewport">
        <ItemArtwork itemId={item.id} discovered={discovered} size="tile" />
      </ArtViewport>
    </button>
  );
  return <ItemTooltip item={item} disabled={!discovered}>{card}</ItemTooltip>;
}

function CollectionItemSection({
  title,
  items,
  discoveredIds,
  selectedItemId,
  onSelect,
}: {
  title: string;
  items: ItemDefinition[];
  discoveredIds: readonly string[];
  selectedItemId: string | null;
  onSelect: (itemId: string) => void;
}) {
  if (!items.length) return null;
  return (
    <section className="collection-section" aria-label={title}>
      <div className="collection-section-heading">
        <h3>{title}</h3>
        <span className="collection-section-count">{items.length} items</span>
      </div>
      <div className="collection-grid collection-item-grid">
        {items.map((item) => {
          const discovered = discoveredIds.includes(item.id);
          return (
            <ItemCard
              item={item}
              discovered={discovered}
              selected={selectedItemId === item.id}
              onSelect={() => onSelect(item.id)}
              key={item.id}
            />
          );
        })}
      </div>
    </section>
  );
}

function ItemCollection({
  game,
  onNavigate,
}: {
  game: GameState;
  onNavigate: (screen: ScreenId) => void;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<DiscoveryFilter>('all');
  const [category, setCategory] = useState<ItemCategoryFilter>('All Items');
  const eligibleItems = useMemo(() => getCollectionEligibleItems(), []);
  const visibleItems = useMemo(
    () => eligibleItems.filter((item) => {
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

  const discoveredItems = visibleItems.filter((item) => game.discoveredItems.includes(item.id));
  const undiscoveredItems = visibleItems.filter((item) => !game.discoveredItems.includes(item.id));
  const categoryTotal = eligibleItems.filter(
    (item) => category === 'All Items' || getCollectionItemCategory(item) === category,
  ).length;
  const filtersActive = Boolean(query.trim()) || filter !== 'all' || category !== 'All Items';
  const clearFilters = () => {
    setQuery('');
    setFilter('all');
    setCategory('All Items');
  };

  return (
    <>
      <SearchField tab="items" query={query} onChange={setQuery} />
      <ItemToolbar
        game={game}
        eligibleItems={eligibleItems}
        filter={filter}
        onFilterChange={setFilter}
        category={category}
        onCategoryChange={setCategory}
      />
      <CollectionResultsBar
        visible={visibleItems.length}
        total={categoryTotal}
        noun="items"
        showClear={filtersActive}
        onClear={clearFilters}
      />
      <div className="collection-browser">
        <div className="collection-item-browser" aria-label="Item collection">
          <CollectionItemSection
            title="Discovered Items"
            items={discoveredItems}
            discoveredIds={game.discoveredItems}
            selectedItemId={selectedItemId}
            onSelect={setSelectedItemId}
          />
          <CollectionItemSection
            title="Undiscovered Items"
            items={undiscoveredItems}
            discoveredIds={game.discoveredItems}
            selectedItemId={selectedItemId}
            onSelect={setSelectedItemId}
          />
          {!visibleItems.length && <div className="collection-empty">No items match these filters.</div>}
        </div>
        <ItemCollectionDetails
          item={selectedItemId ? itemById[selectedItemId] : undefined}
          game={game}
          onNavigate={onNavigate}
        />
      </div>
    </>
  );
}

function ItemCollectionDetails({
  item,
  game,
  onNavigate,
}: {
  item?: ItemDefinition;
  game: GameState;
  onNavigate: (screen: ScreenId) => void;
}) {
  if (!item || !game.discoveredItems.includes(item.id)) {
    return (
      <div className="collection-detail">
        <span className="eyebrow">Collection record</span>
        <h2>UNKNOWN ITEM</h2>
        <p className="subtle">Discover this item to reveal its record.</p>
      </div>
    );
  }
  const bonuses = Object.entries(item.bonuses ?? {}).filter(([, value]) => value !== 0);
  const sourceNavigation = getCollectionItemSourceNavigation(item.id);
  const sourceLabel = getCollectionItemSourceLabel(item.id);
  return (
    <aside className="collection-detail" aria-label={`${item.name} details`}>
      <ItemDetailHeader
        item={item}
        eyebrow={getCollectionItemCategory(item)}
        metadata={
          <>
            {titleCase(item.rarity)}
            {item.slot ? ` · ${titleCase(item.slot)}` : ` · ${titleCase(item.category)}`}
            {item.tier ? ` · ${titleCase(item.tier)}` : ''}
          </>
        }
      />
      <p className="collection-detail-description">{item.description}</p>
      <div className="collection-detail-meta">
        <div className="collection-detail-row"><span>Owned</span><strong className="ui-stat-compact">{formatNumber(getItemQuantity(game.inventory, item.id))}</strong></div>
        <div className="collection-detail-source">
          <div className="collection-detail-row"><span>Source</span><strong>{sourceLabel}</strong></div>
          {sourceNavigation && (
            <button
              type="button"
              className="button ghost collection-detail-source-action"
              onClick={() => onNavigate(sourceNavigation.screen)}
            >
              {sourceNavigation.label} <ArrowUpRight size={13} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      {bonuses.length > 0 && (
        <div className="collection-detail-section">
          <span className="item-tooltip-kicker">Bonuses</span>
          {bonuses.map(([key, value]) => (
            <span key={key}>{getEquipmentBonusLabel(key)} <strong className="ui-stat-compact">{formatEquipmentBonus(key, value as number)}</strong></span>
          ))}
        </div>
      )}
      <ProfessionToolDetails itemId={item.id} className="collection-detail-section" />
      {item.specialAttack && (
        <div className="collection-detail-section">
          <span className="item-tooltip-kicker">Special Attack</span>
          <strong>{item.specialAttack.name}</strong>
          <p>{item.specialAttack.description}</p>
          <SpecialAttackDetails special={item.specialAttack} />
        </div>
      )}
    </aside>
  );
}

function MonsterToolbar({
  game,
  regionId,
  onRegionChange,
  filter,
  onFilterChange,
}: {
  game: GameState;
  regionId: CombatRegionId;
  onRegionChange: (value: CombatRegionId) => void;
  filter: DiscoveryFilter;
  onFilterChange: (value: DiscoveryFilter) => void;
}) {
  const regions = COMBAT_REGIONS.filter((region) => region.availability === 'available');
  return (
    <div className="collection-filter-row">
      <DiscoveryFilterGroup filter={filter} onChange={onFilterChange} />
      <span className="collection-filter-divider" aria-hidden="true" />
      <FilterGroup label="Region">
        {regions.map((region) => {
          const progress = getCollectionProgress(
            getRegionCollectionEnemies(region.id).map((enemy) => enemy.id),
            game.discoveredMonsters,
          );
          return (
            <button
              type="button"
              className={`inventory-filter ${region.id === regionId ? 'is-active' : ''} ${progress.total === 0 ? 'is-empty' : ''}`}
              aria-pressed={region.id === regionId}
              key={region.id}
              onClick={() => onRegionChange(region.id)}
            >
              <span>{region.name}</span>
              <small className="inventory-filter-count">{progress.discovered}/{progress.total}</small>
            </button>
          );
        })}
      </FilterGroup>
    </div>
  );
}

function MonsterCard({
  enemy,
  discovered,
  selected,
  kills,
  onSelect,
}: {
  enemy: EnemyDefinition;
  discovered: boolean;
  selected: boolean;
  kills: number;
  onSelect: () => void;
}) {
  const card = (
    <button
      type="button"
      className={`collection-card ${!discovered ? 'unknown' : ''} ${selected ? 'selected' : ''}`}
      data-debug-kind={discovered ? 'enemy' : undefined}
      data-debug-enemy-id={discovered ? enemy.id : undefined}
      data-debug-label={discovered ? enemy.name : undefined}
      aria-label={discovered ? enemy.name : 'Unknown foe'}
      aria-current={selected ? 'true' : undefined}
      onClick={onSelect}
    >
      <EnemyArtwork enemyId={enemy.id} discovered={discovered} size="sm" />
      <span>
        <strong>{discovered ? enemy.name : 'Unknown foe'}</strong>
        <small>{discovered ? `Level ${enemy.displayLevel} · ${formatNumber(kills)} kills` : 'Undiscovered'}</small>
      </span>
    </button>
  );
  return <EnemyTooltip enemy={enemy} kills={kills} disabled={!discovered}>{card}</EnemyTooltip>;
}

function MonsterCollection({
  game,
}: {
  game: GameState;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<DiscoveryFilter>('all');
  const regions = useMemo(
    () => COMBAT_REGIONS.filter((region) => region.availability === 'available'),
    [],
  );
  const [regionId, setRegionId] = useState<CombatRegionId>(regions[0]?.id ?? 'tauraque');
  const regionEnemies = useMemo(() => getRegionCollectionEnemies(regionId), [regionId]);
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

  const filtersActive = Boolean(query.trim()) || filter !== 'all';
  const clearFilters = () => {
    setQuery('');
    setFilter('all');
  };
  const selectedEnemy = selectedEnemyId
    ? getCollectionEligibleEnemies().find((enemy) => enemy.id === selectedEnemyId)
    : undefined;

  return (
    <>
      <SearchField tab="monsters" query={query} onChange={setQuery} />
      <MonsterToolbar
        game={game}
        regionId={regionId}
        onRegionChange={setRegionId}
        filter={filter}
        onFilterChange={setFilter}
      />
      <CollectionResultsBar
        visible={visibleEnemies.length}
        total={regionEnemies.length}
        noun="monsters"
        showClear={filtersActive}
        onClear={clearFilters}
      />
      <div className="collection-browser">
        <div className="collection-monster-browser" aria-label={`${regionId} monsters`}>
          {AREAS.filter((area) => area.regionId === regionId).map((area) => {
            const areaEnemies = getAreaCollectionEnemies(area.id).filter((enemy) => visibleEnemies.includes(enemy));
            const orderedEnemies = filter === 'all'
              ? [...areaEnemies].sort((left, right) => {
                  const leftDiscovered = game.discoveredMonsters.includes(left.id);
                  const rightDiscovered = game.discoveredMonsters.includes(right.id);
                  return Number(rightDiscovered) - Number(leftDiscovered);
                })
              : areaEnemies;
            const progress = getCollectionProgress(
              getAreaCollectionEnemies(area.id).map((enemy) => enemy.id),
              game.discoveredMonsters,
            );
            if (!orderedEnemies.length) return null;
            return (
              <section className="collection-area-section" key={area.id}>
                <div className="collection-area-heading">
                  <h3>{area.name}</h3>
                  <span>{progress.discovered}/{progress.total}</span>
                </div>
                <div className="collection-grid collection-monster-grid">
                  {orderedEnemies.map((enemy) => {
                    const discovered = game.discoveredMonsters.includes(enemy.id);
                    return (
                      <MonsterCard
                        enemy={enemy}
                        discovered={discovered}
                        selected={selectedEnemyId === enemy.id}
                        kills={game.killCounts[enemy.id] ?? 0}
                        onSelect={() => setSelectedEnemyId(enemy.id)}
                        key={enemy.id}
                      />
                    );
                  })}
                </div>
              </section>
            );
          })}
          {!visibleEnemies.length && <div className="collection-empty">No monsters match these filters.</div>}
        </div>
        <MonsterCollectionDetails enemy={selectedEnemy} game={game} />
      </div>
    </>
  );
}

function MonsterCollectionDetails({ enemy, game }: { enemy?: EnemyDefinition; game: GameState }) {
  if (!enemy || !game.discoveredMonsters.includes(enemy.id)) {
    return (
      <div className="collection-detail">
        <span className="eyebrow">Bestiary record</span>
        <h2>UNKNOWN FOE</h2>
        <p className="subtle">Defeat this enemy to reveal its record.</p>
      </div>
    );
  }
  const area = AREAS.find((candidate) => candidate.id === enemy.areaId);
  const region = COMBAT_REGIONS.find((candidate) => candidate.id === area?.regionId);
  const subRegion = area ? combatSubRegionById[area.subRegionId] : undefined;
  const goldRange = area?.gold;
  const stats = getEnemyCombatStats(enemy);
  return (
    <aside className="collection-detail" aria-label={`${enemy.name} details`}>
      <div className="collection-detail-heading">
        <EnemyArtwork enemyId={enemy.id} size="lg" />
        <div>
          <span className="eyebrow">Bestiary record</span>
          <h2>{enemy.name}</h2>
          <span className="muted">{region?.name} · {subRegion?.name} · {area?.name}</span>
        </div>
      </div>
      <div className="collection-detail-meta">
        <div className="collection-detail-row"><span>Level</span><strong>{enemy.displayLevel}</strong></div>
        <div className="collection-detail-row"><span>Lifetime kills</span><strong>{formatNumber(game.killCounts[enemy.id] ?? 0)}</strong></div>
      </div>
      <div className="collection-detail-section">
        <span className="item-tooltip-kicker">Combat</span>
        <div className="collection-stat-grid">
          <span>Health <strong>{stats.maxHealth}</strong></span>
          <span>Damage <strong>{formatDamageRange(stats.maxHit)}</strong></span>
          <span>Accuracy <strong>{stats.accuracyRating}</strong></span>
          <span>Defence <strong>{stats.defenceRating}</strong></span>
          <span>Attack interval <strong>{(stats.attackIntervalMs / 1000).toFixed(1)}s</strong></span>
        </div>
      </div>
      <div className="collection-detail-section">
        <span className="item-tooltip-kicker">Trait · {enemy.trait.name}</span>
        <p>{enemy.trait.description}</p>
      </div>
      {enemy.specialAttack && (
        <div className="collection-detail-section">
          <EnemySpecialDetails special={enemy.specialAttack} includeNormalQualifier />
        </div>
      )}
      <div className="collection-detail-section">
        <span className="item-tooltip-kicker">Drops</span>
        {getResolvedEnemyLoot(enemy.id).map((drop) => {
          const item = itemById[drop.itemId];
          const discovered = game.discoveredItems.includes(drop.itemId);
          return (
            <ItemTooltip item={item} disabled={!discovered} key={drop.itemId}>
              <div className="collection-drop-row">
                <ArtViewport className={`loot-icon loot-icon-xs loot-icon-${item?.category ?? 'unknown'}`}>
                  <ItemArtwork itemId={drop.itemId} discovered={discovered} size="xs" />
                </ArtViewport>
                <span>{discovered ? item?.name : 'Undiscovered drop'}</span>
                <small>{Math.round(drop.chance * 100)}%</small>
              </div>
            </ItemTooltip>
          );
        })}
        {area?.gold && (
          <div className="collection-drop-row gold">
            <ArtViewport className="loot-icon loot-icon-xs loot-icon-gold">
              <ItemArtwork gold size="xs" />
            </ArtViewport>
            <span>Gold</span>
            <small>{goldRange?.[0]}–{goldRange?.[1]}</small>
          </div>
        )}
      </div>
    </aside>
  );
}

export function CollectionScreen({
  game,
  onNavigate,
  uiLayout = DEFAULT_UI_LAYOUT,
}: {
  game: GameState;
  onNavigate: (screen: ScreenId) => void;
  uiLayout?: UiLayout;
}) {
  const [tab, setTab] = useState<CollectionTab>('items');
  return (
    <div className="collection-screen">
      <div className="screen-heading">
        <div>
          <div className="eyebrow">Records of the road</div>
          <h1>Collection Log</h1>
          <p className="subtle">Records of creatures and items discovered across Ironbound.</p>
        </div>
      </div>
      <UiPanelGrid screen="collection" className="collection-panel-grid">
        <UiPanelSlot screen="collection" id="collectionSummary" layout={uiLayout}>
          <CollectionSummary game={game} uiLayout={uiLayout} />
        </UiPanelSlot>
        <UiPanelSlot screen="collection" id="collectionBrowser" layout={uiLayout}>
          <section className="panel panel-pad collection-panel">
            <UiPanelRegionGrid screen="collection" panelId="collectionBrowser" layout={uiLayout} className="collection-browser-regions">
              <UiPanelRegionSlot screen="collection" panelId="collectionBrowser" regionId="collectionBrowserControls" layout={uiLayout}>
                <div className="tabs" role="tablist" aria-label="Collection categories">
                  {(['items', 'monsters'] as CollectionTab[]).map((option) => (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={tab === option}
                      className={`tab ${tab === option ? 'active' : ''}`}
                      onClick={() => setTab(option)}
                      key={option}
                    >
                      {option === 'items' ? 'Items' : 'Monsters'}
                    </button>
                  ))}
                </div>
              </UiPanelRegionSlot>
              <UiPanelRegionSlot screen="collection" panelId="collectionBrowser" regionId="collectionBrowserContent" layout={uiLayout}>
                {tab === 'items' ? <ItemCollection game={game} onNavigate={onNavigate} /> : <MonsterCollection game={game} />}
              </UiPanelRegionSlot>
            </UiPanelRegionGrid>
          </section>
        </UiPanelSlot>
      </UiPanelGrid>
    </div>
  );
}
