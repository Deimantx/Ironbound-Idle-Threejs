import { enemyById } from '../../../content/enemies';
import { miningNodeById } from '../../../content/miningNodes';
import { recipeById } from '../../../content/recipes';
import {
  getCombatSkillProgress,
  getProfessionSkillProgress,
  getTotalCombatLevels,
  getTotalLevel,
  getTotalProfessionLevels,
  isCombatSkillId,
  isProfessionSkillId,
} from '../../../game/progression/progressionSelectors';
import type { GameState, ScreenId } from '../../../game/types';
import {
  getItemCollectionProgress,
  getMonsterCollectionProgress,
  getOverallCollectionProgress,
} from '../collection/collectionSelectors';

export interface HomeActivitySummary {
  type: 'idle' | 'combat' | 'mining' | 'smithing';
  title: string;
  destination: Extract<ScreenId, 'combat' | 'mining' | 'smithing'> | null;
}

export interface HomeWorldRecord {
  totalKills: number;
  totalItemsGained: number;
  playTimeMs: number;
  itemProgress: ReturnType<typeof getItemCollectionProgress>;
  monsterProgress: ReturnType<typeof getMonsterCollectionProgress>;
  overallProgress: ReturnType<typeof getOverallCollectionProgress>;
}

export interface HomeRecentProgress {
  combat: GameState['activityLogs']['milestones'];
  profession: GameState['activityLogs']['milestones'];
}

export const getHomeContinueDestination = (game: GameState): ScreenId => {
  if (game.activeAction.type === 'combat') return 'combat';
  if (game.activeAction.type === 'mining') return 'mining';
  if (game.activeAction.type === 'smithing') return 'smithing';
  return 'combat';
};

export const getHomeActivitySummary = (game: GameState): HomeActivitySummary => {
  const action = game.activeAction;
  if (action.type === 'none') {
    return {
      type: 'idle',
      title: 'Idle',
      destination: null,
    };
  }
  if (action.type === 'combat') {
    const enemy = enemyById[action.enemyId];
    return {
      type: 'combat',
      title: `Combat \u00b7 ${enemy?.name ?? 'Unknown enemy'}`,
      destination: 'combat',
    };
  }
  if (action.type === 'mining') {
    const node = miningNodeById[action.nodeId];
    return {
      type: 'mining',
      title: `Mining \u00b7 ${node?.name ?? 'Unknown deposit'}`,
      destination: 'mining',
    };
  }
  const recipe = recipeById[action.recipeId];
  return {
    type: 'smithing',
    title: `Smithing \u00b7 ${recipe?.name ?? 'Unknown recipe'}`,
    destination: 'smithing',
  };
};

export const getHomeWorldRecord = (game: GameState): HomeWorldRecord => ({
  totalKills: game.statistics.totalKills,
  totalItemsGained: game.statistics.totalItemsGained,
  playTimeMs: game.statistics.playTimeMs,
  itemProgress: getItemCollectionProgress(game),
  monsterProgress: getMonsterCollectionProgress(game),
  overallProgress: getOverallCollectionProgress(game),
});

export const getHomeRecentProgress = (game: GameState, limit = 2): HomeRecentProgress => ({
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
export type { SkillProgressSummary } from '../../../game/progression/progressionSelectors';
