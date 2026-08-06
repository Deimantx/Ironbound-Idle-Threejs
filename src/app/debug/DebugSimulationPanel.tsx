import { useState } from 'react';
import { GAME_CONFIG } from '../../config/gameConfig';
import {
  debugAdvanceElapsed,
  debugAdvanceOneCycle,
  debugOfflineSimulation,
  parseDebugInteger,
} from '../../game/debug/debugActions';
import type { GameState } from '../../game/types';
import { ActionButton, Field, Section } from './DebugComponents';
import type { PanelProps } from './debugUiTypes';

export function SimulationPanel({ game, run }: { game: GameState; run: PanelProps['run'] }) {
  const [hours, setHours] = useState('1');
  const [minutes, setMinutes] = useState('0');
  const active = game.activeAction.type !== 'none';
  const custom =
    (parseDebugInteger(hours, 0) ?? 0) * 3_600_000 + (parseDebugInteger(minutes, 0) ?? 0) * 60_000;
  return (
    <>
      <Section
        title="Advance Active Action"
        description={
          active
            ? 'Immediate deterministic simulation using the live elapsed-time engine.'
            : 'No active action exists; action advancement is disabled.'
        }
      >
        <div className="button-row">
          <ActionButton disabled={!active} onClick={() => run(debugAdvanceOneCycle)}>
            {game.activeAction.type === 'combat'
              ? 'Advance to Next Combat Event'
              : 'Complete Next Cycle'}
          </ActionButton>
          <ActionButton
            disabled={!active}
            onClick={() => run((state) => debugAdvanceElapsed(state, 60_000))}
          >
            1 Minute
          </ActionButton>
          <ActionButton
            disabled={!active}
            onClick={() => run((state) => debugAdvanceElapsed(state, 600_000))}
          >
            10 Minutes
          </ActionButton>
          <ActionButton
            disabled={!active}
            onClick={() => run((state) => debugAdvanceElapsed(state, 3_600_000))}
          >
            1 Hour
          </ActionButton>
        </div>
      </Section>
      <Section
        title="Simulate Offline"
        description="Uses the same capped offline replay path as profile loading, including exhaustion and full-inventory stops."
      >
        <div className="button-row">
          <ActionButton
            onClick={() => run((state) => debugOfflineSimulation(state, 8 * 3_600_000))}
          >
            8 Hours
          </ActionButton>
          <ActionButton
            onClick={() => run((state) => debugOfflineSimulation(state, 24 * 3_600_000))}
          >
            24 Hours
          </ActionButton>
        </div>
        <div className="debug-tools-grid">
          <Field label="Hours">
            <input
              type="number"
              min="0"
              value={hours}
              onChange={(event) => setHours(event.target.value)}
            />
          </Field>
          <Field label="Minutes">
            <input
              type="number"
              min="0"
              value={minutes}
              onChange={(event) => setMinutes(event.target.value)}
            />
          </Field>
          <ActionButton
            onClick={() =>
              run((state) =>
                debugOfflineSimulation(state, Math.min(GAME_CONFIG.offlineCapMs, custom)),
              )
            }
            disabled={custom <= 0}
          >
            Custom Duration
          </ActionButton>
        </div>
        <p className="debug-tools-inline-note">
          Custom duration is clamped to the current {GAME_CONFIG.offlineCapMs / 3_600_000}-hour
          offline cap.
        </p>
      </Section>
    </>
  );
}
