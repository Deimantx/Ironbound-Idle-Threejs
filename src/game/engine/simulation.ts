import { GAME_CONFIG } from '../../config/gameConfig';
import { areaById } from '../../content/areas';
import { enemyById } from '../../content/enemies';
import { itemById } from '../../content/items';
import { miningNodeById } from '../../content/miningNodes';
import { recipeById } from '../../content/recipes';
import {
  deterministicRandom,
  getCombatDamageXp,
  getCombatStyleSkill,
  getHitpointsDamageXp,
  rollInteger,
} from '../formulas/combatFormulas';
import { addSkillXp } from '../formulas/experienceFormulas';
import { getDerivedStats } from '../formulas/statFormulas';
import { addItem, canAddItem, getItemQuantity, removeItem } from '../systems/inventorySystem';
import type {
  ActiveAction,
  CombatVisualEvent,
  GameState,
  SkillId,
  SimulationSummary,
} from '../types';
import { emptySummary } from '../types';

const clone = (state: GameState): GameState => structuredClone(state);
const addLog = (
  state: GameState,
  text: string,
  tone: GameState['log'][number]['tone'] = 'neutral',
  at = Date.now(),
): void => {
  state.log = [{ id: `${at}-${Math.random()}`, at, text, tone }, ...state.log].slice(0, 80);
};
const addSummaryNumber = (record: Record<string, number>, id: string, amount: number): void => {
  record[id] = (record[id] ?? 0) + amount;
};
const awardXp = (
  state: GameState,
  summary: SimulationSummary,
  skill: SkillId,
  amount: number,
): void => {
  const gained = Math.max(0, Math.floor(amount));
  if (gained === 0) return;
  addSummaryNumber(summary.xpGained as Record<string, number>, skill, gained);
  const levels = addSkillXp(state.skills, skill, gained);
  if (levels > 0) {
    summary.levelsGained[skill] = (summary.levelsGained[skill] ?? 0) + levels;
    addLog(
      state,
      `${skill[0].toUpperCase()}${skill.slice(1)} reached level ${state.skills[skill].level}.`,
      'success',
    );
  }
};
const unlockAreas = (state: GameState): void => {
  for (const area of Object.values(areaById))
    if (!state.unlockedAreas.includes(area.id) && area.unlock(state)) {
      state.unlockedAreas.push(area.id);
      addLog(state, `${area.name} is now accessible.`, 'success');
    }
};

const simulateMining = (state: GameState, elapsedMs: number, summary: SimulationSummary): void => {
  if (state.activeAction.type !== 'mining') return;
  const action = state.activeAction;
  const node = miningNodeById[action.nodeId];
  if (!node || state.skills.mining.level < node.level) {
    state.activeAction = { type: 'none' };
    summary.stoppedReason = 'Mining level is too low for that node.';
    return;
  }
  const speed = getDerivedStats(state).miningIntervalMultiplier;
  const interval = Math.max(500, Math.floor(node.intervalMs * speed));
  let remaining = Math.floor(Math.max(0, elapsedMs));
  let progress = action.progressMs;
  let cycles = 0;
  while (remaining > 0 && cycles < 100_000) {
    const needed = interval - progress;
    if (remaining < needed) {
      progress += remaining;
      remaining = 0;
      break;
    }
    remaining -= needed;
    progress = 0;
    const result = addItem(state.inventory, node.rewardItemId, 1, GAME_CONFIG.inventorySlots);
    if (result.rejected) {
      state.activeAction = { type: 'none' };
      summary.stoppedReason = 'Inventory is full.';
      break;
    }
    state.inventory = result.inventory;
    state.statistics.mined += 1;
    cycles += 1;
    addSummaryNumber(summary.completed, `mine:${node.id}`, 1);
    addSummaryNumber(summary.itemsGained, node.rewardItemId, 1);
    awardXp(state, summary, 'mining', node.xp);
    if (!state.discoveredItems.includes(node.rewardItemId)) {
      state.discoveredItems.push(node.rewardItemId);
      addLog(
        state,
        `${itemById[node.rewardItemId]?.name ?? node.rewardItemId} discovered.`,
        'success',
      );
    }
  }
  if (state.activeAction.type === 'mining')
    state.activeAction = { ...action, progressMs: progress };
};

const maxCraftable = (state: GameState, recipe: (typeof recipeById)[string]): number =>
  Math.min(
    ...recipe.inputs.map((input) =>
      Math.floor(getItemQuantity(state.inventory, input.itemId) / input.quantity),
    ),
  );
