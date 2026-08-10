import { GAME_CONFIG } from '../../config/gameConfig';
import { areaById } from '../../content/areas';
import { enemyById } from '../../content/enemies';
import { itemById } from '../../content/items';
import { miningNodeById } from '../../content/miningNodes';
import { recipeById } from '../../content/recipes';
import {
  getCombatDamageXp,
  getCombatStyleSkill,
  getHitpointsDamageXp,
  getHitChance,
  nextCombatRandom,
  rollDamage,
} from '../formulas/combatFormulas';
import { COMBAT_TUNING } from '../../config/combatTuning';
import { getEnemyCombatStats } from '../formulas/combatStats';
import { getCombatGoldRange, getResolvedEnemyLoot } from '../formulas/combatLoot';
import {
  applyCombatEffect,
  advanceCombatEffects,
  getTimeUntilNextCombatEffectEvent,
  resolveReadyCombatEffectTicks,
} from '../formulas/combatEffects';
import {
  createEnemyTraitState,
  onEnemyAttackResolved,
  onEnemyDamaged,
  syncEnemyTraitState,
} from '../systems/enemyTraitSystem';
import { initializeEnemySpawn } from './combatEncounter';
import { addSkillXp } from '../formulas/experienceFormulas';
import { getDerivedStats } from '../formulas/statFormulas';
import { applyDeathRecovery, applyOutOfCombatHealthRecovery } from '../systems/healthSystem';
import {
  addItem,
  addItemBundle,
  canAddItemBundle,
  getItemQuantity,
  removeItem,
} from '../systems/inventorySystem';
import { MINING_TUNING } from '../../config/miningTuning';
import {
  getMiningEffectiveness,
  getMiningRuntimeState,
  getMiningSwingDamage,
  getMiningSwingXp,
  getMiningTool,
  getMiningPrimaryYield,
  getMiningStageBonusChance,
  nextMiningRandom,
  normalizeMiningState,
} from '../formulas/miningFormulas';
import {
  getForgeFuelCapacity,
  getForgeFuelDefinition,
  getForgeFuelUnitsRequired,
  getForgeLoadedFuelValue,
  getSmithingEffectiveInterval,
  getSmithingPreservationChance,
  nextSmithingRandom,
  normalizeSmithingState,
  stageForgeAutoRefuel,
} from '../formulas/smithingFormulas';
import type {
  ActiveAction,
  ActiveCombatState,
  CombatVisualEvent,
  EnemyId,
  GameState,
  MiningNodeDefinition,
  SkillId,
  SimulationSummary,
} from '../types';
import { emptySummary } from '../types';
import { appendCombatLog } from '../logging/combatLog';
import { appendMilestone } from '../logging/milestoneLog';

const clone = (state: GameState): GameState => structuredClone(state);
const MAX_COMBAT_SIMULATION_EVENTS = 100_000;
const MAX_COMBAT_VISUAL_EVENTS = 64;
const addSummaryNumber = (record: Record<string, number>, id: string, amount: number): void => {
  record[id] = (record[id] ?? 0) + amount;
};
const awardXp = (
  state: GameState,
  summary: SimulationSummary,
  skill: SkillId,
  amount: number,
  at = state.lastSimulatedAt,
): void => {
  const gained = Math.max(0, Math.floor(amount));
  if (gained === 0) return;
  addSummaryNumber(summary.xpGained as Record<string, number>, skill, gained);
  const levels = addSkillXp(state.skills, skill, gained);
  if (levels > 0) {
    summary.levelsGained[skill] = (summary.levelsGained[skill] ?? 0) + levels;
    appendMilestone(state, { skillId: skill, level: state.skills[skill].level, at });
  }
};
const MAX_MINING_SIMULATION_EVENTS = 100_000;

const advanceMiningRockDamage = (
  runtime: ReturnType<typeof getMiningRuntimeState>,
  node: MiningNodeDefinition,
  damage: number,
): { stagesDepleted: number; rockDepleted: boolean; depletedStageIndices: number[] } => {
  let remainingDamage = damage;
  let stagesDepleted = 0;
  const depletedStageIndices: number[] = [];
  let rockDepleted = false;
  while (remainingDamage > 0 && !rockDepleted) {
    const dealt = Math.min(remainingDamage, Math.max(0, runtime.stageDurability));
    runtime.stageDurability -= dealt;
    remainingDamage -= dealt;
    if (runtime.stageDurability > 0) break;
    stagesDepleted += 1;
    depletedStageIndices.push(runtime.stageIndex);
    if (runtime.stageIndex >= node.stages.length - 1) {
      runtime.stageDurability = 0;
      runtime.respawnRemainingMs = node.respawnMs;
      rockDepleted = true;
      break;
    }
    runtime.stageIndex += 1;
    runtime.stageDurability = node.stages[runtime.stageIndex].durability;
  }
  return { stagesDepleted, rockDepleted, depletedStageIndices };
};

