import { enemyById } from '../content/enemies';
import { itemById, ITEMS } from '../content/items';
import { miningNodeById } from '../content/miningNodes';
import { recipeById } from '../content/recipes';
import type { GameState, SimulationContext, SimulationSummary, SkillId } from '../game/types';
import { formatNumber } from './formatters';
import { ItemIcon } from './ItemIcon';

const skillLabels: Record<SkillId, string> = {
  attack: 'Attack',
  strength: 'Strength',
  defence: 'Defence',
  hitpoints: 'Hitpoints',
  mining: 'Mining',
  smithing: 'Smithing',
};

const rarityOrder: Record<string, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
};

export const formatOfflineDuration = (milliseconds: number): string => {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `${minutes}m${seconds ? ` ${seconds}s` : ''}`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h${remainingMinutes ? ` ${remainingMinutes}m` : ''}`;
};

const contextMatchesAction = (context: SimulationContext, game: GameState): boolean => {
  if (context.activity === 'mining')
    return game.activeAction.type === 'mining' && game.activeAction.nodeId === context.miningNodeId;
  if (context.activity === 'smithing')
    return game.activeAction.type === 'smithing' && game.activeAction.recipeId === context.recipeId;
  if (context.activity === 'combat')
    return game.activeAction.type === 'combat' && game.activeAction.enemyId === context.enemyId;
  return false;
};

const activityName = (context: SimulationContext): string => {
  if (context.activity === 'mining') return 'Mining';
  if (context.activity === 'smithing') return 'Smithing';
  if (context.activity === 'combat') return 'Combat';
  return 'No activity';
};

const activityCopy = (context: SimulationContext): string => {
  if (context.activity === 'mining') return 'Mining continued while you were gone.';
  if (context.activity === 'smithing') return 'Smithing continued while you were gone.';
  if (context.activity === 'combat') return 'Combat continued while you were gone.';
  return 'Nothing was running while you were away.';
};

const orderedItemIds = (summary: SimulationSummary, context: SimulationContext): string[] => {
  const primaryId =
    context.activity === 'mining' && context.miningNodeId
      ? miningNodeById[context.miningNodeId]?.primaryRewardItemId
      : undefined;
  const definitionOrder = new Map(ITEMS.map((item, index) => [item.id, index]));
  return Object.entries(summary.itemsGained)
    .filter(([, amount]) => amount > 0)
    .sort(([leftId], [rightId]) => {
      if (leftId === primaryId) return -1;
      if (rightId === primaryId) return 1;
      const left = itemById[leftId];
      const right = itemById[rightId];
      const rarityDelta =
        (rarityOrder[left?.rarity ?? 'common'] ?? 0) -
        (rarityOrder[right?.rarity ?? 'common'] ?? 0);
      if (rarityDelta !== 0) return rarityDelta;
      return (
        (definitionOrder.get(leftId) ?? Number.MAX_SAFE_INTEGER) -
        (definitionOrder.get(rightId) ?? Number.MAX_SAFE_INTEGER)
      );
    })
    .map(([itemId]) => itemId);
};

const skillName = (skill: string): string =>
  skillLabels[skill as SkillId] ??
  skill.replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

function OfflineItems({
  summary,
  context,
}: {
  summary: SimulationSummary;
  context: SimulationContext;
}) {
  const ids = orderedItemIds(summary, context);
  if (ids.length === 0) return null;
  return (
    <section className="offline-report-section offline-gains" aria-labelledby="offline-gains-title">
      <div className="eyebrow" id="offline-gains-title">
        Gains
      </div>
      <div className="offline-gain-list">
        {ids.map((itemId) => (
          <div className="offline-gain-row" key={itemId}>
            <ItemIcon itemId={itemId} size="md" />
            <span>{itemById[itemId]?.name ?? itemId}</span>
            <strong>+{formatNumber(summary.itemsGained[itemId])}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function OfflineProgress({ summary, game }: { summary: SimulationSummary; game: GameState }) {
  const xpRows = Object.entries(summary.xpGained).filter(([, amount]) => (amount ?? 0) > 0);
  const levelRows = Object.entries(summary.levelsGained).filter(([, amount]) => (amount ?? 0) > 0);
  const showCombatStats = summary.offlineContext?.activity === 'combat';
  if (xpRows.length === 0 && levelRows.length === 0 && !showCombatStats) return null;
  return (
    <section
      className="offline-report-section offline-progress"
      aria-labelledby="offline-progress-title"
    >
      <div className="eyebrow" id="offline-progress-title">
        Progress
      </div>
      <div className="offline-progress-list">
        {showCombatStats && summary.enemiesDefeated > 0 && (
          <div className="offline-progress-row">
            <span>Enemies defeated</span>
            <strong>{formatNumber(summary.enemiesDefeated)}</strong>
          </div>
        )}
        {showCombatStats && summary.goldGained > 0 && (
          <div className="offline-progress-row">
            <span>Gold gained</span>
            <strong>+{formatNumber(summary.goldGained)}</strong>
          </div>
        )}
        {xpRows.map(([skill, amount]) => (
          <div className="offline-progress-row" key={skill}>
            <span>{skillName(skill)} XP</span>
            <strong>+{formatNumber(amount ?? 0)}</strong>
          </div>
        ))}
        {levelRows.map(([skill, amount]) => {
          const gained = amount ?? 0;
          const finalLevel = game.skills[skill as SkillId]?.level;
          const startingLevel = finalLevel === undefined ? undefined : finalLevel - gained;
          return (
            <div className="offline-progress-row" key={`${skill}-level`}>
              <span>{skillName(skill)} Level</span>
              <strong>
                {startingLevel !== undefined && startingLevel >= 1
                  ? `${startingLevel} → ${finalLevel}`
                  : `+${gained}`}
              </strong>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function OfflineModal({
  game,
  summary,
  onClose,
}: {
  game: GameState;
  summary: SimulationSummary;
  onClose: () => void;
}) {
  const context = summary.offlineContext ?? { activity: 'idle' as const };
  const nodeName = context.miningNodeId ? miningNodeById[context.miningNodeId]?.name : undefined;
  const recipeName = context.recipeId ? recipeById[context.recipeId]?.name : undefined;
  const enemyName = context.enemyId ? enemyById[context.enemyId]?.name : undefined;
  const subjectName = nodeName ?? recipeName ?? enemyName;
  const status = summary.stoppedReason
    ? `${activityName(context)} stopped: ${summary.stoppedReason}`
    : contextMatchesAction(context, game)
      ? `${activityName(context)} continues automatically.`
      : context.activity === 'idle'
        ? 'No activity was running while you were away.'
        : 'Activity completed while you were away.';

  return (
    <div className="modal-backdrop">
      <section
        className="modal offline-report"
        role="dialog"
        aria-modal="true"
        aria-labelledby="offline-title"
      >
        <div className="eyebrow">Welcome back</div>
        <h2 id="offline-title">Welcome back</h2>
        <p className="offline-report-away">
          {formatOfflineDuration(summary.requestedElapsedMs)} away
        </p>
        <p className="subtle">{activityCopy(context)}</p>
        {subjectName && <h3 className="offline-activity">{subjectName}</h3>}
        <OfflineItems summary={summary} context={context} />
        <OfflineProgress summary={summary} game={game} />
        {summary.offlineCapped && (
          <p className="subtle offline-cap-note">
            {formatOfflineDuration(summary.elapsedMs)} simulated. Offline progress is currently
            capped at 24 hours.
          </p>
        )}
        <p className={`offline-status ${summary.stoppedReason ? 'is-stopped' : ''}`}>{status}</p>
        <button className="button primary offline-continue" onClick={onClose}>
          Continue
        </button>
      </section>
    </div>
  );
}
