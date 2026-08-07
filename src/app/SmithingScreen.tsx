import { ChevronDown, Flame, Hammer, Lock } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  ACTIVE_SMITHING_RECIPES,
  getSmithingRecipesForCategory,
  recipeById,
} from '../content/recipes';
import { itemById } from '../content/items';
import { getLevelProgress } from '../game/formulas/experienceFormulas';
import {
  getSmithingEffectiveInterval,
  getSmithingEstimatedRates,
  getSmithingCycleRequirements,
  getSmithingHammer,
  getSmithingPreservationChance,
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

const formatSeconds = (milliseconds: number): string => `${(milliseconds / 1000).toFixed(1)}s`;

function RecipeRow({
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
  const locked = game.skills.smithing.level < recipe.level;
  const requirements = getSmithingCycleRequirements(recipe);
  const canStart = requirements.every(
    (requirement) => getItemQuantity(game.inventory, requirement.itemId) >= requirement.quantity,
  );
  const interval = getSmithingEffectiveInterval(game, recipe);
  const preservation = getSmithingPreservationChance(game, recipe);
  const rates = getSmithingEstimatedRates(game, recipe);
  const actionLabel = recipe.category === 'smelting' ? 'Start smelting' : 'Start forging';

  return (
    <article
      className={`smithing-recipe-row ${locked ? 'locked-card' : ''} ${active ? 'active' : ''}`}
    >
      <div className="smithing-recipe-output">
        <ItemIcon itemId={recipe.outputItemId} size="md" />
        <div>
          <strong>{itemById[recipe.outputItemId]?.name ?? recipe.name}</strong>
          <small>
            {recipe.name} · {recipe.outputQuantity} output
          </small>
        </div>
      </div>
      <div className="smithing-recipe-meta">
        <span>
          Level <strong>{recipe.level}</strong>
        </span>
        <span>
          XP <strong>{recipe.xp}</strong>
        </span>
        <span>
          Time <strong>{formatSeconds(recipe.intervalMs)}</strong>
          {recipe.category === 'forging' && interval !== recipe.intervalMs
            ? ` → ${formatSeconds(interval)}`
            : ''}
        </span>
        {recipe.category === 'forging' && (
          <span>
            Preserve <strong>{Math.round(preservation * 100)}%</strong>
          </span>
        )}
        {recipe.category === 'forging' && (
          <span className="smithing-rate">~{formatRatePerHour(rates.xpPerHour)} XP/hr</span>
        )}
      </div>
      <div className="recipe-materials smithing-recipe-materials">
        {requirements.map((requirement, index) => {
          const owned = getItemQuantity(game.inventory, requirement.itemId);
          return (
            <span
              className={`material-chip ${owned < requirement.quantity ? 'missing' : ''}`}
              key={`${requirement.itemId}-${index}`}
            >
              {itemById[requirement.itemId]?.name ?? requirement.itemId} ×{requirement.quantity} ·{' '}
              {owned}
              {recipe.fuel?.itemId === requirement.itemId && <small> fuel</small>}
            </span>
          );
        })}
      </div>
      {locked ? (
        <button className="button ghost" disabled>
          <Lock size={13} /> Requires level {recipe.level}
        </button>
      ) : active ? (
        <button className="button gold" disabled>
          Working…
        </button>
      ) : (
        <button
          className="button primary"
          disabled={!canStart}
          onClick={() => requestAction('smithing', () => startSmithing(recipe.id, mode))}
        >
          {canStart
            ? actionLabel
            : recipe.fuel &&
                getItemQuantity(game.inventory, recipe.fuel.itemId) < recipe.fuel.quantity
              ? 'Missing Coal fuel'
              : 'Missing materials'}
        </button>
      )}
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
  icon: React.ReactNode;
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

export function SmithingScreen({ game, uiLayout, requestAction }: SmithingScreenProps) {
  const [mode, setMode] = useState<QuantityMode>(1);
  const [forgeCollapsed, setForgeCollapsed] = useState(false);
  const [anvilCollapsed, setAnvilCollapsed] = useState(false);
  const [filter, setFilter] = useState<OutputGroup>('all');
  const stopAction = useGameStore((store) => store.stopAction);
  const levelProgress = getLevelProgress(game.skills.smithing);
  const active = game.activeAction.type === 'smithing' ? game.activeAction : null;
  const activeRecipe = active ? recipeById[active.recipeId] : undefined;
  const hammer = getSmithingHammer(game);
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
  const activeInterval = activeRecipe ? getSmithingEffectiveInterval(game, activeRecipe) : 1;
  const activeProgress = active
    ? Math.round(Math.max(0, Math.min(1, progressRatio(active, Date.now(), game))) * 100)
    : 0;

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
            <div className="bar" title="Smithing progress to next level">
              <i style={{ width: `${levelProgress.percent}%` }} />
            </div>
            <small>
              {game.skills.smithing.level >= 100
                ? 'MAX LEVEL'
                : `${Math.round(levelProgress.percent)}% to Level ${game.skills.smithing.level + 1}`}
            </small>
          </div>
        }
      />
      <div className="ui-panel-grid smithing-panel-grid" data-ui-panel-grid="smithing">
        <UiPanelSlot screen="smithing" id="smithingOverview" layout={uiLayout}>
          <section className="panel panel-pad smithing-overview-panel">
            <div className="split">
              <div>
                <div className="eyebrow">Active production</div>
                <h2>{activeRecipe?.name ?? 'Smithing is idle'}</h2>
              </div>
              {active && (
                <button className="button danger" onClick={stopAction}>
                  Stop
                </button>
              )}
            </div>
            <div className="smithing-overview-grid">
              <span>
                Facility
                <strong>
                  {activeRecipe ? (activeRecipe.category === 'smelting' ? 'Forge' : 'Anvil') : '—'}
                </strong>
              </span>
              <span>
                Coal owned<strong>{formatNumber(getItemQuantity(game.inventory, 'coal'))}</strong>
              </span>
              <span>
                Profession tool
                <strong>
                  {hammer ? hammer.itemId.replaceAll('-', ' ') : 'No Smithing Hammer'}
                </strong>
              </span>
              <span>
                Quantity
                <strong>
                  {active
                    ? active.quantityMode === 'all'
                      ? `All · ${active.remaining ?? 0} left`
                      : active.quantityMode === 'continuous'
                        ? 'Continuous'
                        : `${active.quantityMode} cycle${active.quantityMode === 1 ? '' : 's'}`
                    : 'Select a mode'}
                </strong>
              </span>
            </div>
            {active && (
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
            )}
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
          </section>
        </UiPanelSlot>
        <UiPanelSlot screen="smithing" id="smithingForge" layout={uiLayout}>
          <section className="panel panel-pad smithing-facility-panel">
            <FacilityHeader
              icon={<Flame size={19} />}
              title="Forge"
              subtitle="Smelt ore into usable metal bars."
              summary={`${getItemQuantity(game.inventory, 'coal')} Coal`}
              collapsed={forgeCollapsed}
              onToggle={() => setForgeCollapsed((value) => !value)}
            />
            {!forgeCollapsed && (
              <div className="smithing-recipe-list">
                {forgeRecipes.map((recipe) => (
                  <RecipeRow
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
              summary={
                hammer
                  ? `${itemById[hammer.itemId]?.name} · ${Math.round(hammer.speedBonus * 100)}% faster`
                  : 'No Smithing Hammer · Base speed'
              }
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
                <div className="smithing-hammer-summary">
                  {hammer
                    ? `${itemById[hammer.itemId]?.name} · ${Math.round(hammer.speedBonus * 100)}% faster · ${Math.round(hammer.materialPreservationChance * 100)}% preservation`
                    : 'No Smithing Hammer · Base speed · 0% preservation'}
                </div>
                <div className="smithing-recipe-list">
                  {anvilRecipes.map((recipe) => (
                    <RecipeRow
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
      </div>
    </>
  );
}