const resolveMiningSwing = (
  state: GameState,
  node: MiningNodeDefinition,
  summary: SimulationSummary,
  at: number,
): { ok: boolean; phase: 'swing' | 'rest' | 'respawn' } => {
  const runtime = getMiningRuntimeState(state.mining, node.id);
  const tool = getMiningTool(state);
  const effectiveness = getMiningEffectiveness(tool, node);
  const damage = getMiningSwingDamage(tool, node);
  const yieldResult = getMiningPrimaryYield(damage, node, runtime.primaryYieldProgress);
  const nextRuntime = structuredClone(runtime);
  const rng = { rngSeed: nextRuntime.rngSeed, rngCursor: nextRuntime.rngCursor };
  const startingStage = node.stages[runtime.stageIndex] ?? node.stages[0];
  const bundle: Array<{ itemId: string; quantity: number }> = [];
  if (yieldResult.quantity > 0)
    bundle.push({ itemId: node.primaryRewardItemId, quantity: yieldResult.quantity });
  for (const drop of node.bonusDrops) {
    if (nextMiningRandom(rng) > getMiningStageBonusChance(drop, startingStage)) continue;
    const quantity =
      drop.minQuantity +
      Math.floor(nextMiningRandom(rng) * (drop.maxQuantity - drop.minQuantity + 1));
    if (quantity > 0) bundle.push({ itemId: drop.itemId, quantity });
  }
  if (!canAddItemBundle(state.inventory, bundle, GAME_CONFIG.inventorySlots)) {
    state.activeAction = { type: 'none' };
    summary.stoppedReason = 'Inventory is full.';
    return { ok: false, phase: 'swing' };
  }
  const transition = advanceMiningRockDamage(nextRuntime, node, damage);
  nextRuntime.primaryYieldProgress = yieldResult.remainingProgress;
  nextRuntime.rngSeed = rng.rngSeed;
  nextRuntime.rngCursor = rng.rngCursor;
  const added = addItemBundle(state.inventory, bundle, GAME_CONFIG.inventorySlots);
  if (added.rejected) {
    state.activeAction = { type: 'none' };
    summary.stoppedReason = 'Inventory is full.';
    return { ok: false, phase: 'swing' };
  }
  state.inventory = added.inventory;
  state.mining.nodeStates[node.id] = nextRuntime;
  state.mining.stamina = Math.max(0, state.mining.stamina - tool.staminaCost);
  state.statistics.mined += 1;
  state.statistics.miningSwings += 1;
  state.statistics.miningStagesDepleted += transition.stagesDepleted;
  if (transition.rockDepleted) state.statistics.miningRocksDepleted += 1;
  addSummaryNumber(summary.completed, `mine-swing:${node.id}`, 1);
  addSummaryNumber(summary.completed, `mine:${node.id}`, 1);
  for (const stageIndex of transition.depletedStageIndices)
    addSummaryNumber(summary.completed, `mine-stage:${node.id}:${stageIndex}`, 1);
  if (transition.rockDepleted) addSummaryNumber(summary.completed, `mine-rock:${node.id}`, 1);
  for (const reward of bundle) {
    addSummaryNumber(summary.itemsGained, reward.itemId, reward.quantity);
    if (!state.discoveredItems.includes(reward.itemId)) state.discoveredItems.push(reward.itemId);
  }
  awardXp(state, summary, 'mining', getMiningSwingXp(node, effectiveness), at);
  if (transition.rockDepleted) return { ok: true, phase: 'respawn' };
  return { ok: true, phase: state.mining.stamina <= 0 ? 'rest' : 'swing' };
};

const simulateMining = (
  state: GameState,
  elapsedMs: number,
  summary: SimulationSummary,
  ignoreLevelRequirement = false,
): number => {
  if (state.activeAction.type !== 'mining') return elapsedMs;
  const action = state.activeAction;
  const node = miningNodeById[action.nodeId];
  if (!node || (!ignoreLevelRequirement && state.skills.mining.level < node.level)) {
    state.activeAction = { type: 'none' };
    summary.stoppedReason = 'Mining level is too low for that node.';
    return elapsedMs;
  }
  state.mining = normalizeMiningState(state.mining);
  state.statistics = {
    ...state.statistics,
    mined: state.statistics?.mined ?? 0,
    miningSwings: state.statistics?.miningSwings ?? state.statistics?.mined ?? 0,
    miningStagesDepleted: state.statistics?.miningStagesDepleted ?? 0,
    miningRocksDepleted: state.statistics?.miningRocksDepleted ?? 0,
  };
  if (!state.mining.nodeStates[node.id])
    state.mining.nodeStates[node.id] = getMiningRuntimeState(state.mining, node.id);
  const currentAction: Extract<GameState['activeAction'], { type: 'mining' }> = {
    ...action,
    phase:
      action.phase === 'respawn' || action.phase === 'rest' || action.phase === 'swing'
        ? action.phase
        : 'swing',
    progressMs: Math.max(0, action.progressMs),
  };
  if (state.mining.stamina <= 0 && currentAction.phase === 'swing') {
    currentAction.phase = 'rest';
    currentAction.progressMs = 0;
  }
  let remaining = Math.floor(Math.max(0, elapsedMs));
  let processed = 0;
  let events = 0;
  while (
    remaining > 0 &&
    events < MAX_MINING_SIMULATION_EVENTS &&
    state.activeAction.type === 'mining'
  ) {
    const runtime = state.mining.nodeStates[node.id]!;
    if (currentAction.phase === 'respawn') {
      const needed = Math.max(1, runtime.respawnRemainingMs);
      if (remaining < needed) {
        runtime.respawnRemainingMs -= remaining;
        currentAction.progressMs = node.respawnMs - runtime.respawnRemainingMs;
        processed += remaining;
        remaining = 0;
        break;
      }
      remaining -= needed;
      processed += needed;
      runtime.respawnRemainingMs = 0;
      runtime.stageIndex = 0;
      runtime.stageDurability = node.stages[0].durability;
      currentAction.phase = state.mining.stamina <= 0 ? 'rest' : 'swing';
      currentAction.progressMs = 0;
      events += 1;
      continue;
    }
    if (currentAction.phase === 'rest') {
      const progress = Math.min(MINING_TUNING.restDurationMs, currentAction.progressMs);
      const needed = Math.max(1, MINING_TUNING.restDurationMs - progress);
      if (remaining < needed) {
        currentAction.progressMs = progress + remaining;
        processed += remaining;
        remaining = 0;
        break;
      }
      remaining -= needed;
      processed += needed;
      state.mining.stamina = MINING_TUNING.maxStamina;
      currentAction.phase = 'swing';
      currentAction.progressMs = 0;
      events += 1;
      continue;
    }
    const tool = getMiningTool(state);
    const interval = Math.max(1, tool.swingIntervalMs);
    const progress = Math.min(interval, Math.max(0, currentAction.progressMs));
    const needed = Math.max(1, interval - progress);
    if (remaining < needed) {
      currentAction.progressMs = progress + remaining;
      processed += remaining;
      remaining = 0;
      break;
    }
    remaining -= needed;
    processed += needed;
    currentAction.progressMs = 0;
    const result = resolveMiningSwing(state, node, summary, state.lastSimulatedAt + processed);
    events += 1;
    if (!result.ok) break;
    currentAction.phase = result.phase;
    currentAction.progressMs = 0;
  }
  if (events >= MAX_MINING_SIMULATION_EVENTS && remaining > 0)
    summary.stoppedReason = 'Mining event cap reached safely.';
  if (state.activeAction.type === 'mining') state.activeAction = currentAction;
  return processed;
};

