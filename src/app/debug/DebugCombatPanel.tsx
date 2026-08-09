import { useState } from 'react';
import { AREAS, areaById } from '../../content/areas';
import { ENEMIES, enemyById } from '../../content/enemies';
import { getDerivedStats } from '../../game/formulas/statFormulas';
import {
  debugAddKillCount,
  debugDamagePlayer,
  debugKillCurrentEnemy,
  debugKillPlayer,
  debugResetCombatUnlocks,
  debugResetCurrentEnemy,
  debugResetKillCount,
  debugSetHp,
  debugSetKillCount,
  debugStartCombat,
  debugStopAction,
  debugUnlockAllAreas,
  parseDebugInteger,
} from '../../game/debug/debugActions';
import type { AreaId } from '../../game/types';
import { formatHealth } from '../shared/formatters';
import { ActionButton, Field, Section } from './DebugComponents';
import type { PanelProps } from './debugUiTypes';

export function CombatPanel({ game, run, confirm }: PanelProps) {
  const [areaId, setAreaId] = useState<AreaId>(
    game.activeAction.type === 'combat' ? game.activeAction.areaId : AREAS[0].id,
  );
  const [enemyId, setEnemyId] = useState<string>(
    game.activeAction.type === 'combat' ? game.activeAction.enemyId : AREAS[0].enemyIds[0],
  );
  const [style, setStyle] = useState<'accurate' | 'aggressive' | 'defensive'>('accurate');
  const [killCount, setKillCount] = useState('10');
  const [damage, setDamage] = useState('10');
  const enemies = areaById[areaId]?.enemyIds.map((id) => enemyById[id]).filter(Boolean) ?? [];
  const active = game.activeAction.type === 'combat' ? game.activeAction : null;
  const enemy = active ? enemyById[active.enemyId] : enemyById[enemyId];
  return (
    <>
      <Section
        title="Combat state"
        description="Enemy options are derived from the current area and reward resolution remains in the normal simulator."
      >
        <div className="debug-tools-stat-grid">
          {[
            ['Active area', active?.areaId ?? 'None'],
            ['Active enemy', active?.enemyId ?? 'None'],
            [
              'Player HP',
              `${formatHealth(game.player.currentHp)}/${formatHealth(getDerivedStats(game, active?.style).maxHealth)}`,
            ],
            [
              'Enemy HP',
              active ? `${active.combatState.enemyHp}/${active.combatState.enemyMaxHp}` : '—',
            ],
            [
              'Combat state',
              active ? (active.combatState.respawnMs > 0 ? 'Respawning' : 'Fighting') : 'Stopped',
            ],
            ['Auto-repeat', active?.autoRepeat ? 'On' : 'Off'],
            ['Current kill count', enemy ? String(game.killCounts[enemy.id] ?? 0) : '0'],
          ].map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Player controls">
        <div className="button-row">
          <ActionButton
            onClick={() => run((state) => debugSetHp(state, getDerivedStats(state).maxHealth))}
          >
            Heal Player
          </ActionButton>
          <ActionButton onClick={() => run((state) => debugSetHp(state, 1))}>
            Set HP to 1
          </ActionButton>
          <Field label="Damage">
            <input
              type="number"
              min="1"
              value={damage}
              onChange={(event) => setDamage(event.target.value)}
            />
          </Field>
          <ActionButton
            onClick={() =>
              run((state) => debugDamagePlayer(state, parseDebugInteger(damage, 1) ?? 1))
            }
          >
            Damage Player
          </ActionButton>
          <ActionButton
            danger
            disabled={!active}
            onClick={() => run(debugKillPlayer)}
            title="Resolve player death through the normal Combat death pipeline."
          >
            Kill Player
          </ActionButton>
        </div>
      </Section>
      <Section title="Enemy controls">
        <div className="debug-tools-grid">
          <Field label="Area">
            <select
              value={areaId}
              onChange={(event) => {
                const next = event.target.value as AreaId;
                setAreaId(next);
                setEnemyId(areaById[next].enemyIds[0]);
              }}
              aria-label="Combat area"
            >
              {AREAS.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Enemy">
            <select
              value={enemyId}
              onChange={(event) => setEnemyId(event.target.value)}
              aria-label="Enemy"
            >
              {enemies.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name} · {candidate.id}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Style">
            <select
              value={style}
              onChange={(event) => setStyle(event.target.value as typeof style)}
            >
              <option value="accurate">Accurate</option>
              <option value="aggressive">Aggressive</option>
              <option value="defensive">Defensive</option>
            </select>
          </Field>
        </div>
        <div className="button-row">
          <ActionButton
            onClick={() => run((state) => debugStartCombat(state, areaId, enemyId, style, true))}
          >
            Start Combat
          </ActionButton>
          <ActionButton onClick={() => run(debugStopAction)}>Stop Combat</ActionButton>
          <ActionButton onClick={() => run(debugResetCurrentEnemy)}>
            Reset Current Enemy
          </ActionButton>
          <ActionButton
            disabled={!active}
            onClick={() => run(debugKillCurrentEnemy)}
            title="Kill current enemy through the normal reward pipeline"
          >
            Kill current monster
          </ActionButton>
        </div>
      </Section>
      <Section title="Combat progression">
        <div className="debug-tools-grid">
          <Field label="Enemy">
            <select value={enemyId} onChange={(event) => setEnemyId(event.target.value)}>
              <option value="">Select enemy</option>
              {ENEMIES.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Kill Count">
            <input
              type="number"
              min="0"
              value={killCount}
              onChange={(event) => setKillCount(event.target.value)}
            />
          </Field>
        </div>
        <div className="button-row">
          <ActionButton
            onClick={() =>
              run((state) =>
                debugSetKillCount(state, enemyId, parseDebugInteger(killCount, 0) ?? 0),
              )
            }
          >
            Set Kill Count
          </ActionButton>
          <ActionButton onClick={() => run((state) => debugAddKillCount(state, enemyId, 1))}>
            Add 1 Kill
          </ActionButton>
          <ActionButton onClick={() => run((state) => debugAddKillCount(state, enemyId, 10))}>
            Add 10 Kills
          </ActionButton>
          <ActionButton onClick={() => run((state) => debugResetKillCount(state, enemyId))}>
            Reset Kill Count
          </ActionButton>
          <ActionButton onClick={() => run(debugUnlockAllAreas)}>
            Unlock All Combat Areas
          </ActionButton>
          <ActionButton
            danger
            onClick={() =>
              confirm(
                {
                  title: 'Reset Combat unlocks?',
                  message:
                    'Area access returns to Training Grounds and combat kill-count inputs are cleared.',
                  confirmLabel: 'Reset unlocks',
                  danger: true,
                },
                () => run(debugResetCombatUnlocks),
              )
            }
          >
            Reset Combat Unlocks
          </ActionButton>
        </div>
      </Section>
    </>
  );
}
