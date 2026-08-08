import { GAME_CONFIG } from '../../config/gameConfig';
import { createSmithingState } from '../formulas/smithingFormulas';
import type { GameState, SkillId } from '../types';

export const createNewGame = (slot: number, name: string, now = Date.now()): GameState => {
  const skills = Object.fromEntries(
    (['attack', 'strength', 'defence', 'hitpoints', 'mining', 'smithing'] as SkillId[]).map(
      (id) => [id, { xp: 0, level: 1 }],
    ),
  ) as GameState['skills'];
  return {
    schemaVersion: GAME_CONFIG.currentSaveVersion,
    profileId: crypto.randomUUID?.() ?? `profile-${now}-${slot}`,
    profileSlot: slot,
    createdAt: now,
    updatedAt: now,
    lastSimulatedAt: now,
    player: { name: name.trim() || 'Wanderer', currentHp: 20 },
    skills,
    inventory: [],
    equipment: { tool: 'worn-pickaxe' },
    discoveredItems: ['worn-pickaxe'],
    discoveredMonsters: [],
    killCounts: {},
    statistics: {
      mined: 0,
      miningSwings: 0,
      miningStagesDepleted: 0,
      miningRocksDepleted: 0,
      smelted: 0,
      forged: 0,
      deaths: 0,
      totalKills: 0,
    },
    gold: 0,
    mining: { stamina: 100, nodeStates: {} },
    smithing: createSmithingState(`profile:${slot}:${now}`),
    activeAction: { type: 'none' },
    unlockedAreas: ['forest-path'],
    settings: {
      sound: true,
      music: true,
      reducedMotion: false,
      compactNumbers: false,
      huntElites: true,
      threeQuality: 'high',
    },
    activityLogs: { milestones: [], combat: [] },
  };
};
