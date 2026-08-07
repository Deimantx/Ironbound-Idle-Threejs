import { Hammer, Heart, Pickaxe, Swords, Timer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MINING_TUNING } from '../config/miningTuning';
import { enemyById } from '../content/enemies';
import { itemById } from '../content/items';
import { miningNodeById } from '../content/miningNodes';
import { recipeById } from '../content/recipes';
import { progressRatio } from '../game/engine/simulation';
import {
  getSmithingEffectiveInterval,
  getSmithingEstimatedRates,
  getSmithingHammer,
} from '../game/formulas/smithingFormulas';
import {
  getMiningEstimatedRates,
  getMiningRuntimeState,
  getMiningTool,
} from '../game/formulas/miningFormulas';
import { MAX_LEVEL, getLevelProgress } from '../game/formulas/experienceFormulas';
import { getDerivedStats } from '../game/formulas/statFormulas';
import { useGameStore } from '../game/state/gameStore';
import type { GameState, ScreenId } from '../game/types';
import { formatRatePerHour } from './formatters';

export const actionLabel = (state: GameState): string => {
  const action = state.activeAction;
  if (action.type === 'mining') return miningNodeById[action.nodeId]?.name ?? 'Mining';
  if (action.type === 'smithing') return recipeById[action.recipeId]?.name ?? 'Smithing';
  if (action.type === 'combat') return `Fighting ${enemyById[action.enemyId]?.name ?? 'enemy'}`;
  return 'No active action';
};

