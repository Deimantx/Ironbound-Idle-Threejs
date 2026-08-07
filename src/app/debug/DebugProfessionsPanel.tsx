import { useState } from 'react';
import { MINING_NODES, miningNodeById } from '../../content/miningNodes';
import { RECIPES, recipeById } from '../../content/recipes';
import { itemById } from '../../content/items';
import {
  getMiningEffectiveness,
  getMiningRuntimeState,
  getMiningSwingDamage,
  getMiningTool,
} from '../../game/formulas/miningFormulas';
import { GAME_CONFIG } from '../../config/gameConfig';
import {
  debugAdvanceElapsed,
  debugAdvanceOneCycle,
  debugAdvanceMiningPhase,
  debugCompleteMiningRespawn,
  debugCompleteMiningRest,
  debugCompleteMiningSwing,
  debugDepleteMiningRock,
  debugDepleteMiningStage,
  debugCompleteSmithingCycle,
  debugGrantMiningOutput,
  debugGrantRecipeMaterials,
  debugGrantRecipeOutput,
  debugDrainMiningStamina,
  debugRefillMiningStamina,
  debugResetAllMining,
  debugResetMiningNode,
  debugSetMiningDurability,
  debugSetMiningStage,
  debugSetMiningStamina,
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
  const [stage, setStage] = useState(1);
  const [durability, setDurability] = useState(10);
  const [stamina, setStamina] = useState(100);
  const activeMining = game.activeAction.type === 'mining' ? game.activeAction : null;
  const activeSmithing = game.activeAction.type === 'smithing' ? game.activeAction : null;
  const node = miningNodeById[nodeId];
  const recipe = recipeById[recipeId];
  const miningTool = getMiningTool(game);
  const selectedRuntime = getMiningRuntimeState(game.mining, nodeId);
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
            ['Phase', activeMining?.phase ?? 'Stopped'],
            ['Progress', activeMining ? `${activeMining.progressMs} ms` : '—'],
            ['Stage', `${selectedRuntime.stageIndex + 1}/${node.stages.length}`],
            [
              'Durability',
              `${Math.ceil(selectedRuntime.stageDurability)}/${node.stages[selectedRuntime.stageIndex]?.durability ?? 0}`,
            ],
            ['Stamina', `${Math.round(game.mining.stamina)}/100`],
            ['Yield progress', selectedRuntime.primaryYieldProgress.toFixed(3)],
            ['RNG', `${selectedRuntime.rngSeed}:${selectedRuntime.rngCursor}`],
            [
              'Tool',
              game.equipment.tool
                ? (itemById[game.equipment.tool]?.name ?? game.equipment.tool)
                : 'None',
            ],
            [
              'Damage / effectiveness',
              `${getMiningSwingDamage(miningTool, node)} / ${Math.round(getMiningEffectiveness(miningTool, node) * 100)}%`,
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
          <ActionButton onClick={() => run(debugCompleteMiningSwing)}>
            Complete One Swing
          </ActionButton>
          <ActionButton onClick={() => run(debugAdvanceMiningPhase)}>
            Advance Mining Phase
          </ActionButton>
          <ActionButton onClick={() => run(debugCompleteMiningRest)}>Complete Rest</ActionButton>
          <ActionButton onClick={() => run(debugCompleteMiningRespawn)}>
            Complete Respawn
          </ActionButton>
          <ActionButton onClick={() => run((state) => debugGrantMiningOutput(state, nodeId))}>
            Grant Node Output Without Simulation
          </ActionButton>
        </div>
        <div className="debug-tools-grid">
          <Field label="Stamina (0–100)">
            <input
              type="number"
              min="0"
              max="100"
              value={stamina}
              onChange={(event) => setStamina(Number(event.target.value))}
            />
          </Field>
          <Field label="Stage">
            <input
              type="number"
              min="1"
              max={node.stages.length}
              value={stage}
              onChange={(event) => setStage(Number(event.target.value))}
            />
          </Field>
          <Field label="Durability">
            <input
              type="number"
              min="0"
              value={durability}
              onChange={(event) => setDurability(Number(event.target.value))}
            />
          </Field>
        </div>
        <div className="button-row">
          <ActionButton onClick={() => run((state) => debugSetMiningStamina(state, stamina))}>
            Set Stamina
          </ActionButton>
          <ActionButton onClick={() => run(debugRefillMiningStamina)}>Refill Stamina</ActionButton>
          <ActionButton onClick={() => run(debugDrainMiningStamina)}>Drain Stamina</ActionButton>
          <ActionButton onClick={() => run((state) => debugSetMiningStage(state, nodeId, stage))}>
            Set Stage
          </ActionButton>
          <ActionButton
            onClick={() => run((state) => debugSetMiningDurability(state, nodeId, durability))}
          >
            Set Durability
          </ActionButton>
          <ActionButton onClick={() => run((state) => debugDepleteMiningStage(state, nodeId))}>
            Deplete Stage
          </ActionButton>
          <ActionButton onClick={() => run((state) => debugDepleteMiningRock(state, nodeId))}>
            Deplete Rock
          </ActionButton>
          <ActionButton onClick={() => run((state) => debugResetMiningNode(state, nodeId))}>
            Reset Node
          </ActionButton>
          <ActionButton onClick={() => run(debugResetAllMining)}>Reset All Mining</ActionButton>
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