const resolveSmithingCycle = (
  state: GameState,
  recipe: (typeof recipeById)[string],
  summary: SimulationSummary,
  at: number,
): { ok: true } | { ok: false; reason: string } => {
  for (const input of recipe.inputs) {
    if (input.quantity <= 0 || getItemQuantity(state.inventory, input.itemId) < input.quantity)
      return { ok: false, reason: 'Materials ran out.' };
  }
  const chance = getSmithingPreservationChance(state, recipe);
  const nextSmithingState = structuredClone(state.smithing);
  let stagedInventory = state.inventory;
  let stagedForgeFuel = nextSmithingState.forgeFuel;
  const fuelUnitsRequired = getForgeFuelUnitsRequired(recipe);
  let fuelQuantityConsumed = 0;
  let fuelItemId: string | null = null;
  if (fuelUnitsRequired > 0) {
    if (getForgeLoadedFuelValue(state) < fuelUnitsRequired && stagedForgeFuel.autoRefuel) {
      const refill = stageForgeAutoRefuel(
        stagedInventory,
        stagedForgeFuel,
        getForgeFuelCapacity(state),
      );
      stagedInventory = refill.inventory;
      stagedForgeFuel = refill.forgeFuel;
    }
    const stagedFuel = getForgeFuelDefinition(stagedForgeFuel.loadedFuelItemId);
    const stagedFuelValue = stagedFuel
      ? stagedForgeFuel.loadedFuelQuantity * stagedFuel.fuelValue
      : 0;
    if (!stagedFuel || stagedFuelValue < fuelUnitsRequired)
      return { ok: false, reason: 'Forge fuel ran out.' };
    fuelItemId = stagedFuel.itemId;
    fuelQuantityConsumed = Math.ceil(fuelUnitsRequired / stagedFuel.fuelValue);
    stagedForgeFuel.loadedFuelQuantity -= fuelQuantityConsumed;
    if (stagedForgeFuel.loadedFuelQuantity <= 0) stagedForgeFuel.loadedFuelItemId = null;
  }
  const consumed = new Map<string, number>();
  for (const input of recipe.inputs) {
    const requiredQuantity = Math.max(0, Math.floor(input.quantity));
    let consumedQuantity = requiredQuantity;
    if (recipe.category === 'forging' && chance > 0) {
      for (let unit = 0; unit < requiredQuantity; unit += 1)
        if (nextSmithingRandom(nextSmithingState) < chance) consumedQuantity -= 1;
    }
    consumed.set(input.itemId, (consumed.get(input.itemId) ?? 0) + consumedQuantity);
  }
  for (const [itemId, quantity] of consumed) {
    const removed = removeItem(stagedInventory, itemId, quantity);
    if (removed.rejected > 0) return { ok: false, reason: 'Materials ran out.' };
    stagedInventory = removed.inventory;
  }
  const output = addItem(
    stagedInventory,
    recipe.outputItemId,
    recipe.outputQuantity,
    GAME_CONFIG.inventorySlots,
  );
  if (output.rejected > 0) return { ok: false, reason: 'Inventory is full.' };

  state.inventory = output.inventory;
  state.smithing = {
    ...nextSmithingState,
    forgeFuel: stagedForgeFuel,
  };
  for (const [itemId, quantity] of consumed) addSummaryNumber(summary.itemsUsed, itemId, quantity);
  if (fuelItemId) addSummaryNumber(summary.itemsUsed, fuelItemId, fuelQuantityConsumed);
  state.statistics[recipe.category === 'smelting' ? 'smelted' : 'forged'] += 1;
  addSummaryNumber(summary.completed, `${recipe.category}:${recipe.id}`, 1);
  addSummaryNumber(summary.itemsGained, recipe.outputItemId, recipe.outputQuantity);
  awardXp(state, summary, 'smithing', recipe.xp, at);
  if (!state.discoveredItems.includes(recipe.outputItemId))
    state.discoveredItems.push(recipe.outputItemId);
  return { ok: true };
};

const simulateSmithing = (
  state: GameState,
  elapsedMs: number,
  summary: SimulationSummary,
): void => {
  if (state.activeAction.type !== 'smithing') return;
  const action = state.activeAction;
  const recipe = recipeById[action.recipeId];
  if (!recipe) {
    state.activeAction = { type: 'none' };
    summary.stoppedReason = 'Smithing recipe is no longer available.';
    return;
  }
  if (state.skills.smithing.level < recipe.level) {
    state.activeAction = { type: 'none' };
    summary.stoppedReason = 'Smithing level is too low for that recipe.';
    return;
  }
  state.smithing = normalizeSmithingState(state.smithing);
  state.statistics = {
    ...state.statistics,
    smelted: state.statistics?.smelted ?? 0,
    forged: state.statistics?.forged ?? 0,
  };
  let remaining = elapsedMs;
  let progress = Math.max(0, action.progressMs);
  let cycles = 0;
  while (
    remaining > 0 &&
    cycles < 100_000 &&
    state.activeAction.type === 'smithing' &&
    (action.remaining === null || action.remaining > 0)
  ) {
    const missingInput = recipe.inputs.some(
      (input) =>
        input.quantity <= 0 || getItemQuantity(state.inventory, input.itemId) < input.quantity,
    );
    if (missingInput) {
      state.activeAction = { type: 'none' };
      summary.stoppedReason = 'Materials ran out.';
      break;
    }
    const interval = getSmithingEffectiveInterval(state, recipe);
    progress = Math.min(interval, progress);
    const needed = Math.max(1, interval - progress);
    if (remaining < needed) {
      progress += remaining;
      remaining = 0;
      break;
    }
    remaining -= needed;
    progress = 0;
    const result = resolveSmithingCycle(
      state,
      recipe,
      summary,
      state.lastSimulatedAt + elapsedMs - remaining,
    );
    if (!result.ok) {
      state.activeAction = { type: 'none' };
      summary.stoppedReason = result.reason;
      break;
    }
    cycles += 1;
    if (action.remaining !== null) action.remaining -= 1;
  }
  if (state.activeAction.type === 'smithing') {
    state.activeAction =
      action.remaining !== null && action.remaining <= 0
        ? { type: 'none' }
        : { ...action, progressMs: progress };
  }
};

