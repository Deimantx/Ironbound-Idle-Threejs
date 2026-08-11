import { useState } from 'react';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import { ITEMS, itemById } from '../../content/items';
import {
  debugAddItem,
  debugClearInventory,
  debugDiscoverAllItems,
  debugFillInventory,
  debugForceAddIgnoringCapacity,
  debugForceLargeStackQuantity,
  debugForceSetQuantity,
  debugRemoveQuantity,
  debugRemoveStack,
  debugResetDiscoveries,
  debugSetAllLocks,
  debugToggleLock,
  parseDebugInteger,
} from '../../game/debug/debugActions';
import { EQUIPMENT_SLOT_LABELS } from '../../game/equipmentSlots';
import type { EquipmentSlot } from '../../game/types';
import { ItemCompactIcon } from '../items/ItemCompactIcon';
import { ItemDetailHeader } from '../items/ItemDetailHeader';
import { ActionButton, Field, Section, labelize, uniqueSorted } from './DebugComponents';
import type { PanelProps } from './debugUiTypes';

export function InventoryPanel({ game, run, confirm }: PanelProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [tier, setTier] = useState('all');
  const [slot, setSlot] = useState('all');
  const [rarity, setRarity] = useState('all');
  const [selectedId, setSelectedId] = useState(ITEMS[0]?.id ?? '');
  const [quantity, setQuantity] = useState('1');
  const [edgeCases, setEdgeCases] = useState(false);
  const categories = uniqueSorted(ITEMS.map((item) => item.category));
  const tiers = uniqueSorted(ITEMS.map((item) => item.tier));
  const slots = uniqueSorted(ITEMS.map((item) => item.slot));
  const rarities = uniqueSorted(ITEMS.map((item) => item.rarity));
  const filtered = ITEMS.filter((item) => {
    const haystack = [
      item.name,
      item.id,
      item.description,
      item.source,
      item.category,
      item.tier,
      item.slot,
      item.rarity,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return (
      haystack.includes(query.toLowerCase()) &&
      (category === 'all' || item.category === category) &&
      (tier === 'all' || item.tier === tier) &&
      (slot === 'all' || item.slot === slot) &&
      (rarity === 'all' || item.rarity === rarity)
    );
  }).sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
  const selected = itemById[selectedId] ?? filtered[0] ?? ITEMS[0];
  const selectedStack = game.inventory.find((stack) => stack.itemId === selected?.id);
  const amount = parseDebugInteger(quantity, 1) ?? 1;
  const selectFirst = (itemId: string) => {
    setSelectedId(itemId);
  };
  return (
    <>
      <Section
        title="Item browser"
        description="Search the live item registry, inspect a stack, and add or remove quantities without bypassing normal Inventory rules."
        className="debug-tools-inventory-browser"
      >
        <div className="debug-tools-search">
          <Search size={15} />
          <input
            aria-label="Search items"
            placeholder="Search items..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="debug-tools-filter-grid">
          <Field label="Category">
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="all">All</option>
              {categories.map((value) => (
                <option key={value} value={value}>
                  {labelize(value)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tier">
            <select value={tier} onChange={(event) => setTier(event.target.value)}>
              <option value="all">All</option>
              {tiers.map((value) => (
                <option key={value} value={value}>
                  {labelize(value)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Slot">
            <select value={slot} onChange={(event) => setSlot(event.target.value)}>
              <option value="all">All</option>
              {slots.map((value) => (
                <option key={value} value={value}>
                  {EQUIPMENT_SLOT_LABELS[value as EquipmentSlot] ?? labelize(value)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Rarity">
            <select value={rarity} onChange={(event) => setRarity(event.target.value)}>
              <option value="all">All</option>
              {rarities.map((value) => (
                <option key={value} value={value}>
                  {labelize(value)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="debug-tools-item-workspace">
          <div className="debug-tools-item-list" aria-label="Registered items">
            {filtered.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`debug-tools-item-row ${selected?.id === item.id ? 'selected' : ''}`}
                onClick={() => selectFirst(item.id)}
              >
                <ItemCompactIcon itemId={item.id} size="sm" />
                <span>
                  <strong>{item.name}</strong>
                  <small>
                    {item.id} · {item.category} · {item.rarity} · {item.tier ?? '—'} ·{' '}
                    {item.slot ? (EQUIPMENT_SLOT_LABELS[item.slot] ?? item.slot) : '—'}
                  </small>
                </span>
              </button>
            ))}
          </div>
          <div className="debug-tools-item-details">
            {selected && (
              <>
                <ItemDetailHeader
                  item={selected}
                  eyebrow="Selected item"
                  metadata={`${selected.id} · ${labelize(selected.category)}`}
                />
                <dl className="debug-tools-definition-list">
                  <div>
                    <dt>Category</dt>
                    <dd>{selected.category}</dd>
                  </div>
                  <div>
                    <dt>Rarity</dt>
                    <dd>{selected.rarity}</dd>
                  </div>
                  <div>
                    <dt>Tier</dt>
                    <dd>{selected.tier ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Slot</dt>
                    <dd>{selected.slot ? EQUIPMENT_SLOT_LABELS[selected.slot] : '—'}</dd>
                  </div>
                  <div>
                    <dt>Current quantity</dt>
                    <dd>{selectedStack?.quantity ?? 0}</dd>
                  </div>
                  <div>
                    <dt>Locked</dt>
                    <dd>{selectedStack?.locked ? 'Yes' : 'No'}</dd>
                  </div>
                </dl>
                <Field label="Quantity">
                  <input
                    aria-label="Quantity"
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                  />
                </Field>
                <div className="button-row">
                  <ActionButton
                    onClick={() => run((state) => debugAddItem(state, selected.id, amount))}
                  >
                    Add to Inventory
                  </ActionButton>
                  <ActionButton
                    onClick={() => run((state) => debugRemoveQuantity(state, selected.id, amount))}
                  >
                    Remove Quantity
                  </ActionButton>
                  <ActionButton
                    danger
                    disabled={!selectedStack}
                    onClick={() =>
                      confirm(
                        {
                          title: 'Remove stack?',
                          message: `Remove the entire ${selected.name} stack?`,
                          confirmLabel: 'Remove stack',
                          danger: true,
                        },
                        () => run((state) => debugRemoveStack(state, selected.id)),
                      )
                    }
                  >
                    Remove Stack
                  </ActionButton>
                  <ActionButton onClick={() => run((state) => debugToggleLock(state, selected.id))}>
                    Toggle Lock
                  </ActionButton>
                </div>
              </>
            )}
          </div>
        </div>
      </Section>
      <Section
        title="Inventory utilities"
        description="Bulk, discovery, and edge-case actions stay grouped here. Destructive operations are confirmed before they change the current profile."
        className="debug-tools-danger-zone"
      >
        <div className="button-row">
          <ActionButton onClick={() => run(debugFillInventory)}>
            Fill with All Current Items
          </ActionButton>
          <ActionButton
            danger
            onClick={() =>
              confirm(
                {
                  title: 'Clear Inventory?',
                  message: 'All Inventory stacks will be cleared. Equipment is not touched.',
                  confirmLabel: 'Clear Inventory',
                  danger: true,
                },
                () => run(debugClearInventory),
              )
            }
          >
            Clear Inventory
          </ActionButton>
          <ActionButton onClick={() => run((state) => debugSetAllLocks(state, true))}>
            Lock All
          </ActionButton>
          <ActionButton onClick={() => run((state) => debugSetAllLocks(state, false))}>
            Unlock All
          </ActionButton>
          <ActionButton onClick={() => run(debugDiscoverAllItems)}>Discover All Items</ActionButton>
          <ActionButton
            danger
            onClick={() =>
              confirm(
                {
                  title: 'Reset discoveries?',
                  message:
                    'Current item discovery state will be cleared; items will remain in Inventory.',
                  confirmLabel: 'Reset discoveries',
                  danger: true,
                },
                () => run(debugResetDiscoveries),
              )
            }
          >
            Reset Discoveries
          </ActionButton>
        </div>
        <button
          type="button"
          className="debug-tools-disclosure"
          aria-expanded={edgeCases}
          onClick={() => setEdgeCases((value) => !value)}
        >
          {edgeCases ? <ChevronUp size={15} /> : <ChevronDown size={15} />} Edge Cases
        </button>
        {edgeCases && (
          <div className="debug-tools-edge-grid">
            <ActionButton
              danger
              disabled={!selected}
              onClick={() =>
                confirm(
                  {
                    title: 'Force add ignoring capacity?',
                    message: 'This can intentionally exceed normal capacity rules.',
                    confirmLabel: 'Force add',
                    danger: true,
                  },
                  () => run((state) => debugForceAddIgnoringCapacity(state, selected.id, amount)),
                )
              }
            >
              Force Add Ignoring Capacity
            </ActionButton>
            <ActionButton
              danger
              disabled={!selected}
              onClick={() =>
                confirm(
                  {
                    title: 'Force set quantity?',
                    message: 'This bypasses normal capacity rules.',
                    confirmLabel: 'Force set',
                    danger: true,
                  },
                  () => run((state) => debugForceSetQuantity(state, selected.id, amount)),
                )
              }
            >
              Force Set Quantity
            </ActionButton>
            <ActionButton
              disabled={!selectedStack}
              onClick={() =>
                confirm(
                  {
                    title: 'Force large stack quantity?',
                    message:
                      'Set this item to a large quantity for stack-size testing. This does not increase occupied slots.',
                    confirmLabel: 'Force quantity',
                    danger: true,
                  },
                  () => run((state) => debugForceLargeStackQuantity(state, selected.id)),
                )
              }
            >
              Force Large Stack Quantity
            </ActionButton>
          </div>
        )}
      </Section>
    </>
  );
}
