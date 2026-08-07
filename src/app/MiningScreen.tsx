import { Lock, Pickaxe } from 'lucide-react';
import { GAME_CONFIG } from '../config/gameConfig';
import { MINING_TUNING } from '../config/miningTuning';
import { itemById } from '../content/items';
import { MINING_NODES, miningNodeById } from '../content/miningNodes';
import {
  getMiningEffectiveness,
  getMiningEstimatedRates,
  getMiningRuntimeState,
  getMiningTool,
} from '../game/formulas/miningFormulas';
import { useGameStore } from '../game/state/gameStore';
import type { GameState, MiningNodeDefinition, ScreenId } from '../game/types';
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

const phaseLabel = (phase: 'swing' | 'rest' | 'respawn' | 'stopped'): string => {
  if (phase === 'swing') return 'Swinging';
  if (phase === 'rest') return 'Resting';
  if (phase === 'respawn') return 'Rock Respawning';
  return 'Stopped';
};

const formatDuration = (milliseconds: number): string => {
  const seconds = Math.max(0, milliseconds) / 1000;
  return seconds >= 10 ? `${Math.ceil(seconds)}s` : `${seconds.toFixed(1)}s`;
};

const phaseProgress = (game: GameState, node: MiningNodeDefinition | undefined): number => {
  if (game.activeAction.type !== 'mining' || !node) return 0;
  if (game.activeAction.phase === 'rest')
    return game.activeAction.progressMs / MINING_TUNING.restDurationMs;
  if (game.activeAction.phase === 'respawn') {
    const runtime = getMiningRuntimeState(game.mining, node.id);
    return 1 - runtime.respawnRemainingMs / node.respawnMs;
  }
  return game.activeAction.progressMs / getMiningTool(game).swingIntervalMs;
};

const StaminaBar = ({ stamina }: { stamina: number }) => (
  <div className="mining-stamina-block">
    <div className="split">
      <span>Mining stamina</span>
      <strong>
        {Math.round(stamina)} / {MINING_TUNING.maxStamina}
      </strong>
    </div>
    <div
      className="bar mining-progress-bar"
      role="progressbar"
      aria-label="Mining stamina"
      aria-valuemin={0}
      aria-valuemax={MINING_TUNING.maxStamina}
      aria-valuenow={Math.round(stamina)}
    >
      <i style={{ width: `${(stamina / MINING_TUNING.maxStamina) * 100}%` }} />
    </div>
  </div>
);

const StageList = ({
  node,
  currentStage,
}: {
  node: MiningNodeDefinition;
  currentStage: number;
}) => (
  <div className="mining-stage-list" aria-label={`${node.name} rock stages`}>
    {node.stages.map((stage, index) => (
      <div className={`mining-stage ${index === currentStage ? 'active' : ''}`} key={stage.id}>
        <span>{index + 1}</span>
        <strong>{stage.name}</strong>
        <small>{stage.bonusChanceMultiplier.toFixed(2)}× bonus chance</small>
      </div>
    ))}
  </div>
);

