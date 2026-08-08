import { ArrowUp, ChevronDown, Flame, Hammer, Lock } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { SMITHING_BAR_BY_TIER, type SmithingTier } from '../config/smithingTuning';
import {
  ACTIVE_SMITHING_RECIPES,
  getSmithingRecipesForCategory,
  recipeById,
} from '../content/recipes';
import { SMITHING_FUELS } from '../content/smithingFuels';
import { SMITHING_TOOLS } from '../content/smithingTools';
import { itemById } from '../content/items';
import { getLevelProgress } from '../game/formulas/experienceFormulas';
import {
  getForgeFuelCapacity,
  getForgeFuelItemsRequired,
  getForgeFuelTimeEstimate,
  getSelectedForgeFuel,
  getSmithingCycleRequirements,
  getSmithingEffectiveInterval,
  getSmithingHammer,
  getSmithingHammerDefinitionByItemId,
  getSmithingProductionEstimate,
  getSmithingStartBlockReason,
} from '../game/formulas/smithingFormulas';
import { progressRatio } from '../game/engine/simulation';
import { useGameStore } from '../game/state/gameStore';
import type {
  GameState,
  QuantityMode,
  RecipeDefinition,
  ScreenId,
  SmithingToolDefinition,
} from '../game/types';
import { getItemQuantity } from '../game/systems/inventorySystem';
import { formatHoursMinutes, formatNumber, formatRatePerHour } from './formatters';
import { ItemIcon } from './ItemIcon';
import { ScreenHeading } from './ScreenHeading';
import { UiPanelSlot } from './UiPanelSlot';
import type { UiLayout } from './uiLayout';

export interface SmithingScreenProps {
  game: GameState;
  uiLayout: UiLayout;
  requestAction: (screen: ScreenId, action: () => void) => void;
}

const quantityOptions: QuantityMode[] = [1, 10, 'all', 'continuous'];
const outputGroups = ['all', 'weapon', 'armor', 'shield', 'tool'] as const;
type OutputGroup = (typeof outputGroups)[number];
type MetalFilter = 'all' | SmithingTier;
type ForgeVisibility = 'all' | 'unlocked';

const formatSeconds = (milliseconds: number): string => `${(milliseconds / 1000).toFixed(1)}s`;
const itemName = (itemId: string): string => itemById[itemId]?.name ?? itemId;

const formatQuantity = (mode: QuantityMode, remaining?: number | null): string => {
  if (mode === 'continuous') return 'Continuous';
  if (mode === 'all') return `All · ${remaining ?? 0} remaining`;
  return `${mode} cycle${mode === 1 ? '' : 's'}`;
};

const formatCost = (recipe: RecipeDefinition): string =>
  recipe.inputs.map((input) => `${input.quantity} ${itemName(input.itemId)}`).join(' + ');

const formatOutput = (recipe: RecipeDefinition): string =>
  `${recipe.outputQuantity} ${itemName(recipe.outputItemId)}`;

const formatEstimateTitle = (
  game: GameState,
  recipe: RecipeDefinition,
  mode: QuantityMode,
): string => {
  const estimate = getSmithingProductionEstimate(game, recipe, mode);
  return `${estimate.baseCraftsAvailable} crafts · ${formatHoursMinutes(estimate.totalBaseTimeMs)} · ${formatNumber(estimate.totalBaseXp)} XP`;
};

function SmithingMaterials({ game, recipe }: { game: GameState; recipe: RecipeDefinition }) {
  const requirements = getSmithingCycleRequirements(recipe);
  return (
    <div className="smithing-cost-materials">
      {requirements.map((requirement) => (
        <span className="smithing-material-line" key={requirement.itemId}>
          <span>{itemName(requirement.itemId)}</span>
          <strong>
            {formatNumber(getItemQuantity(game.inventory, requirement.itemId))} /{' '}
            {requirement.quantity}
          </strong>
        </span>
      ))}
    </div>
  );
}