const grantLoot = (
  state: GameState,
  enemyId: EnemyId,
  summary: SimulationSummary,
  rng: { rngSeed: number; rngCursor: number },
  lootChanceMultiplier = 1,
): { ok: boolean; items: Array<{ itemId: string; quantity: number }> } => {
  const enemy = enemyById[enemyId];
  if (!enemy) return { ok: true, items: [] };
  const items: Array<{ itemId: string; quantity: number }> = [];
  for (const loot of getResolvedEnemyLoot(enemyId))
    if (nextCombatRandom(rng) <= Math.min(1, loot.chance * lootChanceMultiplier)) {
      const quantity = loot.min + Math.floor(nextCombatRandom(rng) * (loot.max - loot.min + 1));
      items.push({ itemId: loot.itemId, quantity });
    }
  const bundle = addItemBundle(state.inventory, items, GAME_CONFIG.inventorySlots);
  if (bundle.rejected) return { ok: false, items: [] };
  state.inventory = bundle.inventory;
  for (const item of items) {
    addSummaryNumber(summary.itemsGained, item.itemId, item.quantity);
    if (!state.discoveredItems.includes(item.itemId)) state.discoveredItems.push(item.itemId);
  }
  return { ok: true, items };
};

const normalizeCombatAction = (
  state: GameState,
): Extract<ActiveAction, { type: 'combat' }> | null => {
  if (state.activeAction.type !== 'combat') return null;
  const action = state.activeAction;
  const enemy = enemyById[action.enemyId];
  if (!enemy) return null;
  const raw = action.combatState as Partial<ActiveCombatState>;
  const eliteModifier = raw.eliteModifier ?? null;
  const maxHealth = Math.max(
    1,
    Number.isFinite(raw.enemyMaxHp)
      ? Number(raw.enemyMaxHp)
      : getEnemyCombatStats(enemy, eliteModifier).maxHealth,
  );
  return {
    ...action,
    pendingStyle: action.pendingStyle ?? null,
    autoSpecial: action.autoSpecial ?? true,
    specialQueued: action.specialQueued ?? false,
    combatState: {
      enemyHp: Math.max(
        0,
        Math.min(maxHealth, Number.isFinite(raw.enemyHp) ? Number(raw.enemyHp) : maxHealth),
      ),
      enemyMaxHp: maxHealth,
      playerAttackMs: Math.max(0, Number(raw.playerAttackMs) || 0),
      enemyAttackMs: Math.max(0, Number(raw.enemyAttackMs) || 0),
      respawnMs: Math.max(0, Number(raw.respawnMs) || 0),
      rngSeed: Number.isFinite(raw.rngSeed) ? Number(raw.rngSeed) : 1,
      rngCursor: Math.max(0, Math.floor(Number(raw.rngCursor) || 0)),
      adrenaline: Math.max(
        0,
        Math.min(
          COMBAT_TUNING.adrenalineMax,
          Number(raw.adrenaline) || 0,
        ),
      ),
      enemySpecialCharge: Math.max(
        0,
        Math.min(COMBAT_TUNING.enemySpecialChargeMax, Number(raw.enemySpecialCharge) || 0),
      ),
      effects: {
        player: Array.isArray(raw.effects?.player) ? structuredClone(raw.effects.player) : [],
        enemy: Array.isArray(raw.effects?.enemy) ? structuredClone(raw.effects.enemy) : [],
      },
      eliteModifier,
      eliteAnnounced: raw.eliteAnnounced ?? true,
      traitState: {
        ...createEnemyTraitState(),
        enemyAttackCount: Math.max(0, Math.floor(raw.traitState?.enemyAttackCount ?? 0)),
        consecutiveEnemyHits: Math.max(0, Math.floor(raw.traitState?.consecutiveEnemyHits ?? 0)),
        packHunterStacks: Math.max(0, Math.floor(raw.traitState?.packHunterStacks ?? 0)),
        scrappyStacks: Math.max(0, Math.floor(raw.traitState?.scrappyStacks ?? 0)),
      },
      encounterIndex: Math.max(1, Math.floor(raw.encounterIndex ?? 1)),
      encounterStartedAt: Number.isFinite(raw.encounterStartedAt)
        ? Number(raw.encounterStartedAt)
        : state.lastSimulatedAt,
    },
  };
};

const combatEventId = (type: string, at: number, cursor: number): string =>
  `${type}-${at}-${cursor}`;
