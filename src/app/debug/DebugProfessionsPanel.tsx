import { useState } from 'react';
import { MINING_NODES, miningNodeById } from '../../content/miningNodes';
import { RECIPES, recipeById } from '../../content/recipes';
import { itemById } from '../../content/items';
import { getDerivedStats } from '../../game/formulas/statFormulas';
import { GAME_CONFIG } from '../../config/gameConfig';
import {
  debugAdvanceElapsed,
  debugAdvanceOneCycle,
  debugCompleteMiningCycle,
  debugCompleteSmithingCycle,
  debugGrantMiningOutput,
  debugGrantRecipeMaterials,
  debugGrantRecipeOutput,
  debugStartMining,
  debugStartSmithing,
  debugStopAction,
} from '../../game/debug/debugActions';
import type { GameState, MiningNodeId, QuantityMode } from '../../game/types';
import { ActionButton, Field, Section, activeActionLabel } from './DebugComponents';
import type { PanelProps } from './debugUiTypes';

export function ProfessionsPanel({ game, run }: { game: GameState; run: PanelProps['run'] }) {
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
            {game.activeAction.type === 'combat'
              ? 'Advance to Next Combat Event'
              : 'Complete Next Cycle'}
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
