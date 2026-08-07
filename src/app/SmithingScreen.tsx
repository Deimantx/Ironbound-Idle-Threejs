import { ChevronDown, Flame, Hammer, Lock } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import {
  ACTIVE_SMITHING_RECIPES,
  getSmithingRecipesForCategory,
  recipeById,
} from '../content/recipes';
import { SMITHING_FUELS } from '../content/smithingFuels';
import { itemById } from '../content/items';
import { getLevelProgress } from '../game/formulas/experienceFormulas';
import {
  getForgeFuelCapacity,
  getForgeFuelTimeEstimate,
  getSelectedForgeFuel,
  getSmithingCycleRequirements,
  getSmithingEffectiveInterval,
  getSmithingHammer,
  getSmithingProductionEstimate,
  getSmithingStartBlockReason,
} from '../game/formulas/smithingFormulas';
import { progressRatio } from '../game/engine/simulation';
import { useGameStore } from '../game/state/gameStore';
import type { GameState, QuantityMode, RecipeDefinition, ScreenId } from '../game/types';
import { getItemQuantity } from '../game/systems/inventorySystem';
import { formatNumber, formatRatePerHour } from './formatters';
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
type MetalFilter = 'all' | 'iron' | 'steel';

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
  return `Base available: ${estimate.baseCraftsAvailable} crafts · ~${formatSeconds(estimate.totalBaseTimeMs)} · ${formatNumber(estimate.totalBaseXp)} XP`;
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
              {fuelUnits} unit{fuelUnits === 1 ? '' : 's'} / craft
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
  const improved = interval !== recipe.intervalMs;
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
          Time{' '}
          <strong>
            {formatSeconds(recipe.intervalMs)}
            {improved && <em className="smithing-improved-time"> → {formatSeconds(interval)}</em>}
          </strong>
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
  summary,
  accessory,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  collapsed: boolean;
  onToggle: () => void;
  summary: string;
  accessory?: ReactNode;
}) {
  return (
    <div className="smithing-facility-header">
      <button
        type="button"
        className="smithing-facility-collapse"
        onClick={onToggle}
        aria-expanded={!collapsed}
        aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${title} ${subtitle}`}
      >
        <span className="smithing-facility-icon">{icon}</span>
        <span className="smithing-facility-title">
          <strong>{title}</strong>
          <small>{subtitle}</small>
        </span>
        <span className="smithing-facility-summary">{summary}</span>
        <ChevronDown size={16} className={collapsed ? '' : 'rotated'} />
      </button>
      {accessory}
    </div>
  );
}

function ForgeFuelControl({ game }: { game: GameState }) {
  const [open, setOpen] = useState(false);
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
        aria-label="Open Forge fuel controls"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
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

function HammerSummary({ game }: { game: GameState }) {
  const hammer = getSmithingHammer(game);
  return (
    <span className="smithing-tool-summary">
      {hammer
        ? `${itemName(hammer.itemId)} · ${Math.round(hammer.speedBonus * 100)}% faster · ${Math.round(hammer.materialPreservationChance * 100)}% preservation`
        : 'No Smithing Hammer · Base speed · 0% preservation'}
    </span>
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
  const loadedFuelTime = getForgeFuelTimeEstimate(game, recipe);
  const available =
    action.quantityMode === 'continuous'
      ? `~${estimate.baseCraftsAvailable} base crafts available`
      : `${action.remaining ?? 0} remaining`;
  return (
    <div className="smithing-active-order">
      <div className="smithing-active-heading">
        <div>
          <div className="eyebrow">Active Order</div>
          <h2>
            {isForge ? 'Smelting' : 'Forging'} {recipe.name}
          </h2>
          <span className="smithing-active-facility">
            {isForge ? 'Forge' : 'Anvil'} · {formatQuantity(action.quantityMode, action.remaining)}
          </span>
        </div>
        <button className="button danger" onClick={stopAction}>
          Stop
        </button>
      </div>
      <div className="smithing-active-progress">
        <div className="split">
          <span>Next {itemName(recipe.outputItemId)}</span>
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
      <div className="smithing-order-detail">
        <span className="eyebrow">AVAILABLE</span>
        <strong>{available}</strong>
        <small>
          {estimate.totalBaseXp > 0
            ? `Base output: ${formatNumber(estimate.totalBaseXp)} XP · ${formatSeconds(estimate.totalBaseTimeMs)}`
            : 'No base crafts available'}
        </small>
      </div>
      {isForge ? (
        <div className="smithing-order-detail">
          <span className="eyebrow">FUEL</span>
          <strong>
            {selectedFuel?.name ?? 'No fuel'} · {fuelState.loadedFuelQuantity} /{' '}
            {getForgeFuelCapacity(game)} loaded · Auto-refuel {fuelState.autoRefuel ? 'ON' : 'OFF'}
          </strong>
          <small>
            Estimated fuel time: ~{formatSeconds(loadedFuelTime)} · {estimate.baseCraftsAvailable}{' '}
            base crafts from current resources
          </small>
        </div>
      ) : (
        <div className="smithing-order-detail">
          <span className="eyebrow">TOOL</span>
          <HammerSummary game={game} />
        </div>
      )}
    </div>
  );
}

export function SmithingScreen({ game, uiLayout, requestAction }: SmithingScreenProps) {
  const [mode, setMode] = useState<QuantityMode>(1);
  const [forgeCollapsed, setForgeCollapsed] = useState(false);
  const [anvilCollapsed, setAnvilCollapsed] = useState(false);
  const [filter, setFilter] = useState<OutputGroup>('all');
  const [metalFilter, setMetalFilter] = useState<MetalFilter>('all');
  const stopAction = useGameStore((store) => store.stopAction);
  const levelProgress = getLevelProgress(game.skills.smithing);
  const active = game.activeAction.type === 'smithing' ? game.activeAction : null;
  const activeRecipe = active ? recipeById[active.recipeId] : undefined;
  const forgeRecipes = useMemo(() => getSmithingRecipesForCategory('smelting'), []);
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
    const tiers =
      metalFilter === 'all' ? metalOptions.filter((tier) => tier !== 'all') : [metalFilter];
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
              summary=""
              accessory={<ForgeFuelControl game={game} />}
              collapsed={forgeCollapsed}
              onToggle={() => setForgeCollapsed((value) => !value)}
            />
            {!forgeCollapsed && (
              <div className="smithing-recipe-list smithing-forge-list">
                {forgeRecipes.map((recipe) => (
                  <ForgeRecipeCard
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
        </UiPanelSlot>
        <UiPanelSlot screen="smithing" id="smithingAnvil" layout={uiLayout}>
          <section className="panel panel-pad smithing-facility-panel">
            <FacilityHeader
              icon={<Hammer size={19} />}
              title="Anvil"
              subtitle="Forge bars into equipment and profession tools."
              summary=""
              accessory={<HammerSummary game={game} />}
              collapsed={anvilCollapsed}
              onToggle={() => setAnvilCollapsed((value) => !value)}
            />
            {!anvilCollapsed && (
              <>
                <div className="smithing-filter-groups">
                  <div className="filterbar smithing-filterbar" aria-label="Anvil type filters">
                    {outputGroups.map((option) => (
                      <button
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
                  <div
                    className="filterbar smithing-filterbar smithing-metal-filterbar"
                    aria-label="Anvil metal filters"
                  >
                    {metalOptions.map((option) => (
                      <button
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
                <div className="smithing-recipe-list smithing-anvil-list">
                  {tierGroups.map(({ tier, recipes }) => (
                    <section className="smithing-tier-group" key={tier}>
                      <div className="smithing-tier-heading">
                        <span>{tier.toUpperCase()}</span>
                        <i />
                      </div>
                      <div className="smithing-tier-recipes">
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
