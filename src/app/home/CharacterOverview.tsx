import { ArrowUpRight, Hammer, Pickaxe, Swords } from 'lucide-react';
import { getDerivedStats } from '../../game/formulas/statFormulas';
import type { GameState, ScreenId } from '../../game/types';
import { ThreeScene } from '../../three/ThreeScene';
import { ItemIcon } from '../ItemIcon';
import { ItemTooltip } from '../items/ItemTooltip';
import { ExplainedTerm } from '../tooltips/GameConceptTooltip';
import { getHomeLoadout, type HomeActivitySummary } from './homeSelectors';

interface CharacterOverviewProps {
  game: GameState;
  onNavigate: (screen: ScreenId) => void;
  totalLevel: number;
  totalCombatLevels: number;
  totalProfessionLevels: number;
  activity: HomeActivitySummary;
}

const metrics = [
  {
    key: 'totalLevel',
    label: 'TOTAL LEVEL',
    concept: 'total-level' as const,
  },
  {
    key: 'totalProfessionLevels',
    label: 'TOTAL PROFESSION LEVELS',
    concept: 'total-profession-levels' as const,
  },
  {
    key: 'totalCombatLevels',
    label: 'TOTAL COMBAT LEVELS',
    concept: 'total-combat-levels' as const,
  },
  {
    key: 'combatLevel',
    label: 'COMBAT LEVEL',
    concept: 'combat-level' as const,
  },
] as const;

export function CharacterOverview({
  game,
  onNavigate,
  totalLevel,
  totalCombatLevels,
  totalProfessionLevels,
  activity,
}: CharacterOverviewProps) {
  const stats = getDerivedStats(game);
  const values = {
    totalLevel,
    combatLevel: stats.combatLevel,
    totalCombatLevels,
    totalProfessionLevels,
  };
  const loadout = getHomeLoadout(game);

  return (
    <section className="panel home-overview" aria-labelledby="character-overview-title">
      <CurrentActivityStatus activity={activity} onNavigate={onNavigate} />
      <div className="home-panel-heading">
        <div>
          <div className="eyebrow">Character overview</div>
          <h2 id="character-overview-title">Your standing on the frontier</h2>
        </div>
        <button className="button ghost" onClick={() => onNavigate('equipment')}>
          View Gear <ArrowUpRight size={14} aria-hidden="true" />
        </button>
      </div>
      <div className="home-overview-metrics">
        {metrics.map((metric) => (
          <div className="home-overview-metric" key={metric.key}>
            <span className="home-metric-label">
              <ExplainedTerm
                concept={metric.concept}
                label={metric.label}
                showHelpIcon={game.settings.showHelpIcons}
              />
            </span>
            <strong>{values[metric.key]}</strong>
          </div>
        ))}
      </div>
      <div className="home-overview-lower">
        <div className="home-loadout" aria-labelledby="home-loadout-title">
          <div className="home-section-heading">
            <div>
              <div className="eyebrow">Current loadout</div>
              <h3 id="home-loadout-title">Equipped for the frontier</h3>
            </div>
          </div>
          <div className="home-loadout-grid">
            {loadout.map(({ slot, label, item }) => {
              const content = (
                <div className="home-loadout-entry" role="group" aria-label={`${label}: ${item?.name ?? 'Empty'}`}>
                  <ItemIcon itemId={item?.id} size="md" />
                  <span>
                    <small>{label}</small>
                    <strong>{item?.name ?? 'Empty'}</strong>
                  </span>
                </div>
              );
              return item ? (
                <ItemTooltip item={item} key={slot}>
                  {content}
                </ItemTooltip>
              ) : (
                <div key={slot}>{content}</div>
              );
            })}
          </div>
        </div>
        <div className="home-character-visual" aria-label="Character scene">
          <ThreeScene screen="home" settings={game.settings} theme="#b58b53" />
        </div>
      </div>
    </section>
  );
}

function CurrentActivityStatus({
  activity,
  onNavigate,
}: {
  activity: HomeActivitySummary;
  onNavigate: (screen: ScreenId) => void;
}) {
  const Icon = activity.type === 'combat' ? Swords : activity.type === 'mining' ? Pickaxe : Hammer;
  const destinationLabel = activity.type === 'combat' ? 'Combat' : activity.type === 'mining' ? 'Mining' : 'Smithing';

  return (
    <div className={`home-activity-status home-activity-status-${activity.type}`} role="status" aria-labelledby="current-activity-title">
      <div className="home-activity-status-icon" aria-hidden="true">
        {activity.type === 'idle' ? <span>·</span> : <Icon size={17} />}
      </div>
      <div className="home-activity-status-copy">
        <div className="eyebrow" id="current-activity-title">Current activity</div>
        <strong>{activity.title}</strong>
        {activity.subtitle && <span>{activity.subtitle}</span>}
        {activity.meta && <small>{activity.meta}</small>}
      </div>
      <div className="home-activity-status-end">
        {activity.destination ? (
          <button className="button ghost home-activity-action" onClick={() => onNavigate(activity.destination!)}>
            Return to {destinationLabel} <ArrowUpRight size={14} aria-hidden="true" />
          </button>
        ) : (
          <span className="home-activity-idle-label">No action running</span>
        )}
      </div>
    </div>
  );
}
