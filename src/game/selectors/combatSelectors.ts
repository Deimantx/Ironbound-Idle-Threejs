import { COMBAT_TUNING } from '../../config/combatTuning';
import { GAME_CONFIG } from '../../config/gameConfig';
import { areaById, AREAS } from '../../content/areas';
import { enemyById } from '../../content/enemies';
import { getEnemyCombatStats } from '../formulas/combatStats';
import {
  getAverageDamageAfterFlatReduction,
  getCombatStyleModifiers,
  getHitChance,
} from '../formulas/combatFormulas';
import { getDerivedStats } from '../formulas/statFormulas';
import type { AreaId, CombatStyle, EliteModifierId, EnemyDefinition, EnemyId, GameState } from '../types';

export type AttackProgressState = 'idle' | 'active' | 'ready' | 'defeated' | 'respawning';
export type HealthState = 'healthy' | 'wounded' | 'critical' | 'near-death' | 'defeated';
export interface AttackProgress {
  ratio: number;
  timeUntilAttackMs: number;
  intervalMs: number;
  state: AttackProgressState;
}

export const getHealthPercent = (current: number, max: number): number =>
  Math.round((Math.max(0, Math.min(current, max)) / Math.max(1, max)) * 100);

export const getHealthState = (current: number, max: number): HealthState => {
  const percent = getHealthPercent(current, max);
  if (percent <= 0) return 'defeated';
  if (percent < 15) return 'near-death';
  if (percent < 35) return 'critical';
  if (percent <= 60) return 'wounded';
  return 'healthy';
};

export const selectSelectedCombatArea = (
  state: GameState,
  fallback: AreaId = 'forest-path',
): (typeof AREAS)[number] =>
  areaById[state.activeAction.type === 'combat' ? state.activeAction.areaId : fallback] ??
  areaById[fallback];

export const selectSelectedEnemy = (
  state: GameState,
  fallback: EnemyId = 'forest-rat',
): EnemyDefinition =>
  enemyById[state.activeAction.type === 'combat' ? state.activeAction.enemyId : fallback] ??
  enemyById[fallback];

const getActiveStyle = (state: GameState, style?: CombatStyle): CombatStyle =>
  style ?? (state.activeAction.type === 'combat' ? state.activeAction.style : 'accurate');

const getActiveElite = (state: GameState, enemy: EnemyDefinition): EliteModifierId | null =>
  state.activeAction.type === 'combat' && state.activeAction.enemyId === enemy.id
    ? state.activeAction.combatState.eliteModifier
    : null;

const selectEnemyStats = (state: GameState, enemy: EnemyDefinition) =>
  getEnemyCombatStats(
    enemy,
    getActiveElite(state, enemy),
    state.activeAction.type === 'combat' && state.activeAction.enemyId === enemy.id
      ? state.activeAction.combatState.enemyHp
      : getEnemyCombatStats(enemy, getActiveElite(state, enemy)).maxHealth,
  );

const interpolatedRemaining = (remainingMs: number, updatedAt: number, now: number): number =>
  Math.max(0, remainingMs - Math.min(250, Math.max(0, now - updatedAt)));

export const selectPlayerAttackProgress = (state: GameState, now = Date.now()): AttackProgress => {
  const style = getActiveStyle(state);
  const stats = getDerivedStats(state, style);
  if (state.activeAction.type !== 'combat')
    return {
      ratio: 0,
      timeUntilAttackMs: stats.attackIntervalMs,
      intervalMs: stats.attackIntervalMs,
      state: 'idle',
    };
  if (state.activeAction.combatState.respawnMs > 0)
    return {
      ratio: 0,
      timeUntilAttackMs: stats.attackIntervalMs,
      intervalMs: stats.attackIntervalMs,
      state: 'respawning',
    };
  if (state.player.currentHp <= 0)
    return {
      ratio: 0,
      timeUntilAttackMs: stats.attackIntervalMs,
      intervalMs: stats.attackIntervalMs,
      state: 'defeated',
    };
  const timeUntilAttackMs = interpolatedRemaining(
    state.activeAction.combatState.playerAttackMs,
    state.updatedAt,
    now,
  );
  const ratio = Math.max(0, Math.min(1, 1 - timeUntilAttackMs / stats.attackIntervalMs));
  return {
    ratio,
    timeUntilAttackMs,
    intervalMs: stats.attackIntervalMs,
    state: ratio >= 0.85 ? 'ready' : 'active',
  };
};

export const selectEnemyAttackProgress = (state: GameState, now = Date.now()): AttackProgress => {
  const enemy = selectSelectedEnemy(state);
  const stats = selectEnemyStats(state, enemy);
  if (state.activeAction.type !== 'combat')
    return {
      ratio: 0,
      timeUntilAttackMs: stats.attackIntervalMs,
      intervalMs: stats.attackIntervalMs,
      state: 'idle',
    };
  if (state.activeAction.combatState.respawnMs > 0)
    return {
      ratio: 0,
      timeUntilAttackMs: stats.attackIntervalMs,
      intervalMs: stats.attackIntervalMs,
      state: 'respawning',
    };
  if (state.activeAction.combatState.enemyHp <= 0 || state.player.currentHp <= 0)
    return {
      ratio: 0,
      timeUntilAttackMs: stats.attackIntervalMs,
      intervalMs: stats.attackIntervalMs,
      state: 'defeated',
    };
  const timeUntilAttackMs = interpolatedRemaining(
    state.activeAction.combatState.enemyAttackMs,
    state.updatedAt,
    now,
  );
  const progressInterval = state.activeAction.combatState.traitState.firstAttackPending
    ? Math.max(
        COMBAT_TUNING.minimumAttackIntervalMs,
        stats.attackIntervalMs * COMBAT_TUNING.ratFirstAttackMultiplier,
      )
    : stats.attackIntervalMs;
  const ratio = Math.max(0, Math.min(1, 1 - timeUntilAttackMs / progressInterval));
  return {
    ratio,
    timeUntilAttackMs,
    intervalMs: progressInterval,
    state: ratio >= 0.85 ? 'ready' : 'active',
  };
};

