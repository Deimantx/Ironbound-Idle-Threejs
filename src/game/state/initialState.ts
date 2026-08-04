import { GAME_CONFIG } from '../../config/gameConfig';
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
    equipment: {},
    discoveredItems: [],
    discoveredMonsters: [],
    killCounts: {},
    statistics: { mined: 0, smelted: 0, forged: 0, deaths: 0, totalKills: 0 },
    gold: 0,
    activeAction: { type: 'none' },
    unlockedAreas: ['training-grounds'],
    settings: {
      sound: true,
      music: true,
      reducedMotion: false,
      compactNumbers: false,
      huntElites: true,
      threeQuality: 'high',
    },
    log: [{ id: `welcome-${now}`, at: now, text: 'The road is yours to forge.', tone: 'neutral' }],
  };
};
