export const GAME_CONFIG = {
  title: 'Ironbound Idle',
  version: '0.1.0',
  currentSaveVersion: 15,
  inventorySlots: 60,
  offlineCapMs: 24 * 60 * 60 * 1000,
  heartbeatMs: 200,
  autosaveMs: 10_000,
  respawnMs: 3_000,
} as const;

export type GameConfig = typeof GAME_CONFIG;
