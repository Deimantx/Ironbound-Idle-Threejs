import { GAME_CONFIG } from '../../config/gameConfig';
import { AREAS, areaById } from '../../content/areas';
import { ENEMIES, enemyById } from '../../content/enemies';
import { ITEMS, itemById } from '../../content/items';
import { MINING_NODES, miningNodeById } from '../../content/miningNodes';
import { RECIPES, recipeById } from '../../content/recipes';
import { MAX_LEVEL, getLevelFromXp, getXpForLevel } from '../formulas/experienceFormulas';
import { getDerivedStats } from '../formulas/statFormulas';
import { simulateElapsed } from '../engine/simulation';
import { startCombat, startMining, startSmithing } from '../engine/actionController';
import { createNewGame } from '../state/initialState';
import { equipItem, unequipItem } from '../systems/equipmentSystem';
import {
  addItem,
  destroyItem,
  getItemQuantity,
  toggleItemLock,
  occupiedSlots,
} from '../systems/inventorySystem';
import { ACTIVE_EQUIPMENT_SLOTS, EQUIPMENT_SLOT_LABELS } from '../equipmentSlots';
import { migrateSave } from '../persistence/migrations';
import type {
  AreaId,
  CombatStyle,
  EquipmentSlot,
  GameState,
  MiningNodeId,
  QuantityMode,
  SkillId,
} from '../types';
import type { DebugActionResult, DebugMutation, DebugPresetId, DebugRuntime } from './debugTypes';
import { applyDebugPreset } from './debugPresets';

export type { DebugActionResult, DebugMutation, DebugPresetId } from './debugTypes';

export const DEBUG_MAX_INTEGER = 999_999_999;

export const parseDebugInteger = (
  value: unknown,
  minimum = 0,
  maximum = DEBUG_MAX_INTEGER,
): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const integer = Math.floor(value);
    return integer >= minimum && integer <= maximum ? integer : null;
  }
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return null;
  return parsed >= minimum && parsed <= maximum ? parsed : null;
};