const simulateSmithing = (
  state: GameState,
  elapsedMs: number,
  summary: SimulationSummary,
): void => {
  if (state.activeAction.type !== 'smithing') return;
  const action = state.activeAction;
  const recipe = recipeById[action.recipeId];
  if (!recipe || state.skills.smithing.level < recipe.level) {
    state.activeAction = { type: 'none' };
    summary.stoppedReason = 'Smithing level is too low for that recipe.';
    return;
  }
  const interval = recipe.intervalMs;
  let remaining = elapsedMs;
  let progress = action.progressMs;
  let cycles = 0;
  while (remaining > 0 && cycles < 100_000 && (action.remaining === null || action.remaining > 0)) {
    const available = maxCraftable(state, recipe);
    if (available < 1) {
      state.activeAction = { type: 'none' };
      summary.stoppedReason = 'Materials ran out.';
      break;
    }
    const needed = interval - progress;
    if (remaining < needed) {
      progress += remaining;
      remaining = 0;
      break;
    }
    remaining -= needed;
    progress = 0;
    if (!canAddItem(state.inventory, recipe.outputItemId, GAME_CONFIG.inventorySlots)) {
      state.activeAction = { type: 'none' };
      summary.stoppedReason = 'Inventory is full.';
      break;
    }
    for (const input of recipe.inputs) {
      state.inventory = removeItem(state.inventory, input.itemId, input.quantity).inventory;
      addSummaryNumber(summary.itemsUsed, input.itemId, input.quantity);
    }
    const output = addItem(
      state.inventory,
      recipe.outputItemId,
      recipe.outputQuantity,
      GAME_CONFIG.inventorySlots,
    );
    if (output.rejected) {
      state.activeAction = { type: 'none' };
      summary.stoppedReason = 'Inventory is full.';
      break;
    }
    state.inventory = output.inventory;
    state.statistics[recipe.category === 'smelting' ? 'smelted' : 'forged'] += 1;
    cycles += 1;
    addSummaryNumber(summary.completed, `${recipe.category}:${recipe.id}`, 1);
    addSummaryNumber(summary.itemsGained, recipe.outputItemId, recipe.outputQuantity);
    awardXp(state, summary, 'smithing', recipe.xp);
    if (!state.discoveredItems.includes(recipe.outputItemId)) {
      state.discoveredItems.push(recipe.outputItemId);
      addLog(
        state,
        `${itemById[recipe.outputItemId]?.name ?? recipe.outputItemId} added to the collection.`,
        'success',
      );
    }
    if (action.remaining !== null) action.remaining -= 1;
  }
  if (state.activeAction.type === 'smithing')
    state.activeAction = { ...action, progressMs: progress };
};

