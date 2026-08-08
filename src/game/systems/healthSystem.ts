import { COMBAT_TUNING } from '../../config/combatTuning';
import { getDerivedStats } from '../formulas/statFormulas';
import type { CombatStyle, GameState } from '../types';

export const clampHealth = (currentHp: number, maxHealth: number): number =>
  Math.max(0, Math.min(Number.isFinite(currentHp) ? currentHp : 0, maxHealth));

export const getClampedPlayerHealth = (state: GameState): number =>
  clampHealth(state.player.currentHp, getDerivedStats(state).maxHealth);

export const applyOutOfCombatHealthRecovery = (state: GameState, elapsedMs: number): void => {
  if (state.activeAction.type === 'combat' || elapsedMs <= 0) return;
  const maxHealth = getDerivedStats(state).maxHealth;
  const recovered =
    maxHealth * COMBAT_TUNING.outOfCombatHealthRegenPercentPerSecond * (elapsedMs / 1000);
  state.player.currentHp = clampHealth(state.player.currentHp + recovered, maxHealth);
};

export const applyDeathRecovery = (state: GameState, style: CombatStyle): void => {
  const maxHealth = getDerivedStats(state, style).maxHealth;
  state.player.currentHp = Math.max(
    1,
    Math.min(maxHealth, Math.floor(maxHealth * COMBAT_TUNING.deathRecoveryHealthPercent)),
  );
};
