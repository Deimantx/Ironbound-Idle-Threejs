import { ArrowUpRight, Check, Hammer, Pickaxe, Swords } from 'lucide-react';
import { getDerivedStats } from '../game/formulas/statFormulas';
import { getTotalCombatLevels, getTotalLevel, getTotalProfessionLevels } from '../game/progression/progressionSelectors';
import { useGameStore } from '../game/state/gameStore';
import type { GameState, ScreenId } from '../game/types';
import { formatNumber } from './formatters';
import { CharacterOverview } from './home/CharacterOverview';
import {
  getHomeActivitySummary,
  getHomeContinueDestination,
  getHomeRecentProgress,
  getHomeStarterPathObjectives,
  getHomeWorldRecord,
} from './home/homeSelectors';
import { CombatProgression, ProfessionProgression } from './home/ProgressionPanels';

export function HomeScreen({
  game,
  onNavigate,
}: {
  game: GameState;
  onNavigate: (screen: ScreenId) => void;
}) {
  const combatSession = useGameStore((store) => store.combatSession);
  const stats = getDerivedStats(game);
  const activity = getHomeActivitySummary(game, { combatSession });
  const objectives = getHomeStarterPathObjectives(game);
  const worldRecord = getHomeWorldRecord(game);
  const recent = getHomeRecentProgress(game);
  const totalLevel = getTotalLevel(game);
  const totalCombatLevels = getTotalCombatLevels(game);
  const totalProfessionLevels = getTotalProfessionLevels(game);

  return (
    <div className="home-screen">
      <div className="screen-heading home-heading">
        <div>
          <div className="eyebrow">The frontier is awake</div>
          <h1>Good to see you, {game.player.name}.</h1>
          <p className="subtle">Your progress, equipment, and current journey at a glance.</p>
        </div>
        <button className="button primary" onClick={() => onNavigate(getHomeContinueDestination(game))}>
          Continue Journey <ArrowUpRight size={15} aria-hidden="true" />
        </button>
      </div>

      <CurrentActivityCard game={game} activity={activity} onNavigate={onNavigate} />

      <CharacterOverview
        game={game}
        onNavigate={onNavigate}
        totalLevel={totalLevel}
        totalCombatLevels={totalCombatLevels}
        totalProfessionLevels={totalProfessionLevels}
      />

      <div className="home-progression-grid">
        <CombatProgression game={game} onNavigate={onNavigate} />
        <ProfessionProgression game={game} onNavigate={onNavigate} />
      </div>

      <div className="home-record-grid">
        <WorldRecord record={worldRecord} onNavigate={onNavigate} />
        <StarterPath objectives={objectives} onNavigate={onNavigate} />
      </div>

      <div className="home-recent-grid">
        <RecentProgressPanel
          title="Recent Combat Progress"
          description="The latest levels earned in combat skills."
          entries={recent.combat}
          empty="No recent combat level-ups yet."
        />
        <RecentProgressPanel
          title="Recent Profession Progress"
          description="The latest levels earned while gathering and crafting."
          entries={recent.profession}
          empty="No recent profession level-ups yet."
          compatibilityHeading="Recent Level Ups"
        />
      </div>

      <div className="home-quiet-summary" aria-label="Character summary">
        Total Level {totalLevel} · Combat Level {stats.combatLevel} · {formatNumber(game.statistics.totalKills)} enemies defeated
      </div>
    </div>
  );
}

function CurrentActivityCard({
  game,
  activity,
  onNavigate,
}: {
  game: GameState;
  activity: ReturnType<typeof getHomeActivitySummary>;
  onNavigate: (screen: ScreenId) => void;
}) {
  const Icon = activity.type === 'combat' ? Swords : activity.type === 'mining' ? Pickaxe : Hammer;
  return (
    <section className={`panel home-activity home-activity-${activity.type}`} aria-labelledby="current-activity-title">
      <div className="home-activity-icon" aria-hidden="true">
        {activity.type === 'idle' ? <span>·</span> : <Icon size={18} />}
      </div>
      <div className="home-activity-copy">
        <div className="eyebrow" id="current-activity-title">Current activity</div>
        <h2>{activity.title}</h2>
        {activity.subtitle && <p className="subtle">{activity.subtitle}</p>}
        {activity.meta && <small>{activity.meta}</small>}
      </div>
      {activity.destination && (
        <button className="button ghost home-activity-action" onClick={() => onNavigate(activity.destination!)}>
          Return to {activity.type === 'combat' ? 'Combat' : activity.type === 'mining' ? 'Mining' : 'Smithing'}
          <ArrowUpRight size={14} aria-hidden="true" />
        </button>
      )}
      {activity.type === 'idle' && game.activeAction.type === 'none' && <span className="badge">No action running</span>}
    </section>
  );
}

