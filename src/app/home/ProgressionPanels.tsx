import { ArrowUpRight } from 'lucide-react';
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
}: {
  skill: SkillProgressSummary;
  activity?: string;
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
        <span>Level {skill.level}</span>
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
        {activity && <span className="home-skill-activity">{activity}</span>}
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
}: {
  eyebrow: string;
  title: string;
  id: string;
  summary: ReactNode;
  action: string;
  onNavigate: () => void;
}) {
  return (
    <div className="home-panel-heading home-progression-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h2 id={id}>{title}</h2>
        <p className="subtle">{summary}</p>
      </div>
      <button className="button ghost" onClick={onNavigate}>
        {action} <ArrowUpRight size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

function DerivedSnapshot({ game }: { game: GameState }) {
  const stats = getDerivedStats(game);
  const rows: Array<{ label: string; value: string; concept: GameConceptId }> = [
    { label: 'Damage', value: formatDamageRange(stats.effectiveMaxHit), concept: 'damage-range' },
    { label: 'Accuracy', value: String(Math.round(stats.effectiveAccuracyRating)), concept: 'accuracy' },
    { label: 'Defence', value: String(Math.round(stats.effectiveDefenceRating)), concept: 'defence' },
    { label: 'Max Health', value: formatHealth(stats.maxHealth), concept: 'hitpoints' },
    { label: 'Attack Speed', value: `${(stats.attackIntervalMs / 1000).toFixed(1)}s`, concept: 'attack-speed' },
  ];
  return (
    <div className="home-derived-snapshot">
      <div className="eyebrow">Derived combat snapshot</div>
      <div className="home-derived-grid">
        {rows.map((row) => (
          <div className="home-derived-stat" key={row.label}>
            <span>
              <ExplainedTerm
                concept={row.concept}
                label={row.label}
                showHelpIcon={game.settings.showHelpIcons}
              />
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
        eyebrow="Combat progression"
        title="Combat Progression"
        id="combat-progression-title"
        summary={
          <>
            <ExplainedTerm
              concept="combat-level"
              label={`Combat Level ${stats.combatLevel}`}
              showHelpIcon={game.settings.showHelpIcons}
            />{' '}
            · Total Combat Levels {getTotalCombatLevels(game)}
          </>
        }
        action="Open Combat"
        onNavigate={() => onNavigate('combat')}
      />
      <div className="home-skill-list">
        {getCombatSkillProgress(game).map((skill) => (
          <SkillProgressRow skill={skill} key={skill.id} />
        ))}
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
  const activity = activeProfession
    ? game.activeAction.type === 'mining'
      ? 'Active'
      : 'Active'
    : undefined;
  return (
    <section className="panel panel-pad home-progression-panel home-profession-progression" aria-labelledby="profession-progression-title">
      <PanelHeading
        eyebrow="Profession progression"
        title="Profession Progression"
        id="profession-progression-title"
        summary={<>Total Profession Levels {getTotalProfessionLevels(game)}</>}
        action="Open Professions"
        onNavigate={() => onNavigate(activeProfession ?? 'mining')}
      />
      <div className="home-skill-list">
        {getProfessionSkillProgress(game).map((skill) => (
          <SkillProgressRow
            skill={skill}
            activity={activeProfession === skill.id ? activity : 'Idle'}
            key={skill.id}
          />
        ))}
      </div>
    </section>
  );
}
