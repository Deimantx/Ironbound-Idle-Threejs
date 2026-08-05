import { GAME_CONFIG } from '../../config/gameConfig';
import { areaById } from '../../content/areas';
import { enemyById } from '../../content/enemies';
import { eliteById } from '../../content/elites';
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
import { initializeEnemySpawn } from './combatEncounter';
import { addSkillXp } from '../formulas/experienceFormulas';
import { getDerivedStats } from '../formulas/statFormulas';
import { addItem, canAddItem, getItemQuantity, removeItem } from '../systems/inventorySystem';
import type {
  ActiveAction,
  ActiveCombatState,
  CombatVisualEvent,
  GameState,
  SkillId,
  SimulationSummary,
} from '../types';
import { emptySummary } from '../types';

const clone = (state: GameState): GameState => structuredClone(state);
const MAX_COMBAT_SIMULATION_EVENTS = 100_000;
const MAX_COMBAT_VISUAL_EVENTS = 64;
const addLog = (
  state: GameState,
  text: string,
  tone: GameState['log'][number]['tone'] = 'neutral',
  at = Date.now(),
  combatEncounterStartedAt?: number,
): void => {
  state.log = [
    { id: `${at}-${state.log.length}-${text}`, at, text, tone, combatEncounterStartedAt },
    ...state.log,
  ].slice(0, 80);
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
  rng: { rngSeed: number; rngCursor: number },
  lootChanceMultiplier = 1,
): { ok: boolean; items: Array<{ itemId: string; quantity: number }> } => {
  const enemy = enemyById[enemyId];
  if (!enemy) return { ok: true, items: [] };
  const items: Array<{ itemId: string; quantity: number }> = [];
  for (const loot of enemy.loot)
    if (nextCombatRandom(rng) <= Math.min(1, loot.chance * lootChanceMultiplier)) {
      const quantity =
        loot.min + Math.floor(nextCombatRandom(rng) * (loot.max - loot.min + 1));
      const added = addItem(state.inventory, loot.itemId, quantity, GAME_CONFIG.inventorySlots);
      if (added.rejected) return { ok: false, items };
      state.inventory = added.inventory;
      items.push({ itemId: loot.itemId, quantity });
      addSummaryNumber(summary.itemsGained, loot.itemId, quantity);
      if (!state.discoveredItems.includes(loot.itemId)) state.discoveredItems.push(loot.itemId);
    }
  return { ok: true, items };
};