function WorldRecord({
  record,
  onNavigate,
}: {
  record: ReturnType<typeof getHomeWorldRecord>;
  onNavigate: (screen: ScreenId) => void;
}) {
  return (
    <section className="panel panel-pad home-world-record" aria-labelledby="world-record-title">
      <div className="home-panel-heading">
        <div>
          <div className="eyebrow">World / collection</div>
          <h2 id="world-record-title">World Record</h2>
        </div>
        <button className="button ghost" onClick={() => onNavigate('collection')}>
          View Collection <ArrowUpRight size={14} aria-hidden="true" />
        </button>
      </div>
      <div className="home-record-grid-inner">
        <div><span>Enemies defeated</span><strong>{formatNumber(record.totalKills)}</strong></div>
        <div><span>Items discovered</span><strong>{record.itemProgress.discovered}/{record.itemProgress.total}</strong></div>
        <div><span>Monsters discovered</span><strong>{record.monsterProgress.discovered}/{record.monsterProgress.total}</strong></div>
        <div><span>Overall collection</span><strong>{record.overallProgress.percent}%</strong></div>
      </div>
      <p className="subtle">The same eligible world and collection totals shown in the Collection Log.</p>
    </section>
  );
}

function StarterPath({
  objectives,
  onNavigate,
}: {
  objectives: ReturnType<typeof getHomeStarterPathObjectives>;
  onNavigate: (screen: ScreenId) => void;
}) {
  const completed = objectives.filter((objective) => objective.done).length;
  const isComplete = completed === objectives.length;
  return (
    <section className={`panel panel-pad home-starter-path ${isComplete ? 'home-starter-complete' : ''}`} aria-labelledby="starter-path-title">
      <div className="home-panel-heading">
        <div>
          <div className="eyebrow">Starter path</div>
          <h2 id="starter-path-title">First embers</h2>
        </div>
        <span className="badge">{completed}/{objectives.length}</span>
      </div>
      {isComplete ? (
        <div className="home-starter-done">
          <Check size={18} aria-hidden="true" />
          <div><strong>Starter Path complete</strong><span>The first road is open. Choose your next direction.</span></div>
        </div>
      ) : (
        <div className="home-objective-list">
          {objectives.map((objective) => (
            <button
              className={`objective ${objective.done ? 'done' : ''}`}
              key={objective.text}
              onClick={() => onNavigate(objective.target)}
              type="button"
              aria-label={`${objective.text}${objective.done ? ', complete' : ', incomplete'}`}
            >
              <span className="objective-check" aria-hidden="true">{objective.done ? <Check size={13} /> : ''}</span>
              <span>{objective.text}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function RecentProgressPanel({
  title,
  description,
  entries,
  empty,
  compatibilityHeading,
}: {
  title: string;
  description: string;
  entries: GameState['activityLogs']['milestones'];
  empty: string;
  compatibilityHeading?: string;
}) {
  return (
    <section className="panel panel-pad home-recent-panel" aria-label={title}>
      <div className="home-panel-heading">
        <div>
          <div className="eyebrow">Recent progress</div>
          <h2>{title}</h2>
          <p className="subtle">{description}</p>
        </div>
      </div>
      {compatibilityHeading && <h2 className="visually-hidden">{compatibilityHeading}</h2>}
      <div className="home-milestone-list">
        {entries.map((entry) => (
          <div className="home-milestone-row" key={entry.id}>
            <span className="home-milestone-icon" aria-hidden="true"><ArrowUpRight size={15} /></span>
            <strong>{entry.skillId[0].toUpperCase() + entry.skillId.slice(1)} reached Level {entry.level}</strong>
            <time dateTime={new Date(entry.at).toISOString()}>
              {new Date(entry.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </time>
          </div>
        ))}
        {entries.length === 0 && <span className="muted">{empty}</span>}
      </div>
    </section>
  );
}
