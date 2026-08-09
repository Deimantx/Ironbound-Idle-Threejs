import {
  Dumbbell,
  Hammer,
  Heart,
  Pickaxe,
  Shield,
  Swords,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { SkillId, GameState, ScreenId } from '../../game/types';
import { formatNumber } from '../formatters';
import type { SkillProgressSummary } from './homeSelectors';
import {
  getCombatSkillProgress,
  getHomeRecentProgress,
  getProfessionSkillProgress,
} from './homeSelectors';

const skillNames: Record<SkillId, string> = {
  attack: 'Attack',
  strength: 'Strength',
  defence: 'Defence',
  hitpoints: 'Hitpoints',
  mining: 'Mining',
  smithing: 'Smithing',
};

const skillIcons: Record<SkillId, LucideIcon> = {
  attack: Swords,
  strength: Dumbbell,
  defence: Shield,
  hitpoints: Heart,
  mining: Pickaxe,
  smithing: Hammer,
};

interface ProgressionBoardGroup {
  id: string;
  label: string;
  skillIds: readonly SkillId[];
}

// Groups are intentionally data-driven: future three-skill combat groups can be added here
// without changing the board or tile components. Only currently implemented SkillIds render.
const combatBoardGroups: readonly ProgressionBoardGroup[] = [
  { id: 'hitpoints', label: 'Hitpoints', skillIds: ['hitpoints'] },
  { id: 'melee', label: 'Melee', skillIds: ['attack', 'strength', 'defence'] },
];

const professionBoardGroups: readonly ProgressionBoardGroup[] = [
  { id: 'professions', label: 'Professions', skillIds: ['mining', 'smithing'] },
];

const getSkillMap = (skills: SkillProgressSummary[]): Map<SkillId, SkillProgressSummary> =>
  new Map(skills.map((skill) => [skill.id, skill]));

function SkillProgressTile({
  skill,
  destination,
  onNavigate,
}: {
  skill: SkillProgressSummary;
  destination: Extract<ScreenId, 'combat' | 'mining' | 'smithing'>;
  onNavigate: (screen: ScreenId) => void;
}) {
  const name = skillNames[skill.id];
  const Icon = skillIcons[skill.id];
  const percent = Math.round(Math.max(0, Math.min(100, skill.percent)));
  const progressLabel = skill.isMax
    ? `${name}, level ${skill.level}, max level`
    : `${name}, level ${skill.level}, ${percent} percent to next level`;

  return (
    <button
      className="home-skill-tile"
      type="button"
      onClick={() => onNavigate(destination)}
      aria-label={progressLabel}
    >
      <span className="home-skill-tile-icon" aria-hidden="true"><Icon size={28} strokeWidth={1.8} /></span>
      <span className="home-skill-tile-copy">
        <span className="home-skill-tile-heading">
          <strong>{name}</strong>
          <span className="home-skill-tile-level">Lv <b>{skill.level}</b></span>
        </span>
        <span className="home-skill-tile-progress-row">
          <span
            className="home-skill-tile-progress"
            role="progressbar"
            aria-label={`${name} progress`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-valuetext={skill.isMax ? `${name} max level, ${formatNumber(skill.xp)} XP` : `${name}: ${formatNumber(skill.current)} of ${formatNumber(skill.next)} XP to next level`}
          >
            <i style={{ width: `${percent}%` }} />
          </span>
          <small className="home-skill-tile-max">{skill.isMax ? 'MAX' : null}</small>
        </span>
      </span>
    </button>
  );
}

function ProgressionBoard({
  groups,
  skills,
  onNavigate,
  destination,
  destinationBySkill,
}: {
  groups: readonly ProgressionBoardGroup[];
  skills: SkillProgressSummary[];
  onNavigate: (screen: ScreenId) => void;
  destination: Extract<ScreenId, 'combat' | 'mining' | 'smithing'>;
  destinationBySkill?: Partial<Record<SkillId, Extract<ScreenId, 'combat' | 'mining' | 'smithing'>>>;
}) {
  const skillMap = getSkillMap(skills);
  return (
    <div className="home-progression-board">
      {groups.map((group) => (
        <div className={`home-progression-group home-progression-group-${group.id}`} key={group.id}>
          <h3>{group.label}</h3>
          <div className="home-skill-tile-grid">
            {group.skillIds.map((skillId) => {
              const skill = skillMap.get(skillId);
              if (!skill) return null;
              return (
                <SkillProgressTile
                  key={skill.id}
                  skill={skill}
                  destination={destinationBySkill?.[skill.id] ?? destination}
                  onNavigate={onNavigate}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function RecentProgressRows({
  title,
  entries,
  empty,
}: {
  title: string;
  entries: GameState['activityLogs']['milestones'];
  empty: string;
}) {
  return (
    <div className="home-recent-inline">
      <h3>{title}</h3>
      <div className="home-milestone-list">
        {entries.map((entry) => {
          const Icon = skillIcons[entry.skillId];
          return (
            <div className="home-milestone-row" key={entry.id}>
              <span className="home-milestone-icon" aria-hidden="true"><Icon size={14} /></span>
              <strong>{skillNames[entry.skillId]} reached Level {entry.level}</strong>
              <time dateTime={new Date(entry.at).toISOString()}>
                {new Date(entry.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </time>
            </div>
          );
        })}
        {entries.length === 0 && <span className="muted home-milestone-empty">{empty}</span>}
      </div>
    </div>
  );
}

function PanelHeading({
  eyebrow,
  title,
  id,
  icon,
}: {
  eyebrow: string;
  title: string;
  id: string;
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
      </div>
    </div>
  );
}

export function CombatProgression({ game, onNavigate }: { game: GameState; onNavigate: (screen: ScreenId) => void }) {
  const recent = getHomeRecentProgress(game);
  return (
    <section className="panel panel-pad home-progression-panel home-combat-progression" aria-labelledby="combat-progression-title">
      <PanelHeading
        eyebrow="Combat"
        title="Combat Progression"
        id="combat-progression-title"
        icon={<Swords size={16} />}
      />
      <ProgressionBoard
        groups={combatBoardGroups}
        skills={getCombatSkillProgress(game)}
        destination="combat"
        onNavigate={onNavigate}
      />
      <RecentProgressRows title="Recent Combat" entries={recent.combat} empty="No recent combat level-ups." />
    </section>
  );
}

export function ProfessionProgression({ game, onNavigate }: { game: GameState; onNavigate: (screen: ScreenId) => void }) {
  const recent = getHomeRecentProgress(game);
  return (
    <section className="panel panel-pad home-progression-panel home-profession-progression" aria-labelledby="profession-progression-title">
      <PanelHeading
        eyebrow="Professions"
        title="Profession Progression"
        id="profession-progression-title"
        icon={<Hammer size={16} />}
      />
      <ProgressionBoard
        groups={professionBoardGroups}
        skills={getProfessionSkillProgress(game)}
        destination="mining"
        destinationBySkill={{ mining: 'mining', smithing: 'smithing' }}
        onNavigate={onNavigate}
      />
      <RecentProgressRows title="Recent Profession" entries={recent.profession} empty="No recent profession level-ups." />
    </section>
  );
}

export { combatBoardGroups, professionBoardGroups };