const pushBoundedEvent = (events: CombatVisualEvent[], event: CombatVisualEvent): void => {
  if (events.length >= MAX_COMBAT_VISUAL_EVENTS) events.shift();
  events.push(event);
};
const simulateCombat = (
  state: GameState,
  elapsedMs: number,
  summary: SimulationSummary,
  events: CombatVisualEvent[],
): { processedElapsedMs: number; safetyCapReached: boolean } => {
  const normalized = normalizeCombatAction(state);
  if (!normalized) {
    state.activeAction = { type: 'none' };
    summary.stoppedReason = 'That combat target is no longer available.';
    return { processedElapsedMs: elapsedMs, safetyCapReached: false };
  }
  let action = normalized;
  const enemy = enemyById[action.enemyId];
  if (!areaById[action.areaId]) {
    state.activeAction = { type: 'none' };
    summary.stoppedReason = 'That combat target is no longer available.';
    return { processedElapsedMs: elapsedMs, safetyCapReached: false };
  }
  const rng = { rngSeed: action.combatState.rngSeed, rngCursor: action.combatState.rngCursor };
  let left = elapsedMs;
  let combatState = action.combatState;
  let clock = state.lastSimulatedAt;
  let iterations = 0;
  const emit = (event: CombatVisualEvent): void => {
    pushBoundedEvent(events, event);
    if (event.type === 'player-hit' || event.type === 'player-miss') {
      summary.combatStats.playerAttacks += 1;
      if (event.type === 'player-hit') summary.combatStats.playerHits += 1;
      if (event.special) {
        summary.combatStats.specialAttempts += 1;
        if (event.type === 'player-hit') summary.combatStats.specialHits += 1;
      }
      if (event.type === 'player-hit') summary.combatStats.damageDealt += event.damage;
    } else if (
      event.type === 'enemy-hit' ||
      event.type === 'enemy-miss' ||
      event.type === 'enemy-special-hit' ||
      event.type === 'enemy-special-miss' ||
      event.type === 'enemy-special-used'
    ) {
      summary.combatStats.enemyAttacks += 1;
      if (event.type === 'enemy-hit' || event.type === 'enemy-special-hit') {
        summary.combatStats.enemyHits += 1;
        summary.combatStats.damageTaken += event.damage;
      }
    } else if (event.type === 'enemy-bleed') {
      summary.combatStats.damageTaken += event.damage;
    } else if (event.type === 'combat-effect-damage' && event.target === 'player') {
      summary.combatStats.damageTaken += event.damage;
    }
  };
  const stopForPlayerDeath = (
    at: number,
    cause:
      | { kind: 'enemy-hit'; damage: number; heavy: boolean }
      | { kind: 'enemy-special'; specialId: string; damage: number }
      | { kind: 'bleed'; damage: number }
      | {
          kind: 'combat-effect';
          effectId: string;
          sourceEnemyId?: typeof enemy.id;
          sourceSpecialId?: string;
          damage: number;
        },
  ): void => {
    state.statistics.deaths += 1;
    summary.deaths += 1;
    applyDeathRecovery(state, action.style);
    state.activeAction = { type: 'none' };
    summary.stoppedReason =
      'You were defeated and returned to the training yard with partial health.';
    emit({
      id: combatEventId('player-defeated', at, rng.rngCursor),
      type: 'player-defeated',
      enemyId: enemy.id,
      at,
    });
    appendCombatLog(state, {
      kind: 'player-defeated',
      enemyId: enemy.id,
      at,
      encounterStartedAt: combatState.encounterStartedAt,
      cause,
    });
  };
  const spawnNextEnemy = (at: number): void => {
    const style = action.pendingStyle ?? action.style;
    const spawn = initializeEnemySpawn(
      state,
      enemy.id,
      style,
      rng,
      combatState.encounterIndex + 1,
      undefined,
      combatState.adrenaline,
      at,
      combatState.effects.player,
    );
    action = { ...action, style, pendingStyle: null, specialQueued: false };
    combatState = spawn.combatState;
    appendCombatLog(state, {
      kind: 'enemy-spawned',
      enemyId: enemy.id,
      at,
      encounterStartedAt: combatState.encounterStartedAt,
      encounterIndex: combatState.encounterIndex,
    });
    if (spawn.eliteModifier) {
      emit({
        id: combatEventId('elite-spawned', at, rng.rngCursor),
        type: 'elite-spawned',
        enemyId: enemy.id,
        at,
        modifier: spawn.eliteModifier,
      });
      combatState.eliteAnnounced = true;
      appendCombatLog(state, {
        kind: 'elite-spawned',
        enemyId: enemy.id,
        at,
        encounterStartedAt: combatState.encounterStartedAt,
        modifier: spawn.eliteModifier,
      });
    }
  };
  if (combatState.eliteModifier && !combatState.eliteAnnounced) {
    emit({
      id: combatEventId('elite-spawned', clock, rng.rngCursor),
      type: 'elite-spawned',
      enemyId: enemy.id,
      at: clock,
      modifier: combatState.eliteModifier,
    });
    combatState.eliteAnnounced = true;
    appendCombatLog(state, {
      kind: 'elite-spawned',
      enemyId: enemy.id,
      at: clock,
      encounterStartedAt: combatState.encounterStartedAt,
      modifier: combatState.eliteModifier,
    });
  }
  const applyEnemySpecialEffects = (
    special: NonNullable<typeof enemy.specialAttack>,
    trigger: 'hit' | 'always',
  ): void => {
    for (const effect of special.effects ?? []) {
      if (effect.applyOn !== 'always' && effect.applyOn !== trigger) continue;
      if (effect.kind === 'player-attack-progress-pushback') {
        const effectiveInterval = getDerivedStats(state, action.style, combatState.effects.player).attackIntervalMs;
        combatState.playerAttackMs = Math.min(
          effectiveInterval,
          combatState.playerAttackMs + Math.max(0, effectiveInterval * effect.fractionOfAttackInterval),
        );
      } else if (effect.kind === 'player-attack-delay') {
        combatState.playerAttackMs += Math.max(0, effect.amountMs);
      } else if (effect.kind === 'player-attack-delay-fraction') {
        const effectiveInterval = getDerivedStats(state, action.style, combatState.effects.player).attackIntervalMs;
        combatState.playerAttackMs += Math.max(0, effectiveInterval * effect.fractionOfAttackInterval);
      } else {
        applyCombatEffect(combatState.effects, effect.effectId, effect.target, {
          sourceEnemyId: enemy.id,
          sourceSpecialId: special.id,
        });
      }
    }
  };
  const syncEnemyTraitEffects = (_at: number): void => {
    syncEnemyTraitState(enemy, combatState.traitState, combatState.enemyHp, combatState.enemyMaxHp);
  };
  const resolvePeriodicEffects = (at: number): boolean => {
    for (const tick of resolveReadyCombatEffectTicks(combatState.effects)) {
      if (tick.effect.target !== 'player') continue;
      const damage = Math.min(Math.max(0, tick.damage), state.player.currentHp);
      state.player.currentHp = Math.max(0, state.player.currentHp - damage);
      emit({
        id: combatEventId('combat-effect-damage', at, rng.rngCursor),
        type: 'combat-effect-damage',
        enemyId: enemy.id,
        effectId: tick.effect.effectId,
        damage,
        at,
        target: 'player',
      });
      appendCombatLog(state, {
        kind: 'combat-effect-damage',
        enemyId: enemy.id,
        effectId: tick.effect.effectId,
        sourceEnemyId: tick.effect.sourceEnemyId,
        sourceSpecialId: tick.effect.sourceSpecialId,
        damage,
        at,
        encounterStartedAt: combatState.encounterStartedAt,
      });
      if (state.player.currentHp <= 0) {
        stopForPlayerDeath(at, {
          kind: 'combat-effect',
          effectId: tick.effect.effectId,
          sourceEnemyId: tick.effect.sourceEnemyId,
          sourceSpecialId: tick.effect.sourceSpecialId,
          damage,
        });
        return true;
      }
    }
    return false;
  };
  while (left > 0 && iterations < MAX_COMBAT_SIMULATION_EVENTS) {
    iterations += 1;
    if (combatState.respawnMs > 0) {
      const nextEffectMs = getTimeUntilNextCombatEffectEvent(combatState.effects);
      const step = Math.min(left, combatState.respawnMs, nextEffectMs ?? Infinity);
      left -= step;
      clock += step;
      combatState.respawnMs -= step;
      advanceCombatEffects(combatState.effects, step);
      if (resolvePeriodicEffects(clock)) break;
      if (combatState.respawnMs <= 0) spawnNextEnemy(clock);
      continue;
    }
    syncEnemyTraitEffects(clock);
    const currentEnemyStats = getEnemyCombatStats(
      enemy,
      combatState.eliteModifier,
      combatState.enemyHp,
      state.player.currentHp /
        Math.max(1, getDerivedStats(state, action.style, combatState.effects.player).maxHealth),
      combatState.effects.enemy,
      combatState.effects.player,
      combatState.traitState,
    );
    const nextEffectMs = getTimeUntilNextCombatEffectEvent(combatState.effects);
    const step = Math.min(
      left,
      combatState.playerAttackMs,
      combatState.enemyAttackMs,
      nextEffectMs ?? Infinity,
    );
    left -= step;
    clock += step;
    combatState.playerAttackMs -= step;
    combatState.enemyAttackMs -= step;
    advanceCombatEffects(combatState.effects, step);
    if (combatState.playerAttackMs <= 0 && combatState.enemyHp > 0) {
      // Capture the style once so a queued style cannot affect any part of this attack.
      const attackStyle = action.style;
      const playerStats = getDerivedStats(state, attackStyle, combatState.effects.player);
      const weapon = itemById[state.equipment.weapon ?? ''];
      const special = weapon?.specialAttack;
      const useSpecial = Boolean(
        special &&
        combatState.adrenaline >= COMBAT_TUNING.adrenalineMax &&
        (action.autoSpecial || action.specialQueued),
      );
      if (useSpecial) {
        combatState.adrenaline = 0;
        action = { ...action, specialQueued: false };
      }
      const targetHpAtStart = combatState.enemyHp;
      const attackMaxHit =
        useSpecial && special
          ? Math.max(
              1,
              Math.round(
                playerStats.effectiveMaxHit *
                  special.damageMultiplier *
                  (special.executeThreshold !== undefined &&
                  targetHpAtStart / Math.max(1, combatState.enemyMaxHp) <= special.executeThreshold
                    ? (special.executeDamageMultiplier ?? 1)
                    : 1),
              ),
            )
          : playerStats.effectiveMaxHit;
      const attackAccuracy =
        playerStats.effectiveAccuracyRating *
        (useSpecial && special ? special.accuracyMultiplier : 1);
      const hit =
        nextCombatRandom(rng) < getHitChance(attackAccuracy, currentEnemyStats.defenceRating);
      if (!hit) {
        emit({
          id: combatEventId(
            useSpecial ? 'player-special-miss' : 'player-miss',
            clock,
            rng.rngCursor,
          ),
          type: 'player-miss',
          enemyId: enemy.id,
          damage: 0,
          at: clock,
          special: useSpecial,
        });
        appendCombatLog(state, {
          kind: 'player-miss',
          enemyId: enemy.id,
          at: clock,
          encounterStartedAt: combatState.encounterStartedAt,
          special: useSpecial,
        });
      } else {
        const rolled = rollDamage(attackMaxHit, nextCombatRandom(rng));
        const reduced =
          special?.ignoresFlatDamageReduction && useSpecial
            ? rolled
            : Math.max(1, rolled - currentEnemyStats.flatDamageReduction);
        const actualDamage = Math.min(reduced, combatState.enemyHp);
        combatState.enemyHp = Math.max(0, combatState.enemyHp - actualDamage);
        onEnemyDamaged(enemy, combatState.traitState, targetHpAtStart, combatState.enemyHp, combatState.enemyMaxHp);
        combatState.adrenaline = Math.min(
          COMBAT_TUNING.adrenalineMax,
          combatState.adrenaline + COMBAT_TUNING.adrenalinePerPlayerHit,
        );
        if (enemy.specialAttack)
          combatState.enemySpecialCharge = Math.min(
            COMBAT_TUNING.enemySpecialChargeMax,
            combatState.enemySpecialCharge + COMBAT_TUNING.enemySpecialChargePerDirectPlayerHitTaken,
          );
        emit({
          id: combatEventId(useSpecial ? 'player-special-hit' : 'player-hit', clock, rng.rngCursor),
          type: 'player-hit',
          enemyId: enemy.id,
          damage: actualDamage,
          at: clock,
          special: useSpecial,
        });
        appendCombatLog(state, {
          kind: 'player-hit',
          enemyId: enemy.id,
          at: clock,
          encounterStartedAt: combatState.encounterStartedAt,
          damage: actualDamage,
          special: useSpecial,
        });
        awardXp(
          state,
          summary,
          getCombatStyleSkill(attackStyle),
          getCombatDamageXp(actualDamage),
          clock,
        );
        awardXp(state, summary, 'hitpoints', getHitpointsDamageXp(actualDamage), clock);
      }
      // A queued style becomes active only after the complete player attack
      // (hit, miss, or special) has resolved. This also makes a same-timestamp
      // enemy attack observe the newly active defensive calculations below.
      if (action.pendingStyle)
        action = { ...action, style: action.pendingStyle, pendingStyle: null };
      combatState.playerAttackMs +=
        getDerivedStats(state, action.style, combatState.effects.player).attackIntervalMs;
      if (combatState.enemyHp <= 0) {
        // Resolve a lethal player event before examining the enemy timer. A dead target never retaliates.
        const eliteModifier = combatState.eliteModifier;
        summary.enemiesDefeated += 1;
        if (eliteModifier) summary.eliteEnemiesDefeated += 1;
        state.statistics.totalKills += 1;
        state.killCounts[enemy.id] = (state.killCounts[enemy.id] ?? 0) + 1;
        if (!state.discoveredMonsters.includes(enemy.id)) state.discoveredMonsters.push(enemy.id);
        const enemyRewardStats = getEnemyCombatStats(enemy, eliteModifier, 0, 1, [], [], combatState.traitState);
        const goldRange = getCombatGoldRange(enemy.id);
        const baseGold = goldRange
          ? goldRange[0] + Math.floor(nextCombatRandom(rng) * (goldRange[1] - goldRange[0] + 1))
          : 0;
        const gold = Math.max(0, Math.round(baseGold * enemyRewardStats.goldMultiplier));
        if (goldRange) {
          state.gold += gold;
          summary.goldGained += gold;
        }
        emit({
          id: combatEventId('enemy-defeated', clock, rng.rngCursor),
          type: 'enemy-defeated',
          enemyId: enemy.id,
          at: clock,
          gold,
          eliteModifier,
        });
        const loot = grantLoot(
          state,
          enemy.id,
          summary,
          rng,
          enemyRewardStats.lootChanceMultiplier,
        );
        emit({
          id: combatEventId('loot', clock, rng.rngCursor),
          type: 'loot',
          enemyId: enemy.id,
          at: clock,
          gold,
          items: loot.items,
        });
        for (const item of loot.items)
          appendCombatLog(state, {
            kind: 'loot',
            enemyId: enemy.id,
            at: clock,
            encounterStartedAt: combatState.encounterStartedAt,
            itemId: item.itemId,
            quantity: item.quantity,
          });
        if (goldRange)
          appendCombatLog(state, {
            kind: 'gold',
            enemyId: enemy.id,
            at: clock,
            encounterStartedAt: combatState.encounterStartedAt,
            amount: gold,
          });
        appendCombatLog(state, {
          kind: 'enemy-defeated',
          enemyId: enemy.id,
          at: clock,
          encounterStartedAt: combatState.encounterStartedAt,
          gold,
          eliteModifier,
        });
        if (!loot.ok) {
          state.activeAction = { type: 'none' };
          summary.stoppedReason =
            'Inventory is full; combat paused before loot could be collected.';
          break;
        }
        combatState.traitState = createEnemyTraitState();
        if (action.autoRepeat) {
          combatState.respawnMs = GAME_CONFIG.respawnMs;
          combatState.enemyHp = 0;
          action = { ...action, specialQueued: false };
          continue;
        }
        state.activeAction = { type: 'none' };
        break;
      }
    }
    syncEnemyTraitEffects(clock);
    if (combatState.enemyHp > 0 && resolvePeriodicEffects(clock)) break;
    if (combatState.enemyAttackMs <= 0 && combatState.enemyHp > 0) {
      const enemyStats = getEnemyCombatStats(
        enemy,
        combatState.eliteModifier,
        combatState.enemyHp,
        state.player.currentHp /
          Math.max(1, getDerivedStats(state, action.style, combatState.effects.player).maxHealth),
        combatState.effects.enemy,
        combatState.effects.player,
        combatState.traitState,
      );
      const special = enemy.specialAttack;
      let enemyAttackHit = false;
      const useSpecial = Boolean(
        special && combatState.enemySpecialCharge >= COMBAT_TUNING.enemySpecialChargeMax,
      );
      if (useSpecial && special) {
        combatState.enemySpecialCharge = 0;
        if (special.delivery === 'self') {
          applyEnemySpecialEffects(special, 'always');
          emit({
            id: combatEventId('enemy-special-used', clock, rng.rngCursor),
            type: 'enemy-special-used',
            enemyId: enemy.id,
            specialId: special.id,
            at: clock,
          });
          appendCombatLog(state, {
            kind: 'enemy-special-used',
            enemyId: enemy.id,
            specialId: special.id,
            at: clock,
            encounterStartedAt: combatState.encounterStartedAt,
          });
        } else {
          const hit =
            nextCombatRandom(rng) <
            getHitChance(
              enemyStats.accuracyRating * (special.accuracyMultiplier ?? 1),
              getDerivedStats(state, action.style, combatState.effects.player).effectiveDefenceRating,
            );
          if (!hit) {
            applyEnemySpecialEffects(special, 'always');
            emit({
              id: combatEventId('enemy-special-miss', clock, rng.rngCursor),
              type: 'enemy-special-miss',
              enemyId: enemy.id,
              specialId: special.id,
              at: clock,
            });
            appendCombatLog(state, {
              kind: 'enemy-special-miss',
              enemyId: enemy.id,
              specialId: special.id,
              at: clock,
              encounterStartedAt: combatState.encounterStartedAt,
            });
          } else {
            const playerHealthPercent = state.player.currentHp /
              Math.max(1, getDerivedStats(state, action.style, combatState.effects.player).maxHealth);
            const conditionalMultiplier = special.playerHealthThreshold !== undefined &&
              playerHealthPercent <= special.playerHealthThreshold
              ? special.conditionalDamageMultiplier ?? 1
              : 1;
            const maxHit = Math.max(1, Math.round(enemyStats.maxHit * (special.damageMultiplier ?? 1) * conditionalMultiplier));
            const actualDamage = Math.min(rollDamage(maxHit, nextCombatRandom(rng)), state.player.currentHp);
            enemyAttackHit = true;
            state.player.currentHp = Math.max(0, state.player.currentHp - actualDamage);
            combatState.adrenaline = Math.min(
              COMBAT_TUNING.adrenalineMax,
              combatState.adrenaline +
                (actualDamage > 0 ? COMBAT_TUNING.adrenalinePerDirectDamageTaken : 0),
            );
            applyEnemySpecialEffects(special, 'hit');
            emit({
              id: combatEventId('enemy-special-hit', clock, rng.rngCursor),
              type: 'enemy-special-hit',
              enemyId: enemy.id,
              specialId: special.id,
              damage: actualDamage,
              at: clock,
            });
            appendCombatLog(state, {
              kind: 'enemy-special-hit',
              enemyId: enemy.id,
              specialId: special.id,
              damage: actualDamage,
              at: clock,
              encounterStartedAt: combatState.encounterStartedAt,
            });
            if (state.player.currentHp <= 0) {
              stopForPlayerDeath(clock, {
                kind: 'enemy-special',
                specialId: special.id,
                damage: actualDamage,
              });
              break;
            }
          }
        }
      } else {
        const hit =
          nextCombatRandom(rng) <
          getHitChance(
            enemyStats.accuracyRating,
            getDerivedStats(state, action.style, combatState.effects.player).effectiveDefenceRating,
          );
        if (!hit) {
          emit({
            id: combatEventId('enemy-miss', clock, rng.rngCursor),
            type: 'enemy-miss',
            enemyId: enemy.id,
            damage: 0,
            at: clock,
          });
          appendCombatLog(state, {
            kind: 'enemy-miss',
            enemyId: enemy.id,
            at: clock,
            encounterStartedAt: combatState.encounterStartedAt,
          });
        } else {
          const actualDamage = Math.min(rollDamage(enemyStats.maxHit, nextCombatRandom(rng)), state.player.currentHp);
          state.player.currentHp = Math.max(0, state.player.currentHp - actualDamage);
          combatState.adrenaline = Math.min(
            COMBAT_TUNING.adrenalineMax,
            combatState.adrenaline +
              (actualDamage > 0 ? COMBAT_TUNING.adrenalinePerDirectDamageTaken : 0),
          );
          emit({
            id: combatEventId('enemy-hit', clock, rng.rngCursor),
            type: 'enemy-hit',
            enemyId: enemy.id,
            damage: actualDamage,
            at: clock,
          });
          appendCombatLog(state, {
            kind: 'enemy-hit',
            enemyId: enemy.id,
            at: clock,
            encounterStartedAt: combatState.encounterStartedAt,
            damage: actualDamage,
            heavy: false,
          });
          if (enemy.specialAttack)
            combatState.enemySpecialCharge = Math.min(
              COMBAT_TUNING.enemySpecialChargeMax,
              combatState.enemySpecialCharge + COMBAT_TUNING.enemySpecialChargePerNormalAttack,
            );
          enemyAttackHit = true;
          if (state.player.currentHp <= 0) {
            stopForPlayerDeath(clock, { kind: 'enemy-hit', damage: actualDamage, heavy: false });
            break;
          }
        }
        if (!hit && enemy.specialAttack)
          combatState.enemySpecialCharge = Math.min(
            COMBAT_TUNING.enemySpecialChargeMax,
            combatState.enemySpecialCharge + COMBAT_TUNING.enemySpecialChargePerNormalAttack,
          );
      }
      onEnemyAttackResolved(enemy, combatState.traitState, enemyAttackHit);
      combatState.enemyAttackMs +=
        getEnemyCombatStats(
          enemy,
          combatState.eliteModifier,
          combatState.enemyHp,
          state.player.currentHp /
            Math.max(1, getDerivedStats(state, action.style, combatState.effects.player).maxHealth),
          combatState.effects.enemy,
          combatState.effects.player,
          combatState.traitState,
        ).attackIntervalMs;
    }
  }
  const safetyCapReached = iterations >= MAX_COMBAT_SIMULATION_EVENTS && left > 0;
  if (safetyCapReached) summary.stoppedReason = 'Combat event cap reached safely.';
  if (state.activeAction.type === 'combat') {
    state.activeAction = {
      ...action,
      combatState: {
        ...combatState,
        rngSeed: rng.rngSeed,
        rngCursor: rng.rngCursor,
        adrenaline: Math.max(0, Math.min(COMBAT_TUNING.adrenalineMax, combatState.adrenaline)),
        enemySpecialCharge: Math.max(
          0,
          Math.min(COMBAT_TUNING.enemySpecialChargeMax, combatState.enemySpecialCharge),
        ),
        effects: combatState.effects,
      },
    };
  }
  return {
    processedElapsedMs: safetyCapReached ? elapsedMs - left : elapsedMs,
    safetyCapReached,
  };
};

