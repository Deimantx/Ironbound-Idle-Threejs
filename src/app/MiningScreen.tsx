import { Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { GAME_CONFIG } from '../config/gameConfig';
import { MINING_TUNING } from '../config/miningTuning';
import { itemById } from '../content/items';
import { MINING_NODES, miningNodeById } from '../content/miningNodes';
import {
  getMiningEffectiveness,
  getMiningEffectivenessLabel,
  getMiningEstimatedRates,
  getMiningRuntimeState,
  getMiningStageBonusChance,
  getMiningSwingDamage,
  getMiningSwingXp,
  getMiningTool,
} from '../game/formulas/miningFormulas';
import { getLevelProgress } from '../game/formulas/experienceFormulas';
import { useGameStore } from '../game/state/gameStore';
import type {
  GameState,
  MiningNodeDefinition,
  MiningNodeId,
  MiningPhase,
  ScreenId,
} from '../game/types';
import { occupiedSlots } from '../game/systems/inventorySystem';
import { ThreeScene } from '../three/ThreeScene';
import { formatNumber } from './formatters';
import { ItemIcon } from './ItemIcon';
import { ScreenHeading } from './ScreenHeading';
import { UiPanelSlot } from './UiPanelSlot';
import type { UiLayout } from './uiLayout';

export interface MiningScreenProps {
  game: GameState;
  uiLayout: UiLayout;
  requestAction: (screen: ScreenId, action: () => void) => void;
}

const phaseLabel = (phase: MiningPhase): string => {
  if (phase === 'swing') return 'Swinging';
  if (phase === 'rest') return 'Resting';
  return 'Rock reforming';
};

const phaseTitle = (phase: MiningPhase): string => {
  if (phase === 'swing') return 'Next swing';
  if (phase === 'rest') return 'Miner resting';
  return 'Rock reforming';
};

const formatDuration = (milliseconds: number): string => {
  const seconds = Math.max(0, milliseconds) / 1000;
  return seconds >= 10 ? `${Math.ceil(seconds)}s` : `${seconds.toFixed(1)}s`;
};

const formatRate = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Math.max(0, value));

const effectivenessClass = (label: string): string =>
  `mining-effectiveness-${label.toLowerCase().replaceAll(' ', '-')}`;

const initialSelectedNode = (game: GameState): MiningNodeId => {
  if (game.activeAction.type === 'mining' && miningNodeById[game.activeAction.nodeId])
    return game.activeAction.nodeId;
  return (
    MINING_NODES.find((node) => game.skills.mining.level >= node.level)?.id ?? MINING_NODES[0].id
  );
};

const phaseProgress = (game: GameState, node: MiningNodeDefinition | undefined): number => {
  if (game.activeAction.type !== 'mining' || !node) return 0;
  if (game.activeAction.phase === 'rest')
    return Math.min(1, game.activeAction.progressMs / MINING_TUNING.restDurationMs);
  if (game.activeAction.phase === 'respawn') {
    const runtime = getMiningRuntimeState(game.mining, node.id);
    return Math.min(1, Math.max(0, 1 - runtime.respawnRemainingMs / node.respawnMs));
  }
  return Math.min(1, game.activeAction.progressMs / getMiningTool(game).swingIntervalMs);
};

const phaseRemaining = (game: GameState, node: MiningNodeDefinition | undefined): number => {
  if (game.activeAction.type !== 'mining' || !node) return 0;
  if (game.activeAction.phase === 'respawn')
    return getMiningRuntimeState(game.mining, node.id).respawnRemainingMs;
  const duration =
    game.activeAction.phase === 'rest'
      ? MINING_TUNING.restDurationMs
      : getMiningTool(game).swingIntervalMs;
  return Math.max(0, duration - game.activeAction.progressMs);
};

const ProgressBar = ({
  value,
  max,
  label,
  className = '',
}: {
  value: number;
  max: number;
  label: string;
  className?: string;
}) => (
  <div
    className={`bar mining-progress-bar ${className}`}
    role="progressbar"
    aria-label={label}
    aria-valuemin={0}
    aria-valuemax={max}
    aria-valuenow={Math.round(Math.max(0, Math.min(max, value)))}
  >
    <i style={{ width: `${Math.max(0, Math.min(1, value / Math.max(1, max))) * 100}%` }} />
  </div>
);

