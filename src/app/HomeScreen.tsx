import { ArrowUpRight, Clock3, Package, Swords } from 'lucide-react';
import { getTotalCombatLevels, getTotalLevel, getTotalProfessionLevels } from '../game/progression/progressionSelectors';
import type { GameState, ScreenId } from '../game/types';
import { formatNumber, formatPlayTime } from './formatters';
import { CharacterOverview } from './home/CharacterOverview';
import {
  getHomeActivitySummary,
  getHomeContinueDestination,
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
  const activity = getHomeActivitySummary(game);
  const worldRecord = getHomeWorldRecord(game);
  const totalLevel = getTotalLevel(game);
  const totalCombatLevels = getTotalCombatLevels(game);
  const totalProfessionLevels = getTotalProfessionLevels(game);

  return (
    <div className="home-screen">
      <div className="screen-heading home-heading">
        <div>
          <div className="eyebrow">The frontier is awake</div>
          <h1>Good to see you, {game.player.name}.</h1>
          <p className="subtle">Your progress and current journey at a glance.</p>
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

      <WorldRecord record={worldRecord} onNavigate={onNavigate} />
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
  const primaryStats = [
    { label: 'Enemies defeated', value: formatNumber(record.totalKills), icon: Swords },
    { label: 'Total items gained', value: formatNumber(record.totalItemsGained), icon: Package },
    { label: 'Time played', value: formatPlayTime(record.playTimeMs), icon: Clock3 },
  ];

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

      <div className="home-record-stat-strip">
        {primaryStats.map(({ label, value, icon: Icon }) => (
          <div className="home-record-stat" key={label}>
            <span className="home-record-stat-icon" aria-hidden="true"><Icon size={17} /></span>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <div className="home-record-collection">
        <div className="eyebrow">Collection</div>
        <div className="home-record-collection-grid">
          <div className="home-record-row"><span>Items</span><strong>{record.itemProgress.discovered}/{record.itemProgress.total}</strong></div>
          <div className="home-record-row"><span>Monsters</span><strong>{record.monsterProgress.discovered}/{record.monsterProgress.total}</strong></div>
          <div className="home-record-row"><span>Overall</span><strong>{record.overallProgress.percent}%</strong></div>
        </div>
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
    </section>
  );
}
