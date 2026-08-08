import { areaById } from '../../content/areas';
import { combatRegionById } from '../../content/combatRegions';
import { enemyById } from '../../content/enemies';
import { itemById } from '../../content/items';
import { miningNodeById } from '../../content/miningNodes';
import { recipeById } from '../../content/recipes';
import { getMiningRuntimeState } from '../../game/formulas/miningFormulas';
import {
  getCombatSkillProgress,
  getProfessionSkillProgress,
  getTotalCombatLevels,
  getTotalLevel,
  getTotalProfessionLevels,
  isCombatSkillId,
  isProfessionSkillId,
} from '../../game/progression/progressionSelectors';
import { getItemQuantity } from '../../game/systems/inventorySystem';
import type {
  CombatSessionStats,
  EquipmentSlot,
  GameState,
  ItemDefinition,
  ScreenId,
} from '../../game/types';
import {
  getItemCollectionProgress,
  getMonsterCollectionProgress,
  getOverallCollectionProgress,
} from '../collection/collectionSelectors';

export interface HomeActivitySummary {
  type: 'idle' | 'combat' | 'mining' | 'smithing';
  title: string;
  subtitle?: string;
  meta?: string;
  destination: Extract<ScreenId, 'combat' | 'mining' | 'smithing'> | null;
}

export interface HomeLoadoutEntry {
  slot: Extract<EquipmentSlot, 'weapon' | 'armor' | 'offhand' | 'tool'>;
  label: string;
  item?: ItemDefinition;
}

export interface StarterPathObjective {
  text: string;
  done: boolean;
  target: Extract<ScreenId, 'combat' | 'mining' | 'smithing' | 'equipment'>;
}

export interface HomeWorldRecord {
  totalKills: number;
  itemProgress: ReturnType<typeof getItemCollectionProgress>;
  monsterProgress: ReturnType<typeof getMonsterCollectionProgress>;
  overallProgress: ReturnType<typeof getOverallCollectionProgress>;
}

export interface HomeRecentProgress {
  combat: GameState['activityLogs']['milestones'];
  profession: GameState['activityLogs']['milestones'];
}

export const getHomeStarterPathObjectives = (game: GameState): StarterPathObjective[] => [
  {
    text: 'Mine Stone and Iron',
    done:
      getItemQuantity(game.inventory, 'stone-ore') > 0 &&
      getItemQuantity(game.inventory, 'iron-ore') > 0,
    target: 'mining',
  },
  {
    text: 'Smelt a Bronze Bar',
    done: getItemQuantity(game.inventory, 'bronze-bar') > 0,
    target: 'smithing',
  },
  {
    text: 'Forge a Bronze Sword',
    done: game.discoveredItems.includes('bronze-sword'),
    target: 'smithing',
  },
  { text: 'Equip a Weapon', done: Boolean(game.equipment.weapon), target: 'equipment' },
  {
    text: 'Defeat a Forest Rat',
    done: (game.killCounts['forest-rat'] ?? 0) > 0,
    target: 'combat',
  },
];

export const getHomeContinueDestination = (game: GameState): ScreenId => {
  if (game.activeAction.type === 'combat') return 'combat';
  if (game.activeAction.type === 'mining') return 'mining';
  if (game.activeAction.type === 'smithing') return 'smithing';
  return getHomeStarterPathObjectives(game).find((objective) => !objective.done)?.target ?? 'combat';
};

const formatElapsed = (startedAt: number | null, now: number): string => {
  if (startedAt === null) return '0m 00s';
  const totalSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  return `${Math.floor(totalSeconds / 60)}m ${String(totalSeconds % 60).padStart(2, '0')}s`;
};

export const getHomeActivitySummary = (
  game: GameState,
  options: { now?: number; combatSession?: Pick<CombatSessionStats, 'startedAt' | 'enemiesDefeated'> } = {},
): HomeActivitySummary => {
  const now = options.now ?? Date.now();
  const action = game.activeAction;
  if (action.type === 'none') {
    return {
      type: 'idle',
      title: 'Idle',
      subtitle: 'Choose a profession or seek a fight.',
      destination: null,
    };
  }
  if (action.type === 'combat') {
    const enemy = enemyById[action.enemyId];
    const areaDefinition = areaById[action.areaId];
    const region = areaDefinition ? combatRegionById[areaDefinition.regionId] : undefined;
    const sessionStartedAt = options.combatSession?.startedAt ?? action.combatState.encounterStartedAt;
    const kills = options.combatSession?.enemiesDefeated ?? 0;
    return {
      type: 'combat',
      title: `Combat · ${enemy?.name ?? 'Unknown enemy'}`,
      subtitle: `${region?.name ?? 'Unknown region'} · ${areaDefinition?.name ?? 'Unknown area'}`,
      meta: `Session ${formatElapsed(sessionStartedAt, now)} · ${kills} kill${kills === 1 ? '' : 's'}`,
      destination: 'combat',
    };
  }
  if (action.type === 'mining') {
    const node = miningNodeById[action.nodeId];
    const runtime = getMiningRuntimeState(game.mining, action.nodeId);
    const phase = action.phase === 'rest' ? 'Resting' : action.phase === 'respawn' ? 'Reforming' : 'Swinging';
    return {
      type: 'mining',
      title: `Mining · ${node?.name ?? 'Unknown deposit'}`,
      subtitle: `Stage ${(runtime?.stageIndex ?? 0) + 1}/${node?.stages.length ?? 0} · ${phase}`,
      meta: `Stamina ${Math.round(game.mining.stamina)}`,
      destination: 'mining',
    };
  }
  const recipe = recipeById[action.recipeId];
  return {
    type: 'smithing',
    title: `Smithing · ${recipe?.name ?? 'Unknown recipe'}`,
    subtitle: action.remaining === null ? 'Continuous cycle' : `${action.remaining} remaining`,
    meta: 'Active in background',
    destination: 'smithing',
  };
};

export const getHomeLoadout = (game: GameState): HomeLoadoutEntry[] =>
  ([
    ['weapon', 'Weapon'],
    ['armor', 'Armor'],
    ['offhand', 'Offhand'],
    ['tool', 'Tool'],
  ] as const).map(([slot, label]) => ({
    slot,
    label,
    item: itemById[game.equipment[slot] ?? ''],
  }));

export const getHomeWorldRecord = (game: GameState): HomeWorldRecord => ({
  totalKills: game.statistics.totalKills,
  itemProgress: getItemCollectionProgress(game),
  monsterProgress: getMonsterCollectionProgress(game),
  overallProgress: getOverallCollectionProgress(game),
});

export const getHomeRecentProgress = (game: GameState, limit = 5): HomeRecentProgress => ({
  combat: game.activityLogs.milestones.filter((entry) => isCombatSkillId(entry.skillId)).slice(0, limit),
  profession: game.activityLogs.milestones
    .filter((entry) => isProfessionSkillId(entry.skillId))
    .slice(0, limit),
});

export {
  getCombatSkillProgress,
  getProfessionSkillProgress,
  getTotalCombatLevels,
  getTotalLevel,
  getTotalProfessionLevels,
};
export type { SkillProgressSummary } from '../../game/progression/progressionSelectors';
