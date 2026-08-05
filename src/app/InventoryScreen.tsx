import { PackageOpen, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { GAME_CONFIG } from '../config/gameConfig';
import { itemById } from '../content/items';
import type { GameState, ScreenId } from '../game/types';
import { useGameStore } from '../game/state/gameStore';
import { occupiedSlots } from '../game/systems/inventorySystem';
import { ConfirmDialog, type ConfirmDialogOptions } from './ConfirmDialog';
import { InventoryDetailsDrawer } from './InventoryDetailsDrawer';
import { InventoryItemCard } from './InventoryItemCard';
import { InventoryItemDetails } from './InventoryItemDetails';
import {
  getInventoryFilterLabel,
  getInventoryGroupCounts,
  getVisibleInventoryStacks,
  INVENTORY_FILTERS,
  type InventoryFilter,
} from './inventoryView';
import { ScreenHeading } from './ScreenHeading';
import { UI_EDITOR_COMPACT_QUERY, type UiLayout } from './uiLayout';
import { UiPanelSlot } from './UiPanelSlot';

export interface InventoryScreenProps {
  game: GameState;
  uiLayout: UiLayout;
  onNavigate: (screen: ScreenId) => void;
}

const getCapacityState = (occupied: number, capacity: number): 'healthy' | 'warning' | 'full' => {
  if (occupied >= capacity) return 'full';
  if (occupied / Math.max(1, capacity) >= 0.8) return 'warning';
  return 'healthy';
};

export function InventoryScreen({ game, uiLayout, onNavigate }: InventoryScreenProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<InventoryFilter>('all');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [mobileDetailsOpen, setMobileDetailsOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmDialogOptions | null>(null);
  const [compactViewport, setCompactViewport] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(UI_EDITOR_COMPACT_QUERY).matches
      : false,
  );
  const cardRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const equip = useGameStore((store) => store.equip);
  const destroy = useGameStore((store) => store.destroy);
  const toggleLock = useGameStore((store) => store.toggleLock);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia(UI_EDITOR_COMPACT_QUERY);
    const update = () => setCompactViewport(media.matches);
    update();
    media.addEventListener?.('change', update);
    media.addListener?.(update);
    return () => {
      media.removeEventListener?.('change', update);
      media.removeListener?.(update);
    };
  }, []);

  const groupCounts = useMemo(
    () => getInventoryGroupCounts(game.inventory, itemById),
    [game.inventory],
  );
  const visibleStacks = useMemo(
    () => getVisibleInventoryStacks(game.inventory, itemById, filter, query),
    [filter, game.inventory, query],
  );
  const occupied = useMemo(() => occupiedSlots(game.inventory), [game.inventory]);
  const capacityState = getCapacityState(occupied, GAME_CONFIG.inventorySlots);
  const selectedStack = useMemo(
    () => game.inventory.find((stack) => stack.itemId === selectedItemId && stack.quantity > 0),
    [game.inventory, selectedItemId],
  );
  const selectedItem = selectedStack ? itemById[selectedStack.itemId] : undefined;
  const hasInventory = occupied > 0;
  const hasFilteredResults = visibleStacks.length > 0;
  const detailsHeadingId = 'inventory-selected-item-title';
  const drawerHeadingId = 'inventory-drawer-item-title';

  useEffect(() => {
    if (!selectedItemId || selectedStack) return;
    const nextStack = visibleStacks[0];
    setSelectedItemId(nextStack?.itemId ?? null);
    if (!nextStack) setMobileDetailsOpen(false);
  }, [selectedItemId, selectedStack, visibleStacks]);

  const selectItem = (itemId: string) => {
    returnFocusRef.current = cardRefs.current[itemId];
    setSelectedItemId(itemId);
    setMobileDetailsOpen(true);
  };

  const resetFilters = () => {
    setQuery('');
    setFilter('all');
  };

  const requestDestroyOne = () => {
    if (!selectedStack || !selectedItem || selectedStack.locked) return;
    setConfirmation({
      title: 'Destroy one item?',
      message: `Destroy one ${selectedItem.name}? This cannot be undone.`,
      confirmLabel: 'Destroy One',
      danger: true,
      onConfirm: () => destroy(selectedItem.id, 1),
    });
  };

  const detailsProps = selectedStack
    ? {
        stack: selectedStack,
        item: selectedItem,
        onEquip: () => {
          if (selectedItem) equip(selectedItem.id);
        },
        onOpenEquipment: () => onNavigate('equipment'),
        onToggleLock: () => {
          if (selectedItem) toggleLock(selectedItem.id);
        },
        onDestroyOne: requestDestroyOne,
      }
    : null;

  return (
    <>
      <ScreenHeading
        eyebrow="Character · Storage"
        title="Inventory"
        description="Materials, equipment, and trophies gathered across the frontier."
        trailing={
          <span className="badge gold inventory-heading-capacity">
            {occupied} / {GAME_CONFIG.inventorySlots} slots
          </span>
        }
      />
      <div className="ui-panel-grid inventory-panel-grid" data-ui-panel-grid="inventory">
        <UiPanelSlot screen="inventory" id="inventoryToolbar" layout={uiLayout}>
          <section
            className="panel panel-pad inventory-toolbar-panel"
            aria-labelledby="inventory-toolbar-title"
          >
            <div className="inventory-toolbar-heading">
              <div>
                <div className="eyebrow">Storage ledger</div>
                <h2 id="inventory-toolbar-title">Search and filter</h2>
              </div>
              <span className="inventory-result-summary">
                Showing {visibleStacks.length} of {occupied} stacks
              </span>
            </div>
            <div className="inventory-search-row">
              <label className="inventory-search-field">
                <Search size={16} aria-hidden="true" />
                <span className="visually-hidden">Search inventory</span>
                <input
                  className="field"
                  aria-label="Search inventory"
                  placeholder="Search items, sources, slots..."
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                {query && (
                  <button
                    type="button"
                    className="inventory-clear-search"
                    onClick={() => setQuery('')}
                    aria-label="Clear search"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                )}
              </label>
              <button
                type="button"
                className="button ghost inventory-open-equipment"
                onClick={() => onNavigate('equipment')}
              >
                Open Equipment
              </button>
            </div>
            <div
              className="inventory-filter-row"
              role="group"
              aria-label="Inventory display groups"
            >
              {INVENTORY_FILTERS.map((option) => {
                const count = groupCounts[option.id];
                return (
                  <button
                    type="button"
                    className={`inventory-filter ${filter === option.id ? 'is-active' : ''}`}
                    key={option.id}
                    aria-pressed={filter === option.id}
                    onClick={() => setFilter(option.id)}
                  >
                    <span>{option.label}</span>
                    <small>{count}</small>
                  </button>
                );
              })}
            </div>
            <div className={`inventory-capacity inventory-capacity-${capacityState}`}>
              <div className="inventory-capacity-label">
                <span>Capacity</span>
                <strong>
                  {occupied} / {GAME_CONFIG.inventorySlots} slots
                </strong>
              </div>
              <div
                className="inventory-capacity-track"
                role="progressbar"
                aria-label="Inventory capacity"
                aria-valuemin={0}
                aria-valuemax={GAME_CONFIG.inventorySlots}
                aria-valuenow={occupied}
                aria-valuetext={`${occupied} of ${GAME_CONFIG.inventorySlots} inventory slots occupied`}
              >
                <span
                  style={{
                    width: `${Math.min(100, (occupied / GAME_CONFIG.inventorySlots) * 100)}%`,
                  }}
                />
              </div>
            </div>
          </section>
        </UiPanelSlot>
        <UiPanelSlot screen="inventory" id="inventoryBank" layout={uiLayout}>
          <section
            className="panel panel-pad inventory-bank-panel"
            aria-labelledby="inventory-bank-title"
          >
            <div className="inventory-bank-heading">
              <div>
                <div className="eyebrow">Archive of gathered goods</div>
                <h2 id="inventory-bank-title">Item Bank</h2>
              </div>
              <span className="inventory-bank-count">
                {hasInventory ? `${visibleStacks.length} visible` : 'No occupied stacks'}
              </span>
            </div>
            {!hasInventory ? (
              <div className="inventory-empty-state">
                <PackageOpen size={30} aria-hidden="true" />
                <h3>Your inventory is empty</h3>
                <p>Mine ore, forge equipment, or defeat enemies to collect items.</p>
                <div className="button-row">
                  <button
                    type="button"
                    className="button primary"
                    onClick={() => onNavigate('mining')}
                  >
                    Go to Mining
                  </button>
                  <button
                    type="button"
                    className="button ghost"
                    onClick={() => onNavigate('combat')}
                  >
                    Go to Combat
                  </button>
                </div>
              </div>
            ) : (
              <div className="inventory-bank-layout">
                <div className="inventory-items-column">
                  {hasFilteredResults ? (
                    <div
                      className="inventory-grid inventory-bank-grid"
                      aria-label="Inventory items"
                    >
                      {visibleStacks.map((stack) => (
                        <InventoryItemCard
                          key={stack.itemId}
                          stack={stack}
                          item={itemById[stack.itemId]}
                          selected={stack.itemId === selectedItemId}
                          onSelect={selectItem}
                          cardRef={(element) => {
                            cardRefs.current[stack.itemId] = element;
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="inventory-filtered-empty">
                      <PackageOpen size={24} aria-hidden="true" />
                      <h3>No items match these filters</h3>
                      <p>Try another search or reset the current filters.</p>
                      <button type="button" className="button ghost" onClick={resetFilters}>
                        Reset filters
                      </button>
                    </div>
                  )}
                </div>
                <aside className="inventory-details-region" aria-label="Selected item details">
                  {detailsProps ? (
                    <InventoryItemDetails headingId={detailsHeadingId} {...detailsProps} />
                  ) : (
                    <div className="inventory-selection-empty">
                      <div className="inventory-selection-empty-icon">
                        <PackageOpen size={22} aria-hidden="true" />
                      </div>
                      <div className="eyebrow">Selected item</div>
                      <h3>Select an item</h3>
                      <p>
                        Choose a stack from the bank to inspect its source, bonuses, and actions.
                      </p>
                    </div>
                  )}
                </aside>
              </div>
            )}
          </section>
        </UiPanelSlot>
      </div>
      {compactViewport && detailsProps && (
        <InventoryDetailsDrawer
          open={mobileDetailsOpen}
          headingId={drawerHeadingId}
          returnFocusRef={returnFocusRef}
          onClose={() => setMobileDetailsOpen(false)}
          {...detailsProps}
        />
      )}
      {confirmation && (
        <ConfirmDialog
          title={confirmation.title}
          message={confirmation.message}
          confirmLabel={confirmation.confirmLabel}
          cancelLabel={confirmation.cancelLabel}
          danger={confirmation.danger}
          onCancel={() => setConfirmation(null)}
          onConfirm={() => {
            const action = confirmation.onConfirm;
            setConfirmation(null);
            void action();
          }}
        />
      )}
      <span className="visually-hidden" aria-live="polite">
        {filter === 'all'
          ? 'Showing all inventory groups'
          : `Showing ${getInventoryFilterLabel(filter)}`}
      </span>
    </>
  );
}
