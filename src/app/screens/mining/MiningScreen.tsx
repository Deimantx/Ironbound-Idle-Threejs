import { Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MINING_TUNING } from '../../../config/miningTuning';
import { itemById } from '../../../content/items';
import { MINING_NODES, miningNodeById } from '../../../content/miningNodes';
import {
  getMiningEffectiveness,
  getMiningEffectivenessLabel,
  getMiningEstimatedRates,
  getMiningRuntimeState,
  getMiningStageBonusChance,
  getMiningSwingsBeforeRest,
  getMiningSwingDamage,
  getMiningSwingXp,
  getRecommendedMiningToolForNode,
  getMiningTool,
} from '../../../game/formulas/miningFormulas';
import { getLevelProgress } from '../../../game/formulas/experienceFormulas';
import { useGameStore } from '../../../game/state/gameStore';
import type {
  GameState,
  MiningNodeDefinition,
  MiningNodeId,
  MiningPhase,
  ScreenId,
} from '../../../game/types';
import { getItemQuantity } from '../../../game/systems/inventorySystem';
import { ThreeScene } from '../../../three/ThreeScene';
import { formatDropChance, formatNumber } from '../../shared/formatters';
import { ItemIcon } from '../../items/ItemIcon';
import { ScreenHeading } from '../../shell/ScreenHeading';
import { UiPanelSlot } from '../../ui-editor/UiPanelSlot';
import { UiPanelGrid } from '../../ui-editor/UiPanelGrid';
import { UiPanelRegionGrid } from '../../ui-editor/UiPanelRegionGrid';
import { UiPanelRegionSlot } from '../../ui-editor/UiPanelRegionSlot';
import { GameTooltip } from '../../items/GameTooltip';
import { ItemTooltip } from '../../items/ItemTooltip';
import { ExplainedTerm } from '../../tooltips/GameConceptTooltip';
import type { UiLayout } from '../../ui-editor/uiLayout';

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
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  if (totalSeconds >= 3600) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours}h${minutes ? ` ${minutes}m` : ''}`;
  }
  if (totalSeconds >= 60) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m${seconds ? ` ${seconds}s` : ''}`;
  }
  return totalSeconds >= 10
    ? `${totalSeconds}s`
    : `${(Math.max(0, milliseconds) / 1000).toFixed(1)}s`;
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

