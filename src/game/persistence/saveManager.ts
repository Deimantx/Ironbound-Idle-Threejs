import { GAME_CONFIG } from '../../config/gameConfig';
import { simulateElapsed } from '../engine/simulation';
import type { GameState, SimulationSummary } from '../types';
import { database } from './database';
import { parseGameState, savePayloadSchema, saveRecordSchema } from './saveSchema';

export interface SaveRecord {
  schemaVersion: number;
  profileId: string;
  slot: number;
  payload: string;
  updatedAt: number;
  checksum: string;
}
export interface LoadedProfile {
  state: GameState;
  offline: SimulationSummary | null;
  recovered: boolean;
}
const key = (slot: number): string => `ironbound-save-slot-${slot}`;
const backupKey = (slot: number): string => `ironbound-save-slot-${slot}-backup`;
const checksum = async (payload: string): Promise<string> => {
  if (globalThis.crypto?.subtle) {
    const bytes = new TextEncoder().encode(payload);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  let hash = 2166136261;
  for (const char of payload) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `fallback-${(hash >>> 0).toString(16)}`;
};
const validRecord = async (candidate: unknown): Promise<SaveRecord> => {
  const record = saveRecordSchema.parse(candidate);
  const actual = await checksum(record.payload);
  if (actual !== record.checksum) throw new Error('Save checksum failed.');
  parseGameState(record.payload);
  return record;
};
const readRaw = (slot: number, backup = false): unknown => {
  const raw = localStorage.getItem(backup ? backupKey(slot) : key(slot));
  return raw ? (JSON.parse(raw) as unknown) : null;
};

export const saveProfile = async (state: GameState): Promise<SaveRecord> => {
  const payload = JSON.stringify({ ...state, updatedAt: Date.now() });
  const record: SaveRecord = {
    schemaVersion: GAME_CONFIG.currentSaveVersion,
    profileId: state.profileId,
    slot: state.profileSlot,
    payload,
    updatedAt: Date.now(),
    checksum: await checksum(payload),
  };
  const previous = localStorage.getItem(key(state.profileSlot));
  if (previous) localStorage.setItem(backupKey(state.profileSlot), previous);
  localStorage.setItem(key(state.profileSlot), JSON.stringify(record));
  try {
    await database.saves.put(record);
  } catch (error) {
    console.warn('IndexedDB save unavailable; local save retained.', error);
  }
  return record;
};

export const loadProfile = async (slot: number): Promise<LoadedProfile | null> => {
  let record: SaveRecord | null = null;
  let recovered = false;
  try {
    const raw = readRaw(slot);
    if (!raw) return null;
    record = await validRecord(raw);
  } catch (error) {
    console.warn('Primary save could not be loaded.', error);
    try {
      record = await validRecord(readRaw(slot, true));
      recovered = true;
    } catch {
      return null;
    }
  }
  if (!record) return null;
  const state = parseGameState(record.payload);
  const now = Date.now();
  const elapsed = Math.max(0, now - state.lastSimulatedAt);
  const capped = Math.min(elapsed, GAME_CONFIG.offlineCapMs);
  const simulation =
    capped > 1000 && state.activeAction.type !== 'none'
      ? simulateElapsed(state, capped)
      : { state, summary: null };
  simulation.state.lastSimulatedAt = simulation.summary
    ? state.lastSimulatedAt + simulation.summary.processedElapsedMs
    : now;
  simulation.state.updatedAt = now;
  return { state: simulation.state, offline: simulation.summary, recovered };
};

export const listProfiles = async (): Promise<Array<SaveRecord | null>> =>
  Promise.all(
    [0, 1, 2].map(async (slot) => {
      try {
        const raw = readRaw(slot);
        return raw ? await validRecord(raw) : null;
      } catch {
        return null;
      }
    }),
  );
export const exportProfile = async (state: GameState): Promise<string> =>
  JSON.stringify(
    {
      gameVersion: GAME_CONFIG.version,
      schemaVersion: GAME_CONFIG.currentSaveVersion,
      exportedAt: Date.now(),
      profile: await saveProfile(state),
    },
    null,
    2,
  );
export const importProfile = async (text: string, targetSlot: number): Promise<GameState> => {
  const raw: unknown = JSON.parse(text);
  if (typeof raw !== 'object' || raw === null || !('profile' in raw))
    throw new Error('This file is not an Ironbound save export.');
  const profile = (raw as { profile: unknown }).profile;
  const record = await validRecord(profile);
  const state = parseGameState(record.payload);
  const imported = { ...state, profileSlot: targetSlot, updatedAt: Date.now() };
  await saveProfile(imported);
  return imported;
};
export const clearProfile = async (slot: number): Promise<void> => {
  localStorage.removeItem(key(slot));
  localStorage.removeItem(backupKey(slot));
  try {
    await database.saves.delete(slot);
  } catch {
    /* local storage is authoritative fallback */
  }
};
export const isValidPayload = (text: string): boolean =>
  savePayloadSchema.safeParse(JSON.parse(text)).success;
