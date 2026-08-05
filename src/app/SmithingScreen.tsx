import { useState } from 'react';
import { Lock } from 'lucide-react';
import { itemById } from '../content/items';
import { RECIPES, recipeById } from '../content/recipes';
import { useGameStore } from '../game/state/gameStore';
import type { GameState, QuantityMode, ScreenId } from '../game/types';
import { getItemQuantity } from '../game/systems/inventorySystem';
import { formatNumber } from './formatters';
import { ScreenHeading } from './ScreenHeading';
import { UiPanelSlot } from './UiPanelSlot';
import type { UiLayout } from './uiLayout';

export interface SmithingScreenProps {
  game: GameState;
  uiLayout: UiLayout;
  requestAction: (screen: ScreenId, action: () => void) => void;
}

export function SmithingScreen({ game, uiLayout, requestAction }: SmithingScreenProps) {
  const [tab, setTab] = useState<'smelting' | 'forging'>('smelting');
  const [mode, setMode] = useState<QuantityMode>(1);
  const startSmithing = useGameStore((store) => store.startSmithing);
  const stopAction = useGameStore((store) => store.stopAction);
  const active = game.activeAction.type === 'smithing' ? game.activeAction : null;
  const recipes = RECIPES.filter((recipe) => recipe.category === tab);
  return (
    <>
      <ScreenHeading
        eyebrow="Skill · The forge"
        title="Smithing"
        description="Turn gathered material into tools, protection, and a stronger road ahead."
        trailing={
          <span className="badge gold">
            Level {game.skills.smithing.level} · {formatNumber(game.skills.smithing.xp)} XP
          </span>
        }
      />
      <div className="ui-panel-grid smithing-panel-grid" data-ui-panel-grid="smithing">
        <UiPanelSlot screen="smithing" id="smithingControls" layout={uiLayout}>
          <section className="panel panel-pad">
            <div className="tabs">
              <button
                className={`tab ${tab === 'smelting' ? 'active' : ''}`}
                onClick={() => setTab('smelting')}
              >
                Smelting
              </button>
              <button
                className={`tab ${tab === 'forging' ? 'active' : ''}`}
                onClick={() => setTab('forging')}
              >
                Forging
              </button>
            </div>
            <div className="button-row" style={{ marginBottom: 15 }}>
              <span className="muted">Quantity:</span>
              {([1, 10, 'all', 'continuous'] as QuantityMode[]).map((option) => (
                <button
                  className={`button ${mode === option ? 'gold' : 'ghost'}`}
                  key={String(option)}
                  onClick={() => setMode(option)}
                >
                  {option === 'all'
                    ? 'All possible'
                    : option === 'continuous'
                      ? 'Continuous'
                      : option}
                </button>
              ))}
              {active && (
                <>
                  <span className="muted" style={{ marginLeft: 'auto' }}>
                    Working: {recipeById[active.recipeId]?.name}
                  </span>
                  <button className="button danger" onClick={stopAction}>
                    Stop
                  </button>
                </>
              )}
            </div>
          </section>
        </UiPanelSlot>
        <UiPanelSlot screen="smithing" id="smithingRecipes" layout={uiLayout}>
          <section className="panel panel-pad">
            <div className="grid grid-3">
              {recipes.map((recipe) => {
                const locked = game.skills.smithing.level < recipe.level;
                const canStart = recipe.inputs.every(
                  (input) => getItemQuantity(game.inventory, input.itemId) >= input.quantity,
                );
                const isActive = active?.recipeId === recipe.id;
                return (
                  <article className={`panel card ${locked ? 'locked-card' : ''}`} key={recipe.id}>
                    <div className="card-head">
                      <div>
                        <div className="eyebrow">{recipe.category}</div>
                        <h2>{recipe.name}</h2>
                      </div>
                      <span className="badge">Lv {recipe.level}</span>
                    </div>
                    <p className="subtle">{recipe.description}</p>
                    <div className="recipe-materials">
                      {recipe.inputs.map((input) => (
                        <span
                          className={`material-chip ${getItemQuantity(game.inventory, input.itemId) < input.quantity ? 'missing' : ''}`}
                          key={input.itemId}
                        >
                          {itemById[input.itemId]?.name} ×{input.quantity} ·{' '}
                          {getItemQuantity(game.inventory, input.itemId)}
                        </span>
                      ))}
                    </div>
                    <div className="split" style={{ marginBottom: 13 }}>
                      <span className="muted">→ {itemById[recipe.outputItemId]?.name}</span>
                      <span className="muted">
                        {recipe.xp} XP · {recipe.intervalMs / 1000}s
                      </span>
                    </div>
                    {locked ? (
                      <button className="button ghost" disabled>
                        <Lock size={13} /> Requires level {recipe.level}
                      </button>
                    ) : isActive ? (
                      <button className="button gold" disabled>
                        Working…
                      </button>
                    ) : (
                      <button
                        className="button primary"
                        disabled={!canStart}
                        onClick={() =>
                          requestAction('smithing', () => startSmithing(recipe.id, mode))
                        }
                      >
                        {canStart ? 'Start forging' : 'Missing materials'}
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        </UiPanelSlot>
      </div>
    </>
  );
}