const StaminaBar = ({
  stamina,
  showHelpIcons = true,
}: {
  stamina: number;
  showHelpIcons?: boolean;
}) => (
  <div className="mining-stamina-block">
    <div className="split">
      <ExplainedTerm concept="mining-stamina" showHelpIcon={showHelpIcons}>Stamina</ExplainedTerm>
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
  showHelpIcons?: boolean;
}) => (
  <div
    className="mining-stage-track"
    role="list"
    aria-label={`${node.name} stage progression`}
    style={{ gridTemplateColumns: `repeat(${node.stages.length}, minmax(0, 1fr))` }}
  >
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
        <GameTooltip
          key={stage.id}
          label={`${stage.name} mining stage`}
          content={
            <div className="concept-tooltip-content">
              <strong>{stage.name}</strong>
              <span>Stage {index + 1} of {node.stages.length}</span>
              <span>Maximum Durability: {stage.durability}</span>
              <span>Bonus Drop Modifier: {stage.bonusChanceMultiplier.toFixed(2)}×</span>
            </div>
          }
        >
          <div
            role="listitem"
            className={`mining-stage-step mining-stage-step-${state}`}
            aria-current={state === 'current' ? 'step' : undefined}
            aria-label={`Stage ${index + 1}: ${stage.name}${state === 'current' ? ' (current)' : state === 'complete' ? ' (complete)' : ' (future)'}`}
          >
            <span className="mining-stage-marker" aria-hidden="true">{state === 'complete' ? '✓' : index + 1}</span>
          </div>
        </GameTooltip>
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

const ByproductRows = ({
  node,
  stage,
  inventory,
}: {
  node: MiningNodeDefinition;
  stage: number;
  inventory: GameState['inventory'];
}) => (
  <div className="mining-reward-rows">
    {node.bonusDrops.map((drop) => {
      const item = itemById[drop.itemId];
      const currentChance = getMiningStageBonusChance(drop, node.stages[stage] ?? node.stages[0]);
      const owned = getItemQuantity(inventory, drop.itemId);
      return (
        <ItemTooltip item={item} key={drop.itemId}>
          <div className="mining-reward-row">
            <ItemIcon itemId={drop.itemId} size="md" />
            <div>
              <strong>{item?.name ?? drop.itemId}</strong>
              <small>
                {formatDropChance(currentChance)} chance · Owned {formatNumber(owned)}
              </small>
            </div>
          </div>
        </ItemTooltip>
      );
    })}
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
  const activePhase =
    activeNode && game.activeAction.type === 'mining' ? game.activeAction.phase : undefined;
  const hasTemporaryPhase = activePhase === 'rest' || activePhase === 'respawn';
  const swingsBeforeRest = getMiningSwingsBeforeRest(game.mining.stamina, activeTool.staminaCost);
  const ownedPrimary = getItemQuantity(game.inventory, selectedNode.primaryRewardItemId);
  const recommendedTool = getRecommendedMiningToolForNode(selectedNode);
  const recommendedToolName = recommendedTool
    ? (itemById[recommendedTool.itemId]?.name ?? recommendedTool.itemId)
    : 'No registered pickaxe';

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
      <UiPanelGrid screen="mining" className="mining-panel-grid">
        <UiPanelSlot screen="mining" id="miningOverview" layout={uiLayout}>
          <section className="panel scene-panel mining-overview-panel mining-active-panel">
            <UiPanelRegionGrid
              screen="mining"
              panelId="miningOverview"
              layout={uiLayout}
              className="mining-overview-layout"
            >
              <UiPanelRegionSlot
                screen="mining"
                panelId="miningOverview"
                regionId="miningOverviewScene"
                layout={uiLayout}
                className="mining-overview-scene-region"
              >
                <ThreeScene
                  screen="mining"
                  settings={game.settings}
                  miningTheme={activeDisplayNode.theme}
                  miningStage={activeDisplayRuntime.stageIndex}
                />
              </UiPanelRegionSlot>
              <UiPanelRegionSlot
                screen="mining"
                panelId="miningOverview"
                regionId="miningOverviewActivity"
                layout={uiLayout}
                className="mining-overview-activity-region"
              >
                <div className="mining-overview-content">
              <div className="eyebrow">{activeNode ? 'Active Mining' : 'Mining Idle'}</div>
              <h2>{activeNode?.name ?? selectedNode.name}</h2>
              <p className="subtle">
                {activeNode
                  ? `${phaseLabel(game.activeAction.type === 'mining' ? game.activeAction.phase : 'swing')} · Stage ${(activeDisplayRuntime.stageIndex ?? 0) + 1} of ${activeDisplayNode.stages.length}`
                  : `${selectedHasRuntime ? 'Ready to continue' : 'Untouched deposit'} · Stage ${(activeDisplayRuntime.stageIndex ?? 0) + 1} of ${activeDisplayNode.stages.length}`}
              </p>

              <StageTrack
                node={activeDisplayNode}
                currentStage={activeDisplayRuntime.stageIndex}
                preview={!activeNode}
              />

               </div>
              </UiPanelRegionSlot>
              <UiPanelRegionSlot
                screen="mining"
                panelId="miningOverview"
                regionId="miningOverviewStatus"
                layout={uiLayout}
                className="mining-overview-status-region"
              >
                <div className="mining-live-status">
                  <div className="mining-live-status-heading">
                    <div>
                      <span className="eyebrow">Current stage</span>
                      <h3>{activeDisplayStage.name}</h3>
                    </div>
                    <strong className="ui-stat-compact">
                      {Math.ceil(activeDisplayRuntime.stageDurability)} / {activeDisplayStage.durability}
                    </strong>
                  </div>
                  <ProgressBar
                    value={activeDisplayRuntime.stageDurability}
                    max={activeDisplayStage.durability}
                    label="Current stage durability"
                    className="mining-durability-bar"
                  />
                  {activePhase === 'swing' && (
                    <div className="mining-live-metrics">
                      <div className="mining-live-metric">
                        <span>{phaseTitle(activePhase)}</span>
                        <strong>{formatDuration(activeRemaining)}</strong>
                      </div>
                      <div className="mining-live-metric">
                        <span>Before rest</span>
                        <strong>{swingsBeforeRest} swing{swingsBeforeRest === 1 ? '' : 's'}</strong>
                      </div>
                    </div>
                  )}
                  {hasTemporaryPhase && activePhase && (
                    <div className="mining-phase-progress">
                      <div className="mining-phase-progress-heading">
                        <span>{phaseLabel(activePhase)}</span>
                        <strong className="ui-stat-compact">{formatDuration(activeRemaining)}</strong>
                      </div>
                      <ProgressBar
                        value={activeProgress * 100}
                        max={100}
                        label={`${phaseLabel(activePhase)} progress`}
                        className="mining-phase-bar"
                      />
                    </div>
                  )}
                  {!activeNode && (
                    <div className="mining-live-idle">
                      <span>Mining status</span>
                      <strong>Idle</strong>
                    </div>
                  )}
                  <div className="mining-live-stamina">
                    <StaminaBar stamina={game.mining.stamina} showHelpIcons={game.settings.showHelpIcons} />
                  </div>
                  <RateSummary game={game} node={activeDisplayNode} />
                </div>
              </UiPanelRegionSlot>
            </UiPanelRegionGrid>
          </section>
        </UiPanelSlot>

        <UiPanelSlot screen="mining" id="miningNodes" layout={uiLayout}>
          <section className="panel panel-pad">
            <UiPanelRegionGrid screen="mining" panelId="miningNodes" layout={uiLayout} className="mining-nodes-layout">
              <UiPanelRegionSlot screen="mining" panelId="miningNodes" regionId="miningNodesHeading" layout={uiLayout}>
                <div className="split">
                  <div>
                    <div className="eyebrow">Available Deposits</div>
                    <h2>Mining deposits</h2>
                    <p className="subtle">
                      Select a rock to inspect it. Mining only changes when you press its action.
                    </p>
                  </div>
                </div>
              </UiPanelRegionSlot>
              <UiPanelRegionSlot screen="mining" panelId="miningNodes" regionId="miningNodesBrowser" layout={uiLayout}>
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
                    <ItemTooltip item={primary}>
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
                          {isActive && (
                            <span className="mining-state-pill active-pill">Mining</span>
                          )}
                        </strong>
                        <small>
                          Mining Level {node.level} · Pen {node.requiredPenetration}
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
                    </ItemTooltip>
                    <button
                      type="button"
                      className={`button ${isActive ? 'danger' : locked ? 'ghost' : 'primary'}`}
                      disabled={locked}
                      onClick={() => {
                        if (isActive) {
                          setSelectedNodeId(node.id);
                          stopAction();
                        } else {
                          requestAction('mining', () => {
                            setSelectedNodeId(node.id);
                            startMining(node.id);
                          });
                        }
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
              </UiPanelRegionSlot>
            </UiPanelRegionGrid>
          </section>
        </UiPanelSlot>

        <UiPanelSlot screen="mining" id="miningDetails" layout={uiLayout}>
          <section className="panel panel-pad mining-details-panel">
            <UiPanelRegionGrid screen="mining" panelId="miningDetails" layout={uiLayout} className="mining-details-layout">
              <UiPanelRegionSlot screen="mining" panelId="miningDetails" regionId="miningDetailsRock" layout={uiLayout}>
                <div className="mining-selected-rock">
                <div className="eyebrow">Selected deposit</div>
                <h2>{selectedNode.name}</h2>
                <p>{selectedNode.description}</p>
                <div className="mining-requirements">
                  <div className="eyebrow">Requirements</div>
                  <div className="mining-requirement-grid">
                    <span>Mining level<strong>{selectedNode.level}</strong></span>
                    <span>Penetration<strong>{selectedNode.requiredPenetration}</strong></span>
                    <span>Full deposit<strong>~{formatDuration(selectedRates.cycleMs)}</strong></span>
                    <span>Respawn<strong>{formatDuration(selectedNode.respawnMs)}</strong></span>
                  </div>
                </div>
                <div className="eyebrow mining-section-label">Primary resource</div>
                <ItemTooltip item={itemById[selectedNode.primaryRewardItemId]}>
                  <div className="mining-primary-resource">
                    <ItemIcon itemId={selectedNode.primaryRewardItemId} size="md" />
                    <div>
                      <strong>{itemById[selectedNode.primaryRewardItemId]?.name}</strong>
                      <small>Owned: {formatNumber(ownedPrimary)}</small>
                    </div>
                  </div>
                </ItemTooltip>
                <div className="eyebrow mining-section-label">Estimated output</div>
                <RateSummary game={game} node={selectedNode} />
                <div className="mining-reward-section">
                  <div className="eyebrow">
                    <ExplainedTerm concept="bonus-drop" showHelpIcon={game.settings.showHelpIcons}>
                      Bonus drops
                    </ExplainedTerm>
                  </div>
                  {selectedNode.bonusDrops.length > 0 ? (
                    <ByproductRows
                      node={selectedNode}
                      stage={selectedRuntime.stageIndex}
                      inventory={game.inventory}
                    />
                  ) : (
                    <p className="subtle">No authored bonus drops.</p>
                  )}
                </div>
                </div>
              </UiPanelRegionSlot>

              <UiPanelRegionSlot screen="mining" panelId="miningDetails" regionId="miningDetailsTool" layout={uiLayout}>
                <div className="mining-tool-details">
                <ItemTooltip item={activeTool.itemId ? itemById[activeTool.itemId] : undefined}>
                  <div className="mining-tool-information">
                    <div className="mining-tool-identity">
                      <ItemIcon itemId={activeTool.itemId || undefined} size="md" />
                      <div>
                        <div className="eyebrow">Current pickaxe</div>
                        <h2>{activeTool.itemId ? itemById[activeTool.itemId]?.name : 'No pickaxe'}</h2>
                      </div>
                    </div>
                    <div className="eyebrow mining-tool-section-label">Tool stats</div>
                    <div className="mining-tool-summary">
                      <div className="mining-stat-grid">
                    <span>
                      Rock damage<strong>{activeTool.rockDamage}</strong>
                    </span>
                    <span>
                      <ExplainedTerm concept="mining-penetration" showHelpIcon={game.settings.showHelpIcons}>
                        Penetration
                      </ExplainedTerm>
                      <strong>{activeTool.penetration}</strong>
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
                  </div>
                </ItemTooltip>
                <div className="mining-tool-comparison">
                  <div className="eyebrow">Vs {selectedNode.name}</div>
                  <div className="mining-comparison-penetration">
                    <div className="mining-comparison-cell">
                      <ExplainedTerm concept="mining-penetration" showHelpIcon={game.settings.showHelpIcons}>
                        Required penetration
                      </ExplainedTerm>
                      <strong>{selectedNode.requiredPenetration}</strong>
                    </div>
                    <div className="mining-comparison-cell">
                      <ExplainedTerm concept="mining-penetration" showHelpIcon={game.settings.showHelpIcons}>
                        Your penetration
                      </ExplainedTerm>
                      <strong>{activeTool.penetration}</strong>
                    </div>
                  </div>
                  <div className="mining-comparison-highlight">
                    <span>
                      <ExplainedTerm concept="mining-effectiveness" showHelpIcon={game.settings.showHelpIcons}>
                        Effectiveness
                      </ExplainedTerm>
                      <EffectivenessBadge effectiveness={selectedEffectiveness} />
                    </span>
                    <span>
                      Actual damage<strong>{getMiningSwingDamage(activeTool, selectedNode)}</strong>
                    </span>
                    <span>
                      Mining XP / Swing
                      <strong>{getMiningSwingXp(selectedNode, selectedEffectiveness)}</strong>{' '}
                      XP/swing
                    </span>
                  </div>
                </div>
                {selectedEffectiveness < 1 ? (
                  <p className="mining-warning" role="status">
                    Your pickaxe cannot fully penetrate this deposit. Damage and Mining XP are reduced.
                  </p>
                ) : (
                  <p className="mining-ready" role="status">
                    Your pickaxe fully penetrates this deposit.
                  </p>
                )}
                {selectedEffectiveness < 1 && (
                  <div className="mining-recommendation">
                  <span>Recommended pickaxe</span>
                  <strong>
                    {recommendedToolName}
                    {recommendedTool && activeTool.penetration > recommendedTool.penetration
                      ? ' or better'
                      : ''}
                  </strong>
                  <small>
                    Requires {recommendedToolName}
                    {recommendedTool
                      ? ` or better · Mining Level ${recommendedTool.requiredMiningLevel}`
                      : ''}
                  </small>
                  </div>
                )}
                </div>
              </UiPanelRegionSlot>
            </UiPanelRegionGrid>
          </section>
        </UiPanelSlot>
      </UiPanelGrid>
    </>
  );
}
