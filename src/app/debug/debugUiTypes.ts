import type { ConfirmDialogOptions } from '../ConfirmDialog';
import type { DebugActionResult, DebugMutation } from '../../game/debug/debugTypes';
import type { GameState, ScreenId } from '../../game/types';

export type DebugTab =
  | 'overview'
  | 'inventory'
  | 'equipment'
  | 'progression'
  | 'combat'
  | 'professions'
  | 'simulation'
  | 'saves';

export const TAB_LABELS: Array<{ id: DebugTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'equipment', label: 'Equipment' },
  { id: 'progression', label: 'Progression' },
  { id: 'combat', label: 'Combat' },
  { id: 'professions', label: 'Professions' },
  { id: 'simulation', label: 'Simulation' },
  { id: 'saves', label: 'Saves & UI' },
];

export type PanelProps = {
  game: GameState;
  run: (operation: (state: GameState) => DebugMutation) => DebugActionResult;
  confirm: (
    options: Omit<ConfirmDialogOptions, 'onConfirm'>,
    action: () => DebugActionResult,
  ) => void;
};

export type DebugController = {
  execute: (operation: (state: GameState) => DebugMutation) => DebugActionResult;
  save: () => Promise<boolean>;
};

export type DebugSavesPanelProps = PanelProps & {
  controller: DebugController;
  screen: ScreenId;
  resetDebugUi: () => void;
  onResetAllLayouts?: () => void;
  onResetCurrentScreenLayout?: (screen: ScreenId) => void;
};
