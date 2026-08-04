import { areaById, AREAS } from '../../content/areas';
import { enemyById } from '../../content/enemies';
import { getDerivedStats } from '../formulas/statFormulas';
import type { AreaId, CombatStyle, EnemyDefinition, EnemyId, GameState } from '../types';

export const ZONE_COMPLETION_KILLS = 25;
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
  fallback: AreaId = 'training-grounds',
): (typeof AREAS)[number] =>
  areaById[state.activeAction.type === 'combat' ? state.activeAction.areaId : fallback] ??
  areaById[fallback];

export const selectSelectedEnemy = (
  state: GameState,
  fallback: EnemyId = 'forest-rat',
): EnemyDefinition =>
  enemyById[state.activeAction.type === 'combat' ? state.activeAction.enemyId : fallback] ??
  enemyById[fallback];

const interpolatedRemaining = (remainingMs: number, updatedAt: number, now: number): number =>
  Math.max(0, remainingMs - Math.min(250, Math.max(0, now - updatedAt)));

export const selectPlayerAttackProgress = (state: GameState, now = Date.now()): AttackProgress => {
  const stats = getDerivedStats(state);
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
  if (state.activeAction.type !== 'combat')
    return {
      ratio: 0,
      timeUntilAttackMs: enemy.attackIntervalMs,
      intervalMs: enemy.attackIntervalMs,
      state: 'idle',
    };
  if (state.activeAction.combatState.respawnMs > 0)
    return {
      ratio: 0,
      timeUntilAttackMs: enemy.attackIntervalMs,
      intervalMs: enemy.attackIntervalMs,
      state: 'respawning',
    };
  if (state.activeAction.combatState.enemyHp <= 0 || state.player.currentHp <= 0)
    return {
      ratio: 0,
      timeUntilAttackMs: enemy.attackIntervalMs,
      intervalMs: enemy.attackIntervalMs,
      state: 'defeated',
    };
  const timeUntilAttackMs = interpolatedRemaining(
    state.activeAction.combatState.enemyAttackMs,
    state.updatedAt,
    now,
  );
  const ratio = Math.max(0, Math.min(1, 1 - timeUntilAttackMs / enemy.attackIntervalMs));
  return {
    ratio,
    timeUntilAttackMs,
    intervalMs: enemy.attackIntervalMs,
    state: ratio >= 0.85 ? 'ready' : 'active',
  };
};

export const selectPlayerEstimatedDps = (
  state: GameState,
  enemy = selectSelectedEnemy(state),
): number => {
  const stats = getDerivedStats(state);
  void enemy;
  return (1 + stats.maxHit / 2) / (stats.attackIntervalMs / 1000);
};

export const selectEnemyEstimatedDps = (
  state: GameState,
  enemy = selectSelectedEnemy(state),
): number => (1 + enemy.maxHit / 2) / (enemy.attackIntervalMs / 1000);

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

export const selectCombatProgress = (
  state: GameState,
): {
  killed: number;
  target: number;
  percent: number;
} => {
  const area = selectSelectedCombatArea(state);
  const killed = area.enemyIds.reduce((total, id) => total + (state.killCounts[id] ?? 0), 0);
  return {
    killed,
    target: ZONE_COMPLETION_KILLS,
    percent: Math.min(100, (killed / ZONE_COMPLETION_KILLS) * 100),
  };
};

export const selectZoneUnlockProgress = selectCombatProgress;

export const selectAreaThreat = (
  state: GameState,
  enemy = selectSelectedEnemy(state),
): 'Trivial' | 'Easy' | 'Fair' | 'Dangerous' | 'Deadly' => {
  const playerDps = Math.max(0.1, selectPlayerEstimatedDps(state, enemy));
  const enemyDps = selectEnemyEstimatedDps(state, enemy);
  const killTime = enemy.maxHealth / playerDps;
  const surviveTime = Math.max(1, getDerivedStats(state).maxHealth / Math.max(0.1, enemyDps));
  const pressure = killTime / surviveTime;
  if (pressure < 0.25) return 'Trivial';
  if (pressure < 0.6) return 'Easy';
  if (pressure < 1) return 'Fair';
  if (pressure < 1.8) return 'Dangerous';
  return 'Deadly';
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
): {
  name: string;
  skill: string;
  benefit: string;
  modifier: string;
} => {
  if (style === 'accurate')
    return {
      name: 'Accurate',
      skill: 'Attack XP',
      benefit: 'Train Attack through damage',
      modifier: '5 Attack XP per damage',
    };
  if (style === 'aggressive')
    return {
      name: 'Aggressive',
      skill: 'Strength XP',
      benefit: 'Train Strength through damage',
      modifier: '5 Strength XP per damage',
    };
  return {
    name: 'Defensive',
    skill: 'Defence XP',
    benefit: 'Train Defence through damage',
    modifier: '5 Defence XP per damage',
  };
};
