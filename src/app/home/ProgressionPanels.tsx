import { ArrowUpRight, Hammer, Swords } from 'lucide-react';
import type { ReactNode } from 'react';
import { getDerivedStats } from '../../game/formulas/statFormulas';
import type { GameState, ScreenId } from '../../game/types';
import { formatDamageRange } from '../combat/combatPresentation';
import { formatHealth, formatNumber } from '../formatters';
import { ExplainedTerm } from '../tooltips/GameConceptTooltip';
import type { GameConceptId } from '../tooltips/gameConcepts';
import {
  getCombatSkillProgress,
  getProfessionSkillProgress,
  getTotalCombatLevels,
  getTotalProfessionLevels,
  type SkillProgressSummary,
} from './homeSelectors';

const skillNames: Record<SkillProgressSummary['id'], string> = {
  attack: 'Attack',
  strength: 'Strength',
  defence: 'Defence',
  hitpoints: 'Hitpoints',
  mining: 'Mining',
  smithing: 'Smithing',
};

function SkillProgressRow({
  skill,
  activity,
  activityActive = false,
  action,
}: {
  skill: SkillProgressSummary;
  activity?: string;
  activityActive?: boolean;
  action?: { label: string; onClick: () => void };
}) {
  const name = skillNames[skill.id];
  const xpText = skill.isMax
    ? `MAX · ${formatNumber(skill.xp)} XP`
    : `${formatNumber(skill.current)} / ${formatNumber(skill.next)} XP to next level`;
  const percent = Math.round(Math.max(0, Math.min(100, skill.percent)));
  return (
    <div className="home-skill-row">
      <div className="home-skill-heading">
        <strong>{name}</strong>
        <span className="home-skill-level">Level <b>{skill.level}</b></span>
        {action && (
          <button className="button ghost home-skill-action" onClick={action.onClick} aria-label={`${action.label} ${name}`}>
            {action.label} <ArrowUpRight size={12} aria-hidden="true" />
          </button>
        )}
      </div>
      <div
        className="home-skill-progress"
        role="progressbar"
        aria-label={`${name} home level progress`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={skill.isMax ? `${name} max level` : `${percent}% to level ${skill.level + 1}`}
      >
        <i style={{ width: `${percent}%` }} />
      </div>
      <div className="home-skill-meta">
        <small>{xpText}</small>
        {activity && <span className={`home-skill-activity ${activityActive ? 'is-active' : ''}`}>{activity}</span>}
      </div>
    </div>
  );
}

function PanelHeading({
  eyebrow,
  title,
  id,
  summary,
  action,
  onNavigate,
  icon,
}: {
  eyebrow: string;
  title: string;
  id: string;
  summary: ReactNode;
  action?: string;
  onNavigate?: () => void;
  icon: ReactNode;
}) {
  return (
    <div className="home-panel-heading home-progression-heading">
      <div>
        <div className="home-progression-title-row">
          <span className="home-progression-icon" aria-hidden="true">{icon}</span>
          <div className="eyebrow">{eyebrow}</div>
        </div>
        <h2 id={id}>{title}</h2>
        <p className="subtle">{summary}</p>
      </div>
      {action && onNavigate && (
        <button className="button ghost" onClick={onNavigate}>
          {action} <ArrowUpRight size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

function DerivedSnapshot({ game }: { game: GameState }) {
  const stats = getDerivedStats(game);
  const rows: Array<{ label: string; value: string; concept: GameConceptId }> = [
    { label: 'Damage', value: formatDamageRange(stats.effectiveMaxHit), concept: 'damage-range' },
    { label: 'Accuracy', value: String(Math.round(stats.effectiveAccuracyRating)), concept: 'accuracy' },
    { label: 'Defence', value: String(Math.round(stats.effectiveDefenceRating)), concept: 'defence' },
    { label: 'Health', value: formatHealth(stats.maxHealth), concept: 'hitpoints' },
    { label: 'Attack Speed', value: `${(stats.attackIntervalMs / 1000).toFixed(1)}s`, concept: 'attack-speed' },
  ];
  return (
    <div className="home-derived-snapshot">
      <div className="eyebrow">Combat snapshot</div>
      <div className="home-derived-grid">
        {rows.map((row) => (
          <div className="home-derived-stat" key={row.label}>
            <span>
              <ExplainedTerm concept={row.concept} label={row.label} showHelpIcon={game.settings.showHelpIcons} />
            </span>
            <strong>{row.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CombatProgression({ game, onNavigate }: { game: GameState; onNavigate: (screen: ScreenId) => void }) {
  const stats = getDerivedStats(game);
  return (
    <section className="panel panel-pad home-progression-panel home-combat-progression" aria-labelledby="combat-progression-title">
      <PanelHeading
        eyebrow="Combat"
        title="Combat Progression"
        id="combat-progression-title"
        summary={
          <>
            <ExplainedTerm concept="combat-level" label={`Combat Level ${stats.combatLevel}`} showHelpIcon={game.settings.showHelpIcons} />{' '}
            &middot;{' '}
            <ExplainedTerm
              concept="total-combat-levels"
              label={`Total Combat Levels ${getTotalCombatLevels(game)}`}
              showHelpIcon={game.settings.showHelpIcons}
            />
          </>
        }
        action="Open Combat"
        onNavigate={() => onNavigate('combat')}
        icon={<Swords size={16} />}
      />
      <div className="home-skill-list">
        {getCombatSkillProgress(game).map((skill) => <SkillProgressRow skill={skill} key={skill.id} />)}
      </div>
      <DerivedSnapshot game={game} />
    </section>
  );
}

export function ProfessionProgression({ game, onNavigate }: { game: GameState; onNavigate: (screen: ScreenId) => void }) {
  const activeProfession =
    game.activeAction.type === 'mining'
      ? 'mining'
      : game.activeAction.type === 'smithing'
        ? 'smithing'
        : null;
  return (
    <section className="panel panel-pad home-progression-panel home-profession-progression" aria-labelledby="profession-progression-title">
      <PanelHeading
        eyebrow="Professions"
        title="Profession Progression"
        id="profession-progression-title"
        summary={
          <ExplainedTerm
            concept="total-profession-levels"
            label={`Total Profession Levels ${getTotalProfessionLevels(game)}`}
            showHelpIcon={game.settings.showHelpIcons}
          />
        }
        icon={<Hammer size={16} />}
      />
      <div className="home-skill-list">
        {getProfessionSkillProgress(game).map((skill) => (
          <SkillProgressRow
            skill={skill}
            activity={activeProfession === skill.id ? 'Active' : 'Idle'}
            activityActive={activeProfession === skill.id}
            action={{
              label: 'Open',
              onClick: () => onNavigate(skill.id === 'mining' ? 'mining' : 'smithing'),
            }}
            key={skill.id}
          />
        ))}
      </div>
    </section>
  );
}