export const simulateElapsed = (
  input: GameState,
  elapsedMs: number,
  options: { ignoreMiningLevel?: boolean } = {},
): { state: GameState; summary: SimulationSummary; events: CombatVisualEvent[] } => {
  const safeElapsed = Math.max(0, Math.min(GAME_CONFIG.offlineCapMs, Math.floor(elapsedMs)));
  const state = clone(input);
  const startedInCombat = state.activeAction.type === 'combat';
  const summary = emptySummary(safeElapsed);
  summary.offlineContext =
    state.activeAction.type === 'mining'
      ? { activity: 'mining', miningNodeId: state.activeAction.nodeId }
      : state.activeAction.type === 'smithing'
        ? { activity: 'smithing', recipeId: state.activeAction.recipeId }
        : state.activeAction.type === 'combat'
          ? { activity: 'combat', enemyId: state.activeAction.enemyId }
          : { activity: 'idle' };
  const events: CombatVisualEvent[] = [];
  if (safeElapsed === 0) {
    summary.processedElapsedMs = 0;
    summary.remainingElapsedMs = 0;
    return { state, summary, events };
  }
  let processedElapsedMs = safeElapsed;
  switch (state.activeAction.type) {
    case 'mining':
      processedElapsedMs = simulateMining(
        state,
        safeElapsed,
        summary,
        options.ignoreMiningLevel ?? false,
      );
      break;
    case 'smithing':
      simulateSmithing(state, safeElapsed, summary);
      break;
    case 'combat':
      processedElapsedMs = simulateCombat(state, safeElapsed, summary, events).processedElapsedMs;
      break;
    default:
      break;
  }
  if (!startedInCombat) applyOutOfCombatHealthRecovery(state, processedElapsedMs);
  summary.processedElapsedMs = processedElapsedMs;
  summary.remainingElapsedMs = Math.max(0, safeElapsed - processedElapsedMs);
  summary.elapsedMs = processedElapsedMs;
  state.lastSimulatedAt += processedElapsedMs;
  state.updatedAt = Date.now();
  return { state, summary, events };
};

