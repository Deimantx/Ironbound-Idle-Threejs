import { useState } from 'react';
import { GAME_CONFIG } from '../../config/gameConfig';
import { getDerivedStats } from '../../game/formulas/statFormulas';
import { SKILL_IDS, type SkillId } from '../../game/types';
import {
  debugAddGold,
  debugAddLevelsToSkills,
  debugKillCurrentEnemy,
  debugKillPlayer,
  debugResetSkills,
  debugApplyPreset,
  parseDebugInteger,
} from '../../game/debug/debugActions';
import { DEBUG_PRESETS } from '../../game/debug/debugPresets';
import { ActionButton, Field, Section, activeActionLabel, skillLabel } from './DebugComponents';
import type { PanelProps } from './debugUiTypes';

export function OverviewPanel({ game, run, confirm }: PanelProps) {
  const [skillTarget, setSkillTarget] = useState<SkillId | 'all'>('all');
  const [levelAmount, setLevelAmount] = useState('1');
  const [goldAmount, setGoldAmount] = useState('1000');
  const targets = skillTarget === 'all' ? SKILL_IDS : [skillTarget];
  return (
    <>
      <Section
        title="Overview"
        description="A live readout of the current profile and safe quick actions."
      >
        <div className="debug-tools-stat-grid">
          {[
            ['Gold', String(game.gold)],
            ['HP / Maximum HP', `${game.player.currentHp}/${getDerivedStats(game).maxHealth}`],
            ['Inventory', `${game.inventory.length}/${GAME_CONFIG.inventorySlots}`],
            ['Equipped items', String(Object.keys(game.equipment).length)],
            ['Active action', activeActionLabel(game)],
            [
              'Combat area/enemy',
              game.activeAction.type === 'combat'
                ? `${game.activeAction.areaId} / ${game.activeAction.enemyId}`
                : 'None',
            ],
            ['Attack level', String(game.skills.attack.level)],
            ['Strength level', String(game.skills.strength.level)],
            ['Defence level', String(game.skills.defence.level)],
            ['Hitpoints level', String(game.skills.hitpoints.level)],
            ['Mining level', String(game.skills.mining.level)],
            ['Smithing level', String(game.skills.smithing.level)],
          ].map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </Section>
      <Section
        title="Quick progression"
        description="These compatibility controls keep the original development entry point useful for fast smoke checks."
      >
        <div className="debug-tools-grid">
          <Field label="Skill target">
            <select
              aria-label="Skill target"
              value={skillTarget}
              onChange={(event) => setSkillTarget(event.target.value as SkillId | 'all')}
            >
              <option value="all">All skills</option>
              {SKILL_IDS.map((skill) => (
                <option key={skill} value={skill}>
                  {skillLabel(skill)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Level amount">
            <input
              aria-label="Level amount"
              type="number"
              min="1"
              value={levelAmount}
              onChange={(event) => setLevelAmount(event.target.value)}
            />
          </Field>
          <Field label="Gold amount">
            <input
              aria-label="Gold amount"
              type="number"
              min="0"
              value={goldAmount}
              onChange={(event) => setGoldAmount(event.target.value)}
            />
          </Field>
        </div>
        <div className="button-row">
          <ActionButton
            danger
            onClick={() =>
              confirm(
                {
                  title: 'Reset selected skills?',
                  message: 'Selected skills will return to level 1 and 0 XP.',
                  confirmLabel: 'Reset skills',
                  danger: true,
                },
                () => run((state) => debugResetSkills(state, targets)),
              )
            }
          >
            Reset level(s)
          </ActionButton>
          <ActionButton
            onClick={() =>
              run((state) =>
                debugAddLevelsToSkills(state, targets, parseDebugInteger(levelAmount, 1) ?? 1),
              )
            }
          >
            Grant level(s)
          </ActionButton>
          <ActionButton
            onClick={() =>
              run((state) => debugAddGold(state, parseDebugInteger(goldAmount, 1) ?? 0))
            }
          >
            Give gold
          </ActionButton>
        </div>
      </Section>
      <Section
        title="Presets"
        description="Presets use current registries and may replace gameplay state. Broad presets require confirmation."
      >
        <div className="debug-tools-preset-grid">
          {DEBUG_PRESETS.map((preset) => (
            <div className="debug-tools-preset" key={preset.id}>
              <strong>{preset.label}</strong>
              <p>{preset.description}</p>
              <ActionButton
                danger
                onClick={() =>
                  confirm(
                    {
                      title: `Apply ${preset.label}?`,
                      message: `${preset.description} Current gameplay state may be replaced.`,
                      confirmLabel: 'Apply preset',
                      danger: true,
                    },
                    () => run((state) => debugApplyPreset(state, preset.id)),
                  )
                }
              >
                Apply
              </ActionButton>
            </div>
          ))}
        </div>
      </Section>
      <Section
        title="Combat quick actions"
        description="The normal combat loop handles kills and deaths after these controls prepare the state."
      >
        <div className="button-row">
          <ActionButton
            disabled={game.activeAction.type !== 'combat'}
            onClick={() => run(debugKillCurrentEnemy)}
            title="Kill current enemy through normal reward resolution"
          >
            Kill current monster
          </ActionButton>
          <ActionButton
            danger
            disabled={game.activeAction.type !== 'combat'}
            onClick={() => run(debugKillPlayer)}
            title="Resolve player death through the normal Combat death pipeline."
          >
            Kill Player
          </ActionButton>
        </div>
      </Section>
    </>
  );
}
