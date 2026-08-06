import { PackageOpen, Search, X } from 'lucide-react';
import type { DragEvent, MouseEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GAME_CONFIG } from '../config/gameConfig';
import { itemById } from '../content/items';
import type { GameState, InventoryStack, ScreenId } from '../game/types';
import { useGameStore } from '../game/state/gameStore';
import { occupiedSlots } from '../game/systems/inventorySystem';
import { ConfirmDialog, type ConfirmDialogOptions } from './ConfirmDialog';
import { InventoryDetailsDrawer } from './InventoryDetailsDrawer';
import { InventoryItemCard } from './InventoryItemCard';
import { InventoryItemDetails } from './InventoryItemDetails';
import {
  INVENTORY_SORT_MODES,
  getInventoryCardDropPosition,
  isInventorySortMode,
  reconcileManualOrder,
  reorderVisibleSubset,
  sortInventoryStacks,
  type InventoryDropPosition,
  type InventorySortMode,
} from './inventoryOrdering';
import { loadInventoryViewPreferences, saveInventoryViewPreferences } from './inventoryPreferences';
import {
  getInventoryGroupCounts,
  getInventoryFilterLabel,
  getInventoryResultLabel,
  getInventoryStackGroups,
  getVisibleInventoryStacks,
  INVENTORY_FILTERS,
  type InventoryFilter,
} from './inventoryView';
import type { InventoryViewPreferences } from './inventoryOrderingPreferences';
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
  const [viewPreferences, setViewPreferences] = useState<InventoryViewPreferences>(() =>
    loadInventoryViewPreferences(game.profileId),
  );
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    itemId: string;
    position: InventoryDropPosition;
  } | null>(null);
  const [compactViewport, setCompactViewport] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(UI_EDITOR_COMPACT_QUERY).matches
      : false,
  );
  const cardRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const suppressNextCardClickRef = useRef(false);
  const suppressNextCardClickTimerRef = useRef<number | null>(null);
  const preferenceProfileRef = useRef(game.profileId);
  const skipPreferencePersistRef = useRef(false);
  const equip = useGameStore((store) => store.equip);
  const destroy = useGameStore((store) => store.destroy);
  const toggleLock = useGameStore((store) => store.toggleLock);

  const clearDragState = useCallback(() => {
    setDraggedItemId(null);
    setDropTarget(null);
  }, []);

  const clearClickSuppression = useCallback(() => {
    suppressNextCardClickRef.current = false;
    if (suppressNextCardClickTimerRef.current !== null) {
      if (typeof window !== 'undefined') {
        window.clearTimeout(suppressNextCardClickTimerRef.current);
      }
      suppressNextCardClickTimerRef.current = null;
    }
  }, []);

  const markCompletedDrag = useCallback(() => {
    clearClickSuppression();
    suppressNextCardClickRef.current = true;
    if (typeof window !== 'undefined') {
      suppressNextCardClickTimerRef.current = window.setTimeout(() => {
        suppressNextCardClickRef.current = false;
        suppressNextCardClickTimerRef.current = null;
      }, 0);
    }
  }, [clearClickSuppression]);

  useEffect(() => () => clearClickSuppression(), [clearClickSuppression]);

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

  useEffect(() => {
    if (preferenceProfileRef.current === game.profileId) return;
    preferenceProfileRef.current = game.profileId;
    skipPreferencePersistRef.current = true;
    setViewPreferences(loadInventoryViewPreferences(game.profileId));
    setSelectedItemId(null);
    setMobileDetailsOpen(false);
    clearDragState();
    clearClickSuppression();
  }, [clearClickSuppression, clearDragState, game.profileId]);

  useEffect(() => {
    if (skipPreferencePersistRef.current) {
      skipPreferencePersistRef.current = false;
      return;
    }
    if (preferenceProfileRef.current === game.profileId) {
      saveInventoryViewPreferences(game.profileId, viewPreferences);
    }
  }, [game.profileId, viewPreferences]);

  const updateViewPreferences = (
    update: (current: InventoryViewPreferences) => InventoryViewPreferences,
  ) => {
    setViewPreferences((current) => {
      const next = update(current);
      const unchanged =
        next.sortMode === current.sortMode &&
        next.sortDirection === current.sortDirection &&
        next.lastAutoSortMode === current.lastAutoSortMode &&
        next.manualOrder.length === current.manualOrder.length &&
        next.manualOrder.every((itemId, index) => itemId === current.manualOrder[index]);
      return unchanged ? current : next;
    });
  };

  const groupCounts = useMemo(
    () => getInventoryGroupCounts(game.inventory, itemById),
    [game.inventory],
  );
  const currentInventoryIds = useMemo(
    () => game.inventory.filter((stack) => stack.quantity > 0).map((stack) => stack.itemId),
    [game.inventory],
  );
  const reconciledManualOrder = useMemo(
    () => reconcileManualOrder(viewPreferences.manualOrder, currentInventoryIds),
    [currentInventoryIds, viewPreferences.manualOrder],
  );
  const orderedStacks = useMemo(
    () =>
      sortInventoryStacks(
        game.inventory,
        itemById,
        viewPreferences.sortMode,
        viewPreferences.sortDirection,
        reconciledManualOrder,
      ),
    [
      game.inventory,
      reconciledManualOrder,
      viewPreferences.sortDirection,
      viewPreferences.sortMode,
    ],
  );
  const visibleStacks = useMemo(
    () => getVisibleInventoryStacks(orderedStacks, itemById, filter, query),
    [filter, orderedStacks, query],
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
  const dragEnabled = !compactViewport && viewPreferences.sortMode === 'manual' && !confirmation;
  const selectedSortLabel =
    INVENTORY_SORT_MODES.find((mode) => mode.id === viewPreferences.sortMode)?.label ?? 'Category';
  const directionLabel =
    viewPreferences.sortMode === 'quantity'
      ? viewPreferences.sortDirection === 'asc'
        ? 'Low-High'
        : 'High-Low'
      : viewPreferences.sortMode === 'name'
        ? viewPreferences.sortDirection === 'asc'
          ? 'A-Z'
          : 'Z-A'
        : viewPreferences.sortDirection === 'asc'
          ? 'Ascending'
          : 'Descending';
  const categoryGroups = useMemo(
    () =>
      viewPreferences.sortMode === 'category'
        ? getInventoryStackGroups(visibleStacks, itemById)
        : [],
    [viewPreferences.sortMode, visibleStacks],
  );

  useEffect(() => {
    if (viewPreferences.sortMode !== 'manual') return;
    if (
      reconciledManualOrder.every(
        (itemId, index) => itemId === viewPreferences.manualOrder[index],
      ) &&
      reconciledManualOrder.length === viewPreferences.manualOrder.length
    )
      return;
    updateViewPreferences((current) => ({ ...current, manualOrder: reconciledManualOrder }));
  }, [reconciledManualOrder, viewPreferences.manualOrder, viewPreferences.sortMode]);

  useEffect(() => {
    if (!draggedItemId) return undefined;
    const cancelDrag = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      clearDragState();
    };
    window.addEventListener('keydown', cancelDrag);
    return () => window.removeEventListener('keydown', cancelDrag);
  }, [clearDragState, draggedItemId]);

  useEffect(() => {
    if (dragEnabled) return;
    clearDragState();
  }, [clearDragState, dragEnabled]);

  useEffect(() => {
    if (!selectedItemId || selectedStack) return;
    const nextStack = visibleStacks[0];
    setSelectedItemId(nextStack?.itemId ?? null);
    if (!nextStack) setMobileDetailsOpen(false);
  }, [selectedItemId, selectedStack, visibleStacks]);

  const selectItem = (itemId: string, event: MouseEvent<HTMLButtonElement>) => {
    if (suppressNextCardClickRef.current && event.detail > 0) {
      clearClickSuppression();
      return;
    }
    returnFocusRef.current = cardRefs.current[itemId];
    setSelectedItemId(itemId);
    setMobileDetailsOpen(true);
  };

  const resetFilters = () => {
    setQuery('');
    setFilter('all');
  };

  const snapshotDisplayedOrder = () =>
    orderedStacks.filter((stack) => stack.quantity > 0).map((stack) => stack.itemId);

  const selectSortMode = (mode: InventorySortMode) => {
    if (mode === 'manual') {
      updateViewPreferences((current) => ({
        ...current,
        sortMode: 'manual',
        manualOrder: snapshotDisplayedOrder(),
      }));
      return;
    }
    updateViewPreferences((current) => ({
      ...current,
      sortMode: mode,
      lastAutoSortMode: mode,
    }));
  };

  const toggleAutoSort = (enabled: boolean) => {
    if (enabled && viewPreferences.sortMode === 'manual') {
      const mode = viewPreferences.lastAutoSortMode ?? 'category';
      updateViewPreferences((current) => ({ ...current, sortMode: mode, lastAutoSortMode: mode }));
      return;
    }
    if (!enabled && viewPreferences.sortMode !== 'manual') {
      updateViewPreferences((current) => ({
        ...current,
        sortMode: 'manual',
        manualOrder: snapshotDisplayedOrder(),
      }));
    }
  };

  const handleDragStart = (event: DragEvent<HTMLButtonElement>, itemId: string) => {
    if (!dragEnabled) return;
    clearClickSuppression();
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', itemId);
    setDraggedItemId(itemId);
    setDropTarget(null);
  };

  const handleDragOver = (event: DragEvent<HTMLButtonElement>, itemId: string) => {
    if (!dragEnabled || !draggedItemId || draggedItemId === itemId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const position = getInventoryCardDropPosition(
      event.currentTarget.getBoundingClientRect(),
      event.clientX,
    );
    setDropTarget((current) =>
      current?.itemId === itemId && current.position === position ? current : { itemId, position },
    );
  };

  const handleDrop = (event: DragEvent<HTMLButtonElement>, targetId: string) => {
    const sourceId = draggedItemId || event.dataTransfer.getData('text/plain');
    if (!dragEnabled || !sourceId || sourceId === targetId) {
      clearDragState();
      return;
    }
    event.preventDefault();
    const position = getInventoryCardDropPosition(
      event.currentTarget.getBoundingClientRect(),
      event.clientX,
    );
    const nextOrder = reorderVisibleSubset(
      reconciledManualOrder,
      visibleStacks.map((stack) => stack.itemId),
      sourceId,
      targetId,
      position,
    );
    updateViewPreferences((current) => ({ ...current, manualOrder: nextOrder }));
    markCompletedDrag();
    clearDragState();
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

  const renderInventoryCards = (stacks: InventoryStack[]) => (
    <div className="inventory-grid inventory-bank-grid" aria-label="Inventory items">
      {stacks.map((stack) => (
        <InventoryItemCard
          key={stack.itemId}
          stack={stack}
          item={itemById[stack.itemId]}
          selected={stack.itemId === selectedItemId}
          onSelect={selectItem}
          dragEnabled={dragEnabled}
          isDragSource={stack.itemId === draggedItemId}
          dropPosition={dropTarget?.itemId === stack.itemId ? dropTarget.position : undefined}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDragEnd={clearDragState}
          cardRef={(element) => {
            cardRefs.current[stack.itemId] = element;
          }}
        />
      ))}
    </div>
  );

  return (
    <>
      <ScreenHeading
        eyebrow="Character · Storage"
        title="Inventory"
        description="Materials, equipment, and trophies gathered across the frontier."
      />
      <div className="ui-panel-grid inventory-panel-grid" data-ui-panel-grid="inventory">
        <UiPanelSlot screen="inventory" id="inventoryToolbar" layout={uiLayout}>
          <section
            className="panel panel-pad inventory-toolbar-panel"
            aria-labelledby="inventory-toolbar-title"
          >
            <h2 className="visually-hidden" id="inventory-toolbar-title">
              Inventory search and filters
            </h2>
            <div className="inventory-toolbar-main">
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
                    className={`inventory-filter ${filter === option.id ? 'is-active' : ''} ${count === 0 ? 'is-empty' : ''}`}
                    key={option.id}
                    aria-pressed={filter === option.id}
                    onClick={() => setFilter(option.id)}
                  >
                    <span>{option.label}</span>
                    <small className="inventory-filter-count">{count}</small>
                  </button>
                );
              })}
            </div>
          </section>
        </UiPanelSlot>
        <UiPanelSlot screen="inventory" id="inventoryBank" layout={uiLayout}>
          <section
            className="panel panel-pad inventory-bank-panel"
            aria-labelledby="inventory-bank-title"
          >
            <div className="inventory-bank-heading">
              <div className="inventory-bank-heading-main">
                <h2 id="inventory-bank-title">Item Bank</h2>
                <span className="inventory-bank-count">
                  {hasInventory
                    ? getInventoryResultLabel(visibleStacks.length, filter, query)
                    : 'No occupied stacks'}
                </span>
              </div>
              <div className="inventory-bank-controls" aria-label="Inventory ordering controls">
                <label className="inventory-sort-control">
                  <span>Sort:</span>
                  <select
                    className="field"
                    aria-label="Sort inventory"
                    value={viewPreferences.sortMode}
                    onChange={(event) => {
                      const mode = event.target.value;
                      if (isInventorySortMode(mode)) selectSortMode(mode);
                    }}
                  >
                    {INVENTORY_SORT_MODES.map((mode) => (
                      <option value={mode.id} key={mode.id}>
                        {mode.label}
                      </option>
                    ))}
                  </select>
                </label>
                {viewPreferences.sortMode !== 'manual' && (
                  <button
                    type="button"
                    className="button ghost inventory-sort-direction"
                    aria-label={`${selectedSortLabel} ${directionLabel}`}
                    title={`${selectedSortLabel}: ${directionLabel}`}
                    onClick={() =>
                      updateViewPreferences((current) => ({
                        ...current,
                        sortDirection: current.sortDirection === 'asc' ? 'desc' : 'asc',
                      }))
                    }
                  >
                    {directionLabel}
                  </button>
                )}
                <label className="inventory-auto-sort">
                  <input
                    type="checkbox"
                    aria-label="Auto Sort"
                    checked={viewPreferences.sortMode !== 'manual'}
                    onChange={(event) => toggleAutoSort(event.target.checked)}
                  />
                  <span className="inventory-switch-track" aria-hidden="true">
                    <span className="inventory-switch-thumb" />
                  </span>
                  <span>Auto Sort</span>
                </label>
              </div>
            </div>
            {viewPreferences.sortMode === 'manual' && !compactViewport && (
              <p className="inventory-manual-hint">
                Manual ordering active - drag cards to rearrange.
              </p>
            )}
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
                    viewPreferences.sortMode === 'category' ? (
                      <div className="inventory-category-groups">
                        {categoryGroups.map((group) => (
                          <section className="inventory-category-group" key={group.id}>
                            <div className="inventory-category-heading">
                              <h3>{group.label}</h3>
                              <span>{group.stacks.length} stacks</span>
                            </div>
                            {renderInventoryCards(group.stacks)}
                          </section>
                        ))}
                      </div>
                    ) : (
                      renderInventoryCards(visibleStacks)
                    )
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