const formatFightDuration = (startedAt: number | null, now: number): string => {
  if (startedAt === null) return '0:00';
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

const formatPhaseRemaining = (milliseconds: number): string =>
  `${Math.max(0, Math.ceil(milliseconds / 1000))}s`;

const formatLevelEta = (xpRemaining: number, xpPerHour: number): string => {
  if (xpRemaining <= 0) return '00:00';
  if (!Number.isFinite(xpPerHour) || xpPerHour <= 0) return '--:--';
  const totalMinutes = Math.max(1, Math.ceil((xpRemaining / xpPerHour) * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

interface ActivityLevelProgressProps {
  label: string;
  level: number;
  percent: number;
  maxLevel: number;
}

export function ActivityLevelProgress({
  label,
  level,
  percent,
  maxLevel,
}: ActivityLevelProgressProps) {
  const isMax = level >= maxLevel;
  const roundedPercent = Math.round(Math.max(0, Math.min(100, percent)));
  return (
    <div
      className="activity-level-progress"
      aria-label={`${label} level progress`}
      title={
        isMax
          ? `${label} Level ${level} — max level`
          : `${label} Level ${level} — ${roundedPercent}% to Level ${level + 1}`
      }
    >
      <strong className="activity-level-current">{level}</strong>
      <div
        className="activity-level-track"
        role="progressbar"
        aria-label={`${label} level progress`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={roundedPercent}
        aria-valuetext={isMax ? `${label} max level` : `${roundedPercent}% to level ${level + 1}`}
      >
        <i className="activity-level-fill" style={{ width: `${roundedPercent}%` }} />
        <span className="activity-level-percent">{isMax ? 'MAX LEVEL' : `${roundedPercent}%`}</span>
      </div>
      {isMax ? (
        <span className="activity-level-next-placeholder" aria-hidden="true" />
      ) : (
        <strong className="activity-level-next">{level + 1}</strong>
      )}
    </div>
  );
}

const ActivityPhaseProgress = ({
  label,
  ratio,
  remainingMs,
}: {
  label: string;
  ratio: number;
  remainingMs: number;
}) => {
  const percentage = Math.round(Math.max(0, Math.min(1, ratio)) * 100);
  return (
    <div className="activity-phase">
      <span className="activity-phase-label">{label}</span>
      <div
        className="activity-phase-track"
        role="progressbar"
        aria-label={`${label} progress`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentage}
      >
        <i className="activity-phase-fill" style={{ width: `${percentage}%` }} />
      </div>
      <strong className="activity-phase-time">{formatPhaseRemaining(remainingMs)}</strong>
    </div>
  );
};

const MiningActivityStrip = ({
  game,
  now,
  onNavigate,
  onStop,
}: {
  game: GameState;
  now: number;
  onNavigate: (screen: ScreenId) => void;
  onStop: () => void;
}) => {
  if (game.activeAction.type !== 'mining') return null;
  const action = game.activeAction;
  const node = miningNodeById[action.nodeId];
  if (!node) return null;
  const runtime = getMiningRuntimeState(game.mining, action.nodeId);
  const stage = node.stages[runtime.stageIndex] ?? node.stages[0];
  const tool = getMiningTool(game);
  const phaseLabel =
    action.phase === 'rest' ? 'Rest' : action.phase === 'respawn' ? 'Respawn' : 'Swing';
  const phaseFullLabel =
    action.phase === 'rest'
      ? 'Resting'
      : action.phase === 'respawn'
        ? 'Rock reforming'
        : 'Swinging';
  const phaseDuration =
    action.phase === 'rest'
      ? MINING_TUNING.restDurationMs
      : action.phase === 'respawn'
        ? node.respawnMs
        : tool.swingIntervalMs;
  const remainingMs =
    action.phase === 'respawn'
      ? runtime.respawnRemainingMs
      : Math.max(0, phaseDuration - action.progressMs);
  const levelProgress = getLevelProgress(game.skills.mining);
  const xpToNextLevel = Math.max(0, levelProgress.next - levelProgress.current);
  const rates = getMiningEstimatedRates(game, node);
  const phaseDescription =
    action.phase === 'respawn' ? phaseFullLabel : `${phaseFullLabel} · ${stage.name}`;

  return (
    <div className="action-strip activity-strip-mining" data-ui-region="actionStrip">
      <div className="action-icon" aria-hidden="true">
        <Pickaxe size={19} />
      </div>
      <button
        className="activity-identity action-main button ghost"
        onClick={() => onNavigate('mining')}
        aria-label={`Open Mining: ${node.name}`}
      >
        <strong>{node.name}</strong>
        <small>{phaseDescription}</small>
      </button>
      <ActivityLevelProgress
        label="Mining"
        level={game.skills.mining.level}
        percent={levelProgress.percent}
        maxLevel={MAX_LEVEL}
      />
      <div className="activity-rate-column">
        <span
          className="activity-rate"
          title="Estimated Mining XP per hour including rest and rock respawn"
        >
          ~{formatRatePerHour(rates.xpPerHour)} XP/hr
        </span>
      </div>
      {levelProgress.next > 0 && (
        <div className="activity-next-column" aria-label="Mining level estimate">
          <span className="activity-xp-next" title="XP remaining until the next Mining level">
            XP to next: {formatRatePerHour(xpToNextLevel)}
          </span>
          <span className="activity-eta" title="Estimated time until the next Mining level">
            ETA: {formatLevelEta(xpToNextLevel, rates.xpPerHour)}
          </span>
        </div>
      )}
      <ActivityPhaseProgress
        label={phaseLabel}
        ratio={progressRatio(action, now, game)}
        remainingMs={remainingMs}
      />
      <div className="activity-stamina">
        <span>Stamina</span>
        <strong>
          {Math.round(game.mining.stamina)}/{MINING_TUNING.maxStamina}
        </strong>
      </div>
      <button className="button danger activity-stop" onClick={onStop} aria-label="Stop mining">
        Stop
      </button>
    </div>
  );
};

const CombatActivityStrip = ({
  game,
  now,
  onNavigate,
}: {
  game: GameState;
  now: number;
  onNavigate: (screen: ScreenId) => void;
}) => {
  const combatSession = useGameStore((store) => store.combatSession);
  if (game.activeAction.type !== 'combat') return null;
  const action = game.activeAction;
  const enemy = enemyById[action.enemyId];
  const derivedStats = getDerivedStats(game, action.style);
  const combatStartedAt = combatSession.startedAt ?? game.updatedAt;
  return (
    <div className="action-strip combat-strip" data-ui-region="actionStrip">
      <div className="action-icon">
        <Swords size={19} />
      </div>
      <div className="combat-activity-stats" aria-label="Combat activity summary">
        <div className="combat-activity-stat">
          <span>Combat level</span>
          <strong>{derivedStats.combatLevel}</strong>
        </div>
        <div className="combat-activity-stat">
          <span>HP</span>
          <strong>
            <Heart size={13} /> {Math.ceil(game.player.currentHp)} / {derivedStats.maxHealth}
          </strong>
        </div>
      </div>
      <button className="action-main button ghost" onClick={() => onNavigate('combat')}>
        <strong>Fighting {enemy?.name ?? 'enemy'}</strong>
        <small>Click to open Live Combat Resolution</small>
      </button>
      <div className="action-meta action-fight-time">
        <Timer size={13} /> {formatFightDuration(combatStartedAt, now)}
      </div>
    </div>
  );
};

const SmithingActivityStrip = ({
  game,
  now,
  onNavigate,
  onStop,
}: {
  game: GameState;
  now: number;
  onNavigate: (screen: ScreenId) => void;
  onStop: () => void;
}) => {
  if (game.activeAction.type !== 'smithing') return null;
  const action = game.activeAction;
  const recipe = recipeById[action.recipeId];
  if (!recipe) return null;
  const interval = getSmithingEffectiveInterval(game, recipe);
  const rates = getSmithingEstimatedRates(game, recipe);
  const levelProgress = getLevelProgress(game.skills.smithing);
  const hammer = getSmithingHammer(game);
  const remainingMs = Math.max(0, interval - action.progressMs);
  const quantity =
    action.quantityMode === 'continuous'
      ? 'Continuous'
      : action.quantityMode === 'all'
        ? `All · ${action.remaining ?? 0} left`
        : action.quantityMode === 1
          ? '1'
          : `10 Â· ${action.remaining ?? 0} left`;
  return (
    <div className="action-strip activity-strip-smithing" data-ui-region="actionStrip">
      <div className="action-icon" aria-hidden="true">
        <Hammer size={19} />
      </div>
      <button
        className="activity-identity action-main button ghost"
        onClick={() => onNavigate('smithing')}
        aria-label={`Open Smithing: ${recipe.name}`}
      >
        <strong>{recipe.name}</strong>
        <small>
          {recipe.category === 'smelting' ? 'Forge' : 'Anvil'} · {quantity}
        </small>
      </button>
      <ActivityLevelProgress
        label="Smithing"
        level={game.skills.smithing.level}
        percent={levelProgress.percent}
        maxLevel={MAX_LEVEL}
      />
      <div className="activity-rate-column">
        <span className="activity-rate" title="Theoretical active Smithing XP per hour">
          ~{formatRatePerHour(rates.xpPerHour)} XP/hr
        </span>
        <small className="smithing-activity-tool">
          {hammer ? `${itemById[hammer.itemId]?.name} equipped` : 'No hammer'}
        </small>
      </div>
      <ActivityPhaseProgress
        label={recipe.category === 'smelting' ? 'Forge' : 'Anvil'}
        ratio={progressRatio(action, now, game)}
        remainingMs={remainingMs}
      />
      <span className="smithing-activity-quantity">{quantity}</span>
      <button className="button danger activity-stop" onClick={onStop} aria-label="Stop smithing">
        Stop
      </button>
    </div>
  );
};

const GenericActivityStrip = ({
  game,
  now,
  onNavigate,
  onStop,
}: {
  game: GameState;
  now: number;
  onNavigate: (screen: ScreenId) => void;
  onStop: () => void;
}) => {
  const action = game.activeAction;
  const screen: ScreenId = action.type === 'smithing' ? 'smithing' : 'combat';
  const ratio = progressRatio(action, now, game);
  return (
    <div className="action-strip" data-ui-region="actionStrip">
      <div className="action-icon">
        <Hammer size={19} />
      </div>
      <button className="action-main button ghost" onClick={() => onNavigate(screen)}>
        <strong>{actionLabel(game)}</strong>
        <small>Active in background</small>
      </button>
      <div className="progress-track">
        <div
          className="progress-fill"
          style={{ width: `${Math.max(4, Math.min(100, ratio * 100))}%` }}
        />
      </div>
      <div className="action-meta">Cycle in progress</div>
      <button className="button danger" onClick={onStop} aria-label={`Stop ${action.type}`}>
        Stop
      </button>
    </div>
  );
};

export function ActivityStrip({
  game,
  onNavigate,
}: {
  game: GameState;
  onNavigate: (screen: ScreenId) => void;
}) {
  const action = game.activeAction;
  const stopAction = useGameStore((store) => store.stopAction);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (action.type === 'none') return null;
  if (action.type === 'mining')
    return (
      <MiningActivityStrip game={game} now={now} onNavigate={onNavigate} onStop={stopAction} />
    );
  if (action.type === 'combat')
    return <CombatActivityStrip game={game} now={now} onNavigate={onNavigate} />;
  if (action.type === 'smithing')
    return (
      <SmithingActivityStrip game={game} now={now} onNavigate={onNavigate} onStop={stopAction} />
    );
  return <GenericActivityStrip game={game} now={now} onNavigate={onNavigate} onStop={stopAction} />;
}
