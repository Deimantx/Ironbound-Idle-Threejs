import { useState } from 'react';
import { getLevelProgress, MAX_LEVEL } from '../../game/formulas/experienceFormulas';
import {
  debugAddGold,
  debugAddSkillLevels,
  debugMaxAllSkills,
  debugResetAllSkills,
  debugResetSkill,
  debugSetGold,
  debugSetSkillLevel,
  debugSetSkillXp,
  parseDebugInteger,
} from '../../game/debug/debugActions';
import type { SkillId } from '../../game/types';
import { ActionButton, Field, Section, skillLabel } from './DebugComponents';
import type { PanelProps } from './debugUiTypes';

export function ProgressionPanel({ game, run, confirm }: PanelProps) {
  const [skill, setSkill] = useState<SkillId>('mining');
  const [level, setLevel] = useState(String(game.skills[skill].level));
  const [xp, setXp] = useState(String(game.skills[skill].xp));
  const [gold, setGold] = useState(String(game.gold));
  const progress = getLevelProgress(game.skills[skill]);
  return (
    <>
      <Section
        title="Skills"
        description="Set Level and Set XP use the authoritative XP thresholds and level cap."
      >
        <div className="debug-tools-grid">
          <Field label="Skill">
            <select
              value={skill}
              onChange={(event) => {
                const next = event.target.value as SkillId;
                setSkill(next);
                setLevel(String(game.skills[next].level));
                setXp(String(game.skills[next].xp));
              }}
              aria-label="Skill"
            >
              <option value="attack">Attack</option>
              <option value="strength">Strength</option>
              <option value="defence">Defence</option>
              <option value="hitpoints">Hitpoints</option>
              <option value="mining">Mining</option>
              <option value="smithing">Smithing</option>
            </select>
          </Field>
          <Field label="Target Level">
            <input
              type="number"
              min="1"
              max={MAX_LEVEL}
              value={level}
              onChange={(event) => setLevel(event.target.value)}
            />
          </Field>
          <Field label="Target XP">
            <input
              type="number"
              min="0"
              value={xp}
              onChange={(event) => setXp(event.target.value)}
            />
          </Field>
        </div>
        <p className="debug-tools-inline-note">
          Current {skillLabel(skill)}: level {game.skills[skill].level}, XP {game.skills[skill].xp},
          progress {Math.round(progress.percent)}%.
        </p>
        <div className="button-row">
          <ActionButton
            onClick={() =>
              run((state) =>
                debugSetSkillLevel(state, skill, parseDebugInteger(level, 1, MAX_LEVEL) ?? 1),
              )
            }
          >
            Set Level
          </ActionButton>
          <ActionButton
            onClick={() =>
              run((state) => debugSetSkillXp(state, skill, parseDebugInteger(xp, 0) ?? 0))
            }
          >
            Set XP
          </ActionButton>
          <ActionButton onClick={() => run((state) => debugAddSkillLevels(state, skill, 1))}>
            Add 1 Level
          </ActionButton>
          <ActionButton onClick={() => run((state) => debugAddSkillLevels(state, skill, 10))}>
            Add 10 Levels
          </ActionButton>
          <ActionButton onClick={() => run((state) => debugSetSkillLevel(state, skill, MAX_LEVEL))}>
            Set Maximum
          </ActionButton>
          <ActionButton danger onClick={() => run((state) => debugResetSkill(state, skill))}>
            Reset Skill
          </ActionButton>
        </div>
      </Section>
      <Section title="Gold">
        <Field label="Amount">
          <input
            type="number"
            min="0"
            value={gold}
            onChange={(event) => setGold(event.target.value)}
          />
        </Field>
        <div className="button-row">
          <ActionButton
            onClick={() => run((state) => debugAddGold(state, parseDebugInteger(gold, 1) ?? 0))}
          >
            Add Gold
          </ActionButton>
          <ActionButton
            onClick={() => run((state) => debugSetGold(state, parseDebugInteger(gold, 0) ?? 0))}
          >
            Set Gold
          </ActionButton>
          <ActionButton onClick={() => run((state) => debugSetGold(state, 0))}>
            Set Zero
          </ActionButton>
        </div>
      </Section>
      <Section title="Global progression">
        <div className="button-row">
          <ActionButton
            danger
            onClick={() =>
              confirm(
                {
                  title: 'Max all skills?',
                  message: 'All current skills will be set to the current maximum XP threshold.',
                  confirmLabel: 'Max all skills',
                  danger: true,
                },
                () => run(debugMaxAllSkills),
              )
            }
          >
            Max All Skills
          </ActionButton>
          <ActionButton
            danger
            onClick={() =>
              confirm(
                {
                  title: 'Reset all skills?',
                  message: 'All current skills will return to level 1 and 0 XP.',
                  confirmLabel: 'Reset all skills',
                  danger: true,
                },
                () => run(debugResetAllSkills),
              )
            }
          >
            Reset All Skills
          </ActionButton>
        </div>
      </Section>
    </>
  );
}