function SmithingRecipeAction({
  game,
  recipe,
  mode,
  requestAction,
}: {
  game: GameState;
  recipe: RecipeDefinition;
  mode: QuantityMode;
  requestAction: SmithingScreenProps['requestAction'];
}) {
  const startSmithing = useGameStore((store) => store.startSmithing);
  const active = game.activeAction.type === 'smithing' && game.activeAction.recipeId === recipe.id;
  const blockReason = getSmithingStartBlockReason(game, recipe);
  const actionLabel = recipe.category === 'smelting' ? 'Start smelting' : 'Start forging';
  const buttonLabel =
    blockReason === 'load-fuel'
      ? 'Load fuel'
      : blockReason === 'fuel'
        ? 'No fuel'
        : blockReason === 'materials'
          ? 'Missing materials'
          : actionLabel;
  const title = formatEstimateTitle(game, recipe, mode);

  if (active)
    return (
      <button className="button gold" disabled title={title}>
        Working…
      </button>
    );
  if (blockReason === 'level')
    return (
      <button className="button ghost" disabled>
        <Lock size={13} /> Requires level {recipe.level}
      </button>
    );
  return (
    <button
      className="button primary"
      disabled={blockReason !== null}
      title={title}
      onClick={() => requestAction('smithing', () => startSmithing(recipe.id, mode))}
    >
      {buttonLabel}
    </button>
  );
}

function RecipeOutput({ recipe }: { recipe: RecipeDefinition }) {
  return (
    <div className="smithing-recipe-output">
      <ItemIcon itemId={recipe.outputItemId} size="md" />
      <div>
        <strong>{itemName(recipe.outputItemId)}</strong>
        <small>
          {recipe.name} · {recipe.outputQuantity} output
        </small>
      </div>
    </div>
  );
}

function ForgeRecipeCard({
  game,
  recipe,
  mode,
  requestAction,
}: {
  game: GameState;
  recipe: RecipeDefinition;
  mode: QuantityMode;
  requestAction: SmithingScreenProps['requestAction'];
}) {
  const active = game.activeAction.type === 'smithing' && game.activeAction.recipeId === recipe.id;
  const locked = game.skills.smithing.level < recipe.level;
  const fuelUnits = recipe.forgeFuelUnits ?? 0;
  const selectedFuel = getSelectedForgeFuel(game);
  const physicalFuelQuantity = getForgeFuelItemsRequired(game, recipe);
  return (
    <article
      className={`smithing-forge-card ${locked ? 'locked-card' : ''} ${active ? 'active' : ''}`}
    >
      <div className="smithing-forge-card-top">
        <RecipeOutput recipe={recipe} />
        <SmithingRecipeAction
          game={game}
          recipe={recipe}
          mode={mode}
          requestAction={requestAction}
        />
      </div>
      <div className="smithing-recipe-meta">
        <span>
          Level <strong>{recipe.level}</strong>
        </span>
        <span>
          XP <strong>{recipe.xp}</strong>
        </span>
        <span>
          Base time <strong>{formatSeconds(recipe.intervalMs)}</strong>
        </span>
      </div>
      <div className="smithing-forge-requirements">
        <SmithingMaterials game={game} recipe={recipe} />
        {fuelUnits > 0 && (
          <span className="smithing-fuel-cost">
            Fuel{' '}
            <strong>
              {physicalFuelQuantity}{' '}
              {selectedFuel?.name ?? `unit${physicalFuelQuantity === 1 ? '' : 's'}`} / craft
            </strong>
          </span>
        )}
      </div>
    </article>
  );
}

function AnvilRecipeRow({
  game,
  recipe,
  mode,
  requestAction,
}: {
  game: GameState;
  recipe: RecipeDefinition;
  mode: QuantityMode;
  requestAction: SmithingScreenProps['requestAction'];
}) {
  const active = game.activeAction.type === 'smithing' && game.activeAction.recipeId === recipe.id;
  const locked = game.skills.smithing.level < recipe.level;
  const interval = getSmithingEffectiveInterval(game, recipe);
  return (
    <article
      className={`smithing-anvil-row ${locked ? 'locked-card' : ''} ${active ? 'active' : ''}`}
      title={recipe.description}
    >
      <RecipeOutput recipe={recipe} />
      <div className="smithing-anvil-meta smithing-recipe-meta">
        <span>
          Level <strong>{recipe.level}</strong>
        </span>
        <span>
          XP <strong>{recipe.xp}</strong>
        </span>
        <span>
          Time <strong>{formatSeconds(interval)}</strong>
        </span>
      </div>
      <SmithingMaterials game={game} recipe={recipe} />
      <SmithingRecipeAction game={game} recipe={recipe} mode={mode} requestAction={requestAction} />
    </article>
  );
}

