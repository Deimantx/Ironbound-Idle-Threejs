import { ChevronDown, Flame, Hammer, Lock } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import {
  ACTIVE_SMITHING_RECIPES,
  getSmithingRecipesForCategory,
  recipeById,
} from '../content/recipes';
import { itemById } from '../content/items';
import { getLevelProgress } from '../game/formulas/experienceFormulas';
import {
  getSmithingCycleRequirements,
  getSmithingEffectiveInterval,
  getSmithingHammer,
  getSmithingStartBlockReason,
} from '../game/formulas/smithingFormulas';
import { progressRatio } from '../game/engine/simulation';
import { useGameStore } from '../game/state/gameStore';
import type { GameState, QuantityMode, RecipeDefinition, ScreenId } from '../game/types';
import { getItemQuantity } from '../game/systems/inventorySystem';
import { formatNumber } from './formatters';
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

const formatSeconds = (milliseconds: number): string => `${(milliseconds / 1000).toFixed(1)}s`;

const formatQuantity = (mode: QuantityMode, remaining?: number | null): string => {
  if (mode === 'continuous') return 'Continuous';
  if (mode === 'all') return `All · ${remaining ?? 0} left`;
  return `${mode} cycle${mode === 1 ? '' : 's'}`;
};

const itemName = (itemId: string): string => itemById[itemId]?.name ?? itemId;

function SmithingMaterials({ game, recipe }: { game: GameState; recipe: RecipeDefinition }) {
  const requirements = getSmithingCycleRequirements(recipe);
  return (
    <div className="recipe-materials smithing-recipe-materials">
      {requirements.map((requirement, index) => {
        const owned = getItemQuantity(game.inventory, requirement.itemId);
        return (
          <span
            className={`material-chip ${owned < requirement.quantity ? 'missing' : ''}`}
            key={`${requirement.itemId}-${index}`}
          >
            {itemName(requirement.itemId)} ×{requirement.quantity} · {owned}
            {requirement.fuel && <small> fuel</small>}
          </span>
        );
      })}
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
    blockReason === 'fuel'
      ? 'Missing Coal fuel'
      : blockReason === 'materials'
        ? 'Missing materials'
        : actionLabel;

  if (active)
    return (
      <button className="button gold" disabled>
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
      <SmithingMaterials game={game} recipe={recipe} />
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
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  collapsed: boolean;
  onToggle: () => void;
  summary: string;
}) {
  return (
    <button
      type="button"
      className="smithing-facility-header"
      onClick={onToggle}
      aria-expanded={!collapsed}
    >
      <span className="smithing-facility-icon">{icon}</span>
      <span className="smithing-facility-title">
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </span>
      <span className="smithing-facility-summary">{summary}</span>
      <ChevronDown size={16} className={collapsed ? '' : 'rotated'} />
    </button>
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

const hammerSummary = (game: GameState): string => {
  const hammer = getSmithingHammer(game);
  if (!hammer) return 'No Smithing Hammer · Base speed · 0% preservation';
  return `${itemName(hammer.itemId)} · ${Math.round(hammer.speedBonus * 100)}% faster · ${Math.round(hammer.materialPreservationChance * 100)}% preservation`;
};

export function SmithingScreen({ game, uiLayout, requestAction }: SmithingScreenProps) {
  const [mode, setMode] = useState<QuantityMode>(1);
  const [forgeCollapsed, setForgeCollapsed] = useState(false);
  const [anvilCollapsed, setAnvilCollapsed] = useState(false);
  const [filter, setFilter] = useState<OutputGroup>('all');
  const stopAction = useGameStore((store) => store.stopAction);
  const levelProgress = getLevelProgress(game.skills.smithing);
  const active = game.activeAction.type === 'smithing' ? game.activeAction : null;
  const activeRecipe = active ? recipeById[active.recipeId] : undefined;
  const forgeRecipes = useMemo(() => getSmithingRecipesForCategory('smelting'), []);
  const anvilRecipes = useMemo(
    () =>
      ACTIVE_SMITHING_RECIPES.filter(
        (recipe) =>
          recipe.category === 'forging' &&
          (filter === 'all' || itemById[recipe.outputItemId]?.category === filter),
      ),
    [filter],
  );
  const tierGroups = useMemo(
    () =>
      (['iron', 'steel'] as const)
        .map((tier) => ({
          tier,
          recipes: anvilRecipes.filter((recipe) => recipe.outputItemId.startsWith(`${tier}-`)),
        }))
        .filter((group) => group.recipes.length > 0),
    [anvilRecipes],
  );
  const activeInterval = activeRecipe ? getSmithingEffectiveInterval(game, activeRecipe) : 1;
  const activeProgress = active
    ? Math.round(Math.max(0, Math.min(1, progressRatio(active, Date.now(), game))) * 100)
    : 0;
  const activeQuantity = active ? formatQuantity(active.quantityMode, active.remaining) : null;
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
              <div className="smithing-active-overview">
                <div className="smithing-active-heading">
                  <div>
                    <div className="eyebrow">Active production</div>
                    <h2>{activeRecipe.name}</h2>
                    <span className="smithing-active-facility">
                      {activeRecipe.category === 'smelting' ? 'Forge' : 'Anvil'} · {activeQuantity}
                    </span>
                  </div>
                  <button className="button danger" onClick={stopAction}>
                    Stop
                  </button>
                </div>
                <div className="smithing-active-progress">
                  <div className="split">
                    <span>Cycle progress</span>
                    <strong>
                      {formatSeconds(Math.max(0, activeInterval - active.progressMs))} remaining
                    </strong>
                  </div>
                  <div className="bar">
                    <i style={{ width: `${activeProgress}%` }} />
                  </div>
                </div>
                <div className="smithing-active-meta">
                  <span>
                    Quantity <strong>{activeQuantity}</strong>
                  </span>
                  <span>
                    Remaining{' '}
                    <strong>
                      {active.quantityMode === 'continuous'
                        ? 'Until resources run out'
                        : (active.remaining ?? 0)}
                    </strong>
                  </span>
                </div>
              </div>
            ) : (
              <div className="smithing-idle-overview">
                <div>
                  <div className="eyebrow">Production ready</div>
                  <h2>Smithing idle</h2>
                  <p>Select a Forge or Anvil recipe to begin.</p>
                </div>
              </div>
            )}
            <QuantitySelector mode={mode} setMode={setMode} />
          </section>
        </UiPanelSlot>
        <UiPanelSlot screen="smithing" id="smithingForge" layout={uiLayout}>
          <section className="panel panel-pad smithing-facility-panel">
            <FacilityHeader
              icon={<Flame size={19} />}
              title="Forge"
              subtitle="Smelt ore into usable metal bars."
              summary={`${formatNumber(getItemQuantity(game.inventory, 'coal'))} Coal`}
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
              summary={hammerSummary(game)}
              collapsed={anvilCollapsed}
              onToggle={() => setAnvilCollapsed((value) => !value)}
            />
            {!anvilCollapsed && (
              <>
                <div className="filterbar smithing-filterbar" aria-label="Anvil filters">
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
