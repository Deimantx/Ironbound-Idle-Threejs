import {
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { itemById } from '../../../content/items';
import { ArtViewport } from '../../art/ArtViewport';
import { MINING_TUNING } from '../../../config/miningTuning';
import { getMiningToolDefinition } from '../../../content/miningTools';
import { getSmithingHammerDefinition } from '../../../content/smithingTools';
import { getDerivedStats } from '../../../game/formulas/statFormulas';
import {
  ACCESSORY_EQUIPMENT_SLOTS,
  ACTIVE_EQUIPMENT_SLOTS,
  COMBAT_GEAR_MAIN_SLOTS,
  type ActiveEquipmentSlot,
  getEquipmentSlotLabel,
} from '../../../game/equipmentSlots';
import type { GameState, ItemDefinition, ScreenId } from '../../../game/types';
import { useGameStore } from '../../../game/state/gameStore';
import {
  formatEquipmentBonus,
  getCompatibleEquipmentStacks,
  getDerivedStatComparison,
  getEquipmentBonusComparison,
  getEquipmentBonusLabel,
  getEquipmentEmptyState,
  getEquipmentPreviewState,
} from '../../shared/equipmentView';
import { formatNumber } from '../../shared/formatters';
import { getInventoryValueLabel } from '../../shared/inventoryView';
import { ItemCompactIcon } from '../../items/ItemCompactIcon';
import { ItemIcon } from '../../items/ItemIcon';
import { ScreenHeading } from '../../shell/ScreenHeading';
import { UiPanelSlot } from '../../ui-editor/UiPanelSlot';
import { UiPanelGrid } from '../../ui-editor/UiPanelGrid';
import { UiPanelRegionGrid } from '../../ui-editor/UiPanelRegionGrid';
import { UiPanelRegionSlot } from '../../ui-editor/UiPanelRegionSlot';
import { ItemTooltip } from '../../items/ItemTooltip';
import { SpecialAttackDetails } from '../../items/SpecialAttackDetails';
import { EquipmentSlotArt } from '../../art/EquipmentSlotArt';
import {
  formatMiningToolSummary,
  formatSmithingToolSummary,
} from '../../items/itemProfessionPresentation';
import type { UiLayout } from '../../ui-editor/uiLayout';

export interface EquipmentScreenProps {
  game: GameState;
  uiLayout: UiLayout;
  onNavigate: (screen: ScreenId) => void;
}

const getDefaultSlot = (game: GameState): ActiveEquipmentSlot => {
  if (game.equipment.weapon) return 'weapon';
  return ACTIVE_EQUIPMENT_SLOTS.find((slot) => game.equipment[slot]) ?? 'weapon';
};

function ItemSummary({
  heading,
  item,
  itemId,
  quantity,
  scope,
}: {
  heading: string;
  item?: ItemDefinition;
  itemId?: string;
  quantity?: number;
  scope: 'combat' | 'profession';
}) {
  const bonusEntries = Object.entries(item?.bonuses ?? {}).filter(([key, value]) => {
    if (value === 0) return false;
    return scope === 'profession' ? false : key !== 'miningSpeed';
  });
  const content = (
    <div
      className="equipment-item-summary"
      tabIndex={item ? 0 : undefined}
      aria-label={item ? `${heading}: ${item.name}` : undefined}
    >
      <div className="equipment-item-summary-heading">
        <ArtViewport className="equipment-item-summary-viewport">
          <ItemIcon
            itemId={item?.id ?? itemId}
            size="lg"
            framed={false}
            artVariant="item-equipment"
          />
        </ArtViewport>
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
      {bonusEntries.length > 0 && (
        <div className="equipment-item-bonus-list">
          {bonusEntries.map(([key, value]) => (
            <span key={key}>
              {getEquipmentBonusLabel(key)} {formatEquipmentBonus(key, value as number)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
  return item ? <ItemTooltip item={item}>{content}</ItemTooltip> : content;
}

const formatCombatStatValue = (value: number, id: string): string =>
  id === 'attackIntervalMs' ? `${(value / 1000).toFixed(1)}s` : String(Math.round(value));

const formatCombatStatDelta = (id: string, current: number, candidate: number): string => {
  if (candidate === current) return 'No change';
  if (id === 'attackIntervalMs') {
    const seconds = Math.abs(candidate - current) / 1000;
    return candidate < current ? `${seconds.toFixed(1)}s faster` : `+${seconds.toFixed(1)}s slower`;
  }
  const delta = Math.round(candidate - current);
  return `${delta > 0 ? '+' : ''}${delta}`;
};

const CONTENT_BEARING_SLOTS = new Set<ActiveEquipmentSlot>([
  'head',
  'armor',
  'weapon',
  'offhand',
  'tool',
]);

function EquipmentSlotCard({
  game,
  slot,
  selected,
  onSelect,
}: {
  game: GameState;
  slot: ActiveEquipmentSlot;
  selected: boolean;
  onSelect: (slot: ActiveEquipmentSlot) => void;
}) {
  const itemId = game.equipment[slot];
  const item = itemId ? itemById[itemId] : undefined;
  const label = getEquipmentSlotLabel(slot);
  return (
    <ItemTooltip item={item} disabled={!item}>
      <button
        type="button"
        className={`equipment-slot-card slot-${slot} ${selected ? 'equipment-slot-selected' : ''} ${!itemId ? 'equipment-slot-empty' : ''}`}
        data-debug-kind="equipment-slot"
        data-debug-slot-id={slot}
        data-debug-item-id={item?.id}
        data-debug-label={item?.name ?? label}
        onClick={() => onSelect(slot)}
        aria-label={`${label} slot${item ? `, ${item.name}` : ', empty'}`}
        aria-pressed={selected}
      >
        <strong>{label}</strong>
        {item ? (
          <>
            <span className="equipment-item-icon">
              <ArtViewport className="equipment-item-viewport">
                <ItemIcon itemId={item.id} size="lg" framed={false} artVariant="item-equipment" />
              </ArtViewport>
            </span>
            <small>{item.name}</small>
          </>
        ) : (
          <>
            <span className="equipment-empty-slot-icon">
              <EquipmentSlotArt slot={slot} />
            </span>
            <span className="empty-slot">Empty</span>
          </>
        )}
      </button>
    </ItemTooltip>
  );
}

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
  const previewStats =
    selectedSlot !== 'tool' && candidateId
      ? getDerivedStats(getEquipmentPreviewState(game, selectedSlot, candidateId))
      : currentStats;
  const rows = getDerivedStatComparison(currentStats, previewStats, 'combat');
  const hasPreview = selectedSlot !== 'tool' && Boolean(candidateId);
  return (
    <div className="equipment-stat-section">
      <div className="eyebrow">Combat statistics</div>
      {rows.map((row) => {
        const deltaClass =
          row.delta === 0
            ? 'equipment-delta-neutral'
            : row.beneficial
              ? 'equipment-delta-positive'
              : 'equipment-delta-negative';
        return (
          <div className="equipment-stat-comparison-row" key={row.id}>
            <span>{row.label}</span>
            <strong>{formatCombatStatValue(row.current, row.id)}</strong>
            {hasPreview && (
              <>
                <span aria-hidden="true">→</span>
                <strong>{formatCombatStatValue(row.candidate, row.id)}</strong>
                <span className={deltaClass}>
                  {formatCombatStatDelta(row.id, row.current, row.candidate)}
                </span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ProfessionBonuses({
  currentTool,
  candidateItem,
  expanded,
  onToggle,
}: {
  currentTool?: ItemDefinition;
  candidateItem?: ItemDefinition;
  expanded: boolean;
  onToggle: () => void;
}) {
  const currentDefinition = getMiningToolDefinition(currentTool?.id) ?? MINING_TUNING.noTool;
  const candidateDefinition = candidateItem
    ? (getMiningToolDefinition(candidateItem.id) ?? MINING_TUNING.noTool)
    : null;
  const currentHammer = getSmithingHammerDefinition(currentTool?.id);
  const candidateHammer = getSmithingHammerDefinition(candidateItem?.id);
  return (
    <section className="equipment-profession-bonuses" aria-labelledby="profession-bonuses-title">
      <button
        type="button"
        className="equipment-profession-toggle"
        aria-expanded={expanded}
        aria-controls="equipment-profession-bonuses"
        onClick={onToggle}
      >
        <span id="profession-bonuses-title">Profession Bonuses</span>
        <ChevronDown className={expanded ? 'is-expanded' : ''} size={15} aria-hidden="true" />
      </button>
      {expanded && (
        <div id="equipment-profession-bonuses" className="equipment-profession-content">
          {!currentTool && !candidateItem ? (
            <p className="subtle">
              No profession tool equipped.
              <br />
              Equip a tool to gain profession-specific bonuses.
            </p>
          ) : (
            <>
              <div className="eyebrow">
                {currentHammer || candidateHammer ? 'Anvil Smithing' : 'Mining'}
              </div>
              <div className="equipment-profession-row">
                <span>{currentTool ? 'Equipped tool' : 'Current tool'}</span>
                <strong>{currentTool?.name ?? 'None'}</strong>
              </div>
              {candidateItem && (
                <div className="equipment-profession-row">
                  <span>Candidate</span>
                  <strong>{candidateItem.name}</strong>
                </div>
              )}
              {currentHammer || candidateHammer ? (
                <>
                  <div className="equipment-profession-row">
                    <span>Hammer effects</span>
                    <strong>
                      {currentHammer
                        ? formatSmithingToolSummary(currentHammer)
                        : 'None'}
                    </strong>
                  </div>
                  <div className="equipment-profession-row">
                    <span>Required Smithing level</span>
                    <strong>
                      {currentHammer?.requiredSmithingLevel ??
                        candidateHammer?.requiredSmithingLevel}
                    </strong>
                  </div>
                  {candidateHammer && (
                    <div className="equipment-profession-improvement">
                      Candidate · {formatSmithingToolSummary(candidateHammer)} · level{' '}
                      {candidateHammer.requiredSmithingLevel}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="equipment-profession-row">
                    <span>Mining stats</span>
                    <strong>{formatMiningToolSummary(currentDefinition)}</strong>
                  </div>
                  <div className="equipment-profession-row">
                    <span>Required Mining level</span>
                    <strong>{currentDefinition.requiredMiningLevel}</strong>
                  </div>
                  {candidateItem && candidateDefinition && (
                    <div className="equipment-profession-improvement">
                      Candidate · {formatMiningToolSummary(candidateDefinition)} · level{' '}
                      {candidateDefinition.requiredMiningLevel}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}

export function EquipmentScreen({ game, uiLayout, onNavigate }: EquipmentScreenProps) {
  const equip = useGameStore((store) => store.equip);
  const unequip = useGameStore((store) => store.unequip);
  const [selectedSlot, setSelectedSlot] = useState<ActiveEquipmentSlot>(() => getDefaultSlot(game));
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [professionExpanded, setProfessionExpanded] = useState(
    () => getDefaultSlot(game) === 'tool',
  );
  const profileIdRef = useRef(game.profileId);
  const statsPanelScale = uiLayout.screenPanels.equipment?.equipmentStats?.scale ?? 1;

  const compatibleStacks = useMemo(
    () => getCompatibleEquipmentStacks(game.inventory, itemById, selectedSlot),
    [game.inventory, selectedSlot],
  );
  const currentItemId = game.equipment[selectedSlot];
  const currentItem = currentItemId ? itemById[currentItemId] : undefined;
  const selectedCandidate = compatibleStacks.find((stack) => stack.itemId === selectedCandidateId);
  const candidateItem = selectedCandidate ? itemById[selectedCandidate.itemId] : undefined;
  const scope = selectedSlot === 'tool' ? 'profession' : 'combat';

  useEffect(() => {
    if (selectedCandidateId && !selectedCandidate) setSelectedCandidateId(null);
  }, [selectedCandidate, selectedCandidateId]);

  useEffect(() => {
    if (selectedSlot !== 'tool' && !game.equipment.tool) setProfessionExpanded(false);
  }, [game.equipment.tool, selectedSlot]);

  useEffect(() => {
    if (profileIdRef.current === game.profileId) return;
    profileIdRef.current = game.profileId;
    const nextSlot = getDefaultSlot(game);
    setSelectedSlot(nextSlot);
    setSelectedCandidateId(null);
    setProfessionExpanded(nextSlot === 'tool');
  }, [game]);

  const selectSlot = (slot: ActiveEquipmentSlot): void => {
    setSelectedSlot(slot);
    setSelectedCandidateId(null);
    if (slot === 'tool') setProfessionExpanded(true);
  };

  const bonusComparison = candidateItem
    ? getEquipmentBonusComparison(currentItem, candidateItem, scope)
    : [];
  const equippedWeapon = game.equipment.weapon ? itemById[game.equipment.weapon] : undefined;
  const currentSpecial = equippedWeapon?.specialAttack;
  const candidateSpecial = selectedSlot === 'weapon' ? candidateItem?.specialAttack : undefined;
  const comparingWeaponSpecials = selectedSlot === 'weapon' && Boolean(candidateItem);
  const showSpecialAttack = Boolean(currentSpecial || candidateSpecial);

  return (
    <>
      <ScreenHeading
        eyebrow="Character · Loadout"
        title="Equipment"
        description="Equip forged gear, compare upgrades, and shape your combat statistics."
      />
      <UiPanelGrid screen="equipment" className="equipment-panel-grid">
        <UiPanelSlot screen="equipment" id="equipmentLoadout" layout={uiLayout}>
          <section
            className="panel panel-pad equipment-loadout-shell"
            aria-labelledby="equipment-loadout-title"
          >
            <div className="eyebrow">Character loadout</div>
            <h2 id="equipment-loadout-title">Active equipment</h2>

            <UiPanelRegionGrid screen="equipment" panelId="equipmentLoadout" layout={uiLayout} className="equipment-loadout-regions">
            <UiPanelRegionSlot screen="equipment" panelId="equipmentLoadout" regionId="equipmentLoadoutCombat" layout={uiLayout}>
            <section className="equipment-combat-section" aria-labelledby="combat-gear-title">
              <div className="equipment-section-heading">
                <div className="eyebrow">Combat Gear</div>
                <h3 id="combat-gear-title" className="visually-hidden">
                  Combat Gear
                </h3>
              </div>
              <div className="equipment-combat-grid">
                {COMBAT_GEAR_MAIN_SLOTS.map((slot) => (
                  <EquipmentSlotCard
                    game={game}
                    slot={slot}
                    selected={selectedSlot === slot}
                    onSelect={selectSlot}
                    key={slot}
                  />
                ))}
              </div>
            </section>
            </UiPanelRegionSlot>

            <UiPanelRegionSlot screen="equipment" panelId="equipmentLoadout" regionId="equipmentLoadoutAccessories" layout={uiLayout}>
            <section className="equipment-accessory-section" aria-labelledby="accessories-title">
              <div className="eyebrow">Accessories</div>
              <h3 id="accessories-title" className="visually-hidden">
                Accessories
              </h3>
              <div className="equipment-accessory-grid">
                {ACCESSORY_EQUIPMENT_SLOTS.map((slot) => (
                  <EquipmentSlotCard
                    game={game}
                    slot={slot}
                    selected={selectedSlot === slot}
                    onSelect={selectSlot}
                    key={slot}
                  />
                ))}
              </div>
            </section>
            </UiPanelRegionSlot>

            <UiPanelRegionSlot screen="equipment" panelId="equipmentLoadout" regionId="equipmentLoadoutProfession" layout={uiLayout}>
            <section
              className="equipment-profession-section"
              aria-labelledby="profession-equipment-title"
            >
              <div className="eyebrow">Profession Equipment</div>
              <h3 id="profession-equipment-title" className="visually-hidden">
                Profession Equipment
              </h3>
              <div className="equipment-tool-grid">
                <div className="equipment-tool-card">
                  <EquipmentSlotCard
                    game={game}
                    slot="tool"
                    selected={selectedSlot === 'tool'}
                    onSelect={selectSlot}
                  />
                </div>
              </div>
            </section>
            </UiPanelRegionSlot>

            <UiPanelRegionSlot screen="equipment" panelId="equipmentLoadout" regionId="equipmentLoadoutInspection" layout={uiLayout}>
            <div className="equipment-loadout-workspace">
              <section
                className="equipment-selected-slot equipment-loadout-inspection"
                aria-labelledby="selected-slot-title"
              >
                <div className="eyebrow">Selected slot</div>
                <h2 id="selected-slot-title">{getEquipmentSlotLabel(selectedSlot)}</h2>
                <div className="equipment-inspection-grid">
                  <ItemSummary
                    heading="Currently equipped"
                    item={currentItem}
                    itemId={currentItemId}
                    scope={scope}
                  />
                  {candidateItem && (
                    <ItemSummary
                      heading="Selected candidate"
                      item={candidateItem}
                      quantity={selectedCandidate?.quantity}
                      scope={scope}
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

              <section
                className="equipment-compatible-bank"
                aria-labelledby="compatible-gear-title"
              >
                <div className="equipment-compatible-heading">
                  <div>
                    <div className="eyebrow">Compatible inventory</div>
                    <h2 id="compatible-gear-title" className="visually-hidden">
                      Compatible inventory
                    </h2>
                  </div>
                  <span className="muted">
                    {compatibleStacks.length} stack{compatibleStacks.length === 1 ? '' : 's'}
                  </span>
                </div>
                {compatibleStacks.length > 0 ? (
                  <>
                    <p className="equipment-compatible-subtitle">
                      Select an item to preview its effects.
                    </p>
                    <div className="equipment-candidate-grid">
                      {compatibleStacks.map((stack) => {
                        const item = itemById[stack.itemId];
                        const selected = selectedCandidateId === stack.itemId;
                        return (
                          <ItemTooltip item={item} key={stack.itemId}>
                            <button
                              type="button"
                              className={`equipment-candidate-card ${selected ? 'is-selected' : ''} ${stack.locked ? 'is-locked' : ''}`}
                              onClick={() => setSelectedCandidateId(stack.itemId)}
                              aria-pressed={selected}
                              aria-label={`Inspect ${item?.name ?? 'Unknown item'}, quantity ${stack.quantity}${stack.locked ? ', locked' : ''}`}
                            >
                              <ItemCompactIcon itemId={stack.itemId} size="sm" />
                              <span>
                                <strong>{item?.name ?? 'Unknown item'}</strong>
                                <small>
                                  ×{formatNumber(stack.quantity)}
                                  {stack.locked ? ' · Locked' : ''}
                                </small>
                              </span>
                            </button>
                          </ItemTooltip>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="equipment-empty-compatible">
                    {(() => {
                      const emptyState = getEquipmentEmptyState(
                        selectedSlot,
                        CONTENT_BEARING_SLOTS.has(selectedSlot),
                      );
                      return (
                        <>
                          <p>{emptyState.message}</p>
                          {emptyState.secondary && <small>{emptyState.secondary}</small>}
                          {emptyState.showOpenInventory && (
                            <button
                              type="button"
                              className="button ghost"
                              onClick={() => onNavigate('inventory')}
                            >
                              Open Inventory
                            </button>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </section>
            </div>
            </UiPanelRegionSlot>
            </UiPanelRegionGrid>
          </section>
        </UiPanelSlot>
        <UiPanelSlot screen="equipment" id="equipmentStats" layout={uiLayout}>
          <section
            className={`panel panel-pad equipment-comparison equipment-stats-shell ${statsPanelScale === 1 ? 'equipment-stats-sticky-safe' : ''}`}
            aria-labelledby="equipment-stats-title"
          >
            <UiPanelRegionGrid screen="equipment" panelId="equipmentStats" layout={uiLayout} className="equipment-stats-regions">
              <UiPanelRegionSlot screen="equipment" panelId="equipmentStats" regionId="equipmentStatsCombat" layout={uiLayout}>
                <div className="eyebrow">Character statistics</div>
                <h2 id="equipment-stats-title">Derived statistics</h2>
                <EquipmentStatRows
                  game={game}
                  selectedSlot={selectedSlot}
                  candidateId={selectedSlot === 'tool' ? null : (candidateItem?.id ?? null)}
                />
              </UiPanelRegionSlot>

              <UiPanelRegionSlot screen="equipment" panelId="equipmentStats" regionId="equipmentStatsComparison" layout={uiLayout}>
              {candidateItem && selectedSlot !== 'tool' && (
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
                    return (
                      <div className="equipment-stat-comparison-row" key={row.id}>
                        <span>{row.label}</span>
                        <strong>{formatEquipmentBonus(row.id, row.current)}</strong>
                        <span aria-hidden="true">→</span>
                        <strong>{formatEquipmentBonus(row.id, row.candidate)}</strong>
                        <span className={deltaClass}>
                          {row.delta === 0 ? 'No change' : formatEquipmentBonus(row.id, row.delta)}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <p className="subtle">No bonus changes between these items.</p>
                )}
                </section>
              )}
              </UiPanelRegionSlot>

              <UiPanelRegionSlot screen="equipment" panelId="equipmentStats" regionId="equipmentStatsSpecial" layout={uiLayout}>
              {showSpecialAttack && (
                <section
                className="equipment-stat-section equipment-special-comparison"
                aria-labelledby="special-comparison-title"
              >
                <div className="eyebrow" id="special-comparison-title">
                  <Sparkles size={13} /> Special Attack
                </div>
                <div className={`equipment-comparison-columns ${comparingWeaponSpecials ? '' : 'equipment-comparison-columns-single'}`}>
                  <div>
                    {comparingWeaponSpecials && <small>Current</small>}
                    <strong>{currentSpecial?.name ?? 'No special attack'}</strong>
                    {currentSpecial && <p>{currentSpecial.description}</p>}
                    {currentSpecial && <SpecialAttackDetails special={currentSpecial} />}
                  </div>
                  {comparingWeaponSpecials && (
                    <div>
                      <small>Candidate</small>
                      <strong>{candidateSpecial?.name ?? 'No special attack'}</strong>
                      {candidateSpecial && <p>{candidateSpecial.description}</p>}
                      {candidateSpecial && <SpecialAttackDetails special={candidateSpecial} />}
                    </div>
                  )}
                </div>
                </section>
              )}
              </UiPanelRegionSlot>

              <UiPanelRegionSlot screen="equipment" panelId="equipmentStats" regionId="equipmentStatsProfession" layout={uiLayout}>
                <ProfessionBonuses
                  currentTool={game.equipment.tool ? itemById[game.equipment.tool] : undefined}
                  candidateItem={selectedSlot === 'tool' ? candidateItem : undefined}
                  expanded={professionExpanded}
                  onToggle={() => setProfessionExpanded((value) => !value)}
                />
              </UiPanelRegionSlot>
            </UiPanelRegionGrid>
          </section>
        </UiPanelSlot>
      </UiPanelGrid>
    </>
  );
}