const grantLoot = (
  state: GameState,
  enemyId: string,
  summary: SimulationSummary,
  seed: number,
): { ok: boolean; items: Array<{ itemId: string; quantity: number }> } => {
  const enemy = enemyById[enemyId];
  if (!enemy) return { ok: true, items: [] };
  const items: Array<{ itemId: string; quantity: number }> = [];
  for (const [index, loot] of enemy.loot.entries())
    if (deterministicRandom(seed + index) <= loot.chance) {
      const quantity =
        loot.min + Math.floor(deterministicRandom(seed + index + 40) * (loot.max - loot.min + 1));
      const added = addItem(state.inventory, loot.itemId, quantity, GAME_CONFIG.inventorySlots);
      if (added.rejected) return { ok: false, items };
      state.inventory = added.inventory;
      items.push({ itemId: loot.itemId, quantity });
      addSummaryNumber(summary.itemsGained, loot.itemId, quantity);
      if (!state.discoveredItems.includes(loot.itemId)) state.discoveredItems.push(loot.itemId);
    }
  return { ok: true, items };
};
const simulateCombat = (
  state: GameState,
  elapsedMs: number,
  summary: SimulationSummary,
  events: CombatVisualEvent[],
): void => {
  if (state.activeAction.type !== 'combat') return;
  const action = state.activeAction;
  const enemy = enemyById[action.enemyId];
  if (!enemy || !areaById[action.areaId]) {
    state.activeAction = { type: 'none' };
    summary.stoppedReason = 'That combat target is no longer available.';
    return;
  }
  const stats = getDerivedStats(state);
  let left = elapsedMs;
  let enemyHp = action.combatState.enemyHp;
  let playerTimer = action.combatState.playerAttackMs;
  let enemyTimer = action.combatState.enemyAttackMs;
  let respawn = action.combatState.respawnMs;
  let seed = Math.floor(state.lastSimulatedAt / 1000) + state.statistics.totalKills;
  while (left > 0 && left < 86_400_000 + 1) {
    if (respawn > 0) {
      const step = Math.min(left, respawn);
      left -= step;
      respawn -= step;
      if (respawn <= 0) enemyHp = enemy.maxHealth;
      continue;
    }
    const step = Math.min(
      left,
      Math.max(1, Math.min(playerTimer || Infinity, enemyTimer || Infinity)),
    );
    left -= step;
    playerTimer -= step;
    enemyTimer -= step;
    if (playerTimer <= 0) {
      const damage = 1 + rollInteger(stats.maxHit, deterministicRandom(seed++));
      enemyHp -= damage;
      events.push({
        id: `player-hit-${seed}-${left}`,
        type: 'player-hit',
        enemyId: enemy.id,
        damage,
        at: Date.now(),
      });
      addLog(state, `You hit ${enemy.name} for ${damage}.`, 'neutral');
      awardXp(state, summary, getCombatStyleSkill(action.style), getCombatDamageXp(damage));
      awardXp(state, summary, 'hitpoints', getHitpointsDamageXp(damage));
      playerTimer += stats.attackIntervalMs;
    }
    if (enemyTimer <= 0) {
      const damage = 1 + rollInteger(enemy.maxHit, deterministicRandom(seed++));
      state.player.currentHp = Math.max(0, state.player.currentHp - damage);
      events.push({
        id: `enemy-hit-${seed}-${left}`,
        type: 'enemy-hit',
        enemyId: enemy.id,
        damage,
        at: Date.now(),
      });
      addLog(state, `${enemy.name} hit you for ${damage}.`, 'danger');
      enemyTimer += enemy.attackIntervalMs;
    }
    if (state.player.currentHp <= 0) {
      state.statistics.deaths += 1;
      summary.deaths += 1;
      state.player.currentHp = stats.maxHealth;
      state.activeAction = { type: 'none' };
      summary.stoppedReason = 'You were defeated and returned safely to the training yard.';
      events.push({
        id: `player-defeated-${seed}-${left}`,
        type: 'player-defeated',
        enemyId: enemy.id,
        at: Date.now(),
      });
      addLog(state, 'You were defeated. Your belongings are safe.', 'danger');
      break;
    }
    if (enemyHp <= 0) {
      summary.enemiesDefeated += 1;
      state.statistics.totalKills += 1;
      state.killCounts[enemy.id] = (state.killCounts[enemy.id] ?? 0) + 1;
      if (!state.discoveredMonsters.includes(enemy.id)) state.discoveredMonsters.push(enemy.id);
      const gold =
        enemy.gold[0] +
        Math.floor(deterministicRandom(seed++) * (enemy.gold[1] - enemy.gold[0] + 1));
      state.gold += gold;
      summary.goldGained += gold;
      events.push({
        id: `enemy-defeated-${seed}-${left}`,
        type: 'enemy-defeated',
        enemyId: enemy.id,
        at: Date.now(),
        gold,
      });
      const loot = grantLoot(state, enemy.id, summary, seed++);
      events.push({
        id: `loot-${seed}-${left}`,
        type: 'loot',
        enemyId: enemy.id,
        at: Date.now(),
        gold,
        items: loot.items,
      });
      const lootText = loot.items.length
        ? ` Received ${loot.items.map((entry) => `${entry.quantity} ${itemById[entry.itemId]?.name ?? entry.itemId}`).join(', ')}.`
        : '';
      addLog(state, `${enemy.name} defeated. +${gold} gold.${lootText}`, 'success');
      if (!loot.ok) {
        state.activeAction = { type: 'none' };
        summary.stoppedReason = 'Inventory is full; combat paused before loot could be collected.';
        break;
      }
      if (action.autoRepeat) {
        state.player.currentHp = getDerivedStats(state).maxHealth;
        respawn = GAME_CONFIG.respawnMs;
        enemyHp = 0;
      } else {
        state.activeAction = { type: 'none' };
        addLog(state, `${enemy.name} defeated. +${gold} gold.`, 'success');
        break;
      }
    }
  }
  if (state.activeAction.type === 'combat')
    state.activeAction = {
      ...action,
      combatState: {
        enemyHp,
        playerAttackMs: Math.max(0, playerTimer),
        enemyAttackMs: Math.max(0, enemyTimer),
        respawnMs: Math.max(0, respawn),
      },
    };
};

export const simulateElapsed = (
  input: GameState,
  elapsedMs: number,
): { state: GameState; summary: SimulationSummary; events: CombatVisualEvent[] } => {
  const safeElapsed = Math.max(0, Math.min(GAME_CONFIG.offlineCapMs, Math.floor(elapsedMs)));
  const state = clone(input);
  const summary = emptySummary(safeElapsed);
  const events: CombatVisualEvent[] = [];
  if (safeElapsed === 0) return { state, summary, events };
  switch (state.activeAction.type) {
    case 'mining':
      simulateMining(state, safeElapsed, summary);
      break;
    case 'smithing':
      simulateSmithing(state, safeElapsed, summary);
      break;
    case 'combat':
      simulateCombat(state, safeElapsed, summary, events);
      break;
    default:
      if (state.player.currentHp < getDerivedStats(state).maxHealth)
        state.player.currentHp = Math.min(
          getDerivedStats(state).maxHealth,
          state.player.currentHp + Math.floor(safeElapsed / 5000),
        );
  }
  unlockAreas(state);
  state.lastSimulatedAt += safeElapsed;
  state.updatedAt = Date.now();
  return { state, summary, events: events.slice(-64) };
};

export const progressRatio = (action: ActiveAction, now: number, state: GameState): number => {
  if (action.type === 'mining') {
    const node = miningNodeById[action.nodeId];
    return node
      ? action.progressMs /
          Math.max(1, node.intervalMs * getDerivedStats(state).miningIntervalMultiplier)
      : 0;
  }
  if (action.type === 'smithing') {
    const recipe = recipeById[action.recipeId];
    return recipe ? action.progressMs / recipe.intervalMs : 0;
  }
  if (action.type === 'combat') {
    const enemy = enemyById[action.enemyId];
    return enemy ? 1 - action.combatState.enemyHp / enemy.maxHealth : 0;
  }
  void now;
  return 0;
};