const StaminaBar = ({ stamina }: { stamina: number }) => (
  <div className="mining-stamina-block">
    <div className="split">
      <span>Stamina</span>
      <strong>
        {Math.round(stamina)} / {MINING_TUNING.maxStamina}
      </strong>
    </div>
    <ProgressBar
      value={stamina}
      max={MINING_TUNING.maxStamina}
      label="Mining stamina"
      className={stamina <= 0 ? 'is-empty' : ''}
    />
  </div>
);

const StageTrack = ({
  node,
  currentStage,
  preview = false,
}: {
  node: MiningNodeDefinition;
  currentStage: number;
  preview?: boolean;
}) => (
  <div className="mining-stage-track" aria-label={`${node.name} stage progression`}>
    {node.stages.map((stage, index) => {
      const state = preview
        ? index === currentStage
          ? 'current'
          : 'future'
        : index < currentStage
          ? 'complete'
          : index === currentStage
            ? 'current'
            : 'future';
      return (
        <div
          className={`mining-stage-step mining-stage-step-${state}`}
          key={stage.id}
          title={`${stage.name}: ${stage.durability} durability, ${stage.bonusChanceMultiplier.toFixed(2)}x bonus chance`}
          aria-current={state === 'current' ? 'step' : undefined}
        >
          <span className="mining-stage-marker">{state === 'complete' ? '✓' : index + 1}</span>
          <strong>{stage.name}</strong>
          <small>{stage.durability} durability</small>
        </div>
      );
    })}
  </div>
);

const EffectivenessBadge = ({ effectiveness }: { effectiveness: number }) => {
  const label = getMiningEffectivenessLabel(effectiveness);
  return (
    <span className={`mining-effectiveness ${effectivenessClass(label)}`}>
      {label} · {Math.round(effectiveness * 100)}%
    </span>
  );
};

const RateSummary = ({ game, node }: { game: GameState; node: MiningNodeDefinition }) => {
  const rates = getMiningEstimatedRates(game, node);
  const primaryName = itemById[node.primaryRewardItemId]?.name ?? node.primaryRewardItemId;
  return (
    <div className="mining-rate-summary">
      <span>
        ~{formatRate(rates.primaryOrePerHour)} {primaryName}/hr
      </span>
      <span>~{formatRate(rates.xpPerHour)} XP/hr</span>
    </div>
  );
};

const ByproductRows = ({ node, stage }: { node: MiningNodeDefinition; stage: number }) => (
  <div className="mining-reward-rows">
    {node.bonusDrops.map((drop) => {
      const item = itemById[drop.itemId];
      const currentChance = getMiningStageBonusChance(drop, node.stages[stage] ?? node.stages[0]);
      return (
        <div className="mining-reward-row" key={drop.itemId}>
          <ItemIcon itemId={drop.itemId} size="md" />
          <div>
            <strong>{item?.name ?? drop.itemId}</strong>
            <small>
              Base {(drop.chance * 100).toFixed(2)}% → Current {(currentChance * 100).toFixed(3)}% ·{' '}
              {drop.minQuantity === drop.maxQuantity
                ? `x${drop.minQuantity}`
                : `x${drop.minQuantity}-${drop.maxQuantity}`}
            </small>
          </div>
        </div>
      );
    })}
  </div>
);

const StageRows = ({
  node,
  currentStage,
}: {
  node: MiningNodeDefinition;
  currentStage: number;
}) => (
  <div className="mining-stage-table" aria-label={`${node.name} stage details`}>
    {node.stages.map((stage, index) => (
      <div
        className={`mining-stage-table-row ${index === currentStage ? 'is-current' : ''}`}
        key={stage.id}
      >
        <span>
          {index + 1}. {stage.name}
        </span>
        <strong>{stage.durability}</strong>
        <small>{stage.bonusChanceMultiplier.toFixed(2)}x bonus</small>
      </div>
    ))}
  </div>
);

