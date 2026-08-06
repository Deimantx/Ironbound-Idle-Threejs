import { useEffect, useMemo, useRef, useState } from 'react';
import { Bug, ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { AREAS, areaById } from '../../content/areas';
import { ENEMIES, enemyById } from '../../content/enemies';
import { ITEMS, itemById } from '../../content/items';
import { MINING_NODES, miningNodeById } from '../../content/miningNodes';
import { RECIPES, recipeById } from '../../content/recipes';
import { GAME_CONFIG } from '../../config/gameConfig';
import { getDerivedStats } from '../../game/formulas/statFormulas';
import { getLevelProgress, MAX_LEVEL } from '../../game/formulas/experienceFormulas';
import {
  createDebugController,
  debugActionForState,
  debugAddGold,
  debugAddKillCount,
  debugAddSkillLevels,
  debugAddItem,
  debugAdvanceElapsed,
  debugAdvanceOneCycle,
  debugApplyPreset,
  debugClampHp,
  debugClearEquipment,
  debugClearInventory,
  debugCompleteMiningCycle,
  debugCompleteSmithingCycle,
  debugDiscoverAllItems,
  debugDamagePlayer,
  debugEquipItem,
  debugEquipSet,
  debugFillInventory,
  debugForceAddIgnoringCapacity,
  debugForceOneStackOverCapacity,
  debugForceSetQuantity,
  debugGrantAndEquip,
  debugGrantItem,
  debugGrantMiningOutput,
  debugGrantRecipeMaterials,
  debugGrantRecipeOutput,
  debugGrantSet,
  debugKillCurrentEnemy,
  debugKillPlayer,
  debugMaxAllSkills,
  debugMigrateFixture,
  debugOfflineSimulation,
  debugRemoveQuantity,
  debugRemoveStack,
  debugResetCombatUnlocks,
  debugResetCurrentEnemy,
  debugResetDiscoveries,
  debugResetAllSkills,
  debugResetKillCount,
  debugResetSkill,
  debugSetAllLocks,
  debugSetGold,
  debugSetHp,
  debugSetHpAboveMaximum,
  debugSetKillCount,
  debugSetSkillLevel,
  debugSetSkillXp,
  debugStartCombat,
  debugStartMining,
  debugStartSmithing,
  debugStopAction,
  debugToggleLock,
  debugUnequipSlot,
  debugUnlockAllAreas,
  parseDebugInteger,
} from '../../game/debug/debugActions';
import {
  createLegacyArmorFixture,
  createLegacyShieldFixture,
  previewMigration,
  validateFixture,
} from '../../game/debug/debugFixtures';
import { DEBUG_PRESETS } from '../../game/debug/debugPresets';
import { useGameStore } from '../../game/state/gameStore';
import {
  EQUIPMENT_SLOT_LABELS,
  ACTIVE_EQUIPMENT_SLOTS,
  type ActiveEquipmentSlot,
} from '../../game/equipmentSlots';
import {
  SKILL_IDS,
  type AreaId,
  type EquipmentSlot,
  type GameState,
  type MiningNodeId,
  type QuantityMode,
  type SkillId,
  type ScreenId,
} from '../../game/types';
import { exportProfile, importProfile } from '../../game/persistence/saveManager';
import { savePayloadSchema } from '../../game/persistence/saveSchema';
import { ConfirmDialog, type ConfirmDialogOptions } from '../ConfirmDialog';
import { ItemIcon } from '../ItemIcon';
import { DEFAULT_UI_LAYOUT, saveUiLayout } from '../uiLayout';
import { getInventoryViewStorageKey } from '../inventoryPreferences';
import type { DebugActionResult, DebugMutation } from '../../game/debug/debugTypes';

type DebugTab =
  | 'overview'
  | 'inventory'
  | 'equipment'
  | 'progression'
  | 'combat'
  | 'professions'
  | 'simulation'
  | 'saves';

const TAB_LABELS: Array<{ id: DebugTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'equipment', label: 'Equipment' },
  { id: 'progression', label: 'Progression' },
  { id: 'combat', label: 'Combat' },
  { id: 'professions', label: 'Professions' },
  { id: 'simulation', label: 'Simulation' },
  { id: 'saves', label: 'Saves & UI' },
];

