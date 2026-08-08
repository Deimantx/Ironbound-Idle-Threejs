import { ArrowUpRight, Check } from 'lucide-react';
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

      <CharacterOverview
        game={game}
        onNavigate={onNavigate}
        totalLevel={totalLevel}
        totalCombatLevels={totalCombatLevels}
        totalProfessionLevels={totalProfessionLevels}
        activity={activity}
      />

      <div className="home-progression-grid">
        <CombatProgression game={game} onNavigate={onNavigate} />
        <ProfessionProgression game={game} onNavigate={onNavigate} />
      </div>

      <div className="home-record-grid">
        <WorldRecord record={worldRecord} onNavigate={onNavigate} />
        <StarterPath objectives={objectives} onNavigate={onNavigate} />
      </div>

      <RecentProgress combat={recent.combat} profession={recent.profession} />
    </div>
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
        <div className="home-record-primary">
          <span>Enemies defeated</span>
          <strong>{formatNumber(record.totalKills)}</strong>
        </div>
        <div className="home-record-collection">
          <div className="eyebrow">Collection</div>
          <div className="home-record-row"><span>Items</span><strong>{record.itemProgress.discovered}/{record.itemProgress.total}</strong></div>
          <div className="home-record-row"><span>Monsters</span><strong>{record.monsterProgress.discovered}/{record.monsterProgress.total}</strong></div>
          <div className="home-record-row"><span>Overall</span><strong>{record.overallProgress.percent}%</strong></div>
          <div
            className="home-record-progress"
            role="progressbar"
            aria-label="Overall collection progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={record.overallProgress.percent}
            aria-valuetext={`${record.overallProgress.percent}% overall collection`}
          >
            <i style={{ width: `${record.overallProgress.percent}%` }} />
          </div>
        </div>
      </div>
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

function RecentProgress({
  combat,
  profession,
}: {
  combat: GameState['activityLogs']['milestones'];
  profession: GameState['activityLogs']['milestones'];
}) {
  return (
    <section className="panel panel-pad home-recent-progress" aria-labelledby="recent-progress-title">
      <div className="home-panel-heading">
        <div>
          <div className="eyebrow">Progression log</div>
          <h2 id="recent-progress-title">Recent Progress</h2>
          <p className="subtle">Latest level gains across your skills.</p>
        </div>
      </div>
      <div className="home-recent-columns">
        <RecentProgressGroup title="Combat" entries={combat} empty="No recent combat level-ups yet." />
        <RecentProgressGroup title="Professions" entries={profession} empty="No recent profession level-ups yet." />
      </div>
    </section>
  );
}

function RecentProgressGroup({
  title,
  entries,
  empty,
}: {
  title: string;
  entries: GameState['activityLogs']['milestones'];
  empty: string;
}) {
  return (
    <div className="home-recent-group">
      <h3>{title}</h3>
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
        {entries.length === 0 && <span className="muted home-milestone-empty">{empty}</span>}
      </div>
    </div>
  );
}
