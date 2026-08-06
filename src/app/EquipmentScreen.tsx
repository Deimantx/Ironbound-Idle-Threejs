import { Lock, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { itemById } from '../content/items';
import { getDerivedStats } from '../game/formulas/statFormulas';
import {
  ACTIVE_EQUIPMENT_SLOTS,
  FUTURE_EQUIPMENT_SLOTS,
  type ActiveEquipmentSlot,
  getEquipmentSlotLabel,
} from '../game/equipmentSlots';
import type { GameState, ItemDefinition, ScreenId } from '../game/types';
import { useGameStore } from '../game/state/gameStore';
import {
  getCompatibleEquipmentStacks,
  getDerivedStatComparison,
  getEquipmentBonusComparison,
  getEquipmentPreviewState,
} from './equipmentView';
import { formatNumber } from './formatters';
import { getInventoryValueLabel } from './inventoryView';
import { ItemIcon } from './ItemIcon';
import { ScreenHeading } from './ScreenHeading';
import { UiPanelSlot } from './UiPanelSlot';
import type { UiLayout } from './uiLayout';

export interface EquipmentScreenProps {
  game: GameState;
  uiLayout: UiLayout;
  onNavigate: (screen: ScreenId) => void;
}

const getDefaultSlot = (game: GameState): ActiveEquipmentSlot => {
  if (game.equipment.weapon) return 'weapon';
  return ACTIVE_EQUIPMENT_SLOTS.find((slot) => game.equipment[slot]) ?? 'weapon';
};

const formatBonus = (key: string, value: number): string =>
  key === 'speed'
    ? `${value >= 0 ? '+' : ''}${Math.round(value * 100)}%`
    : `${value >= 0 ? '+' : ''}${value}`;

const formatBonusDelta = (key: string, value: number): string =>
  key === 'speed'
    ? `${value > 0 ? '+' : ''}${Math.round(value * 100)}%`
    : `${value > 0 ? '+' : ''}${value}`;

function ItemSummary({
  heading,
  item,
  itemId,
  quantity,
}: {
  heading: string;
  item?: ItemDefinition;
  itemId?: string;
  quantity?: number;
}) {
  return (
    <div className="equipment-item-summary">
      <div className="equipment-item-summary-heading">
        <ItemIcon itemId={item?.id ?? itemId} size="md" />
        <div className="equipment-item-summary-title">
          <div className="eyebrow">{heading}</div>
          <strong>{item?.name ?? (itemId ? 'Unknown item' : 'Empty')}</strong>
          {item && (
            <small>
              {getInventoryValueLabel(item.rarity)}
              {item.tier ? ` · ${getInventoryValueLabel(item.tier)}` : ''}
              {quantity !== undefined ? ` · ×${formatNumber(quantity)}` : ''}
            </small>
          )}
        </div>
      </div>
      {item && (
        <div className="equipment-item-bonus-list">
          {Object.entries(item.bonuses ?? {})
            .filter(([, value]) => value !== 0)
            .map(([key, value]) => (
              <span key={key}>
                {getInventoryValueLabel(key)} {formatBonus(key, value as number)}
              </span>
            ))}
        </div>
      )}
    </div>
  );
}

const formatStatValue = (
  id: ReturnType<typeof getDerivedStatComparison>[number]['id'],
  value: number,
): string => {
  if (id === 'attackIntervalMs') return `${(value / 1000).toFixed(1)}s`;
  if (id === 'miningIntervalMultiplier') return `${Math.round((1 - value) * 100)}% faster`;
  return String(Math.round(value));
};

const formatStatDelta = (
  id: ReturnType<typeof getDerivedStatComparison>[number]['id'],
  current: number,
  candidate: number,
): string => {
  if (candidate === current) return 'No change';
  if (id === 'attackIntervalMs') {
    const delta = (candidate - current) / 1000;
    return `${delta > 0 ? '+' : ''}${delta.toFixed(1)}s`;
  }
  if (id === 'miningIntervalMultiplier') {
    const delta = (current - candidate) * 100;
    return `${delta > 0 ? '+' : ''}${Math.round(delta)}% faster`;
  }
  const delta = candidate - current;
  return `${delta > 0 ? '+' : ''}${Math.round(delta)}`;
};

function EquipmentStatRows({
  game,
  selectedSlot,
  candidateId,
}: {
  game: GameState;
  selectedSlot: ActiveEquipmentSlot;
  candidateId: string | null;
}) {
  const currentStats = getDerivedStats(game);
  const previewStats = candidateId
    ? getDerivedStats(getEquipmentPreviewState(game, selectedSlot, candidateId))
    : null;
  const rows = getDerivedStatComparison(currentStats, previewStats ?? currentStats);
  return (
    <div className="equipment-stat-section">
      <div className="eyebrow">Combat and gathering</div>
      {rows.map((row) => {
        const hasPreview = Boolean(previewStats);
        const deltaClass =
          row.delta === 0
            ? 'equipment-delta-neutral'
            : row.beneficial
              ? 'equipment-delta-positive'
              : 'equipment-delta-negative';
        return (
          <div className="equipment-stat-comparison-row" key={row.id}>
            <span>{row.label}</span>
            <strong>{formatStatValue(row.id, row.current)}</strong>
            {hasPreview && (
              <>
                <span aria-hidden="true">→</span>
                <strong>{formatStatValue(row.id, row.candidate)}</strong>
                <span
                  className={deltaClass}
                  aria-label={formatStatDelta(row.id, row.current, row.candidate)}
                >
                  {formatStatDelta(row.id, row.current, row.candidate)}
                </span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function EquipmentScreen({ game, uiLayout, onNavigate }: EquipmentScreenProps) {
  const equip = useGameStore((store) => store.equip);
  const unequip = useGameStore((store) => store.unequip);
  const [selectedSlot, setSelectedSlot] = useState<ActiveEquipmentSlot>(() => getDefaultSlot(game));
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const profileIdRef = useRef(game.profileId);

  const compatibleStacks = useMemo(
    () => getCompatibleEquipmentStacks(game.inventory, itemById, selectedSlot),
    [game.inventory, selectedSlot],
  );
  const currentItemId = game.equipment[selectedSlot];
  const currentItem = currentItemId ? itemById[currentItemId] : undefined;
  const selectedCandidate = compatibleStacks.find((stack) => stack.itemId === selectedCandidateId);
  const candidateItem = selectedCandidate ? itemById[selectedCandidate.itemId] : undefined;

  useEffect(() => {
    if (selectedCandidateId && !selectedCandidate) setSelectedCandidateId(null);
  }, [selectedCandidate, selectedCandidateId]);

  useEffect(() => {
    if (profileIdRef.current === game.profileId) return;
    profileIdRef.current = game.profileId;
    setSelectedSlot(getDefaultSlot(game));
    setSelectedCandidateId(null);
  }, [game]);

  const bonusComparison = candidateItem
    ? getEquipmentBonusComparison(currentItem, candidateItem)
    : [];
  const currentSpecial = selectedSlot === 'weapon' ? currentItem?.specialAttack : undefined;
  const candidateSpecial = selectedSlot === 'weapon' ? candidateItem?.specialAttack : undefined;

  const selectSlot = (slot: ActiveEquipmentSlot): void => {
    setSelectedSlot(slot);
    setSelectedCandidateId(null);
  };

  return (
    <>
      <ScreenHeading
        eyebrow="Character · Loadout"
        title="Equipment"
        description="Equip forged gear, compare upgrades, and shape your combat statistics."
        trailing={<span className="badge gold">5 active slots</span>}
      />
      <div className="ui-panel-grid equipment-panel-grid" data-ui-panel-grid="equipment">
        <UiPanelSlot screen="equipment" id="equipmentLoadout" layout={uiLayout}>
          <section
            className="panel panel-pad equipment-loadout-shell"
            aria-labelledby="equipment-loadout-title"
          >
            <div className="eyebrow">Character loadout</div>
            <h2 id="equipment-loadout-title">Active equipment</h2>
            <div className="equipment-slot-layout">
              {ACTIVE_EQUIPMENT_SLOTS.map((slot) => {
                const itemId = game.equipment[slot];
                const item = itemId ? itemById[itemId] : undefined;
                const selected = selectedSlot === slot;
                return (
                  <button
                    type="button"
                    className={`equipment-slot-card slot-${slot} ${selected ? 'equipment-slot-selected' : ''} ${!itemId ? 'equipment-slot-empty' : ''}`}
                    key={slot}
                    onClick={() => selectSlot(slot)}
                    title={`Select ${getEquipmentSlotLabel(slot)}`}
                    aria-label={`${getEquipmentSlotLabel(slot)} slot${item ? `, ${item.name}` : ', empty'}`}
                    aria-pressed={selected}
                  >
                    <strong>{getEquipmentSlotLabel(slot)}</strong>
                    {item ? (
                      <>
                        <span className="equipment-item-icon">
                          <ItemIcon itemId={item.id} size="md" />
                        </span>
                        <small>{item.name}</small>
                      </>
                    ) : (
                      <span className="empty-slot">Empty</span>
                    )}
                  </button>
                );
              })}
            </div>
            <section className="equipment-future-slots" aria-labelledby="future-slots-title">
              <div className="eyebrow" id="future-slots-title">
                Future slots
              </div>
              <div className="equipment-future-slot-list">
                {FUTURE_EQUIPMENT_SLOTS.map((slot) => (
                  <span className="badge locked" key={slot} aria-disabled="true">
                    <Lock size={10} aria-hidden="true" /> {getEquipmentSlotLabel(slot)} · Locked
                  </span>
                ))}
              </div>
            </section>

            <section className="equipment-selected-slot" aria-labelledby="selected-slot-title">
              <div className="eyebrow">Selected slot</div>
              <h2 id="selected-slot-title">{getEquipmentSlotLabel(selectedSlot)}</h2>
              <div className="equipment-inspection-grid">
                <ItemSummary
                  heading="Currently equipped"
                  item={currentItem}
                  itemId={currentItemId}
                />
                {candidateItem && (
                  <ItemSummary
                    heading="Selected upgrade"
                    item={candidateItem}
                    quantity={selectedCandidate?.quantity}
                  />
                )}
              </div>
              <div className="button-row equipment-action-row">
                {candidateItem && (
                  <button
                    type="button"
                    className="button primary"
                    onClick={() => equip(candidateItem.id)}
                  >
                    {currentItem ? `Replace ${currentItem.name}` : 'Equip'}
                  </button>
                )}
                {currentItemId && (
                  <button
                    type="button"
                    className="button ghost"
                    onClick={() => unequip(selectedSlot)}
                  >
                    Unequip
                  </button>
                )}
              </div>
            </section>

            <section className="equipment-compatible-bank" aria-labelledby="compatible-gear-title">
              <div className="split equipment-section-heading">
                <div>
                  <div className="eyebrow">Compatible inventory</div>
                  <h2 id="compatible-gear-title">Choose gear to inspect</h2>
                </div>
                <span className="muted">
                  {compatibleStacks.length} stack{compatibleStacks.length === 1 ? '' : 's'}
                </span>
              </div>
              {compatibleStacks.length > 0 ? (
                <div className="equipment-candidate-grid">
                  {compatibleStacks.map((stack) => {
                    const item = itemById[stack.itemId];
                    const selected = selectedCandidateId === stack.itemId;
                    return (
                      <button
                        type="button"
                        className={`equipment-candidate-card ${selected ? 'is-selected' : ''} ${stack.locked ? 'is-locked' : ''}`}
                        key={stack.itemId}
                        onClick={() => setSelectedCandidateId(stack.itemId)}
                        aria-pressed={selected}
                        aria-label={`Inspect ${item?.name ?? 'Unknown item'}, quantity ${stack.quantity}${stack.locked ? ', locked' : ''}`}
                      >
                        <ItemIcon itemId={stack.itemId} size="sm" />
                        <span>
                          <strong>{item?.name ?? 'Unknown item'}</strong>
                          <small>
                            ×{formatNumber(stack.quantity)}
                            {stack.locked ? ' · Locked' : ''}
                          </small>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="equipment-empty-compatible">
                  <p>No compatible items in Inventory</p>
                  <small>
                    Forge or collect equipment for this slot, then return here to compare it.
                  </small>
                  <button
                    type="button"
                    className="button ghost"
                    onClick={() => onNavigate('inventory')}
                  >
                    Open Inventory
                  </button>
                </div>
              )}
            </section>
          </section>
        </UiPanelSlot>
        <UiPanelSlot screen="equipment" id="equipmentStats" layout={uiLayout}>
          <section
            className="panel panel-pad equipment-comparison"
            aria-labelledby="equipment-stats-title"
          >
            <div className="eyebrow">Character statistics</div>
            <h2 id="equipment-stats-title">Derived statistics</h2>
            <EquipmentStatRows
              game={game}
              selectedSlot={selectedSlot}
              candidateId={candidateItem?.id ?? null}
            />

            {candidateItem && (
              <section className="equipment-stat-section" aria-labelledby="bonus-comparison-title">
                <div className="eyebrow" id="bonus-comparison-title">
                  Item bonus comparison
                </div>
                {bonusComparison.length > 0 ? (
                  bonusComparison.map((row) => {
                    const deltaClass =
                      row.delta === 0
                        ? 'equipment-delta-neutral'
                        : row.delta > 0
                          ? 'equipment-delta-positive'
                          : 'equipment-delta-negative';
                    const delta =
                      row.delta === 0 ? 'No change' : formatBonusDelta(row.id, row.delta);
                    return (
                      <div className="equipment-stat-comparison-row" key={row.id}>
                        <span>{row.label}</span>
                        <strong>{formatBonus(row.id, row.current)}</strong>
                        <span aria-hidden="true">→</span>
                        <strong>{formatBonus(row.id, row.candidate)}</strong>
                        <span className={deltaClass}>{delta}</span>
                      </div>
                    );
                  })
                ) : (
                  <p className="subtle">No bonus changes between these items.</p>
                )}
              </section>
            )}

            {selectedSlot === 'weapon' && (
              <section
                className="equipment-stat-section equipment-special-comparison"
                aria-labelledby="special-comparison-title"
              >
                <div className="eyebrow" id="special-comparison-title">
                  <Sparkles size={13} /> Special attacks
                </div>
                <div className="equipment-comparison-columns">
                  <div>
                    <small>Current Special</small>
                    <strong>{currentSpecial?.name ?? 'No special attack'}</strong>
                    {currentSpecial && <p>{currentSpecial.description}</p>}
                  </div>
                  {candidateItem && (
                    <div>
                      <small>Candidate Special</small>
                      <strong>{candidateSpecial?.name ?? 'No special attack'}</strong>
                      {candidateSpecial && <p>{candidateSpecial.description}</p>}
                    </div>
                  )}
                </div>
              </section>
            )}

            {!candidateItem && (
              <p className="subtle equipment-stats-hint">
                Select compatible inventory gear to preview its bonuses and derived-stat changes.
              </p>
            )}
          </section>
        </UiPanelSlot>
      </div>
    </>
  );
}
