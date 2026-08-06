import type { GameState, SimulationSummary } from '../types';

export type DebugActionResult =
  | { ok: true; message: string; details?: string[] }
  | { ok: false; message: string; details?: string[] };

export interface DebugMutation {
  result: DebugActionResult;
  state?: GameState;
  summary?: SimulationSummary | null;
  save?: boolean;
}

export interface DebugRuntime {
  getGame: () => GameState | null;
  setGame: (state: GameState, summary?: SimulationSummary | null) => void;
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