const labelize = (value: string): string =>
  value.replace(/[-_]/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
const skillLabel = (skill: string): string =>
  skill === 'hitpoints' ? 'Hitpoints' : labelize(skill);
const activeActionLabel = (game: GameState): string => {
  if (game.activeAction.type === 'none') return 'None';
  if (game.activeAction.type === 'mining')
    return `Mining · ${miningNodeById[game.activeAction.nodeId]?.name ?? game.activeAction.nodeId}`;
  if (game.activeAction.type === 'smithing')
    return `Smithing · ${recipeById[game.activeAction.recipeId]?.name ?? game.activeAction.recipeId}`;
  return `Combat · ${enemyById[game.activeAction.enemyId]?.name ?? game.activeAction.enemyId}`;
};

const uniqueSorted = (values: Array<string | undefined>): string[] =>
  [...new Set(values.filter((value): value is string => Boolean(value)))].sort();

function Field({
  label,
  children,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`debug-tools-field ${className}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function Section({
  title,
  description,
  children,
  className = '',
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`debug-tools-section ${className}`}>
      <div className="debug-tools-section-heading">
        <div>
          <h3>{title}</h3>
          {description && <p>{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function ActionButton({
  children,
  onClick,
  danger = false,
  disabled = false,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      className={`button ${danger ? 'danger' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}

function Details({ details }: { details?: string[] }) {
  if (!details?.length) return null;
  return (
    <ul className="debug-tools-result-details">
      {details.map((detail) => (
        <li key={detail}>{detail}</li>
      ))}
    </ul>
  );
}

interface DebugMenuProps {
  game: GameState;
  open: boolean;
  onClose: () => void;
  screen?: ScreenId;
  onResetAllLayouts?: () => void;
  onResetCurrentScreenLayout?: (screen: ScreenId) => void;
}

export default function DebugMenu({
  game,
  open,
  onClose,
  screen = 'home',
  onResetAllLayouts,
  onResetCurrentScreenLayout,
}: DebugMenuProps) {
  const [activeTab, setActiveTab] = useState<DebugTab>('overview');
  const [feedback, setFeedback] = useState<DebugActionResult | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [confirmation, setConfirmation] = useState<ConfirmDialogOptions | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const controller = useMemo(
    () =>
      createDebugController({
        getGame: () => useGameStore.getState().game,
        setGame: (next, summary) => useGameStore.getState().setGame(next, summary),
        saveNow: () => useGameStore.getState().saveNow(),
      }),
    [],
  );

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
  }, [open]);

  if (!import.meta.env.DEV || !open) return null;

  const record = (result: DebugActionResult): DebugActionResult => {
    setFeedback(result);
    setHistory((current) =>
      [`${new Date().toLocaleTimeString()} ${result.message}`, ...current].slice(0, 30),
    );
    return result;
  };
  const run = (operation: (state: GameState) => DebugMutation): DebugActionResult =>
    record(controller.execute(operation));
  const confirm = (
    options: Omit<ConfirmDialogOptions, 'onConfirm'>,
    action: () => DebugActionResult,
  ) =>
    setConfirmation({
      ...options,
      onConfirm: () => {
        setConfirmation(null);
        action();
      },
    });
  const resetDebugUi = () => {
    setActiveTab('overview');
    setFeedback(null);
  };

  const renderPanel = () => {
    switch (activeTab) {
      case 'inventory':
        return <InventoryPanel game={game} run={run} confirm={confirm} />;
      case 'equipment':
        return <EquipmentPanel game={game} run={run} confirm={confirm} />;
      case 'progression':
        return <ProgressionPanel game={game} run={run} confirm={confirm} />;
      case 'combat':
        return <CombatPanel game={game} run={run} confirm={confirm} />;
      case 'professions':
        return <ProfessionsPanel game={game} run={run} />;
      case 'simulation':
        return <SimulationPanel game={game} run={run} />;
      case 'saves':
        return (
          <SavesPanel
            game={game}
            run={run}
            controller={controller}
            confirm={confirm}
            screen={screen}
            resetDebugUi={resetDebugUi}
            onResetAllLayouts={onResetAllLayouts}
            onResetCurrentScreenLayout={onResetCurrentScreenLayout}
          />
        );
      default:
        return <OverviewPanel game={game} run={run} confirm={confirm} />;
    }
  };

  return (
    <div className="debug-tools-backdrop">
      <section
        className="debug-tools-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Debug menu"
        aria-describedby="debug-tools-warning"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="debug-tools-header">
          <div>
            <div className="eyebrow">
              <Bug size={13} /> Development only
            </div>
            <h2>DEVELOPMENT TOOLS</h2>
            <p id="debug-tools-warning" className="debug-tools-warning">
              Changes affect the current profile.
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="button ghost debug-tools-close"
            onClick={onClose}
            aria-label="Close debug menu"
          >
            <X size={18} />
          </button>
        </header>
        <div className="debug-tools-body">
          <aside className="debug-tools-nav" aria-label="Debug tool categories">
            {TAB_LABELS.map((tab) => (
              <button
                type="button"
                key={tab.id}
                className={`debug-tools-nav-button ${activeTab === tab.id ? 'active' : ''}`}
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </aside>
          <main className="debug-tools-content">
            <section className="debug-tools-summary" aria-label="Current profile summary">
              <span>
                <b>Profile ID</b>
                {game.profileId}
              </span>
              <span>
                <b>Character</b>
                {game.player.name}
              </span>
              <span>
                <b>Save version</b>
                {game.schemaVersion}
              </span>
              <span>
                <b>Action</b>
                {activeActionLabel(game)}
              </span>
              <span>
                <b>Inventory</b>
                {game.inventory.filter((stack) => stack.quantity > 0).length}/
                {GAME_CONFIG.inventorySlots}
              </span>
            </section>
            {feedback && (
              <div
                className={`debug-tools-result ${feedback.ok ? 'success' : 'failure'}`}
                role="status"
                aria-live="polite"
              >
                <strong>{feedback.ok ? 'Success' : 'Action failed'}</strong>
                <span>{feedback.message}</span>
                <Details details={feedback.details} />
              </div>
            )}
            {renderPanel()}
            <Section
              title="Session action history"
              description="Debug history is session-only and is never serialized into gameplay saves."
              className="debug-tools-history"
            >
              {history.length ? (
                <div className="debug-tools-action-log">
                  {history.map((entry, index) => (
                    <div key={`${entry}-${index}`}>{entry}</div>
                  ))}
                </div>
              ) : (
                <p className="muted">No debug actions yet.</p>
              )}
            </Section>
          </main>
        </div>
      </section>
      {confirmation && <ConfirmDialog {...confirmation} onCancel={() => setConfirmation(null)} />}
    </div>
  );
}

type PanelProps = {
  game: GameState;
  run: (operation: (state: GameState) => DebugMutation) => DebugActionResult;
  confirm: (
    options: Omit<ConfirmDialogOptions, 'onConfirm'>,
    action: () => DebugActionResult,
  ) => void;
};

function OverviewPanel({ game, run, confirm }: PanelProps) {
  const [skillTarget, setSkillTarget] = useState<SkillId | 'all'>('all');
  const [levelAmount, setLevelAmount] = useState('1');
  const [goldAmount, setGoldAmount] = useState('1000');
  const targets = skillTarget === 'all' ? SKILL_IDS : [skillTarget];
  const runForTargets = (
    action: (state: GameState, skill: SkillId) => DebugMutation,
  ): DebugActionResult => {
    let last: DebugActionResult = { ok: true, message: 'Completed.' };
    for (const skill of targets) last = run((state) => action(state, skill));
    return last;
  };
  return (
    <>
      <Section
        title="Overview"
        description="A live readout of the current profile and safe quick actions."
      >
        <div className="debug-tools-stat-grid">
          {[
            ['Gold', String(game.gold)],
            ['HP / Maximum HP', `${game.player.currentHp}/${getDerivedStats(game).maxHealth}`],
            ['Inventory', `${game.inventory.length}/${GAME_CONFIG.inventorySlots}`],
            ['Equipped items', String(Object.keys(game.equipment).length)],
            ['Active action', activeActionLabel(game)],
            [
              'Combat area/enemy',
              game.activeAction.type === 'combat'
                ? `${game.activeAction.areaId} / ${game.activeAction.enemyId}`
                : 'None',
            ],
            ['Attack level', String(game.skills.attack.level)],
            ['Strength level', String(game.skills.strength.level)],
            ['Defence level', String(game.skills.defence.level)],
            ['Hitpoints level', String(game.skills.hitpoints.level)],
            ['Mining level', String(game.skills.mining.level)],
            ['Smithing level', String(game.skills.smithing.level)],
          ].map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </Section>
      <Section
        title="Quick progression"
        description="These compatibility controls keep the original development entry point useful for fast smoke checks."
      >
        <div className="debug-tools-grid">
          <Field label="Skill target">
            <select
              aria-label="Skill target"
              value={skillTarget}
              onChange={(event) => setSkillTarget(event.target.value as SkillId | 'all')}
            >
              <option value="all">All skills</option>
              {SKILL_IDS.map((skill) => (
                <option key={skill} value={skill}>
                  {skillLabel(skill)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Level amount">
            <input
              aria-label="Level amount"
              type="number"
              min="1"
              value={levelAmount}
              onChange={(event) => setLevelAmount(event.target.value)}
            />
          </Field>
          <Field label="Gold amount">
            <input
              aria-label="Gold amount"
              type="number"
              min="0"
              value={goldAmount}
              onChange={(event) => setGoldAmount(event.target.value)}
            />
          </Field>
        </div>
        <div className="button-row">
          <ActionButton
            danger
            onClick={() =>
              confirm(
                {
                  title: 'Reset selected skills?',
                  message: 'Selected skills will return to level 1 and 0 XP.',
                  confirmLabel: 'Reset skills',
                  danger: true,
                },
                () => runForTargets((state, skill) => debugResetSkill(state, skill)),
              )
            }
          >
            Reset level(s)
          </ActionButton>
          <ActionButton
            onClick={() =>
              runForTargets((state, skill) =>
                debugAddSkillLevels(state, skill, parseDebugInteger(levelAmount, 1) ?? 1),
              )
            }
          >
            Grant level(s)
          </ActionButton>
          <ActionButton
            onClick={() =>
              run((state) => debugAddGold(state, parseDebugInteger(goldAmount, 1) ?? 0))
            }
          >
            Give gold
          </ActionButton>
        </div>
      </Section>
      <Section
        title="Presets"
        description="Presets use current registries and may replace gameplay state. Broad presets require confirmation."
      >
        <div className="debug-tools-preset-grid">
          {DEBUG_PRESETS.map((preset) => (
            <div className="debug-tools-preset" key={preset.id}>
              <strong>{preset.label}</strong>
              <p>{preset.description}</p>
              <ActionButton
                danger
                onClick={() =>
                  confirm(
                    {
                      title: `Apply ${preset.label}?`,
                      message: `${preset.description} Current gameplay state may be replaced.`,
                      confirmLabel: 'Apply preset',
                      danger: true,
                    },
                    () => run((state) => debugApplyPreset(state, preset.id)),
                  )
                }
              >
                Apply
              </ActionButton>
            </div>
          ))}
        </div>
      </Section>
      <Section
        title="Combat quick actions"
        description="The normal combat loop handles kills and deaths after these controls prepare the state."
      >
        <div className="button-row">
          <ActionButton
            disabled={game.activeAction.type !== 'combat'}
            onClick={() => run(debugKillCurrentEnemy)}
            title="Kill current enemy through normal reward resolution"
          >
            Kill current monster
          </ActionButton>
          <ActionButton danger onClick={() => run(debugKillPlayer)}>
            Suicide player
          </ActionButton>
        </div>
      </Section>
    </>
  );
}

function InventoryPanel({ game, run, confirm }: PanelProps) {
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
        title="Item spawner"
        description="Search and filter the real item registry; normal adding respects stack merging and capacity."
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
                <ItemIcon itemId={item.id} />
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
                <div className="debug-tools-item-title">
                  <ItemIcon itemId={selected.id} size="md" />
                  <div>
                    <h4>{selected.name}</h4>
                    <small>{selected.id}</small>
                  </div>
                </div>
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
        title="Bulk and edge actions"
        description="Destructive operations are confirmed. Edge actions deliberately create invalid inventory conditions for testing."
        className="debug-tools-danger-zone"
      >
        <div className="button-row">
          <ActionButton onClick={() => run(debugFillInventory)}>
            Fill Inventory to Capacity
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
              danger
              disabled={!selected}
              onClick={() =>
                confirm(
                  {
                    title: 'Create over-capacity stack?',
                    message: 'Create one stack above normal capacity for edge-case testing.',
                    confirmLabel: 'Create edge state',
                    danger: true,
                  },
                  () => run((state) => debugForceOneStackOverCapacity(state, selected.id)),
                )
              }
            >
              Force One Stack Over Capacity
            </ActionButton>
          </div>
        )}
      </Section>
    </>
  );
}

function EquipmentPanel({ game, run, confirm }: PanelProps) {
  const [selectedSlot, setSelectedSlot] = useState<ActiveEquipmentSlot>('weapon');
  const compatible = ITEMS.filter((item) => item.slot === selectedSlot).sort((left, right) =>
    left.name.localeCompare(right.name),
  );
  const [selectedItem, setSelectedItem] = useState(compatible[0]?.id ?? '');
  const [hpAmount, setHpAmount] = useState(String(game.player.currentHp));
  const itemId = compatible.some((item) => item.id === selectedItem)
    ? selectedItem
    : (compatible[0]?.id ?? '');
  return (
    <>
      <Section
        title="Equipment loadout"
        description="All current slots are shown; direct actions use normal ownership, capacity, and HP recalculation."
      >
        <div className="debug-tools-equipment-slots">
          {ACTIVE_EQUIPMENT_SLOTS.map((slot) => {
            const id = game.equipment[slot];
            const item = id ? itemById[id] : undefined;
            return (
              <div className="debug-tools-equipment-slot" key={slot}>
                <span>{EQUIPMENT_SLOT_LABELS[slot]}</span>
                <strong>{item?.name ?? 'Empty'}</strong>
                <small>
                  {id ?? 'No item ID'}
                  {id &&
                    ` · HP ${game.player.currentHp <= getDerivedStats(game).maxHealth ? 'valid' : 'invalid'}`}
                </small>
              </div>
            );
          })}
        </div>
      </Section>
      <Section title="Direct controls">
        <div className="debug-tools-grid">
          <Field label="Slot">
            <select
              value={selectedSlot}
              onChange={(event) => {
                const next = event.target.value as ActiveEquipmentSlot;
                setSelectedSlot(next);
                setSelectedItem(ITEMS.find((item) => item.slot === next)?.id ?? '');
              }}
              aria-label="Equipment slot"
            >
              {ACTIVE_EQUIPMENT_SLOTS.map((slot) => (
                <option key={slot} value={slot}>
                  {EQUIPMENT_SLOT_LABELS[slot]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Compatible item">
            <select
              value={itemId}
              onChange={(event) => setSelectedItem(event.target.value)}
              aria-label="Compatible item"
            >
              {compatible.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.id}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <p className="debug-tools-inline-note">
          Compatible options are derived with <code>item.slot === selectedSlot</code>.
        </p>
        <div className="button-row">
          <ActionButton onClick={() => run((state) => debugGrantItem(state, itemId))}>
            Grant Selected Item
          </ActionButton>
          <ActionButton onClick={() => run((state) => debugEquipItem(state, itemId))}>
            Equip Selected
          </ActionButton>
          <ActionButton onClick={() => run((state) => debugGrantAndEquip(state, itemId))}>
            Grant and Equip
          </ActionButton>
          <ActionButton
            danger
            onClick={() => run((state) => debugUnequipSlot(state, selectedSlot))}
          >
            Unequip Slot
          </ActionButton>
        </div>
      </Section>
      <Section title="Equipment presets">
        <div className="button-row">
          {(['bronze', 'iron', 'steel'] as const).map((tier) => (
            <span className="debug-tools-button-group" key={tier}>
              <ActionButton onClick={() => run((state) => debugGrantSet(state, tier))}>
                Grant {labelize(tier)} Set
              </ActionButton>
              <ActionButton onClick={() => run((state) => debugEquipSet(state, tier))}>
                Equip {labelize(tier)} Set
              </ActionButton>
            </span>
          ))}
          <ActionButton
            danger
            onClick={() =>
              confirm(
                {
                  title: 'Clear Equipment?',
                  message:
                    'Normal unequip actions will run. Failed slots remain equipped and no gear is deleted.',
                  confirmLabel: 'Clear Equipment',
                  danger: true,
                },
                () => run(debugClearEquipment),
              )
            }
          >
            Clear Equipment
          </ActionButton>
        </div>
      </Section>
      <Section title="Equipment edge cases">
        <div className="button-row">
          <ActionButton
            danger
            onClick={() =>
              confirm(
                {
                  title: 'Fill Inventory then unequip?',
                  message: `Fill all ${GAME_CONFIG.inventorySlots} slots, then attempt a normal unequip for ${EQUIPMENT_SLOT_LABELS[selectedSlot]}.`,
                  confirmLabel: 'Run edge case',
                  danger: true,
                },
                () =>
                  run((state) => {
                    const filled = debugFillInventory(state);
                    return filled.state ? debugUnequipSlot(filled.state, selectedSlot) : filled;
                  }),
              )
            }
          >
            Fill Inventory, Then Attempt Unequip
          </ActionButton>
          <ActionButton
            onClick={() => run((state) => debugSetHp(state, getDerivedStats(state).maxHealth))}
          >
            Set HP to Current Maximum
          </ActionButton>
          <ActionButton onClick={() => run((state) => debugSetHp(state, 1))}>
            Set HP to 1
          </ActionButton>
          <ActionButton danger onClick={() => run(debugSetHpAboveMaximum)}>
            Set HP Above Maximum
          </ActionButton>
          <ActionButton onClick={() => run(debugClampHp)}>Recalculate and Clamp HP</ActionButton>
        </div>
        <div className="debug-tools-grid">
          <Field label="Exact HP">
            <input
              type="number"
              min="0"
              value={hpAmount}
              onChange={(event) => setHpAmount(event.target.value)}
            />
          </Field>
          <ActionButton
            onClick={() =>
              run((state) => debugSetHp(state, parseDebugInteger(hpAmount, 0) ?? 0, false))
            }
          >
            Set Exact HP
          </ActionButton>
        </div>
      </Section>
    </>
  );
}

function ProgressionPanel({ game, run, confirm }: PanelProps) {
  const [skill, setSkill] = useState<SkillId>('mining');
  const [level, setLevel] = useState(String(game.skills[skill].level));
  const [xp, setXp] = useState(String(game.skills[skill].xp));
  const [gold, setGold] = useState(String(game.gold));
  const progress = getLevelProgress(game.skills[skill]);
  return (
    <>
      <Section
        title="Skills"
        description="Set Level and Set XP use the authoritative XP thresholds and level cap."
      >
        <div className="debug-tools-grid">
          <Field label="Skill">
            <select
              value={skill}
              onChange={(event) => {
                const next = event.target.value as SkillId;
                setSkill(next);
                setLevel(String(game.skills[next].level));
                setXp(String(game.skills[next].xp));
              }}
              aria-label="Skill"
            >
              <option value="attack">Attack</option>
              <option value="strength">Strength</option>
              <option value="defence">Defence</option>
              <option value="hitpoints">Hitpoints</option>
              <option value="mining">Mining</option>
              <option value="smithing">Smithing</option>
            </select>
          </Field>
          <Field label="Target Level">
            <input
              type="number"
              min="1"
              max={MAX_LEVEL}
              value={level}
              onChange={(event) => setLevel(event.target.value)}
            />
          </Field>
          <Field label="Target XP">
            <input
              type="number"
              min="0"
              value={xp}
              onChange={(event) => setXp(event.target.value)}
            />
          </Field>
        </div>
        <p className="debug-tools-inline-note">
          Current {skillLabel(skill)}: level {game.skills[skill].level}, XP {game.skills[skill].xp},
          progress {Math.round(progress.percent)}%.
        </p>
        <div className="button-row">
          <ActionButton
            onClick={() =>
              run((state) =>
                debugSetSkillLevel(state, skill, parseDebugInteger(level, 1, MAX_LEVEL) ?? 1),
              )
            }
          >
            Set Level
          </ActionButton>
          <ActionButton
            onClick={() =>
              run((state) => debugSetSkillXp(state, skill, parseDebugInteger(xp, 0) ?? 0))
            }
          >
            Set XP
          </ActionButton>
          <ActionButton onClick={() => run((state) => debugAddSkillLevels(state, skill, 1))}>
            Add 1 Level
          </ActionButton>
          <ActionButton onClick={() => run((state) => debugAddSkillLevels(state, skill, 10))}>
            Add 10 Levels
          </ActionButton>
          <ActionButton onClick={() => run((state) => debugSetSkillLevel(state, skill, MAX_LEVEL))}>
            Set Maximum
          </ActionButton>
          <ActionButton danger onClick={() => run((state) => debugResetSkill(state, skill))}>
            Reset Skill
          </ActionButton>
        </div>
      </Section>
      <Section title="Gold">
        <Field label="Amount">
          <input
            type="number"
            min="0"
            value={gold}
            onChange={(event) => setGold(event.target.value)}
          />
        </Field>
        <div className="button-row">
          <ActionButton
            onClick={() => run((state) => debugAddGold(state, parseDebugInteger(gold, 1) ?? 0))}
          >
            Add Gold
          </ActionButton>
          <ActionButton
            onClick={() => run((state) => debugSetGold(state, parseDebugInteger(gold, 0) ?? 0))}
          >
            Set Gold
          </ActionButton>
          <ActionButton onClick={() => run((state) => debugSetGold(state, 0))}>
            Set Zero
          </ActionButton>
        </div>
      </Section>
      <Section title="Global progression">
        <div className="button-row">
          <ActionButton
            danger
            onClick={() =>
              confirm(
                {
                  title: 'Max all skills?',
                  message: 'All current skills will be set to the current maximum XP threshold.',
                  confirmLabel: 'Max all skills',
                  danger: true,
                },
                () => run(debugMaxAllSkills),
              )
            }
          >
            Max All Skills
          </ActionButton>
          <ActionButton
            danger
            onClick={() =>
              confirm(
                {
                  title: 'Reset all skills?',
                  message: 'All current skills will return to level 1 and 0 XP.',
                  confirmLabel: 'Reset all skills',
                  danger: true,
                },
                () => run(debugResetAllSkills),
              )
            }
          >
            Reset All Skills
          </ActionButton>
        </div>
      </Section>
    </>
  );
}

function CombatPanel({ game, run, confirm }: PanelProps) {
  const [areaId, setAreaId] = useState<AreaId>(
    game.activeAction.type === 'combat' ? game.activeAction.areaId : AREAS[0].id,
  );
  const [enemyId, setEnemyId] = useState<string>(
    game.activeAction.type === 'combat' ? game.activeAction.enemyId : AREAS[0].enemyIds[0],
  );
  const [style, setStyle] = useState<'accurate' | 'aggressive' | 'defensive'>('accurate');
  const [killCount, setKillCount] = useState('10');
  const [damage, setDamage] = useState('10');
  const enemies = areaById[areaId]?.enemyIds.map((id) => enemyById[id]).filter(Boolean) ?? [];
  const active = game.activeAction.type === 'combat' ? game.activeAction : null;
  const enemy = active ? enemyById[active.enemyId] : enemyById[enemyId];
  return (
    <>
      <Section
        title="Combat state"
        description="Enemy options are derived from the current area and reward resolution remains in the normal simulator."
      >
        <div className="debug-tools-stat-grid">
          {[
            ['Active area', active?.areaId ?? 'None'],
            ['Active enemy', active?.enemyId ?? 'None'],
            [
              'Player HP',
              `${game.player.currentHp}/${getDerivedStats(game, active?.style).maxHealth}`,
            ],
            [
              'Enemy HP',
              active ? `${active.combatState.enemyHp}/${active.combatState.enemyMaxHp}` : '—',
            ],
            [
              'Combat state',
              active ? (active.combatState.respawnMs > 0 ? 'Respawning' : 'Fighting') : 'Stopped',
            ],
            ['Auto-repeat', active?.autoRepeat ? 'On' : 'Off'],
            ['Current kill count', enemy ? String(game.killCounts[enemy.id] ?? 0) : '0'],
          ].map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Player controls">
        <div className="button-row">
          <ActionButton
            onClick={() => run((state) => debugSetHp(state, getDerivedStats(state).maxHealth))}
          >
            Heal Player
          </ActionButton>
          <ActionButton onClick={() => run((state) => debugSetHp(state, 1))}>
            Set HP to 1
          </ActionButton>
          <Field label="Damage">
            <input
              type="number"
              min="1"
              value={damage}
              onChange={(event) => setDamage(event.target.value)}
            />
          </Field>
          <ActionButton
            onClick={() =>
              run((state) => debugDamagePlayer(state, parseDebugInteger(damage, 1) ?? 1))
            }
          >
            Damage Player
          </ActionButton>
          <ActionButton danger onClick={() => run(debugKillPlayer)}>
            Kill Player
          </ActionButton>
        </div>
      </Section>
      <Section title="Enemy controls">
        <div className="debug-tools-grid">
          <Field label="Area">
            <select
              value={areaId}
              onChange={(event) => {
                const next = event.target.value as AreaId;
                setAreaId(next);
                setEnemyId(areaById[next].enemyIds[0]);
              }}
              aria-label="Combat area"
            >
              {AREAS.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Enemy">
            <select
              value={enemyId}
              onChange={(event) => setEnemyId(event.target.value)}
              aria-label="Enemy"
            >
              {enemies.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name} · {candidate.id}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Style">
            <select
              value={style}
              onChange={(event) => setStyle(event.target.value as typeof style)}
            >
              <option value="accurate">Accurate</option>
              <option value="aggressive">Aggressive</option>
              <option value="defensive">Defensive</option>
            </select>
          </Field>
        </div>
        <div className="button-row">
          <ActionButton
            onClick={() => run((state) => debugStartCombat(state, areaId, enemyId, style, true))}
          >
            Start Combat
          </ActionButton>
          <ActionButton onClick={() => run(debugStopAction)}>Stop Combat</ActionButton>
          <ActionButton onClick={() => run(debugResetCurrentEnemy)}>
            Reset Current Enemy
          </ActionButton>
          <ActionButton
            disabled={!active}
            onClick={() => run(debugKillCurrentEnemy)}
            title="Kill current enemy through the normal reward pipeline"
          >
            Kill current monster
          </ActionButton>
        </div>
      </Section>
      <Section title="Combat progression">
        <div className="debug-tools-grid">
          <Field label="Enemy">
            <select value={enemyId} onChange={(event) => setEnemyId(event.target.value)}>
              <option value="">Select enemy</option>
              {ENEMIES.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Kill Count">
            <input
              type="number"
              min="0"
              value={killCount}
              onChange={(event) => setKillCount(event.target.value)}
            />
          </Field>
        </div>
        <div className="button-row">
          <ActionButton
            onClick={() =>
              run((state) =>
                debugSetKillCount(state, enemyId, parseDebugInteger(killCount, 0) ?? 0),
              )
            }
          >
            Set Kill Count
          </ActionButton>
          <ActionButton onClick={() => run((state) => debugAddKillCount(state, enemyId, 1))}>
            Add 1 Kill
          </ActionButton>
          <ActionButton onClick={() => run((state) => debugAddKillCount(state, enemyId, 10))}>
            Add 10 Kills
          </ActionButton>
          <ActionButton onClick={() => run((state) => debugResetKillCount(state, enemyId))}>
            Reset Kill Count
          </ActionButton>
          <ActionButton onClick={() => run(debugUnlockAllAreas)}>
            Unlock All Combat Areas
          </ActionButton>
          <ActionButton
            danger
            onClick={() =>
              confirm(
                {
                  title: 'Reset Combat unlocks?',
                  message:
                    'Area access returns to Training Grounds and combat kill-count inputs are cleared.',
                  confirmLabel: 'Reset unlocks',
                  danger: true,
                },
                () => run(debugResetCombatUnlocks),
              )
            }
          >
            Reset Combat Unlocks
          </ActionButton>
        </div>
      </Section>
    </>
  );
}

function ProfessionsPanel({ game, run }: { game: GameState; run: PanelProps['run'] }) {
  const [nodeId, setNodeId] = useState<MiningNodeId>(MINING_NODES[0].id);
  const [recipeId, setRecipeId] = useState(RECIPES[0].id);
  const [mode, setMode] = useState<QuantityMode>(1);
  const activeMining = game.activeAction.type === 'mining' ? game.activeAction : null;
  const activeSmithing = game.activeAction.type === 'smithing' ? game.activeAction : null;
  const node = miningNodeById[nodeId];
  const recipe = recipeById[recipeId];
  return (
    <>
      <Section
        title="Mining"
        description="Start/stop and cycle controls use the real timestamp-based Mining simulation."
      >
        <div className="debug-tools-stat-grid">
          {[
            ['Mining level', game.skills.mining.level],
            ['Active node', activeMining ? miningNodeById[activeMining.nodeId]?.name : 'None'],
            ['Progress', activeMining ? `${activeMining.progressMs} ms` : '—'],
            [
              'Tool',
              game.equipment.tool
                ? (itemById[game.equipment.tool]?.name ?? game.equipment.tool)
                : 'None',
            ],
            [
              'Effective interval',
              `${node ? Math.round(node.intervalMs * getDerivedStats(game).miningIntervalMultiplier) : 0} ms`,
            ],
            ['Capacity', `${game.inventory.length}/${GAME_CONFIG.inventorySlots}`],
          ].map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{String(value)}</strong>
            </div>
          ))}
        </div>
        <Field label="Node">
          <select
            value={nodeId}
            onChange={(event) => setNodeId(event.target.value as MiningNodeId)}
            aria-label="Mining node"
          >
            {MINING_NODES.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name} · level {candidate.level}
              </option>
            ))}
          </select>
        </Field>
        <div className="button-row">
          <ActionButton onClick={() => run((state) => debugStartMining(state, nodeId))}>
            Start Mining
          </ActionButton>
          <ActionButton onClick={() => run(debugStopAction)}>Stop Mining</ActionButton>
          <ActionButton onClick={() => run(debugCompleteMiningCycle)}>
            Complete One Mining Cycle
          </ActionButton>
          <ActionButton onClick={() => run((state) => debugGrantMiningOutput(state, nodeId))}>
            Grant Node Output Without Simulation
          </ActionButton>
        </div>
      </Section>
      <Section
        title="Smithing"
        description="Material and output helpers are clearly separate from simulation cycles."
      >
        <div className="debug-tools-stat-grid">
          {[
            ['Smithing level', game.skills.smithing.level],
            ['Active recipe', activeSmithing ? recipeById[activeSmithing.recipeId]?.name : 'None'],
            ['Quantity mode', activeSmithing?.quantityMode ?? '—'],
            ['Remaining', activeSmithing?.remaining ?? '—'],
            ['Progress', activeSmithing ? `${activeSmithing.progressMs} ms` : '—'],
            [
              'Output',
              recipe
                ? `${itemById[recipe.outputItemId]?.name ?? recipe.outputItemId} ×${recipe.outputQuantity}`
                : '—',
            ],
          ].map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{String(value)}</strong>
            </div>
          ))}
        </div>
        <div className="debug-tools-grid">
          <Field label="Recipe">
            <select
              value={recipeId}
              onChange={(event) => setRecipeId(event.target.value)}
              aria-label="Smithing recipe"
            >
              {RECIPES.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name} · level {candidate.level}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Quantity mode">
            <select
              value={String(mode)}
              onChange={(event) =>
                setMode(
                  event.target.value === 'all' || event.target.value === 'continuous'
                    ? event.target.value
                    : (Number(event.target.value) as 1 | 10),
                )
              }
            >
              <option value="1">1</option>
              <option value="10">10</option>
              <option value="all">All</option>
              <option value="continuous">Continuous</option>
            </select>
          </Field>
        </div>
        <p className="debug-tools-inline-note">
          Requirements:{' '}
          {recipe?.inputs
            .map((input) => `${itemById[input.itemId]?.name ?? input.itemId} ×${input.quantity}`)
            .join(', ')}
        </p>
        <div className="button-row">
          <ActionButton onClick={() => run((state) => debugStartSmithing(state, recipeId, mode))}>
            Start Smithing
          </ActionButton>
          <ActionButton onClick={() => run(debugStopAction)}>Stop Smithing</ActionButton>
          <ActionButton onClick={() => run(debugCompleteSmithingCycle)}>
            Complete One Smithing Cycle
          </ActionButton>
          <ActionButton onClick={() => run((state) => debugGrantRecipeMaterials(state, recipeId))}>
            Grant Recipe Materials
          </ActionButton>
          <ActionButton onClick={() => run((state) => debugGrantRecipeOutput(state, recipeId))}>
            Grant One Output Without Simulation
          </ActionButton>
        </div>
      </Section>
      <Section title="Active action">
        <p className="debug-tools-active-action">{activeActionLabel(game)}</p>
        <div className="button-row">
          <ActionButton
            onClick={() => run(debugStopAction)}
            disabled={game.activeAction.type === 'none'}
          >
            Stop Active Action
          </ActionButton>
          <ActionButton
            onClick={() => run(debugAdvanceOneCycle)}
            disabled={game.activeAction.type === 'none'}
          >
            Complete Next Cycle
          </ActionButton>
          <ActionButton
            onClick={() => run((state) => debugAdvanceElapsed(state, 60_000))}
            disabled={game.activeAction.type === 'none'}
          >
            Advance 1 Minute
          </ActionButton>
          <ActionButton
            onClick={() => run((state) => debugAdvanceElapsed(state, 600_000))}
            disabled={game.activeAction.type === 'none'}
          >
            Advance 10 Minutes
          </ActionButton>
          <ActionButton
            onClick={() => run((state) => debugAdvanceElapsed(state, 3_600_000))}
            disabled={game.activeAction.type === 'none'}
          >
            Advance 1 Hour
          </ActionButton>
        </div>
      </Section>
    </>
  );
}

function SimulationPanel({ game, run }: { game: GameState; run: PanelProps['run'] }) {
  const [hours, setHours] = useState('1');
  const [minutes, setMinutes] = useState('0');
  const active = game.activeAction.type !== 'none';
  const custom =
    (parseDebugInteger(hours, 0) ?? 0) * 3_600_000 + (parseDebugInteger(minutes, 0) ?? 0) * 60_000;
  return (
    <>
      <Section
        title="Advance Active Action"
        description={
          active
            ? 'Immediate deterministic simulation using the live elapsed-time engine.'
            : 'No active action exists; action advancement is disabled.'
        }
      >
        <div className="button-row">
          <ActionButton disabled={!active} onClick={() => run(debugAdvanceOneCycle)}>
            1 Cycle
          </ActionButton>
          <ActionButton
            disabled={!active}
            onClick={() => run((state) => debugAdvanceElapsed(state, 60_000))}
          >
            1 Minute
          </ActionButton>
          <ActionButton
            disabled={!active}
            onClick={() => run((state) => debugAdvanceElapsed(state, 600_000))}
          >
            10 Minutes
          </ActionButton>
          <ActionButton
            disabled={!active}
            onClick={() => run((state) => debugAdvanceElapsed(state, 3_600_000))}
          >
            1 Hour
          </ActionButton>
        </div>
      </Section>
      <Section
        title="Simulate Offline"
        description="Uses the same capped offline replay path as profile loading, including exhaustion and full-inventory stops."
      >
        <div className="button-row">
          <ActionButton
            onClick={() => run((state) => debugOfflineSimulation(state, 8 * 3_600_000))}
          >
            8 Hours
          </ActionButton>
          <ActionButton
            onClick={() => run((state) => debugOfflineSimulation(state, 24 * 3_600_000))}
          >
            24 Hours
          </ActionButton>
        </div>
        <div className="debug-tools-grid">
          <Field label="Hours">
            <input
              type="number"
              min="0"
              value={hours}
              onChange={(event) => setHours(event.target.value)}
            />
          </Field>
          <Field label="Minutes">
            <input
              type="number"
              min="0"
              value={minutes}
              onChange={(event) => setMinutes(event.target.value)}
            />
          </Field>
          <ActionButton
            onClick={() =>
              run((state) =>
                debugOfflineSimulation(state, Math.min(GAME_CONFIG.offlineCapMs, custom)),
              )
            }
            disabled={custom <= 0}
          >
            Custom Duration
          </ActionButton>
        </div>
        <p className="debug-tools-inline-note">
          Custom duration is clamped to the current {GAME_CONFIG.offlineCapMs / 3_600_000}-hour
          offline cap.
        </p>
      </Section>
    </>
  );
}

function SavesPanel({
  game,
  run,
  controller,
  confirm,
  screen,
  resetDebugUi,
  onResetAllLayouts,
  onResetCurrentScreenLayout,
}: PanelProps & {
  controller: ReturnType<typeof createDebugController>;
  screen: ScreenId;
  resetDebugUi: () => void;
  onResetAllLayouts?: () => void;
  onResetCurrentScreenLayout?: (screen: ScreenId) => void;
}) {
  const [migration, setMigration] = useState<'armor' | 'shield'>('armor');
  const [fixtureFeedback, setFixtureFeedback] = useState<string[]>([]);
  const fixture = migration === 'armor' ? createLegacyArmorFixture() : createLegacyShieldFixture();
  const downloadExport = async () => {
    const text = await exportProfile(game);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    link.download = `${game.player.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-debug.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    setFixtureFeedback(['Save exported using the current format.']);
  };
  const importFile = async (file: File) => {
    try {
      const imported = await importProfile(await file.text(), game.profileSlot);
      useGameStore.getState().setGame(imported);
      setFixtureFeedback(['Save imported and migrated into the current profile.']);
    } catch (cause) {
      setFixtureFeedback([cause instanceof Error ? cause.message : 'Import failed.']);
    }
  };
  const resetAllLayouts = () => {
    onResetAllLayouts?.();
    if (!onResetAllLayouts) saveUiLayout(DEFAULT_UI_LAYOUT);
    setFixtureFeedback(['All UI layouts reset without changing gameplay.']);
  };
  const resetCurrentLayout = () => {
    onResetCurrentScreenLayout?.(screen);
    if (!onResetCurrentScreenLayout) saveUiLayout(DEFAULT_UI_LAYOUT);
    setFixtureFeedback([`Layout reset for ${screen}.`]);
  };
  return (
    <>
      <Section
        title="Profile Save"
        description="Persistence actions use the current save queue, checksum, schema validation, and migration implementations."
      >
        <div className="button-row">
          <ActionButton
            onClick={() => {
              void controller
                .save()
                .then((ok) =>
                  setFixtureFeedback([
                    ok
                      ? `Force Save completed at ${new Date().toLocaleTimeString()}.`
                      : 'Force Save failed.',
                  ]),
                );
            }}
          >
            Force Save
          </ActionButton>
          <ActionButton
            onClick={() => {
              void downloadExport();
            }}
          >
            Export Save
          </ActionButton>
          <label className="button">
            Import Save
            <input
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file)
                  confirm(
                    {
                      title: 'Import Save?',
                      message:
                        'This replaces the current profile through the normal validation and migration path.',
                      confirmLabel: 'Import Save',
                      danger: true,
                    },
                    () => {
                      void importFile(file);
                      return { ok: true, message: 'Import started.' };
                    },
                  );
                event.currentTarget.value = '';
              }}
            />
          </label>
          <ActionButton
            onClick={() => {
              const result = savePayloadSchema.safeParse(game);
              setFixtureFeedback([
                result.success
                  ? 'Current state passes the save schema.'
                  : 'Current state failed the save schema.',
              ]);
            }}
          >
            Validate Current Save
          </ActionButton>
        </div>
        {fixtureFeedback.map((message) => (
          <p className="debug-tools-inline-note" key={message}>
            {message}
          </p>
        ))}
      </Section>
      <Section
        title="UI Preferences"
        description="These controls touch browser UI storage only; gameplay and Inventory stacks are not changed."
      >
        <div className="button-row">
          <ActionButton
            danger
            onClick={() =>
              confirm(
                {
                  title: 'Reset all UI layouts?',
                  message:
                    'Global and screen layouts will return to defaults. Gameplay is preserved.',
                  confirmLabel: 'Reset layouts',
                  danger: true,
                },
                () => {
                  resetAllLayouts();
                  return { ok: true, message: 'Layouts reset.' };
                },
              )
            }
          >
            Reset All UI Layouts
          </ActionButton>
          <ActionButton onClick={resetCurrentLayout}>Reset Current Screen Layout</ActionButton>
          <ActionButton
            onClick={() => {
              window.localStorage.removeItem(getInventoryViewStorageKey(game.profileId));
              setFixtureFeedback(['Inventory view preferences reset; stacks were preserved.']);
            }}
          >
            Reset Inventory View Preferences
          </ActionButton>
          <ActionButton
            onClick={() => {
              resetDebugUi();
              setFixtureFeedback(['Debug menu UI state reset for this session.']);
            }}
          >
            Reset Debug Menu UI State
          </ActionButton>
        </div>
      </Section>
      <Section
        title="Migration Fixtures"
        description="Factories return fresh legacy objects. Preview is read-only; Load uses the migration path into the current profile."
      >
        <div className="debug-tools-grid">
          <Field label="Fixture">
            <select
              value={migration}
              onChange={(event) => {
                setMigration(event.target.value as typeof migration);
                setFixtureFeedback([]);
              }}
            >
              <option value="armor">Legacy Armor Save</option>
              <option value="shield">Legacy Shield Save</option>
            </select>
          </Field>
        </div>
        <div className="debug-tools-preview">
          <p>
            <strong>Preview Migration Result</strong>
          </p>
          {previewMigration(fixture).map((change) => (
            <span key={change}>{change}</span>
          ))}
        </div>
        <div className="button-row">
          <ActionButton onClick={() => setFixtureFeedback([validateFixture(fixture).message])}>
            Validate Fixture
          </ActionButton>
          <ActionButton onClick={() => setFixtureFeedback(previewMigration(fixture))}>
            Preview Migration Result
          </ActionButton>
          <ActionButton
            danger
            onClick={() =>
              confirm(
                {
                  title: 'Load legacy fixture?',
                  message:
                    'The fixture will be migrated and loaded into the current profile while preserving profile identity.',
                  confirmLabel: 'Load Fixture',
                  danger: true,
                },
                () => {
                  const result = controller.execute((state) =>
                    debugActionForState(state, (current) =>
                      debugMigrateFixture(
                        current,
                        migration === 'armor'
                          ? createLegacyArmorFixture()
                          : createLegacyShieldFixture(),
                      ),
                    ),
                  );
                  return recordExternal(result);
                },
              )
            }
          >
            Load Fixture into Current Profile
          </ActionButton>
        </div>
      </Section>
      <Section title="Danger Zone" className="debug-tools-danger-zone">
        <ActionButton
          danger
          onClick={() =>
            confirm(
              {
                title: 'Reset Current Profile?',
                message:
                  'Gameplay resets to a fresh character. Profile ID, name, settings, and UI preferences remain.',
                confirmLabel: 'Reset Current Profile',
                danger: true,
              },
              () => run((state) => debugApplyPreset(state, 'fresh')),
            )
          }
        >
          Reset Current Profile
        </ActionButton>
      </Section>
    </>
  );
  function recordExternal(result: DebugActionResult): DebugActionResult {
    setFixtureFeedback([result.message]);
    return result;
  }
}
