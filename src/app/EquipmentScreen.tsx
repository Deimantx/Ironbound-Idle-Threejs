import {
  Circle,
  ChevronDown,
  Flag,
  Footprints,
  Gem,
  Hand,
  HardHat,
  Pickaxe,
  Shirt,
  Shield,
  Sparkles,
  Sword,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { itemById } from '../content/items';
import { MINING_TUNING } from '../config/miningTuning';
import { getMiningToolDefinition } from '../content/miningTools';
import { getSmithingHammerDefinition } from '../content/smithingTools';
import { getDerivedStats } from '../game/formulas/statFormulas';
import {
  ACCESSORY_EQUIPMENT_SLOTS,
  ACTIVE_EQUIPMENT_SLOTS,
  COMBAT_GEAR_MAIN_SLOTS,
  type ActiveEquipmentSlot,
  getEquipmentSlotLabel,
} from '../game/equipmentSlots';
import type { GameState, ItemDefinition, MiningToolDefinition, ScreenId } from '../game/types';
import { useGameStore } from '../game/state/gameStore';
import {
  formatEquipmentBonus,
  getCompatibleEquipmentStacks,
  getDerivedStatComparison,
  getEquipmentBonusComparison,
  getEquipmentBonusLabel,
  getEquipmentEmptyState,
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

const EMPTY_SLOT_ICONS: Record<ActiveEquipmentSlot, LucideIcon> = {
  head: HardHat,
  armor: Shirt,
  gloves: Hand,
  boots: Footprints,
  weapon: Sword,
  offhand: Shield,
  amulet: Gem,
  ring: Circle,
  cape: Flag,
  tool: Pickaxe,
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
    <button
      type="button"
      className={`equipment-slot-card slot-${slot} ${selected ? 'equipment-slot-selected' : ''} ${!itemId ? 'equipment-slot-empty' : ''}`}
      onClick={() => onSelect(slot)}
      title={`Select ${label}`}
      aria-label={`${label} slot${item ? `, ${item.name}` : ', empty'}`}
      aria-pressed={selected}
    >
      <strong>{label}</strong>
      {item ? (
        <>
          <span className="equipment-item-icon">
            <ItemIcon itemId={item.id} size="md" />
          </span>
          <small>{item.name}</small>
        </>
      ) : (
        <>
          <span className="equipment-empty-slot-icon">
            {(() => {
              const Icon = EMPTY_SLOT_ICONS[slot];
              return <Icon size={18} aria-hidden="true" />;
            })()}
          </span>
          <span className="empty-slot">Empty</span>
        </>
      )}
    </button>
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

const formatMiningToolStats = (definition: MiningToolDefinition): string =>
  `${definition.rockDamage} damage · ${definition.penetration} pen · ${(definition.swingIntervalMs / 1000).toFixed(1)}s · ${definition.staminaCost} stamina`;

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
  const summary = candidateItem
    ? candidateHammer
      ? `Preview ${Math.round(candidateHammer.speedBonus * 100)}% faster · ${Math.round(candidateHammer.materialPreservationChance * 100)}% preservation`
      : `Preview ${formatMiningToolStats(candidateDefinition ?? MINING_TUNING.noTool)}`
    : currentTool
      ? currentHammer
        ? `${Math.round(currentHammer.speedBonus * 100)}% faster · ${Math.round(currentHammer.materialPreservationChance * 100)}% preservation`
        : formatMiningToolStats(currentDefinition)
      : 'No pickaxe equipped';
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
        <span className="equipment-profession-toggle-summary">{summary}</span>
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
                        ? `${Math.round(currentHammer.speedBonus * 100)}% faster · ${Math.round(currentHammer.materialPreservationChance * 100)}% preservation`
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
                      Candidate · {Math.round(candidateHammer.speedBonus * 100)}% faster ·{' '}
                      {Math.round(candidateHammer.materialPreservationChance * 100)}% preservation ·
                      level {candidateHammer.requiredSmithingLevel}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="equipment-profession-row">
                    <span>Mining stats</span>
                    <strong>{formatMiningToolStats(currentDefinition)}</strong>
                  </div>
                  <div className="equipment-profession-row">
                    <span>Required Mining level</span>
                    <strong>{currentDefinition.requiredMiningLevel}</strong>
                  </div>
                  {candidateItem && candidateDefinition && (
                    <div className="equipment-profession-improvement">
                      Candidate · {formatMiningToolStats(candidateDefinition)} · level{' '}
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
  const currentSpecial = selectedSlot === 'weapon' ? currentItem?.specialAttack : undefined;
  const candidateSpecial = selectedSlot === 'weapon' ? candidateItem?.specialAttack : undefined;

  return (
    <>
      <ScreenHeading
        eyebrow="Character · Loadout"
        title="Equipment"
        description="Equip forged gear, compare upgrades, and shape your combat statistics."
      />
      <div className="ui-panel-grid equipment-panel-grid" data-ui-panel-grid="equipment">
        <UiPanelSlot screen="equipment" id="equipmentLoadout" layout={uiLayout}>
          <section
            className="panel panel-pad equipment-loadout-shell"
            aria-labelledby="equipment-loadout-title"
          >
            <div className="eyebrow">Character loadout</div>
            <h2 id="equipment-loadout-title">Active equipment</h2>

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
                  {!game.equipment.tool && <small>No pickaxe equipped</small>}
                  {game.equipment.tool && itemById[game.equipment.tool] && (
                    <small>Explicit Mining stats shown below</small>
                  )}
                </div>
              </div>
            </section>

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
          </section>
        </UiPanelSlot>
        <UiPanelSlot screen="equipment" id="equipmentStats" layout={uiLayout}>
          <section
            className={`panel panel-pad equipment-comparison equipment-stats-shell ${statsPanelScale === 1 ? 'equipment-stats-sticky-safe' : ''}`}
            aria-labelledby="equipment-stats-title"
          >
            <div className="eyebrow">Character statistics</div>
            <h2 id="equipment-stats-title">Derived statistics</h2>
            <EquipmentStatRows
              game={game}
              selectedSlot={selectedSlot}
              candidateId={selectedSlot === 'tool' ? null : (candidateItem?.id ?? null)}
            />

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

            {selectedSlot === 'weapon' && (currentSpecial || candidateSpecial) && (
              <section
                className="equipment-stat-section equipment-special-comparison"
                aria-labelledby="special-comparison-title"
              >
                <div className="eyebrow" id="special-comparison-title">
                  <Sparkles size={13} /> Special Attacks
                </div>
                <div className="equipment-comparison-columns">
                  <div>
                    <small>Current special</small>
                    <strong>{currentSpecial?.name ?? 'No special attack'}</strong>
                    {currentSpecial && <p>{currentSpecial.description}</p>}
                  </div>
                  {candidateItem && (
                    <div>
                      <small>Candidate special</small>
                      <strong>{candidateSpecial?.name ?? 'No special attack'}</strong>
                      {candidateSpecial && <p>{candidateSpecial.description}</p>}
                    </div>
                  )}
                </div>
              </section>
            )}

            <ProfessionBonuses
              currentTool={game.equipment.tool ? itemById[game.equipment.tool] : undefined}
              candidateItem={selectedSlot === 'tool' ? candidateItem : undefined}
              expanded={professionExpanded}
              onToggle={() => setProfessionExpanded((value) => !value)}
            />
          </section>
        </UiPanelSlot>
      </div>
    </>
  );
}