export function MiningScreen({ game, uiLayout, requestAction }: MiningScreenProps) {
  const startMining = useGameStore((store) => store.startMining);
  const stopAction = useGameStore((store) => store.stopAction);
  const activeNodeId = game.activeAction.type === 'mining' ? game.activeAction.nodeId : null;
  const activeNode = activeNodeId ? miningNodeById[activeNodeId] : undefined;
  const [selectedNodeId, setSelectedNodeId] = useState<MiningNodeId>(() =>
    initialSelectedNode(game),
  );
  const profileId = game.profileId;

  useEffect(() => {
    const currentGame = useGameStore.getState().game;
    if (currentGame) setSelectedNodeId(initialSelectedNode(currentGame));
  }, [profileId]);

  const selectedNode = miningNodeById[selectedNodeId] ?? MINING_NODES[0];
  const selectedHasRuntime = game.mining.nodeStates[selectedNode.id] !== undefined;
  const selectedRuntime = getMiningRuntimeState(game.mining, selectedNode.id);
  const selectedStage = selectedNode.stages[selectedRuntime.stageIndex] ?? selectedNode.stages[0];
  const activeRuntime = activeNode ? getMiningRuntimeState(game.mining, activeNode.id) : undefined;
  const activeStage = activeNode
    ? (activeNode.stages[activeRuntime?.stageIndex ?? 0] ?? activeNode.stages[0])
    : undefined;
  const activeTool = getMiningTool(game);
  const selectedEffectiveness = getMiningEffectiveness(activeTool, selectedNode);
  const selectedRates = getMiningEstimatedRates(game, selectedNode);
  const miningProgress = getLevelProgress(game.skills.mining);
  const activeDisplayNode = activeNode ?? selectedNode;
  const activeDisplayStage = activeNode ? (activeStage ?? selectedStage) : selectedStage;
  const activeDisplayRuntime = activeNode ? (activeRuntime ?? selectedRuntime) : selectedRuntime;
  const activeProgress = phaseProgress(game, activeNode);
  const activeRemaining = phaseRemaining(game, activeNode);
  const swingsBeforeRest = Math.floor(game.mining.stamina / Math.max(1, activeTool.staminaCost));

  return (
    <>
      <ScreenHeading
        eyebrow="Skill · Gathering"
        title="Mining"
        description="Choose a rock, read its depth, and make the next deliberate swing."
        trailing={
          <div className="mining-level-header" aria-label="Mining experience">
            <strong>Level {game.skills.mining.level}</strong>
            <span>
              {formatNumber(game.skills.mining.xp)} XP ·{' '}
              {game.skills.mining.level >= 100
                ? 'Max level'
                : `${Math.round(miningProgress.percent)}% to Level ${game.skills.mining.level + 1}`}
            </span>
            <ProgressBar value={miningProgress.percent} max={100} label="Mining level progress" />
          </div>
        }
      />
      <div className="ui-panel-grid mining-panel-grid" data-ui-panel-grid="mining">
        <UiPanelSlot screen="mining" id="miningOverview" layout={uiLayout}>
          <section className="panel scene-panel mining-overview-panel mining-active-panel">
            <ThreeScene
              screen="mining"
              settings={game.settings}
              miningTheme={activeDisplayNode.theme}
              miningStage={activeDisplayRuntime.stageIndex}
            />
            <div className="mining-overview-content">
              <div className="eyebrow">{activeNode ? 'Active Mining' : 'Mining Idle'}</div>
              <h2>{activeNode?.name ?? selectedNode.name}</h2>
              <p className="subtle">
                {activeNode
                  ? `${phaseLabel(game.activeAction.type === 'mining' ? game.activeAction.phase : 'swing')} · Stage ${(activeDisplayRuntime.stageIndex ?? 0) + 1} of ${activeDisplayNode.stages.length}`
                  : 'Select a rock and press Mine to begin.'}
              </p>

              <StageTrack
                node={activeDisplayNode}
                currentStage={activeDisplayRuntime.stageIndex}
                preview={!activeNode}
              />

              <div className="mining-overview-status">
                <div className="split">
                  <span>{activeDisplayStage.name} durability</span>
                  <strong>
                    {Math.ceil(activeDisplayRuntime.stageDurability)} /{' '}
                    {activeDisplayStage.durability}
                  </strong>
                </div>
                <ProgressBar
                  value={activeDisplayRuntime.stageDurability}
                  max={activeDisplayStage.durability}
                  label="Current stage durability"
                  className="mining-durability-bar"
                />

                {activeNode ? (
                  <>
                    <div className="split mining-phase-row">
                      <span>
                        {phaseTitle(
                          game.activeAction.type === 'mining' ? game.activeAction.phase : 'swing',
                        )}
                      </span>
                      <strong>{formatDuration(activeRemaining)}</strong>
                    </div>
                    <ProgressBar
                      value={activeProgress * 100}
                      max={100}
                      label={`${phaseLabel(game.activeAction.type === 'mining' ? game.activeAction.phase : 'swing')} progress`}
                      className="mining-phase-bar"
                    />
                  </>
                ) : (
                  <div className="mining-preview-note">Previewing Stage 1 at full durability.</div>
                )}

                <div className="mining-active-stats">
                  <span>
                    Resource progress
                    <strong>{Math.round(activeDisplayRuntime.primaryYieldProgress * 100)}%</strong>
                  </span>
                  <span>
                    {activeNode ? 'Stamina' : 'Ready'}
                    <strong>
                      {Math.round(game.mining.stamina)} / {MINING_TUNING.maxStamina}
                    </strong>
                  </span>
                  {activeNode && (
                    <span>
                      Before rest
                      <strong>
                        {swingsBeforeRest} swing{swingsBeforeRest === 1 ? '' : 's'}
                      </strong>
                    </span>
                  )}
                </div>
                <StaminaBar stamina={game.mining.stamina} />
              </div>
            </div>
          </section>
        </UiPanelSlot>

        <UiPanelSlot screen="mining" id="miningNodes" layout={uiLayout}>
          <section className="panel panel-pad">
            <div className="split">
              <div>
                <div className="eyebrow">Phase One resources</div>
                <h2>Rock nodes</h2>
                <p className="subtle">
                  Select a rock to inspect it. Mining only changes when you press its action.
                </p>
              </div>
              <span className="badge">
                {occupiedSlots(game.inventory)}/{GAME_CONFIG.inventorySlots} slots
              </span>
            </div>
            <div className="list mining-node-list">
              {MINING_NODES.map((node) => {
                const locked = game.skills.mining.level < node.level;
                const isSelected = selectedNode.id === node.id;
                const isActive = activeNodeId === node.id;
                const effectiveness = getMiningEffectiveness(activeTool, node);
                const rates = getMiningEstimatedRates(game, node);
                const primary = itemById[node.primaryRewardItemId];
                const actionText = locked
                  ? `Level ${node.level} Required`
                  : isActive
                    ? 'Stop Mining'
                    : activeNode
                      ? `Switch to ${node.name}`
                      : `Mine ${node.name}`;
                return (
                  <div
                    className={`list-row mining-node-card ${locked ? 'locked-card' : ''} ${isSelected ? 'is-selected' : ''} ${isActive ? 'is-active' : ''}`}
                    key={node.id}
                  >
                    <button
                      type="button"
                      className="mining-node-select"
                      onClick={() => setSelectedNodeId(node.id)}
                      aria-label={`Inspect ${node.name}`}
                      aria-pressed={isSelected}
                    >
                      <ItemIcon itemId={primary?.id} size="md" />
                      <span className="row-main">
                        <strong>
                          {node.name}
                          {isSelected && (
                            <span className="mining-state-pill selected-pill">Selected</span>
                          )}
                          {isActive && (
                            <span className="mining-state-pill active-pill">Mining</span>
                          )}
                        </strong>
                        <small>
                          Mining Level {node.level} · {primary?.name ?? node.primaryRewardItemId} ·
                          5 stages · Pen {node.requiredPenetration}
                        </small>
                        <span className="mining-node-effectiveness">
                          <EffectivenessBadge effectiveness={effectiveness} />
                        </span>
                        <span className="mining-node-rates">
                          ~{formatRate(rates.primaryOrePerHour)}{' '}
                          {primary?.name ?? node.primaryRewardItemId}/hr · ~
                          {formatRate(rates.xpPerHour)} XP/hr
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className={`button ${isActive ? 'danger' : locked ? 'ghost' : 'primary'}`}
                      disabled={locked}
                      onClick={() => {
                        if (isActive) stopAction();
                        else requestAction('mining', () => startMining(node.id));
                      }}
                      aria-label={actionText}
                    >
                      {locked ? (
                        <Lock size={14} aria-hidden="true" />
                      ) : isActive ? (
                        'Stop'
                      ) : (
                        actionText
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </UiPanelSlot>

        <UiPanelSlot screen="mining" id="miningDetails" layout={uiLayout}>
          <section className="panel panel-pad mining-details-panel">
            <div className="mining-details-grid">
              <div className="mining-selected-rock">
                <div className="eyebrow">Selected rock</div>
                <h2>{selectedNode.name}</h2>
                <p className="subtle">
                  Mining Level {selectedNode.level} · Required Penetration{' '}
                  {selectedNode.requiredPenetration}
                </p>
                <p>{selectedNode.description}</p>
                <div className="mining-primary-resource">
                  <ItemIcon itemId={selectedNode.primaryRewardItemId} size="md" />
                  <div>
                    <span>Primary resource</span>
                    <strong>{itemById[selectedNode.primaryRewardItemId]?.name}</strong>
                    <small>Deterministic yield from swing damage</small>
                  </div>
                </div>
                <div className="mining-selected-stage-heading">
                  <span>{selectedHasRuntime ? 'Saved stage' : 'Preview stage'}</span>
                  <strong>
                    Stage {selectedRuntime.stageIndex + 1}: {selectedStage.name}
                  </strong>
                </div>
                <StageRows node={selectedNode} currentStage={selectedRuntime.stageIndex} />
                <RateSummary game={game} node={selectedNode} />
                <div className="mining-detail-meta">
                  <span>
                    Respawn<strong>{formatDuration(selectedNode.respawnMs)}</strong>
                  </span>
                  <span>
                    Damage / resource<strong>{selectedNode.damagePerPrimaryReward}</strong>
                  </span>
                </div>
                <div className="mining-reward-section">
                  <div className="eyebrow">Possible byproducts</div>
                  {selectedNode.bonusDrops.length > 0 ? (
                    <ByproductRows node={selectedNode} stage={selectedRuntime.stageIndex} />
                  ) : (
                    <p className="subtle">No authored bonus drops.</p>
                  )}
                </div>
              </div>

              <div className="mining-tool-details">
                <div className="eyebrow">Current pickaxe</div>
                <h2>{activeTool.itemId ? itemById[activeTool.itemId]?.name : 'No pickaxe'}</h2>
                <div className="mining-tool-summary">
                  <ItemIcon itemId={activeTool.itemId || undefined} size="md" />
                  <div className="mining-stat-grid">
                    <span>
                      Rock damage<strong>{activeTool.rockDamage}</strong>
                    </span>
                    <span>
                      Penetration<strong>{activeTool.penetration}</strong>
                    </span>
                    <span>
                      Swing time<strong>{formatDuration(activeTool.swingIntervalMs)}</strong>
                    </span>
                    <span>
                      Stamina / swing<strong>{activeTool.staminaCost}</strong>
                    </span>
                    <span>
                      Required level<strong>{activeTool.requiredMiningLevel}</strong>
                    </span>
                  </div>
                </div>
                <div className="mining-tool-comparison">
                  <div className="eyebrow">Vs {selectedNode.name}</div>
                  <div className="mining-comparison-row">
                    <span>Required penetration</span>
                    <strong>{selectedNode.requiredPenetration}</strong>
                  </div>
                  <div className="mining-comparison-row">
                    <span>Your penetration</span>
                    <strong>{activeTool.penetration}</strong>
                  </div>
                  <div className="mining-comparison-highlight">
                    <EffectivenessBadge effectiveness={selectedEffectiveness} />
                    <span>
                      Actual damage<strong>{getMiningSwingDamage(activeTool, selectedNode)}</strong>
                    </span>
                    <span>
                      XP effectiveness
                      <strong>{getMiningSwingXp(selectedNode, selectedEffectiveness)}</strong>{' '}
                      XP/swing
                    </span>
                  </div>
                </div>
                {selectedEffectiveness < 1 ? (
                  <p className="mining-warning" role="status">
                    Your pickaxe cannot fully penetrate this rock. Damage and Mining XP are reduced.
                  </p>
                ) : (
                  <p className="mining-ready" role="status">
                    Your pickaxe fully penetrates this rock.
                  </p>
                )}
                <div className="mining-tool-rate-note">
                  <span>Selected-node estimate</span>
                  <strong>{formatDuration(selectedRates.cycleMs)} per rock cycle</strong>
                </div>
              </div>
            </div>
          </section>
        </UiPanelSlot>
      </div>
    </>
  );
}