function FacilityHeader({
  icon,
  title,
  subtitle,
  collapsed,
  onToggle,
  controls,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  collapsed: boolean;
  onToggle: () => void;
  controls?: ReactNode;
}) {
  return (
    <div className="smithing-facility-header">
      <div className="smithing-facility-identity">
        <span className="smithing-facility-icon">{icon}</span>
        <span className="smithing-facility-title">
          <strong>{title}</strong>
          <small>{subtitle}</small>
        </span>
      </div>
      <div className="smithing-facility-controls">
        {controls}
        <button
          type="button"
          className="smithing-facility-collapse"
          data-smithing-control="collapse"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${title}`}
          title={`${collapsed ? 'Expand' : 'Collapse'} ${title}`}
        >
          <ChevronDown size={16} className={collapsed ? '' : 'rotated'} />
        </button>
      </div>
    </div>
  );
}

type FacilityKind = 'forge' | 'anvil';

const FACILITY_UPGRADE_PREVIEW: Record<
  FacilityKind,
  { currentName: string; nextName: string; plannedEffects: string[] }
> = {
  forge: {
    currentName: 'Basic Forge',
    nextName: 'Reinforced Forge',
    plannedEffects: ['Increased fuel capacity', 'Improved fuel efficiency', 'Faster smelting'],
  },
  anvil: {
    currentName: 'Basic Anvil',
    nextName: 'Reinforced Anvil',
    plannedEffects: [
      'Faster forging',
      'Improved Smithing Hammer effectiveness',
      'Advanced recipe support',
    ],
  },
};

function FacilityUpgradeTrigger({
  open,
  onToggle,
  panelId,
}: {
  open: boolean;
  onToggle: () => void;
  panelId: string;
}) {
  return (
    <button
      type="button"
      className="smithing-facility-upgrade-trigger"
      data-smithing-control="upgrade"
      aria-expanded={open}
      aria-controls={panelId}
      onClick={onToggle}
    >
      <ArrowUp size={14} />
      <span>Upgrade</span>
    </button>
  );
}

function FacilityUpgradePreview({ facility }: { facility: FacilityKind }) {
  const preview = FACILITY_UPGRADE_PREVIEW[facility];
  return (
    <section
      id={`${facility}-facility-upgrade-preview`}
      className="smithing-facility-upgrade-panel"
      aria-label={`${preview.currentName} facility upgrade preview`}
    >
      <div className="eyebrow">FACILITY UPGRADE</div>
      <div className="smithing-facility-upgrade-summary">
        <div>
          <strong>{preview.currentName}</strong>
          <small>Current Tier</small>
        </div>
        <div className="smithing-facility-upgrade-arrow" aria-hidden="true">
          →
        </div>
        <div>
          <strong>{preview.nextName}</strong>
          <small>Future Upgrade</small>
        </div>
      </div>
      <div className="smithing-facility-upgrade-details">
        <div className="smithing-facility-upgrade-effects">
          <span className="eyebrow">PLANNED UPGRADE EFFECTS</span>
          <ul>
            {preview.plannedEffects.map((effect) => (
              <li key={effect}>{effect}</li>
            ))}
          </ul>
        </div>
        <div className="smithing-facility-upgrade-requirements">
          <span className="eyebrow">REQUIREMENTS</span>
          <strong>Not yet available</strong>
          <small>Future progression resources</small>
        </div>
      </div>
      <div className="smithing-facility-upgrade-note">
        Upgrade requirements will be defined with future profession and combat progression.
        <span className="badge ghost">COMING LATER</span>
      </div>
    </section>
  );
}

function ForgeFuelControl({
  game,
  open,
  onOpenChange,
}: {
  game: GameState;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const selected = getSelectedForgeFuel(game);
  const fuel = game.smithing.forgeFuel;
  const capacity = getForgeFuelCapacity(game);
  const load = useGameStore((store) => store.loadForgeFuel);
  const unload = useGameStore((store) => store.unloadForgeFuel);
  const select = useGameStore((store) => store.selectForgeFuel);
  const setAuto = useGameStore((store) => store.setForgeAutoRefuel);
  const forgeRecipes = useMemo(() => getSmithingRecipesForCategory('smelting'), []);
  return (
    <div className="smithing-fuel-control">
      <button
        type="button"
        className="smithing-fuel-trigger"
        data-smithing-control="fuel"
        aria-label="Open Forge fuel controls"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
      >
        <span>
          <strong>Fuel: {selected?.name ?? 'None'}</strong>
          <small>
            {fuel.loadedFuelQuantity} / {capacity} loaded · Auto-refuel{' '}
            {fuel.autoRefuel ? 'ON' : 'OFF'}
          </small>
        </span>
        <ChevronDown size={14} className={open ? 'rotated' : ''} />
      </button>
      {open && (
        <div className="smithing-fuel-popover" role="dialog" aria-label="Forge fuel controls">
          <div className="eyebrow">Forge fuel</div>
          <label>
            Fuel
            <select
              aria-label="Forge fuel"
              value={fuel.selectedFuelItemId ?? ''}
              onChange={(event) => select(event.target.value)}
            >
              {SMITHING_FUELS.map((definition) => (
                <option value={definition.itemId} key={definition.itemId}>
                  {definition.name}
                </option>
              ))}
            </select>
          </label>
          <div className="smithing-fuel-popover-stats">
            <span>
              Inventory{' '}
              <strong>
                {selected ? formatNumber(getItemQuantity(game.inventory, selected.itemId)) : 0}{' '}
                {selected?.name ?? 'fuel'}
              </strong>
            </span>
            <span>
              Loaded{' '}
              <strong>
                {fuel.loadedFuelQuantity} / {capacity}
              </strong>
            </span>
          </div>
          <div className="smithing-fuel-estimates">
            <span className="eyebrow">Estimated fuel time</span>
            {forgeRecipes.map((recipe) => (
              <span key={recipe.id}>
                {recipe.name}{' '}
                <strong>~{formatSeconds(getForgeFuelTimeEstimate(game, recipe))}</strong>
              </span>
            ))}
          </div>
          <label className="smithing-auto-refuel">
            <input
              type="checkbox"
              checked={fuel.autoRefuel}
              onChange={(event) => setAuto(event.target.checked)}
            />
            Auto-refuel
          </label>
          <div className="button-row smithing-fuel-actions">
            <button className="button ghost" onClick={() => load(1)}>
              Load 1
            </button>
            <button className="button ghost" onClick={() => load(5)}>
              Load 5
            </button>
            <button className="button ghost" onClick={() => load(10)}>
              Load 10
            </button>
            <button className="button gold" onClick={() => load('max')}>
              Fill
            </button>
            <button className="button danger" onClick={unload}>
              Unload
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ForgeVisibilityControl({
  value,
  onChange,
}: {
  value: ForgeVisibility;
  onChange: (value: ForgeVisibility) => void;
}) {
  return (
    <div className="smithing-browse-control" role="group" aria-label="Forge visibility">
      <span className="smithing-filter-label">SHOW</span>
      <div className="filterbar smithing-filterbar">
        <button
          type="button"
          className={`button ${value === 'all' ? 'gold' : 'ghost'}`}
          onClick={() => onChange('all')}
        >
          All Bars
        </button>
        <button
          type="button"
          className={`button ${value === 'unlocked' ? 'gold' : 'ghost'}`}
          onClick={() => onChange('unlocked')}
        >
          Unlocked
        </button>
      </div>
    </div>
  );
}

function QuantitySelector({
  mode,
  setMode,
}: {
  mode: QuantityMode;
  setMode: (mode: QuantityMode) => void;
}) {
  return (
    <div className="button-row smithing-quantity-row" aria-label="Smithing quantity">
      <span className="muted">Quantity:</span>
      {quantityOptions.map((option) => (
        <button
          className={`button ${mode === option ? 'gold' : 'ghost'}`}
          key={String(option)}
          onClick={() => setMode(option)}
        >
          {option === 'continuous' ? 'Continuous' : option === 'all' ? 'All' : option}
        </button>
      ))}
    </div>
  );
}

const formatHammerStats = (hammer: SmithingToolDefinition): string =>
  `${Math.round(hammer.speedBonus * 100)}% faster · ${Math.round(hammer.materialPreservationChance * 100)}% preservation`;

const getActiveToolBonus = (game: GameState): { name: string; detail: string } => {
  const hammer = getSmithingHammer(game);
  if (hammer) return { name: itemName(hammer.itemId), detail: formatHammerStats(hammer) };
  const equippedToolId = game.equipment.tool;
  const equippedTool = equippedToolId ? itemById[equippedToolId] : undefined;
  return {
    name: 'No Smithing Hammer',
    detail: equippedTool
      ? `${equippedTool.name} equipped · No Smithing bonus`
      : 'Base speed · 0% preservation',
  };
};

function AnvilToolControl({
  game,
  open,
  onOpenChange,
}: {
  game: GameState;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const equip = useGameStore((store) => store.equip);
  const unequip = useGameStore((store) => store.unequip);
  const hammer = getSmithingHammer(game);
  const equippedToolId = game.equipment.tool;
  const equippedTool = equippedToolId ? itemById[equippedToolId] : undefined;
  const equippedHammer = getSmithingHammerDefinitionByItemId(equippedToolId);
  const activeAnvil =
    game.activeAction.type === 'smithing' &&
    recipeById[game.activeAction.recipeId]?.category === 'forging';
  const toolLabel = hammer ? itemName(hammer.itemId) : 'No Smithing Hammer';
  const toolDetail = hammer
    ? 'Equipped'
    : equippedTool && !equippedHammer
      ? `${equippedTool.name} equipped`
      : 'Base speed · 0% preservation';

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onOpenChange, open]);

  return (
    <div className="smithing-tool-control">
      <button
        type="button"
        className="smithing-tool-trigger"
        data-smithing-control="tool"
        aria-label={`Anvil tool: ${toolLabel}`}
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
      >
        <span>
          <strong>Tool: {toolLabel}</strong>
          <small>{toolDetail}</small>
        </span>
        <ChevronDown size={14} className={open ? 'rotated' : ''} />
      </button>
      {open && (
        <div className="smithing-tool-popover" role="dialog" aria-label="Anvil tool selector">
          <div className="eyebrow">Anvil tool</div>
          <div className="smithing-tool-equipped">
            <span>Equipped</span>
            <strong>{toolLabel}</strong>
            <small>{toolDetail}</small>
          </div>
          <div className="smithing-tool-options">
            <span className="eyebrow">Available hammers</span>
            {SMITHING_TOOLS.map((definition) => {
              const item = itemById[definition.itemId];
              const owned = getItemQuantity(game.inventory, definition.itemId);
              const isEquipped = equippedToolId === definition.itemId;
              const levelLocked = game.skills.smithing.level < definition.requiredSmithingLevel;
              const notOwned = owned <= 0;
              const disabled = activeAnvil || isEquipped || levelLocked || notOwned;
              const reason = activeAnvil
                ? 'Stop the current Anvil order to change tools.'
                : isEquipped
                  ? 'Currently equipped.'
                  : levelLocked
                    ? `Requires Smithing ${definition.requiredSmithingLevel}.`
                    : notOwned
                      ? 'Not owned.'
                      : undefined;
              return (
                <div className="smithing-tool-option" key={definition.itemId}>
                  <div>
                    <strong>{item?.name ?? definition.itemId}</strong>
                    <small>
                      Owned: {formatNumber(owned)} · Requires Smithing{' '}
                      {definition.requiredSmithingLevel}
                    </small>
                    <small>{formatHammerStats(definition)}</small>
                  </div>
                  <button
                    type="button"
                    className="button ghost"
                    disabled={disabled}
                    title={reason}
                    onClick={() => {
                      equip(definition.itemId);
                      onOpenChange(false);
                    }}
                  >
                    {isEquipped
                      ? 'Equipped'
                      : levelLocked
                        ? 'Locked'
                        : notOwned
                          ? 'Not owned'
                          : 'Equip'}
                  </button>
                </div>
              );
            })}
          </div>
          {equippedHammer && (
            <button
              type="button"
              className="button danger"
              disabled={activeAnvil}
              title={activeAnvil ? 'Stop the current Anvil order to change tools.' : undefined}
              onClick={() => {
                unequip('tool');
                onOpenChange(false);
              }}
            >
              Unequip Hammer
            </button>
          )}
          {activeAnvil && (
            <small className="smithing-tool-blocked">
              Stop the current Anvil order to change tools.
            </small>
          )}
        </div>
      )}
    </div>
  );
}

function ActiveOrder({
  game,
  recipe,
  action,
  stopAction,
}: {
  game: GameState;
  recipe: RecipeDefinition;
  action: Extract<GameState['activeAction'], { type: 'smithing' }>;
  stopAction: () => void;
}) {
  const estimate = getSmithingProductionEstimate(game, recipe, action.quantityMode);
  const interval = getSmithingEffectiveInterval(game, recipe);
  const progress = Math.round(
    Math.max(0, Math.min(1, progressRatio(action, Date.now(), game))) * 100,
  );
  const remainingMs = Math.max(0, interval - action.progressMs);
  const isForge = recipe.category === 'smelting';
  const selectedFuel = getSelectedForgeFuel(game);
  const fuelState = game.smithing.forgeFuel;
  const toolBonus = getActiveToolBonus(game);
  const available =
    action.quantityMode === 'continuous'
      ? `~${estimate.baseCraftsAvailable} crafts`
      : `${action.remaining ?? 0} crafts remaining`;
  const availableDetail =
    estimate.totalBaseXp > 0
      ? `${formatNumber(estimate.totalBaseXp)} XP · ${formatHoursMinutes(estimate.totalBaseTimeMs)}`
      : 'No crafts available';
  return (
    <div className="smithing-active-order">
      <div className="smithing-active-heading">
        <div className="smithing-active-order-identity">
          <ItemIcon itemId={recipe.outputItemId} size="lg" />
          <div>
            <div className="eyebrow">Active Order</div>
            <h2>{recipe.name}</h2>
            <span className="smithing-active-facility">
              {isForge ? 'Forge' : 'Anvil'} ·{' '}
              {formatQuantity(action.quantityMode, action.remaining)}
            </span>
          </div>
        </div>
        <button className="button danger" onClick={stopAction}>
          Stop
        </button>
      </div>
      <div className="smithing-active-progress">
        <div className="split">
          <span>{itemName(recipe.outputItemId)}</span>
          <strong>{formatSeconds(remainingMs)}</strong>
        </div>
        <div className="bar">
          <i style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="smithing-order-grid">
        <div>
          <span>COST</span>
          <strong>{formatCost(recipe)}</strong>
        </div>
        <div>
          <span>OUTPUT</span>
          <strong>{formatOutput(recipe)}</strong>
        </div>
        <div>
          <span>XP</span>
          <strong>{recipe.xp} / craft</strong>
        </div>
        <div>
          <span>RATE</span>
          <strong>~{formatRatePerHour(estimate.xpPerHour)} XP/hr</strong>
        </div>
      </div>
      <div className="smithing-active-context-grid">
        <div className="smithing-order-detail">
          <span className="eyebrow">AVAILABLE</span>
          <strong
            title={
              action.quantityMode === 'continuous'
                ? 'Material preservation may extend Continuous production beyond this estimate.'
                : undefined
            }
          >
            {available}
          </strong>
          <small>{availableDetail}</small>
        </div>
        {isForge ? (
          <div className="smithing-order-detail">
            <span className="eyebrow">FORGE FUEL</span>
            <strong>
              {selectedFuel?.name ?? 'No fuel'} · {fuelState.loadedFuelQuantity} /{' '}
              {getForgeFuelCapacity(game)}
            </strong>
            <small>Auto-refuel {fuelState.autoRefuel ? 'ON' : 'OFF'}</small>
          </div>
        ) : (
          <div className="smithing-order-detail">
            <span className="eyebrow">TOOL BONUS</span>
            <strong>{toolBonus.name}</strong>
            <small>{toolBonus.detail}</small>
          </div>
        )}
      </div>
    </div>
  );
}

export function SmithingScreen({ game, uiLayout, requestAction }: SmithingScreenProps) {
  const [mode, setMode] = useState<QuantityMode>(1);
  const [forgeCollapsed, setForgeCollapsed] = useState(false);
  const [anvilCollapsed, setAnvilCollapsed] = useState(false);
  const [forgeUpgradeOpen, setForgeUpgradeOpen] = useState(false);
  const [forgeFuelOpen, setForgeFuelOpen] = useState(false);
  const [anvilUpgradeOpen, setAnvilUpgradeOpen] = useState(false);
  const [anvilToolOpen, setAnvilToolOpen] = useState(false);
  const [collapsedTiers, setCollapsedTiers] = useState<Record<SmithingTier, boolean>>({
    iron: false,
    steel: false,
  });
  const [forgeVisibility, setForgeVisibility] = useState<ForgeVisibility>('all');
  const [filter, setFilter] = useState<OutputGroup>('all');
  const [metalFilter, setMetalFilter] = useState<MetalFilter>('all');
  const stopAction = useGameStore((store) => store.stopAction);
  const toggleForgeUpgrade = () => {
    const nextOpen = !forgeUpgradeOpen;
    setForgeUpgradeOpen(nextOpen);
    if (nextOpen) setForgeFuelOpen(false);
  };
  const toggleForgeFuel = (open: boolean) => {
    setForgeFuelOpen(open);
    if (open) setForgeUpgradeOpen(false);
  };
  const toggleAnvilUpgrade = () => {
    const nextOpen = !anvilUpgradeOpen;
    setAnvilUpgradeOpen(nextOpen);
    if (nextOpen) setAnvilToolOpen(false);
  };
  const toggleAnvilTool = (open: boolean) => {
    setAnvilToolOpen(open);
    if (open) setAnvilUpgradeOpen(false);
  };
  const toggleForgeCollapsed = () => {
    const nextCollapsed = !forgeCollapsed;
    setForgeCollapsed(nextCollapsed);
    if (nextCollapsed) {
      setForgeUpgradeOpen(false);
      setForgeFuelOpen(false);
    }
  };
  const toggleAnvilCollapsed = () => {
    const nextCollapsed = !anvilCollapsed;
    setAnvilCollapsed(nextCollapsed);
    if (nextCollapsed) {
      setAnvilUpgradeOpen(false);
      setAnvilToolOpen(false);
    }
  };
  const levelProgress = getLevelProgress(game.skills.smithing);
  const active = game.activeAction.type === 'smithing' ? game.activeAction : null;
  const activeRecipe = active ? recipeById[active.recipeId] : undefined;
  const forgeRecipes = useMemo(
    () =>
      getSmithingRecipesForCategory('smelting')
        .map((recipe, index) => ({ recipe, index }))
        .sort(
          (first, second) => first.recipe.level - second.recipe.level || first.index - second.index,
        )
        .map(({ recipe }) => recipe),
    [],
  );
  const visibleForgeRecipes = useMemo(
    () =>
      forgeVisibility === 'unlocked'
        ? forgeRecipes.filter((recipe) => game.skills.smithing.level >= recipe.level)
        : forgeRecipes,
    [forgeRecipes, forgeVisibility, game.skills.smithing.level],
  );
  const metalOptions = useMemo<MetalFilter[]>(() => {
    const tiers = new Set<MetalFilter>();
    for (const recipe of ACTIVE_SMITHING_RECIPES) {
      if (recipe.category !== 'forging') continue;
      const tier = itemById[recipe.outputItemId]?.tier;
      if (tier === 'iron' || tier === 'steel') tiers.add(tier);
    }
    return ['all', ...tiers];
  }, []);
  const anvilRecipes = useMemo(
    () =>
      ACTIVE_SMITHING_RECIPES.filter((recipe) => {
        if (recipe.category !== 'forging') return false;
        const item = itemById[recipe.outputItemId];
        return (
          (filter === 'all' || item?.category === filter) &&
          (metalFilter === 'all' || item?.tier === metalFilter)
        );
      }),
    [filter, metalFilter],
  );
  const tierGroups = useMemo(() => {
    const tiers: SmithingTier[] =
      metalFilter === 'all'
        ? metalOptions.filter((tier): tier is SmithingTier => tier !== 'all')
        : [metalFilter];
    return tiers
      .map((tier) => ({
        tier,
        recipes: anvilRecipes.filter((recipe) => itemById[recipe.outputItemId]?.tier === tier),
      }))
      .filter((group) => group.recipes.length > 0);
  }, [anvilRecipes, metalFilter, metalOptions]);
  const xpRemaining = Math.max(0, levelProgress.next - levelProgress.current);

  return (
    <>
      <ScreenHeading
        eyebrow="Skill · Production"
        title="Smithing"
        description="Fuel the Forge, shape metal at the Anvil, and turn mined resources into dependable equipment."
        trailing={
          <div className="smithing-heading-progress">
            <span className="badge gold">
              Level {game.skills.smithing.level} · {formatNumber(game.skills.smithing.xp)} XP
            </span>
            <div
              className="bar"
              role="progressbar"
              aria-label="Smithing level progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(levelProgress.percent)}
            >
              <i style={{ width: `${levelProgress.percent}%` }} />
            </div>
            <small>
              {game.skills.smithing.level >= 100
                ? 'MAX LEVEL'
                : `${Math.round(levelProgress.percent)}% to Level ${game.skills.smithing.level + 1} · ${formatNumber(xpRemaining)} XP to next`}
            </small>
          </div>
        }
      />
      <div className="ui-panel-grid smithing-panel-grid" data-ui-panel-grid="smithing">
        <UiPanelSlot screen="smithing" id="smithingOverview" layout={uiLayout}>
          <section className="panel panel-pad smithing-overview-panel">
            {active && activeRecipe ? (
              <ActiveOrder
                game={game}
                recipe={activeRecipe}
                action={active}
                stopAction={stopAction}
              />
            ) : (
              <div className="smithing-idle-overview">
                <div>
                  <div className="eyebrow">Production ready</div>
                  <h2>Smithing idle</h2>
                  <p>Select a Forge or Anvil recipe to begin.</p>
                </div>
              </div>
            )}
            {!active && <QuantitySelector mode={mode} setMode={setMode} />}
          </section>
        </UiPanelSlot>
        <UiPanelSlot screen="smithing" id="smithingForge" layout={uiLayout}>
          <section className="panel panel-pad smithing-facility-panel">
            <FacilityHeader
              icon={<Flame size={19} />}
              title="Forge"
              subtitle="Smelt ore into usable metal bars."
              controls={
                <>
                  <FacilityUpgradeTrigger
                    open={forgeUpgradeOpen}
                    onToggle={toggleForgeUpgrade}
                    panelId="forge-facility-upgrade-preview"
                  />
                  <ForgeFuelControl
                    game={game}
                    open={forgeFuelOpen}
                    onOpenChange={toggleForgeFuel}
                  />
                </>
              }
              collapsed={forgeCollapsed}
              onToggle={toggleForgeCollapsed}
            />
            {!forgeCollapsed && (
              <>
                {forgeUpgradeOpen && <FacilityUpgradePreview facility="forge" />}
                <ForgeVisibilityControl value={forgeVisibility} onChange={setForgeVisibility} />
                <div className="smithing-recipe-list smithing-forge-list">
                  {visibleForgeRecipes.map((recipe) => (
                    <ForgeRecipeCard
                      key={recipe.id}
                      game={game}
                      recipe={recipe}
                      mode={mode}
                      requestAction={requestAction}
                    />
                  ))}
                </div>
              </>
            )}
          </section>
        </UiPanelSlot>
        <UiPanelSlot screen="smithing" id="smithingAnvil" layout={uiLayout}>
          <section className="panel panel-pad smithing-facility-panel">
            <FacilityHeader
              icon={<Hammer size={19} />}
              title="Anvil"
              subtitle="Forge bars into equipment and profession tools."
              controls={
                <>
                  <FacilityUpgradeTrigger
                    open={anvilUpgradeOpen}
                    onToggle={toggleAnvilUpgrade}
                    panelId="anvil-facility-upgrade-preview"
                  />
                  <AnvilToolControl
                    game={game}
                    open={anvilToolOpen}
                    onOpenChange={toggleAnvilTool}
                  />
                </>
              }
              collapsed={anvilCollapsed}
              onToggle={toggleAnvilCollapsed}
            />
            {!anvilCollapsed && (
              <>
                {anvilUpgradeOpen && <FacilityUpgradePreview facility="anvil" />}
                <div className="smithing-filter-groups">
                  <div
                    className="smithing-filter-group"
                    role="group"
                    aria-label="Anvil type filters"
                  >
                    <span className="smithing-filter-label">TYPE</span>
                    <div className="filterbar smithing-filterbar">
                      {outputGroups.map((option) => (
                        <button
                          type="button"
                          key={option}
                          className={`button ${filter === option ? 'gold' : 'ghost'}`}
                          onClick={() => setFilter(option)}
                        >
                          {option === 'all'
                            ? 'All'
                            : option === 'armor'
                              ? 'Armor'
                              : `${option[0].toUpperCase()}${option.slice(1)}s`}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div
                    className="smithing-filter-group"
                    role="group"
                    aria-label="Anvil metal filters"
                  >
                    <span className="smithing-filter-label">METAL</span>
                    <div className="filterbar smithing-filterbar">
                      {metalOptions.map((option) => (
                        <button
                          type="button"
                          key={option}
                          className={`button ${metalFilter === option ? 'gold' : 'ghost'}`}
                          onClick={() => setMetalFilter(option)}
                        >
                          {option === 'all'
                            ? 'All Metals'
                            : option[0].toUpperCase() + option.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="smithing-recipe-list smithing-anvil-list">
                  {tierGroups.map(({ tier, recipes }) => (
                    <section className="smithing-tier-group" key={tier}>
                      <button
                        type="button"
                        className="smithing-tier-heading"
                        aria-expanded={!(metalFilter === 'all' && collapsedTiers[tier])}
                        aria-controls={`smithing-tier-${tier}-recipes`}
                        aria-label={`${metalFilter === 'all' && collapsedTiers[tier] ? 'Expand' : 'Collapse'} ${tier} recipes`}
                        onClick={() =>
                          setCollapsedTiers((current) => ({ ...current, [tier]: !current[tier] }))
                        }
                      >
                        <span>{tier.toUpperCase()}</span>
                        <small>
                          ·{' '}
                          {formatNumber(
                            getItemQuantity(game.inventory, SMITHING_BAR_BY_TIER[tier]),
                          )}{' '}
                          bars
                        </small>
                        <i />
                        <ChevronDown
                          size={15}
                          className={metalFilter === 'all' && collapsedTiers[tier] ? '' : 'rotated'}
                        />
                      </button>
                      {!(metalFilter === 'all' && collapsedTiers[tier]) && (
                        <div className="smithing-tier-recipes" id={`smithing-tier-${tier}-recipes`}>
                          {recipes.map((recipe) => (
                            <AnvilRecipeRow
                              key={recipe.id}
                              game={game}
                              recipe={recipe}
                              mode={mode}
                              requestAction={requestAction}
                            />
                          ))}
                        </div>
                      )}
                    </section>
                  ))}
                </div>
              </>
            )}
          </section>
        </UiPanelSlot>
      </div>
    </>
  );
}
