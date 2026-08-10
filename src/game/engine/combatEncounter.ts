import { COMBAT_TUNING } from '../../config/combatTuning';
import { enemyById } from '../../content/enemies';
import { getEnemyCombatStats } from '../formulas/combatStats';
import { createCombatRng, nextCombatRandom } from '../formulas/combatFormulas';
import { getDerivedStats } from '../formulas/statFormulas';
import { emptyCombatEffects } from '../formulas/combatEffects';
import { createEnemyTraitState } from '../systems/enemyTraitSystem';
import type {
  ActiveCombatState,
  ActiveCombatEffect,
  CombatStyle,
  EliteModifierId,
  EnemyId,
  GameState,
} from '../types';
import type { CombatRngState } from '../formulas/combatFormulas';

export const rollEliteModifier = (rng: CombatRngState): EliteModifierId | null => {
  if (nextCombatRandom(rng) >= COMBAT_TUNING.eliteSpawnChance) return null;
  const modifiers: EliteModifierId[] = [
    'savage',
    'armoured',
    'swift',
    'wealthy',
    'treasure-touched',
  ];
  return modifiers[Math.min(modifiers.length - 1, Math.floor(nextCombatRandom(rng) * modifiers.length))];
};

export const initializeEnemySpawn = (
  state: GameState,
  enemyId: EnemyId,
  style: CombatStyle,
  rng: CombatRngState,
  encounterIndex: number,
  eliteModifier: EliteModifierId | null | undefined = undefined,
  adrenaline = 0,
  encounterStartedAt = Date.now(),
  playerEffects: ActiveCombatEffect[] = [],
): { combatState: ActiveCombatState; eliteModifier: EliteModifierId | null } => {
  const enemy = enemyById[enemyId];
  const modifier = eliteModifier === undefined
    ? state.settings.huntElites !== false
      ? rollEliteModifier(rng)
      : null
    : eliteModifier;
  const traitState = createEnemyTraitState();
  const stats = getEnemyCombatStats(enemy, modifier, enemy.maxHealth, 1, [], playerEffects, traitState);
  return {
    eliteModifier: modifier,
    combatState: {
      enemyHp: stats.maxHealth,
      enemyMaxHp: stats.maxHealth,
      playerAttackMs: getDerivedStats(state, style, playerEffects).attackIntervalMs,
      enemyAttackMs: stats.attackIntervalMs,
      respawnMs: 0,
      rngSeed: rng.rngSeed,
      rngCursor: rng.rngCursor,
      adrenaline: Math.max(0, Math.min(COMBAT_TUNING.adrenalineMax, adrenaline)),
      enemySpecialCharge: 0,
      effects: { ...emptyCombatEffects(), player: structuredClone(playerEffects) },
      eliteModifier: modifier,
      eliteAnnounced: false,
      traitState,
      encounterIndex,
      encounterStartedAt,
    },
  };
};

export const createCombatRngForStart = (
  state: GameState,
  startedAt: number,
  enemyId: EnemyId,
): CombatRngState => createCombatRng(startedAt, state.profileId, enemyId);