export function MiningScreen({ game, uiLayout, requestAction }: MiningScreenProps) {
  const startMining = useGameStore((store) => store.startMining);
  const stopAction = useGameStore((store) => store.stopAction);
  const active = game.activeAction.type === 'mining' ? game.activeAction.nodeId : null;
  const activeNode = active ? miningNodeById[active] : undefined;
  const tool = getMiningTool(game);
  const activeRuntime = activeNode ? getMiningRuntimeState(game.mining, activeNode.id) : undefined;
  const activeStage = activeNode?.stages[activeRuntime?.stageIndex ?? 0];
  const activePhase = game.activeAction.type === 'mining' ? game.activeAction.phase : 'stopped';
  const progress = phaseProgress(game, activeNode);
  const phaseDuration =
    activePhase === 'rest'
      ? MINING_TUNING.restDurationMs
      : activePhase === 'respawn'
        ? (activeNode?.respawnMs ?? 0)
        : tool.swingIntervalMs;
  const phaseRemaining = Math.max(0, phaseDuration - (progress * phaseDuration || 0));

  return (
    <>
      <ScreenHeading
        eyebrow="Skill · Gathering"
        title="Mining"
        description="Set a pick against one living rock, then let steady work fill your pack."
        trailing={
          <span className="badge gold">
            Level {game.skills.mining.level} · {formatNumber(game.skills.mining.xp)} XP
          </span>
        }
      />
      <div className="ui-panel-grid mining-panel-grid" data-ui-panel-grid="mining">
        <UiPanelSlot screen="mining" id="miningOverview" layout={uiLayout}>
          <section className="panel scene-panel mining-overview-panel">
            <ThreeScene screen="mining" settings={game.settings} theme="#b87950" />
            <div className="mining-overview-content">
              <div className="eyebrow">Deep-earth study</div>
              <h2>{activeNode?.name ?? 'Choose a rock node'}</h2>
              <p className="subtle">
                {activeNode
                  ? `${phaseLabel(activePhase)} · stage ${(activeRuntime?.stageIndex ?? 0) + 1} / ${activeNode.stages.length}`
                  : 'Select a node to begin a persistent Mining action.'}
              </p>
              {activeNode && activeRuntime && activeStage ? (
                <div className="mining-overview-status">
                  <div className="split">
                    <span>{activeStage.name}</span>
                    <strong>
                      {Math.ceil(activeRuntime.stageDurability)} / {activeStage.durability}
                    </strong>
                  </div>
                  <div
                    className="bar mining-progress-bar"
                    role="progressbar"
                    aria-label="Current stage durability"
                    aria-valuemin={0}
                    aria-valuemax={activeStage.durability}
                    aria-valuenow={Math.ceil(activeRuntime.stageDurability)}
                  >
                    <i
                      style={{
                        width: `${(activeRuntime.stageDurability / activeStage.durability) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="split mining-phase-row">
                    <span>{phaseLabel(activePhase)}</span>
                    <strong>
                      {game.activeAction.type === 'mining'
                        ? `${formatDuration(phaseRemaining)} remaining`
                        : 'Ready'}
                    </strong>
                  </div>
                  <div
                    className="bar mining-progress-bar"
                    role="progressbar"
                    aria-label={`${phaseLabel(activePhase)} progress`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(Math.max(0, Math.min(1, progress)) * 100)}
                  >
                    <i style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%` }} />
                  </div>
                  <StaminaBar stamina={game.mining.stamina} />
                </div>
              ) : (
                <div className="mining-empty-state">
                  <Pickaxe size={28} aria-hidden="true" />
                  <span>Nothing is selected. Choose Copper or Tin to start Mining.</span>
                </div>
              )}
            </div>
          </section>
        </UiPanelSlot>

        <UiPanelSlot screen="mining" id="miningNodes" layout={uiLayout}>
          <section className="panel panel-pad">
            <div className="split">
              <div>
                <h2>Rock nodes</h2>
                <p className="subtle">Rates include tool damage, stamina rest, and respawn time.</p>
              </div>
              <span className="badge">
                {occupiedSlots(game.inventory)}/{GAME_CONFIG.inventorySlots} slots
              </span>
            </div>
            <div className="list mining-node-list">
              {MINING_NODES.map((node) => {
                const locked = game.skills.mining.level < node.level;
                const isActive = active === node.id;
                const effectiveness = getMiningEffectiveness(tool, node);
                const rates = getMiningEstimatedRates(game, node);
                const primary = itemById[node.primaryRewardItemId];
                return (
                  <div
                    className={`list-row mining-node-card ${locked ? 'locked-card' : ''}`}
                    key={node.id}
                  >
                    <div className="row-main">
                      <strong>
                        {node.name}{' '}
                        {locked && <span className="badge locked">Level {node.level}</span>}
                      </strong>
                      <small>
                        <ItemIcon itemId={primary?.id} size="sm" />{' '}
                        {primary?.name ?? node.primaryRewardItemId} · {node.stages.length} stages ·{' '}
                        {node.requiredPenetration} penetration
                      </small>
                      <div className="mining-node-metrics">
                        <span>{Math.round(effectiveness * 100)}% effective</span>
                        <span>{rates.primaryOrePerHour.toFixed(1)} ore/hr</span>
                        <span>{Math.round(rates.xpPerHour)} XP/hr</span>
                      </div>
                    </div>
                    {locked ? (
                      <Lock
                        size={15}
                        className="muted"
                        aria-label={`Locked: Mining level ${node.level} required`}
                      />
                    ) : isActive ? (
                      <button
                        className="button danger"
                        onClick={stopAction}
                        aria-label={`Stop mining ${node.name}`}
                      >
                        Stop
                      </button>
                    ) : (
                      <button
                        className="button primary"
                        onClick={() => requestAction('mining', () => startMining(node.id))}
                        aria-label="Mine"
                      >
                        Mine
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </UiPanelSlot>

        <UiPanelSlot screen="mining" id="miningDetails" layout={uiLayout}>
          <section className="panel panel-pad mining-details-panel">
            <div className="mining-details-grid">
              <div>
                <div className="eyebrow">Current tool</div>
                <h2>{tool.itemId ? itemById[tool.itemId]?.name : 'No pickaxe'}</h2>
                <div className="mining-tool-summary">
                  <ItemIcon itemId={tool.itemId || undefined} size="md" />
                  <div className="mining-stat-grid">
                    <span>
                      Rock damage<strong>{tool.rockDamage}</strong>
                    </span>
                    <span>
                      Penetration<strong>{tool.penetration}</strong>
                    </span>
                    <span>
                      Swing time<strong>{formatDuration(tool.swingIntervalMs)}</strong>
                    </span>
                    <span>
                      Stamina / swing<strong>{tool.staminaCost}</strong>
                    </span>
                    <span>
                      Required level<strong>{tool.requiredMiningLevel}</strong>
                    </span>
                    {activeNode && (
                      <span>
                        Effectiveness
                        <strong>
                          {Math.round(getMiningEffectiveness(tool, activeNode) * 100)}%
                        </strong>
                      </span>
                    )}
                  </div>
                </div>
                {activeNode && getMiningEffectiveness(tool, activeNode) < 1 && (
                  <p className="mining-warning" role="status">
                    Under-penetration reduces damage and XP against this node. Mining never misses.
                  </p>
                )}
                <StaminaBar stamina={game.mining.stamina} />
              </div>
              <div>
                <div className="eyebrow">Rock and rewards</div>
                <h2>{activeNode?.name ?? 'Select a node'}</h2>
                {activeNode && activeRuntime ? (
                  <>
                    <StageList node={activeNode} currentStage={activeRuntime.stageIndex} />
                    <div className="mining-reward-summary">
                      <span>
                        Primary ore<strong>{itemById[activeNode.primaryRewardItemId]?.name}</strong>
                      </span>
                      <span>
                        Current durability
                        <strong>{Math.ceil(activeRuntime.stageDurability)}</strong>
                      </span>
                      <span>
                        Stage bonus
                        <strong>{(activeStage?.bonusChanceMultiplier ?? 1).toFixed(2)}×</strong>
                      </span>
                      <span>
                        Rest / respawn
                        <strong>
                          {formatDuration(MINING_TUNING.restDurationMs)} /{' '}
                          {formatDuration(activeNode.respawnMs)}
                        </strong>
                      </span>
                    </div>
                    <div className="mining-loot-list">
                      {activeNode.bonusDrops.map((drop) => (
                        <span key={drop.itemId}>
                          {itemById[drop.itemId]?.name ?? drop.itemId} ·{' '}
                          {(drop.chance * (activeStage?.bonusChanceMultiplier ?? 1) * 100).toFixed(
                            2,
                          )}
                          %
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="subtle">
                    Current-stage loot and durability appear here after selecting a node.
                  </p>
                )}
              </div>
            </div>
          </section>
        </UiPanelSlot>
      </div>
    </>
  );
}
