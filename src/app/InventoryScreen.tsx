import { useState } from 'react';
import { Lock } from 'lucide-react';
import { GAME_CONFIG } from '../config/gameConfig';
import { itemById } from '../content/items';
import type { GameState, ScreenId } from '../game/types';
import { useGameStore } from '../game/state/gameStore';
import { occupiedSlots } from '../game/systems/inventorySystem';
import { ConfirmDialog, type ConfirmDialogOptions } from './ConfirmDialog';
import { ItemIcon } from './ItemIcon';
import { formatNumber } from './formatters';
import { ScreenHeading } from './ScreenHeading';
import { UiPanelSlot } from './UiPanelSlot';
import type { UiLayout } from './uiLayout';

export interface InventoryScreenProps {
  game: GameState;
  uiLayout: UiLayout;
  onNavigate: (screen: ScreenId) => void;
}

export function InventoryScreen({ game, uiLayout, onNavigate }: InventoryScreenProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [selected, setSelected] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmDialogOptions | null>(null);
  const equip = useGameStore((store) => store.equip);
  const destroy = useGameStore((store) => store.destroy);
  const toggleLock = useGameStore((store) => store.toggleLock);
  const entries = game.inventory.filter((stack) => {
    const item = itemById[stack.itemId];
    return (
      item &&
      (category === 'all' || item.category === category) &&
      item.name.toLowerCase().includes(search.toLowerCase())
    );
  });
  const selectedStack = game.inventory.find((stack) => stack.itemId === selected);
  const selectedItem = selectedStack ? itemById[selectedStack.itemId] : undefined;

  return (
    <>
      <ScreenHeading
        eyebrow="The bank"
        title="Inventory"
        description="Every item has a source. Locked stacks are protected from destruction."
        trailing={
          <span className="badge gold">
            {occupiedSlots(game.inventory)} / {GAME_CONFIG.inventorySlots} stacks
          </span>
        }
      />
      <div className="ui-panel-grid inventory-panel-grid" data-ui-panel-grid="inventory">
        <UiPanelSlot screen="inventory" id="inventoryToolbar" layout={uiLayout}>
          <section className="panel panel-pad">
            <div className="filterbar">
              <input
                className="field"
                placeholder="Search items…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <select
                className="select"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                <option value="all">All categories</option>
                {['material', 'bar', 'weapon', 'armor', 'shield', 'tool', 'drop'].map((value) => (
                  <option value={value} key={value}>
                    {value[0].toUpperCase() + value.slice(1)}
                  </option>
                ))}
              </select>
              <button className="button ghost" onClick={() => onNavigate('equipment')}>
                Open equipment
              </button>
            </div>
          </section>
        </UiPanelSlot>
        <UiPanelSlot screen="inventory" id="inventoryBank" layout={uiLayout}>
          <section className="panel panel-pad">
            {entries.length === 0 ? (
              <div className="empty">Your pack is quiet. Mining and combat will change that.</div>
            ) : (
              <div className="inventory-grid">
                {entries.map((stack) => {
                  const item = itemById[stack.itemId];
                  return (
                    <button
                      className="item-card"
                      key={stack.itemId}
                      onClick={() => setSelected(stack.itemId)}
                      aria-label={`View ${item.name}, quantity ${stack.quantity}`}
                    >
                      <ItemIcon itemId={item.id} size="md" />
                      <strong>{item.name}</strong>
                      <small>{item.category}</small>
                      <span className="quantity">×{formatNumber(stack.quantity)}</span>
                      {stack.locked && (
                        <span className="item-card-lock" title="Locked stack">
                          <Lock size={14} aria-hidden="true" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </UiPanelSlot>
      </div>
      {selectedItem && selectedStack && (
        <div className="modal-backdrop" onClick={() => setSelected('')}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="item-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="split">
              <div>
                <div className="eyebrow">{selectedItem.category}</div>
                <h2 id="item-modal-title">{selectedItem.name}</h2>
              </div>
              <button className="button ghost" onClick={() => setSelected('')}>
                Close
              </button>
            </div>
            <p className="subtle">{selectedItem.description}</p>
            <div className="stat-line">
              <span>Quantity</span>
              <strong>{selectedStack.quantity}</strong>
            </div>
            <div className="stat-line">
              <span>Source</span>
              <strong>{selectedItem.source}</strong>
            </div>
            {selectedItem.bonuses &&
              Object.entries(selectedItem.bonuses).map(([key, value]) => (
                <div className="stat-line" key={key}>
                  <span>{key}</span>
                  <strong>+{value}</strong>
                </div>
              ))}
            <div className="button-row" style={{ marginTop: 18 }}>
              {selectedItem.slot && (
                <button
                  className="button primary"
                  onClick={() => {
                    equip(selectedItem.id);
                    setSelected('');
                  }}
                >
                  Equip
                </button>
              )}
              <button className="button ghost" onClick={() => toggleLock(selectedItem.id)}>
                {selectedStack.locked ? 'Unlock stack' : 'Lock stack'}
              </button>
              <button
                className="button danger"
                onClick={() => {
                  setConfirmation({
                    title: 'Destroy item?',
                    message: `Destroy one ${selectedItem.name}? This cannot be undone.`,
                    confirmLabel: 'Destroy one',
                    danger: true,
                    onConfirm: () => {
                      destroy(selectedItem.id, 1);
                      setSelected('');
                    },
                  });
                }}
              >
                Destroy one
              </button>
            </div>
          </section>
        </div>
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
    </>
  );
}
