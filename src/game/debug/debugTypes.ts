import type { CombatVisualEvent, GameState, SimulationSummary } from '../types';

export type DebugActionResult =
  | { ok: true; message: string; details?: string[] }
  | { ok: false; message: string; details?: string[] };

export interface DebugMutation {
  result: DebugActionResult;
  state?: GameState;
  summary?: SimulationSummary | null;
  events?: CombatVisualEvent[];
  save?: boolean;
  replaceCombatSession?: boolean;
}

export interface DebugRuntime {
  getGame: () => GameState | null;
  applyMutation: (
    state: GameState,
    options?: {
      summary?: SimulationSummary | null;
      events?: CombatVisualEvent[];
      replaceCombatSession?: boolean;
    },
  ) => void;
  saveNow: () => Promise<boolean>;
}

export type DebugPresetId =
  | 'fresh'
  | 'inventory'
  | 'equipment'
  | 'mining'
  | 'smithing'
  | 'combat'
  | 'full-inventory'
  | 'late-game';
