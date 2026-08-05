import { Lock } from 'lucide-react';
import { GAME_CONFIG } from '../config/gameConfig';
import { itemById } from '../content/items';
import { MINING_NODES, miningNodeById } from '../content/miningNodes';
import { getDerivedStats } from '../game/formulas/statFormulas';
import { useGameStore } from '../game/state/gameStore';
import type { GameState, ScreenId } from '../game/types';
import { occupiedSlots } from '../game/systems/inventorySystem';
import { ThreeScene } from '../three/ThreeScene';
import { formatNumber } from './formatters';
import { ScreenHeading } from './ScreenHeading';
import { UiPanelSlot } from './UiPanelSlot';
import type { UiLayout } from './uiLayout';

export interface MiningScreenProps {
  game: GameState;
  uiLayout: UiLayout;
  requestAction: (screen: ScreenId, action: () => void) => void;
}

export function MiningScreen({ game, uiLayout, requestAction }: MiningScreenProps) {
  const startMining = useGameStore((store) => store.startMining);
  const stopAction = useGameStore((store) => store.stopAction);
  const active = game.activeAction.type === 'mining' ? game.activeAction.nodeId : null;
  const miningIntervalMultiplier = getDerivedStats(game).miningIntervalMultiplier;
  const activeNode = active ? miningNodeById[active] : undefined;
  return (
    <>
      <ScreenHeading
        eyebrow="Skill · Gathering"
        title="Mining"
        description="Find a seam, set the pick, and let steady work fill your pack."
        trailing={
          <span className="badge gold">
            Level {game.skills.mining.level} · {formatNumber(game.skills.mining.xp)} XP
          </span>
        }
      />
      <div className="ui-panel-grid mining-panel-grid" data-ui-panel-grid="mining">
        <UiPanelSlot screen="mining" id="miningOverview" layout={uiLayout}>
          <section className="panel scene-panel">
            <ThreeScene screen="mining" settings={game.settings} theme="#b87950" />
            <div style={{ position: 'relative', padding: 20 }}>
              <div className="eyebrow">Deep-earth study</div>
              <h2>{activeNode?.name ?? 'Choose a rock node'}</h2>
              <p className="subtle">
                Mining stays active as you move through the keep. Your pickaxe trims the interval.
              </p>
              {activeNode && (
                <div style={{ marginTop: 35 }}>
                  <div className="split">
                    <span className="muted">Current cycle</span>
                    <span className="muted">
                      {Math.round(
                        (game.activeAction.type === 'mining' ? game.activeAction.progressMs : 0) /
                          1000,
                      )}
                      s
                    </span>
                  </div>
                  <div className="bar" style={{ marginTop: 7 }}>
                    <i
                      style={{
                        width: `${(game.activeAction.type === 'mining' ? game.activeAction.progressMs / activeNode.intervalMs : 0) * 100}%`,
                      }}
                    />
                  </div>
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
                <p className="subtle">Output per hour is an estimate before tool bonuses.</p>
              </div>
              <span className="badge">
                {occupiedSlots(game.inventory)}/{GAME_CONFIG.inventorySlots} slots
              </span>
            </div>
            <div className="list" style={{ marginTop: 12 }}>
              {MINING_NODES.map((node) => {
                const locked = game.skills.mining.level < node.level;
                const isActive = active === node.id;
                return (
                  <div className={`list-row ${locked ? 'locked-card' : ''}`} key={node.id}>
                    <div className="row-main">
                      <strong>
                        {node.name}{' '}
                        {locked && <span className="badge locked">Level {node.level}</span>}
                      </strong>
                      <small>
                        {node.description} · {itemById[node.rewardItemId]?.name} ·{' '}
                        {Math.round(3_600_000 / (node.intervalMs * miningIntervalMultiplier))}/hr
                      </small>
                    </div>
                    {locked ? (
                      <Lock size={15} className="muted" aria-label="Locked" />
                    ) : isActive ? (
                      <button className="button danger" onClick={stopAction}>
                        Stop
                      </button>
                    ) : (
                      <button
                        className="button primary"
                        onClick={() => requestAction('mining', () => startMining(node.id))}
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
      </div>
    </>
  );
}