export const selectPlayerHitChance = (
  state: GameState,
  enemy = selectSelectedEnemy(state),
  style = getActiveStyle(state),
): number => getHitChance(getDerivedStats(state, style).effectiveAccuracyRating, selectEnemyStats(state, enemy).defenceRating);

export const selectEnemyHitChance = (
  state: GameState,
  enemy = selectSelectedEnemy(state),
  style = getActiveStyle(state),
): number => getHitChance(selectEnemyStats(state, enemy).accuracyRating, getDerivedStats(state, style).effectiveDefenceRating);

export const selectPlayerAverageDamage = (
  state: GameState,
  enemy = selectSelectedEnemy(state),
  style = getActiveStyle(state),
): number => {
  const stats = selectEnemyStats(state, enemy);
  return getAverageDamageAfterFlatReduction(
    getDerivedStats(state, style).effectiveMaxHit,
    stats.flatDamageReduction,
  );
};

export const selectEnemyAverageDamage = (
  state: GameState,
  enemy = selectSelectedEnemy(state),
): number => {
  const stats = selectEnemyStats(state, enemy);
  let average = getAverageDamageAfterFlatReduction(stats.maxHit, 0);
  if (enemy.trait.id === 'heavy-strike') average *= 0.75 + 0.25 * COMBAT_TUNING.banditHeavyMaxHitMultiplier;
  if (enemy.trait.id === 'bleeding-bites') average += COMBAT_TUNING.wolfBleedChance;
  return average;
};

export const selectPlayerEstimatedDps = (
  state: GameState,
  enemy = selectSelectedEnemy(state),
  style = getActiveStyle(state),
): number => {
  const attackInterval = getDerivedStats(state, style).attackIntervalMs;
  return (selectPlayerHitChance(state, enemy, style) * selectPlayerAverageDamage(state, enemy, style)) /
    Math.max(0.001, attackInterval / 1000);
};

export const selectEnemyEstimatedDps = (
  state: GameState,
  enemy = selectSelectedEnemy(state),
  style = getActiveStyle(state),
): number => selectEnemyHitChance(state, enemy, style) * selectEnemyAverageDamage(state, enemy) /
  Math.max(0.001, selectEnemyStats(state, enemy).attackIntervalMs / 1000);

export const selectEstimatedKillTimeMs = (
  state: GameState,
  enemy = selectSelectedEnemy(state),
  style = getActiveStyle(state),
): number => selectEnemyStats(state, enemy).maxHealth / Math.max(0.001, selectPlayerEstimatedDps(state, enemy, style)) * 1000;

export const selectExpectedKillsPerHour = (
  state: GameState,
  enemy = selectSelectedEnemy(state),
  style = getActiveStyle(state),
): number => 3_600_000 /
  Math.max(1, selectEstimatedKillTimeMs(state, enemy, style) + GAME_CONFIG.respawnMs);

export const selectExpectedFoodPerHour = (_state?: GameState): 'Not available yet' => 'Not available yet';

export const selectTargetTrait = (state: GameState, enemy = selectSelectedEnemy(state)) => enemy.trait;

export const isCombatAreaUnlocked = (
  state: GameState,
  area: (typeof AREAS)[number],
): boolean => getDerivedStats(state).combatLevel >= area.requiredCombatLevel;

export const selectCombatStatus = (state: GameState): string => {
  if (state.activeAction.type !== 'combat') {
    const recent = state.log[0]?.text ?? '';
    return recent.toLowerCase().includes('inventory is full') ? 'Inventory full' : 'Idle';
  }
  if (state.activeAction.combatState.respawnMs > 0) return 'Respawning enemy';
  if (state.activeAction.combatState.enemyHp <= 0) return 'Enemy defeated';
  if (state.player.currentHp <= 0) return 'Player defeated';
  return 'Fighting';
};

export const displayDropChance = (chance: number): string => `${Math.round(chance * 100)}%`;
export type LootRarityLabel = 'Common' | 'Uncommon' | 'Rare' | 'Very Rare';
export const getLootRarity = (chance: number): LootRarityLabel => {
  if (chance >= 0.5) return 'Common';
  if (chance >= 0.25) return 'Uncommon';
  if (chance >= 0.1) return 'Rare';
  return 'Very Rare';
};

export const getCombatStyleInfo = (
  style: CombatStyle,
): { name: string; skill: string; benefit: string; modifier: string } => {
  const modifiers = getCombatStyleModifiers(style);
  if (style === 'accurate')
    return {
      name: 'Accurate',
      skill: 'Attack XP',
      benefit: 'Train Attack through damage',
      modifier: `+${Math.round((modifiers.accuracyMultiplier - 1) * 100)}% Accuracy`,
    };
  if (style === 'aggressive')
    return {
      name: 'Aggressive',
      skill: 'Strength XP',
      benefit: 'Train Strength through damage',
      modifier: '+10% max hit · −10% Accuracy',
    };
  return {
    name: 'Defensive',
    skill: 'Defence XP',
    benefit: 'Train Defence through damage',
    modifier: '+20% Defence · −10% max hit',
  };
};