export const getTimeUntilNextCombatEvent = (state: GameState): number | null => {
  if (state.activeAction.type !== 'combat') return null;
  const combatState = state.activeAction.combatState;
  if (combatState.respawnMs > 0) return Math.max(1, combatState.respawnMs);
  const timers = [combatState.playerAttackMs, combatState.enemyAttackMs];
  if (timers.some((timer) => timer <= 0)) return 1;
  const next = Math.min(...timers.filter((timer) => Number.isFinite(timer) && timer > 0));
  return Number.isFinite(next) ? Math.max(1, next) : 1;
};

export const progressRatio = (action: ActiveAction, now: number, state: GameState): number => {
  if (action.type === 'mining') {
    const node = miningNodeById[action.nodeId];
    if (!node) return 0;
    if (action.phase === 'rest')
      return action.progressMs / Math.max(1, MINING_TUNING.restDurationMs);
    if (action.phase === 'respawn') {
      const runtime = state.mining.nodeStates[action.nodeId];
      return runtime ? 1 - runtime.respawnRemainingMs / Math.max(1, node.respawnMs) : 0;
    }
    return action.progressMs / Math.max(1, getMiningTool(state).swingIntervalMs);
  }
  if (action.type === 'smithing') {
    const recipe = recipeById[action.recipeId];
    return recipe
      ? action.progressMs / Math.max(1, getSmithingEffectiveInterval(state, recipe))
      : 0;
  }
  if (action.type === 'combat') {
    const enemy = enemyById[action.enemyId];
    return enemy
      ? 1 -
          action.combatState.enemyHp / Math.max(1, action.combatState.enemyMaxHp ?? enemy.maxHealth)
      : 0;
  }
  void now;
  return 0;
};