const normalizeCombatAction = (state: GameState): Extract<ActiveAction, { type: 'combat' }> | null => {
  if (state.activeAction.type !== 'combat') return null;
  const action = state.activeAction;
  const enemy = enemyById[action.enemyId];
  if (!enemy) return null;
  const raw = action.combatState as Partial<ActiveCombatState>;
  const eliteModifier = raw.eliteModifier ?? null;
  const maxHealth = Math.max(
    1,
    Number.isFinite(raw.enemyMaxHp) ? Number(raw.enemyMaxHp) : getEnemyCombatStats(enemy, eliteModifier).maxHealth,
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
      momentum: Math.max(0, Math.min(COMBAT_TUNING.momentumMax, Number(raw.momentum) || 0)),
      eliteModifier,
      eliteAnnounced: raw.eliteAnnounced ?? true,
      traitState: {
        firstAttackPending: raw.traitState?.firstAttackPending ?? enemy.trait.id === 'scurry',
        enemyAttackCount: Math.max(0, Math.floor(raw.traitState?.enemyAttackCount ?? 0)),
        bleedStacks: Math.max(0, Math.min(COMBAT_TUNING.wolfMaxBleedStacks, Math.floor(raw.traitState?.bleedStacks ?? 0))),
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
const getEliteModifierDisplayName = (modifier: keyof typeof eliteById): string =>
  eliteById[modifier]?.name ?? modifier;

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
  const addCombatLog = (
    text: string,
    tone: GameState['log'][number]['tone'],
    at: number,
  ): void => addLog(state, text, tone, at, combatState.encounterStartedAt);
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
    } else if (event.type === 'enemy-hit' || event.type === 'enemy-miss') {
      summary.combatStats.enemyAttacks += 1;
      if (event.type === 'enemy-hit') {
        summary.combatStats.enemyHits += 1;
        summary.combatStats.damageTaken += event.damage;
      }
    } else if (event.type === 'enemy-bleed') {
      summary.combatStats.damageTaken += event.damage;
    }
  };
  const stopForPlayerDeath = (at: number, cause: string): void => {
    state.statistics.deaths += 1;
    summary.deaths += 1;
    state.player.currentHp = getDerivedStats(state, action.style).maxHealth;
    state.activeAction = { type: 'none' };
    summary.stoppedReason = 'You were defeated and returned safely to the training yard.';
    emit({
      id: combatEventId('player-defeated', at, rng.rngCursor),
      type: 'player-defeated',
      enemyId: enemy.id,
      at,
    });
    addCombatLog('You were defeated. Your belongings are safe.', 'danger', at);
    addCombatLog(`You were killed by ${enemy.name} ${cause}.`, 'danger', at);
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
      combatState.momentum,
      at,
    );
    action = { ...action, style, pendingStyle: null, specialQueued: false };
    combatState = spawn.combatState;
    if (spawn.eliteModifier) {
      emit({
        id: combatEventId('elite-spawned', at, rng.rngCursor),
        type: 'elite-spawned',
        enemyId: enemy.id,
        at,
        modifier: spawn.eliteModifier,
      });
      combatState.eliteAnnounced = true;
      addCombatLog(`${enemy.name} spawned as a ${getEliteModifierDisplayName(spawn.eliteModifier)} elite.`, 'warning', at);
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
  }
  while (left > 0 && iterations < MAX_COMBAT_SIMULATION_EVENTS) {
    iterations += 1;
    if (combatState.respawnMs > 0) {
      const step = Math.min(left, combatState.respawnMs);
      left -= step;
      clock += step;
      combatState.respawnMs -= step;
      if (combatState.respawnMs <= 0) spawnNextEnemy(clock);
      continue;
    }
    const currentEnemyStats = getEnemyCombatStats(enemy, combatState.eliteModifier, combatState.enemyHp);
    const step = Math.min(
      left,
      Math.max(1, Math.min(combatState.playerAttackMs || Infinity, combatState.enemyAttackMs || Infinity)),
    );
    left -= step;
    clock += step;
    combatState.playerAttackMs -= step;
    combatState.enemyAttackMs -= step;
    if (combatState.playerAttackMs <= 0 && combatState.enemyHp > 0) {
      const playerStats = getDerivedStats(state, action.style);
      const weapon = itemById[state.equipment.weapon ?? ''];
      const special = weapon?.specialAttack;
      const useSpecial = Boolean(
        special &&
          combatState.momentum >= COMBAT_TUNING.momentumMax &&
          (action.autoSpecial || action.specialQueued),
      );
      if (useSpecial) {
        combatState.momentum = 0;
        action = { ...action, specialQueued: false };
      }
      const targetHpAtStart = combatState.enemyHp;
      const attackMaxHit = useSpecial && special
        ? Math.max(
            1,
            Math.round(
              playerStats.effectiveMaxHit *
                special.damageMultiplier *
                (special.executeThreshold !== undefined &&
                targetHpAtStart / Math.max(1, combatState.enemyMaxHp) <= special.executeThreshold
                  ? special.executeDamageMultiplier ?? 1
                  : 1),
            ),
          )
        : playerStats.effectiveMaxHit;
      const attackAccuracy = playerStats.effectiveAccuracyRating * (useSpecial && special ? special.accuracyMultiplier : 1);
      const hit = nextCombatRandom(rng) < getHitChance(attackAccuracy, currentEnemyStats.defenceRating);
      if (!hit) {
        emit({
          id: combatEventId(useSpecial ? 'player-special-miss' : 'player-miss', clock, rng.rngCursor),
          type: 'player-miss',
          enemyId: enemy.id,
          damage: 0,
          at: clock,
          special: useSpecial,
        });
        addCombatLog(`You missed ${enemy.name}.`, 'neutral', clock);
      } else {
        const rolled = rollDamage(attackMaxHit, nextCombatRandom(rng));
        const reduced = special?.ignoresFlatDamageReduction && useSpecial
          ? rolled
          : Math.max(1, rolled - currentEnemyStats.flatDamageReduction);
        const actualDamage = Math.min(reduced, combatState.enemyHp);
        combatState.enemyHp = Math.max(0, combatState.enemyHp - actualDamage);
        combatState.momentum = Math.min(
          COMBAT_TUNING.momentumMax,
          combatState.momentum + COMBAT_TUNING.momentumPerPlayerHit,
        );
        emit({
          id: combatEventId(useSpecial ? 'player-special-hit' : 'player-hit', clock, rng.rngCursor),
          type: 'player-hit',
          enemyId: enemy.id,
          damage: actualDamage,
          at: clock,
          special: useSpecial,
        });
        addCombatLog(`You hit ${enemy.name} for ${actualDamage}${useSpecial ? ' with a special' : ''}.`, 'neutral', clock);
        awardXp(state, summary, getCombatStyleSkill(action.style), getCombatDamageXp(actualDamage));
        awardXp(state, summary, 'hitpoints', getHitpointsDamageXp(actualDamage));
      }
      combatState.playerAttackMs += getDerivedStats(state, action.style).attackIntervalMs;
      if (combatState.enemyHp <= 0) {
        // Resolve a lethal player event before examining the enemy timer. A dead target never retaliates.
        const eliteModifier = combatState.eliteModifier;
        summary.enemiesDefeated += 1;
        if (eliteModifier) summary.eliteEnemiesDefeated += 1;
        state.statistics.totalKills += 1;
        state.killCounts[enemy.id] = (state.killCounts[enemy.id] ?? 0) + 1;
        if (!state.discoveredMonsters.includes(enemy.id)) state.discoveredMonsters.push(enemy.id);
        const enemyRewardStats = getEnemyCombatStats(enemy, eliteModifier, 0);
        const baseGold = enemy.gold[0] + Math.floor(nextCombatRandom(rng) * (enemy.gold[1] - enemy.gold[0] + 1));
        const gold = Math.max(0, Math.round(baseGold * enemyRewardStats.goldMultiplier));
        state.gold += gold;
        summary.goldGained += gold;
        emit({
          id: combatEventId('enemy-defeated', clock, rng.rngCursor),
          type: 'enemy-defeated',
          enemyId: enemy.id,
          at: clock,
          gold,
          eliteModifier,
        });
        const loot = grantLoot(state, enemy.id, summary, rng, enemyRewardStats.lootChanceMultiplier);
        emit({
          id: combatEventId('loot', clock, rng.rngCursor),
          type: 'loot',
          enemyId: enemy.id,
          at: clock,
          gold,
          items: loot.items,
        });
        const lootText = loot.items.length
          ? ` Received ${loot.items.map((entry) => `${entry.quantity} ${itemById[entry.itemId]?.name ?? entry.itemId}`).join(', ')}.`
          : '';
        addCombatLog(
          `${eliteModifier ? `${getEliteModifierDisplayName(eliteModifier)} ` : ''}${enemy.name} defeated. +${gold} gold.${lootText}`,
          'success',
          clock,
        );
        if (!loot.ok) {
          state.activeAction = { type: 'none' };
          summary.stoppedReason = 'Inventory is full; combat paused before loot could be collected.';
          break;
        }
        combatState.traitState = { firstAttackPending: false, enemyAttackCount: 0, bleedStacks: 0 };
        if (action.autoRepeat) {
          state.player.currentHp = getDerivedStats(state, action.style).maxHealth;
          combatState.respawnMs = GAME_CONFIG.respawnMs;
          combatState.enemyHp = 0;
          action = { ...action, specialQueued: false };
          continue;
        }
        state.activeAction = { type: 'none' };
        break;
      }
    }
    if (combatState.enemyAttackMs <= 0 && combatState.enemyHp > 0) {
      if (enemy.trait.id === 'bleeding-bites' && combatState.traitState.bleedStacks > 0) {
        const bleedDamage = Math.min(
          state.player.currentHp,
          combatState.traitState.bleedStacks * COMBAT_TUNING.wolfBleedDamagePerStack,
        );
        combatState.traitState.bleedStacks = Math.max(0, combatState.traitState.bleedStacks - 1);
        state.player.currentHp = Math.max(0, state.player.currentHp - bleedDamage);
        emit({
          id: combatEventId('enemy-bleed', clock, rng.rngCursor),
          type: 'enemy-bleed',
          enemyId: enemy.id,
          damage: bleedDamage,
          at: clock,
        });
        if (state.player.currentHp <= 0) {
          stopForPlayerDeath(clock, `from bleeding bites for ${bleedDamage} damage`);
          break;
        }
      }
      combatState.traitState.enemyAttackCount += 1;
      const heavy = enemy.trait.id === 'heavy-strike' &&
        combatState.traitState.enemyAttackCount % COMBAT_TUNING.banditHeavyAttackEvery === 0;
      const enemyStats = getEnemyCombatStats(enemy, combatState.eliteModifier, combatState.enemyHp);
      const hit = nextCombatRandom(rng) < getHitChance(enemyStats.accuracyRating, getDerivedStats(state, action.style).effectiveDefenceRating);
      if (!hit) {
        emit({
          id: combatEventId('enemy-miss', clock, rng.rngCursor),
          type: 'enemy-miss',
          enemyId: enemy.id,
          damage: 0,
          at: clock,
        });
        addCombatLog(`${enemy.name} missed you.`, 'neutral', clock);
      } else {
        const maxHit = heavy
          ? Math.max(1, Math.round(enemyStats.maxHit * COMBAT_TUNING.banditHeavyMaxHitMultiplier))
          : enemyStats.maxHit;
        const rolled = rollDamage(maxHit, nextCombatRandom(rng));
        const actualDamage = Math.min(rolled, state.player.currentHp);
        state.player.currentHp = Math.max(0, state.player.currentHp - actualDamage);
        combatState.momentum = Math.min(
          COMBAT_TUNING.momentumMax,
          combatState.momentum + (actualDamage > 0 ? COMBAT_TUNING.momentumPerDirectDamageTaken : 0),
        );
        emit({
          id: combatEventId('enemy-hit', clock, rng.rngCursor),
          type: 'enemy-hit',
          enemyId: enemy.id,
          damage: actualDamage,
          at: clock,
        });
        addCombatLog(`${enemy.name} hit you for ${actualDamage}${heavy ? ' with a heavy strike' : ''}.`, 'danger', clock);
        if (enemy.trait.id === 'bleeding-bites' && nextCombatRandom(rng) < COMBAT_TUNING.wolfBleedChance)
          combatState.traitState.bleedStacks = Math.min(
            COMBAT_TUNING.wolfMaxBleedStacks,
            combatState.traitState.bleedStacks + 1,
          );
        if (state.player.currentHp <= 0) {
          stopForPlayerDeath(
            clock,
            `with a hit for ${actualDamage}${heavy ? ' from a heavy strike' : ''}`,
          );
          break;
        }
      }
      combatState.traitState.firstAttackPending = false;
      combatState.enemyAttackMs += getEnemyCombatStats(enemy, combatState.eliteModifier, combatState.enemyHp).attackIntervalMs;
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
        momentum: Math.max(0, Math.min(COMBAT_TUNING.momentumMax, combatState.momentum)),
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
): { state: GameState; summary: SimulationSummary; events: CombatVisualEvent[] } => {
  const safeElapsed = Math.max(0, Math.min(GAME_CONFIG.offlineCapMs, Math.floor(elapsedMs)));
  const state = clone(input);
  const summary = emptySummary(safeElapsed);
  const events: CombatVisualEvent[] = [];
  if (safeElapsed === 0) {
    summary.processedElapsedMs = 0;
    summary.remainingElapsedMs = 0;
    return { state, summary, events };
  }
  let processedElapsedMs = safeElapsed;
  switch (state.activeAction.type) {
    case 'mining':
      simulateMining(state, safeElapsed, summary);
      break;
    case 'smithing':
      simulateSmithing(state, safeElapsed, summary);
      break;
    case 'combat':
      processedElapsedMs = simulateCombat(state, safeElapsed, summary, events).processedElapsedMs;
      break;
    default:
      if (state.player.currentHp < getDerivedStats(state).maxHealth)
        state.player.currentHp = Math.min(
          getDerivedStats(state).maxHealth,
          state.player.currentHp + Math.floor(safeElapsed / 5000),
        );
  }
  summary.processedElapsedMs = processedElapsedMs;
  summary.remainingElapsedMs = Math.max(0, safeElapsed - processedElapsedMs);
  summary.elapsedMs = processedElapsedMs;
  unlockAreas(state);
  state.lastSimulatedAt += processedElapsedMs;
  state.updatedAt = Date.now();
  return { state, summary, events };
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
    return enemy ? 1 - action.combatState.enemyHp / Math.max(1, action.combatState.enemyMaxHp ?? enemy.maxHealth) : 0;
  }
  void now;
  return 0;
};