export const clampDebugInteger = (
  value: unknown,
  minimum: number,
  maximum: number,
  fallback = minimum,
): number => {
  const parsed = parseDebugInteger(value, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
  return Math.min(maximum, Math.max(minimum, parsed ?? fallback));
};

const success = (message: string, details?: string[]): DebugActionResult => ({
  ok: true,
  message,
  details,
});
const failure = (message: string, details?: string[]): DebugActionResult => ({
  ok: false,
  message,
  details,
});

const normalizeAfterMutation = (state: GameState, clampHealth = true): GameState => {
  const next = { ...state, updatedAt: Date.now(), schemaVersion: GAME_CONFIG.currentSaveVersion };
  if (clampHealth) {
    next.player = {
      ...next.player,
      currentHp: Math.min(next.player.currentHp, getDerivedStats(next).maxHealth),
    };
  }
  return next;
};

const mutate = (
  state: GameState,
  message: string,
  callback: (next: GameState) => void,
  options: { clampHealth?: boolean; details?: string[]; save?: boolean } = {},
): DebugMutation => {
  const next = structuredClone(state);
  callback(next);
  return {
    result: success(message, options.details),
    state: normalizeAfterMutation(next, options.clampHealth ?? true),
    save: options.save,
  };
};

const withItem = (itemId: string): DebugActionResult | null =>
  itemById[itemId] ? null : failure(`Unknown item ID: ${itemId}.`);

const withSkill = (skillId: SkillId): DebugActionResult | null =>
  skillId in createNewGame(0, 'Debug').skills ? null : failure(`Unknown skill: ${skillId}.`);

const withGame = (
  state: GameState | null,
  operation: (game: GameState) => DebugMutation,
): DebugMutation =>
  state ? operation(state) : { result: failure('No active profile is loaded.') };

const addDebugItem = (state: GameState, itemId: string, quantity: number): DebugMutation => {
  const itemError = withItem(itemId);
  if (itemError) return { result: itemError };
  const amount = parseDebugInteger(quantity, 1);
  if (amount === null) return { result: failure('Quantity must be a positive integer.') };
  return mutate(
    state,
    `Added ${itemById[itemId].name} ×${amount}.`,
    (next) => {
      const result = addItem(next.inventory, itemId, amount, GAME_CONFIG.inventorySlots);
      next.inventory = result.inventory;
      if (result.rejected && result.added === 0)
        throw new Error('Inventory is full and cannot accept that item.');
    },
    { details: ['Normal inventory capacity and stack merging were used.'] },
  );
};

export const debugAddItem = (state: GameState, itemId: string, quantity: number): DebugMutation => {
  try {
    return addDebugItem(state, itemId, quantity);
  } catch (cause) {
    return { result: failure(cause instanceof Error ? cause.message : 'Unable to add item.') };
  }
};

export const debugRemoveQuantity = (
  state: GameState,
  itemId: string,
  quantity: number,
): DebugMutation => {
  const itemError = withItem(itemId);
  if (itemError) return { result: itemError };
  const amount = parseDebugInteger(quantity, 1);
  if (amount === null) return { result: failure('Quantity must be a positive integer.') };
  const current = getItemQuantity(state.inventory, itemId);
  if (!current) return { result: failure('That item is not in the inventory.') };
  const actual = Math.min(amount, current);
  const result = destroyItem(state.inventory, itemId, actual);
  if (result.rejected) return { result: failure('That stack is locked or unavailable.') };
  return mutate(
    state,
    `Removed ${itemById[itemId].name} ×${actual}.`,
    (next) => {
      next.inventory = result.inventory;
    },
    { details: amount > current ? [`Quantity was clamped to ${current}.`] : undefined },
  );
};

export const debugRemoveStack = (state: GameState, itemId: string): DebugMutation =>
  debugRemoveQuantity(state, itemId, getItemQuantity(state.inventory, itemId));

export const debugToggleLock = (state: GameState, itemId: string): DebugMutation => {
  if (!getItemQuantity(state.inventory, itemId))
    return { result: failure('That item is not in the inventory.') };
  return mutate(state, `Toggled the lock on ${itemById[itemId]?.name ?? itemId}.`, (next) => {
    next.inventory = toggleItemLock(next.inventory, itemId);
  });
};

const appendRepeatedValidStacks = (inventory: GameState['inventory']): GameState['inventory'] => {
  const next = inventory.map((stack) => ({ ...stack }));
  const fillerItems = ITEMS.filter((item) => !item.slot);
  let itemIndex = 0;
  while (occupiedSlots(next) < GAME_CONFIG.inventorySlots) {
    const item = fillerItems[itemIndex % fillerItems.length] ?? ITEMS[itemIndex % ITEMS.length];
    next.push({ itemId: item.id, quantity: 1, locked: false });
    itemIndex += 1;
  }
  return next;
};

export const debugFillInventory = (state: GameState): DebugMutation =>
  mutate(
    state,
    `Filled Inventory to ${GAME_CONFIG.inventorySlots} occupied slots.`,
    (next) => {
      next.inventory = appendRepeatedValidStacks(next.inventory);
    },
    {
      details: [
        'Only current registry item IDs were used.',
        'Existing stacks and order were preserved.',
      ],
    },
  );

export const debugClearInventory = (state: GameState): DebugMutation =>
  mutate(state, 'Cleared all Inventory stacks.', (next) => {
    next.inventory = [];
  });

export const debugSetAllLocks = (state: GameState, locked: boolean): DebugMutation =>
  mutate(
    state,
    locked ? 'Locked all Inventory stacks.' : 'Unlocked all Inventory stacks.',
    (next) => {
      next.inventory = next.inventory.map((stack) => ({ ...stack, locked }));
    },
  );

export const debugDiscoverAllItems = (state: GameState): DebugMutation =>
  mutate(state, 'Discovered all current items.', (next) => {
    next.discoveredItems = ITEMS.map((item) => item.id);
  });

export const debugResetDiscoveries = (state: GameState): DebugMutation =>
  mutate(state, 'Reset item discoveries.', (next) => {
    next.discoveredItems = [];
  });

export const debugForceAddIgnoringCapacity = (
  state: GameState,
  itemId: string,
  quantity: number,
): DebugMutation => {
  const itemError = withItem(itemId);
  if (itemError) return { result: itemError };
  const amount = parseDebugInteger(quantity, 1);
  if (amount === null) return { result: failure('Quantity must be a positive integer.') };
  return mutate(
    state,
    `Force-added ${itemById[itemId].name} ×${amount}.`,
    (next) => {
      const existing = next.inventory.find((stack) => stack.itemId === itemId);
      if (existing) existing.quantity += amount;
      else next.inventory.push({ itemId, quantity: amount, locked: false });
    },
    {
      details: [
        'Capacity was intentionally ignored.',
        'This action is for edge-case testing only.',
      ],
    },
  );
};

export const debugForceSetQuantity = (
  state: GameState,
  itemId: string,
  quantity: number,
): DebugMutation => {
  const itemError = withItem(itemId);
  if (itemError) return { result: itemError };
  const amount = parseDebugInteger(quantity, 0);
  if (amount === null) return { result: failure('Quantity must be a non-negative integer.') };
  return mutate(
    state,
    `Force-set ${itemById[itemId].name} to ${amount}.`,
    (next) => {
      const existing = next.inventory.find((stack) => stack.itemId === itemId);
      if (amount === 0) next.inventory = next.inventory.filter((stack) => stack.itemId !== itemId);
      else if (existing) existing.quantity = amount;
      else next.inventory.push({ itemId, quantity: amount, locked: false });
    },
    {
      details: [
        'Capacity was intentionally ignored.',
        'This action is for edge-case testing only.',
      ],
    },
  );
};

export const debugForceOneStackOverCapacity = (state: GameState, itemId: string): DebugMutation =>
  debugForceSetQuantity(state, itemId, GAME_CONFIG.inventorySlots + 1);

export const debugGrantAndEquip = (state: GameState, itemId: string): DebugMutation => {
  const itemError = withItem(itemId);
  if (itemError) return { result: itemError };
  if (!itemById[itemId].slot) return { result: failure('That item has no equipment slot.') };
  const added = addItem(state.inventory, itemId, 1, GAME_CONFIG.inventorySlots);
  if (added.rejected) return { result: failure('Inventory is full and cannot accept that item.') };
  const equipped = equipItem({ ...structuredClone(state), inventory: added.inventory }, itemId);
  if (!equipped.ok) return { result: failure(equipped.message) };
  return {
    result: success(`${itemById[itemId].name} granted and equipped.`),
    state: equipped.state,
  };
};

export const debugGrantItem = (state: GameState, itemId: string): DebugMutation =>
  debugAddItem(state, itemId, 1);

export const debugEquipItem = (state: GameState, itemId: string): DebugMutation => {
  const result = equipItem(state, itemId);
  return result.ok
    ? { result: success(result.message), state: normalizeAfterMutation(result.state) }
    : { result: failure(result.message) };
};

export const debugUnequipSlot = (state: GameState, slot: EquipmentSlot): DebugMutation => {
  const result = unequipItem(state, slot);
  return result.ok
    ? {
        result: success(`${EQUIPMENT_SLOT_LABELS[slot]} unequipped.`),
        state: normalizeAfterMutation(result.state),
      }
    : { result: failure(result.message) };
};

const tierItemIds = (tier: 'bronze' | 'iron' | 'steel'): string[] =>
  ACTIVE_EQUIPMENT_SLOTS.map(
    (slot) => ITEMS.find((item) => item.tier === tier && item.slot === slot)?.id,
  ).filter((id): id is string => Boolean(id));

const grantIds = (state: GameState, itemIds: string[]): DebugMutation => {
  let inventory = structuredClone(state.inventory);
  const rejected: string[] = [];
  for (const itemId of itemIds) {
    const result = addItem(inventory, itemId, 1, GAME_CONFIG.inventorySlots);
    inventory = result.inventory;
    if (result.rejected) rejected.push(itemId);
  }
  if (rejected.length)
    return { result: failure(`Inventory could not accept ${rejected.length} item(s).`) };
  return {
    result: success(`Granted ${itemIds.length} current equipment item(s).`),
    state: normalizeAfterMutation({ ...state, inventory }),
  };
};

export const debugGrantSet = (state: GameState, tier: 'bronze' | 'iron' | 'steel'): DebugMutation =>
  grantIds(state, tierItemIds(tier));

export const debugEquipSet = (
  state: GameState,
  tier: 'bronze' | 'iron' | 'steel',
): DebugMutation => {
  let next = structuredClone(state);
  for (const itemId of tierItemIds(tier)) {
    const granted = addItem(next.inventory, itemId, 1, GAME_CONFIG.inventorySlots);
    next.inventory = granted.inventory;
    if (granted.rejected)
      return { result: failure(`Inventory could not accept ${itemById[itemId].name}.`) };
    const equipped = equipItem(next, itemId);
    if (!equipped.ok) return { result: failure(equipped.message) };
    next = equipped.state;
  }
  return {
    result: success(`${tier[0].toUpperCase()}${tier.slice(1)} set equipped.`),
    state: normalizeAfterMutation(next),
  };
};

export const debugClearEquipment = (state: GameState): DebugMutation => {
  let next = structuredClone(state);
  const failed: string[] = [];
  for (const slot of ACTIVE_EQUIPMENT_SLOTS) {
    const result = unequipItem(next, slot);
    if (result.ok) next = result.state;
    else if (next.equipment[slot]) failed.push(EQUIPMENT_SLOT_LABELS[slot]);
  }
  return {
    result: failed.length
      ? failure(`Could not unequip: ${failed.join(', ')}.`, ['No equipment was deleted.'])
      : success('Cleared Equipment using normal unequip actions.'),
    state: normalizeAfterMutation(next),
  };
};

export const debugSetHp = (state: GameState, hp: number, clamp = true): DebugMutation => {
  const amount = parseDebugInteger(hp, 0);
  if (amount === null) return { result: failure('HP must be a non-negative integer.') };
  return mutate(
    state,
    `Set player HP to ${amount}.`,
    (next) => {
      next.player.currentHp = amount;
    },
    { clampHealth: clamp },
  );
};

export const debugSetHpAboveMaximum = (state: GameState): DebugMutation =>
  debugSetHp(state, getDerivedStats(state).maxHealth + 100, false);

export const debugClampHp = (state: GameState): DebugMutation =>
  mutate(state, 'Recalculated and clamped HP to the derived maximum.', (next) => {
    next.player.currentHp = Math.min(next.player.currentHp, getDerivedStats(next).maxHealth);
  });

export const debugDamagePlayer = (state: GameState, amount: number): DebugMutation => {
  const parsed = parseDebugInteger(amount, 1);
  if (parsed === null) return { result: failure('Damage must be a positive integer.') };
  return mutate(
    state,
    `Damaged player for ${parsed}.`,
    (next) => {
      next.player.currentHp = Math.max(0, next.player.currentHp - parsed);
    },
    { clampHealth: false },
  );
};

export const debugKillPlayer = (state: GameState): DebugMutation =>
  mutate(
    state,
    'Set player HP to 0 and queued normal combat death handling.',
    (next) => {
      next.player.currentHp = 0;
      if (next.activeAction.type === 'combat')
        next.activeAction = {
          ...next.activeAction,
          // Let the normal enemy attack/death branch resolve before the player attack branch.
          combatState: {
            ...next.activeAction.combatState,
            playerAttackMs: 999_999,
            enemyAttackMs: 0,
          },
        };
    },
    { clampHealth: false },
  );

export const debugSetSkillLevel = (
  state: GameState,
  skillId: SkillId,
  level: number,
): DebugMutation => {
  const skillError = withSkill(skillId);
  if (skillError) return { result: skillError };
  const target = parseDebugInteger(level, 1, MAX_LEVEL);
  if (target === null)
    return { result: failure(`Level must be an integer from 1 to ${MAX_LEVEL}.`) };
  return mutate(state, `Set ${skillId} to level ${target}.`, (next) => {
    next.skills[skillId] = { level: target, xp: getXpForLevel(target) };
  });
};

export const debugSetSkillXp = (state: GameState, skillId: SkillId, xp: number): DebugMutation => {
  const skillError = withSkill(skillId);
  if (skillError) return { result: skillError };
  const target = parseDebugInteger(xp, 0, getXpForLevel(MAX_LEVEL));
  if (target === null)
    return { result: failure('XP must be a non-negative integer within the level cap.') };
  return mutate(state, `Set ${skillId} XP to ${target}.`, (next) => {
    next.skills[skillId] = { xp: target, level: getLevelFromXp(target) };
  });
};

export const debugAddSkillLevels = (
  state: GameState,
  skillId: SkillId,
  levels: number,
): DebugMutation => {
  const skillError = withSkill(skillId);
  if (skillError) return { result: skillError };
  const amount = parseDebugInteger(levels, 1, MAX_LEVEL);
  if (amount === null) return { result: failure('Level amount must be a positive integer.') };
  return mutate(state, `Added ${amount} level threshold(s) to ${skillId}.`, (next) => {
    const target = Math.min(MAX_LEVEL, next.skills[skillId].level + amount);
    next.skills[skillId] = { level: target, xp: getXpForLevel(target) };
  });
};

export const debugMaxAllSkills = (state: GameState): DebugMutation =>
  mutate(state, 'Set all skills to their current maximum level.', (next) => {
    for (const skill of Object.keys(next.skills) as SkillId[])
      next.skills[skill] = { level: MAX_LEVEL, xp: getXpForLevel(MAX_LEVEL) };
  });

export const debugResetSkill = (state: GameState, skillId: SkillId): DebugMutation =>
  debugSetSkillLevel(state, skillId, 1);

export const debugResetAllSkills = (state: GameState): DebugMutation =>
  mutate(state, 'Reset all skills to level 1.', (next) => {
    for (const skill of Object.keys(next.skills) as SkillId[])
      next.skills[skill] = { level: 1, xp: 0 };
  });

export const debugAddGold = (state: GameState, amount: number): DebugMutation => {
  const parsed = parseDebugInteger(amount, 1);
  if (parsed === null) return { result: failure('Gold must be a positive integer.') };
  return mutate(state, `Added ${parsed} Gold.`, (next) => {
    next.gold = Math.min(DEBUG_MAX_INTEGER, next.gold + parsed);
  });
};

export const debugSetGold = (state: GameState, amount: number): DebugMutation => {
  const parsed = parseDebugInteger(amount, 0);
  if (parsed === null) return { result: failure('Gold must be a non-negative integer.') };
  return mutate(state, `Set Gold to ${parsed}.`, (next) => {
    next.gold = parsed;
  });
};

export const debugSetKillCount = (
  state: GameState,
  enemyId: string,
  count: number,
): DebugMutation => {
  if (!enemyById[enemyId]) return { result: failure(`Unknown enemy ID: ${enemyId}.`) };
  const parsed = parseDebugInteger(count, 0);
  if (parsed === null) return { result: failure('Kill count must be a non-negative integer.') };
  return mutate(state, `Set ${enemyById[enemyId].name} kills to ${parsed}.`, (next) => {
    next.killCounts[enemyId as keyof typeof next.killCounts] = parsed;
  });
};

export const debugAddKillCount = (
  state: GameState,
  enemyId: string,
  amount: number,
): DebugMutation =>
  debugSetKillCount(
    state,
    enemyId,
    (state.killCounts[enemyId as keyof typeof state.killCounts] ?? 0) + amount,
  );

export const debugResetKillCount = (state: GameState, enemyId: string): DebugMutation =>
  debugSetKillCount(state, enemyId, 0);

export const debugUnlockAllAreas = (state: GameState): DebugMutation =>
  mutate(state, 'Unlocked all current Combat areas through progression inputs.', (next) => {
    next.skills.attack = { level: MAX_LEVEL, xp: getXpForLevel(MAX_LEVEL) };
    next.skills.strength = { level: MAX_LEVEL, xp: getXpForLevel(MAX_LEVEL) };
    next.skills.defence = { level: MAX_LEVEL, xp: getXpForLevel(MAX_LEVEL) };
    next.killCounts['forest-rat'] = Math.max(5, next.killCounts['forest-rat'] ?? 0);
    next.killCounts['cave-bat'] = Math.max(8, next.killCounts['cave-bat'] ?? 0);
    next.unlockedAreas = AREAS.filter((area) => area.unlock(next)).map((area) => area.id);
  });

export const debugResetCombatUnlocks = (state: GameState): DebugMutation =>
  mutate(state, 'Reset Combat unlock inputs and returned access to Training Grounds.', (next) => {
    next.unlockedAreas = ['training-grounds'];
    next.killCounts = {};
  });

export const debugStartMining = (state: GameState, nodeId: MiningNodeId): DebugMutation =>
  miningNodeById[nodeId]
    ? {
        result: success(`Started mining ${miningNodeById[nodeId].name}.`),
        state: startMining(state, nodeId, Date.now()),
      }
    : { result: failure(`Unknown Mining node: ${nodeId}.`) };

export const debugStartSmithing = (
  state: GameState,
  recipeId: string,
  mode: QuantityMode,
): DebugMutation =>
  recipeById[recipeId]
    ? {
        result: success(`Started ${recipeById[recipeId].name}.`),
        state: startSmithing(state, recipeId, mode, Date.now()),
      }
    : { result: failure(`Unknown Smithing recipe: ${recipeId}.`) };

export const debugStartCombat = (
  state: GameState,
  areaId: AreaId,
  enemyId: string,
  style: CombatStyle = 'accurate',
  autoRepeat = true,
): DebugMutation => {
  const enemy = enemyById[enemyId];
  if (!areaById[areaId] || !enemy || enemy.areaId !== areaId)
    return { result: failure('Select a current enemy from its registered Combat area.') };
  const next = startCombat(state, areaId, enemy.id, style, autoRepeat, Date.now(), true);
  return { result: success(`Started combat against ${enemy.name}.`), state: next };
};

export const debugStopAction = (state: GameState): DebugMutation =>
  mutate(state, 'Stopped the active action.', (next) => {
    next.activeAction = { type: 'none' };
  });

export const debugAdvanceElapsed = (state: GameState, elapsedMs: number): DebugMutation => {
  const amount = parseDebugInteger(elapsedMs, 1, GAME_CONFIG.offlineCapMs);
  if (amount === null)
    return { result: failure('Duration must be a positive integer within the offline cap.') };
  if (state.activeAction.type === 'none')
    return { result: failure('No active action to advance.') };
  const result = simulateElapsed(state, amount);
  return {
    result: success(`Advanced the active action by ${Math.round(amount / 1000)} second(s).`, [
      result.summary.stoppedReason ?? 'Simulation completed.',
    ]),
    state: result.state,
    summary: result.summary,
  };
};

export const debugAdvanceOneCycle = (state: GameState): DebugMutation => {
  if (state.activeAction.type === 'mining') {
    const node = miningNodeById[state.activeAction.nodeId];
    const interval = Math.max(
      500,
      Math.floor(node.intervalMs * getDerivedStats(state).miningIntervalMultiplier),
    );
    return debugAdvanceElapsed(state, Math.max(1, interval - state.activeAction.progressMs));
  }
  if (state.activeAction.type === 'smithing') {
    const recipe = recipeById[state.activeAction.recipeId];
    return recipe
      ? debugAdvanceElapsed(state, Math.max(1, recipe.intervalMs - state.activeAction.progressMs))
      : { result: failure('Unknown Smithing recipe.') };
  }
  if (state.activeAction.type === 'combat') return debugAdvanceElapsed(state, 1000);
  return { result: failure('No active action to advance.') };
};

export const debugOfflineSimulation = (state: GameState, elapsedMs: number): DebugMutation => {
  const amount = parseDebugInteger(elapsedMs, 1, GAME_CONFIG.offlineCapMs);
  if (amount === null)
    return {
      result: failure('Offline duration must be a positive integer within the 24-hour cap.'),
    };
  const result = simulateElapsed(state, amount);
  return {
    result: success(`Simulated ${Math.round((amount / 3_600_000) * 10) / 10} offline hour(s).`, [
      result.summary.stoppedReason ?? 'Offline replay completed.',
    ]),
    state: result.state,
    summary: result.summary,
  };
};

export const debugCompleteMiningCycle = debugAdvanceOneCycle;
export const debugCompleteSmithingCycle = debugAdvanceOneCycle;

export const debugGrantMiningOutput = (state: GameState, nodeId: MiningNodeId): DebugMutation => {
  const node = miningNodeById[nodeId];
  if (!node) return { result: failure(`Unknown Mining node: ${nodeId}.`) };
  const amount = addItem(state.inventory, node.rewardItemId, 1, GAME_CONFIG.inventorySlots);
  if (amount.rejected) return { result: failure('Inventory is full.') };
  return mutate(
    state,
    `Granted one ${itemById[node.rewardItemId]?.name ?? node.rewardItemId}.`,
    (next) => {
      next.inventory = amount.inventory;
      if (!next.discoveredItems.includes(node.rewardItemId))
        next.discoveredItems.push(node.rewardItemId);
    },
  );
};

export const debugGrantRecipeMaterials = (state: GameState, recipeId: string): DebugMutation => {
  const recipe = recipeById[recipeId];
  if (!recipe) return { result: failure(`Unknown Smithing recipe: ${recipeId}.`) };
  let inventory = state.inventory;
  for (const input of recipe.inputs) {
    const added = addItem(
      inventory,
      input.itemId,
      input.quantity * 100,
      GAME_CONFIG.inventorySlots,
    );
    if (added.rejected) return { result: failure('Inventory is full.') };
    inventory = added.inventory;
  }
  return mutate(state, `Granted materials for ${recipe.name}.`, (next) => {
    next.inventory = inventory;
  });
};

export const debugGrantRecipeOutput = (state: GameState, recipeId: string): DebugMutation => {
  const recipe = recipeById[recipeId];
  if (!recipe) return { result: failure(`Unknown Smithing recipe: ${recipeId}.`) };
  const added = addItem(
    state.inventory,
    recipe.outputItemId,
    recipe.outputQuantity,
    GAME_CONFIG.inventorySlots,
  );
  if (added.rejected) return { result: failure('Inventory is full.') };
  return mutate(
    state,
    `Granted one ${itemById[recipe.outputItemId]?.name ?? recipe.outputItemId}.`,
    (next) => {
      next.inventory = added.inventory;
    },
  );
};

export const debugResetCurrentEnemy = (state: GameState): DebugMutation => {
  if (state.activeAction.type !== 'combat') return { result: failure('Combat is not active.') };
  return debugStartCombat(
    state,
    state.activeAction.areaId,
    state.activeAction.enemyId,
    state.activeAction.style,
    state.activeAction.autoRepeat,
  );
};

export const debugKillCurrentEnemy = (state: GameState): DebugMutation => {
  if (state.activeAction.type !== 'combat') return { result: failure('Combat is not active.') };
  const prepared = structuredClone(state);
  const combatAction = prepared.activeAction;
  if (combatAction.type !== 'combat') return { result: failure('Combat is not active.') };
  prepared.player.currentHp = getDerivedStats(prepared, combatAction.style).maxHealth;
  combatAction.combatState = {
    ...combatAction.combatState,
    enemyHp: 1,
    playerAttackMs: 0,
    enemyAttackMs: 999_999,
  };
  let result = simulateElapsed(prepared, 1);
  for (let attempt = 0; attempt < 10 && result.summary.enemiesDefeated === 0; attempt += 1)
    result = simulateElapsed(result.state, 3_000);
  if (result.summary.enemiesDefeated === 0)
    return { result: failure('The normal combat pipeline did not defeat the current enemy.') };
  return {
    result: success(
      `Resolved the ${enemyById[combatAction.enemyId]?.name ?? 'current enemy'} through the combat reward pipeline.`,
      [`Kills: ${result.summary.enemiesDefeated}`, `Gold gained: ${result.summary.goldGained}`],
    ),
    state: result.state,
    summary: result.summary,
  };
};

export const debugApplyPreset = (state: GameState, preset: DebugPresetId): DebugMutation => {
  const result = applyDebugPreset(state, preset);
  return {
    result: success(result.message, result.details),
    state: normalizeAfterMutation(result.state, true),
  };
};

export const debugMigrateFixture = (state: GameState, fixture: GameState): DebugMutation => {
  const migrated = migrateSave(fixture, fixture.schemaVersion);
  const next = {
    ...migrated,
    profileId: state.profileId,
    profileSlot: state.profileSlot,
    player: { ...migrated.player, name: state.player.name },
  };
  return {
    result: success('Loaded and migrated the fixture into the current profile.', [
      'Profile identity and name were preserved.',
    ]),
    state: normalizeAfterMutation(next),
  };
};

export const createDebugController = (runtime: DebugRuntime) => ({
  execute(operation: (state: GameState) => DebugMutation): DebugActionResult {
    const game = runtime.getGame();
    const outcome = withGame(game, operation);
    if (!outcome.result.ok || !outcome.state) return outcome.result;
    runtime.setGame(outcome.state, outcome.summary);
    if (outcome.save !== false) void runtime.saveNow();
    return outcome.result;
  },
  save(): Promise<boolean> {
    return runtime.saveNow();
  },
});

export const debugActionForState = (
  state: GameState,
  operation: (state: GameState) => DebugMutation,
): DebugMutation => withGame(state, operation);

export const DEBUG_REGISTRIES = { ITEMS, ENEMIES, AREAS, MINING_NODES, RECIPES };
