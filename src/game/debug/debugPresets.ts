import { GAME_CONFIG } from '../../config/gameConfig';
import { AREAS } from '../../content/areas';
import { ENEMIES } from '../../content/enemies';
import { ITEMS } from '../../content/items';
import { RECIPES } from '../../content/recipes';
import { MAX_LEVEL, getXpForLevel } from '../formulas/experienceFormulas';
import { getDerivedStats } from '../formulas/statFormulas';
import { createNewGame } from '../state/initialState';
import { addItem } from '../systems/inventorySystem';
import { ACTIVE_EQUIPMENT_SLOTS } from '../equipmentSlots';
import type { GameState, SkillId } from '../types';
import type { DebugPresetId } from './debugTypes';

export const DEBUG_PRESETS: Array<{
  id: DebugPresetId;
  label: string;
  description: string;
  destructive?: boolean;
}> = [
  {
    id: 'fresh',
    label: 'Fresh Character',
    description: 'Reset gameplay while preserving profile identity and preferences.',
    destructive: true,
  },
  {
    id: 'inventory',
    label: 'Inventory Testing',
    description: 'Representative materials, drops, gear, tools, and open capacity.',
    destructive: true,
  },
  {
    id: 'equipment',
    label: 'Equipment Testing',
    description: 'All current equippable items, useful levels, and empty equipment.',
    destructive: true,
  },
  {
    id: 'mining',
    label: 'Mining Testing',
    description: 'All Mining nodes, current picks, level 100, and no active action.',
    destructive: true,
  },
  {
    id: 'smithing',
    label: 'Smithing Testing',
    description: 'Recipe materials, level 100, and no active action.',
    destructive: true,
  },
  {
    id: 'combat',
    label: 'Combat Testing',
    description: 'Current combat gear, useful Melee levels, unlocked areas, and full HP.',
    destructive: true,
  },
  {
    id: 'full-inventory',
    label: 'Inventory Capacity Testing',
    description:
      'Grants all current unique items and prepares one-shot capacity rejection tests without duplicate stacks.',
    destructive: true,
  },
  {
    id: 'late-game',
    label: 'Late-Game Testing',
    description: 'Max current progression, current content, strong gear, and valid HP.',
    destructive: true,
  },
];

const setSkill = (state: GameState, skill: SkillId, level: number): void => {
  state.skills[skill] = { level, xp: getXpForLevel(level) };
};

const clearAction = (state: GameState): void => {
  state.activeAction = { type: 'none' };
};

const add = (state: GameState, itemId: string, quantity: number): void => {
  const result = addItem(state.inventory, itemId, quantity, GAME_CONFIG.inventorySlots);
  state.inventory = result.inventory;
};

const currentEquipmentIds = (): string[] =>
  ITEMS.filter((item) => item.slot).map((item) => item.id);

const strongestEquipment = (): GameState['equipment'] => {
  const equipment: GameState['equipment'] = {};
  for (const slot of ACTIVE_EQUIPMENT_SLOTS) {
    const item = ITEMS.filter((candidate) => candidate.slot === slot).sort((left, right) => {
      const rank = { bronze: 1, iron: 2, steel: 3 };
      return (rank[right.tier ?? 'bronze'] ?? 0) - (rank[left.tier ?? 'bronze'] ?? 0);
    })[0];
    if (item) equipment[slot] = item.id;
  }
  return equipment;
};

const maxSkills = (state: GameState): void => {
  for (const skill of Object.keys(state.skills) as SkillId[]) setSkill(state, skill, MAX_LEVEL);
};

const validHp = (state: GameState): void => {
  state.player.currentHp = getDerivedStats(state).maxHealth;
};

export interface DebugPresetResult {
  state: GameState;
  message: string;
  details: string[];
}

export const applyDebugPreset = (input: GameState, preset: DebugPresetId): DebugPresetResult => {
  let state = structuredClone(input);
  const details: string[] = [
    'Only current content registry IDs were used.',
    'Profile identity and character name were preserved.',
  ];

  switch (preset) {
    case 'fresh': {
      const fresh = createNewGame(input.profileSlot, input.player.name, input.createdAt);
      state = {
        ...fresh,
        profileId: input.profileId,
        profileSlot: input.profileSlot,
        settings: structuredClone(input.settings),
      };
      details.push('Gameplay was returned to normal new-game defaults.');
      break;
    }
    case 'inventory':
      state.inventory = [];
      for (const item of ITEMS) add(state, item.id, item.stackable ? 10 : 1);
      clearAction(state);
      details.push('Equipment was left unchanged.', 'Open capacity remains for additional tests.');
      break;
    case 'equipment':
      state.inventory = [];
      for (const itemId of currentEquipmentIds()) add(state, itemId, 1);
      state.equipment = {};
      clearAction(state);
      setSkill(state, 'attack', 50);
      setSkill(state, 'strength', 50);
      setSkill(state, 'defence', 50);
      setSkill(state, 'hitpoints', 50);
      setSkill(state, 'mining', 50);
      setSkill(state, 'smithing', 50);
      validHp(state);
      details.push('Equipment was left empty for direct equip/replace tests.');
      break;
    case 'mining':
      state.inventory = [];
      add(state, 'iron-pickaxe', 1);
      add(state, 'steel-pickaxe', 1);
      setSkill(state, 'mining', MAX_LEVEL);
      clearAction(state);
      validHp(state);
      details.push('All current Mining nodes are level-valid.');
      break;
    case 'smithing':
      state.inventory = [];
      for (const recipe of RECIPES)
        for (const inputItem of recipe.inputs)
          add(state, inputItem.itemId, inputItem.quantity * 100);
      setSkill(state, 'smithing', MAX_LEVEL);
      clearAction(state);
      validHp(state);
      details.push('Recipe materials were granted in large, stackable quantities.');
      break;
    case 'combat':
      state.inventory = [];
      state.equipment = strongestEquipment();
      for (const item of ITEMS)
        if (item.slot && state.equipment[item.slot] !== item.id) add(state, item.id, 1);
      setSkill(state, 'attack', 50);
      setSkill(state, 'strength', 50);
      setSkill(state, 'defence', 50);
      setSkill(state, 'hitpoints', 50);
      state.unlockedAreas = AREAS.map((area) => area.id);
      clearAction(state);
      validHp(state);
      details.push('Current Combat areas were unlocked through useful progression inputs.');
      break;
    case 'full-inventory':
      state.inventory = [];
      for (const item of ITEMS) add(state, item.id, item.stackable ? 10 : 1);
      clearAction(state);
      details.push(
        `Inventory now has ${state.inventory.length} of ${GAME_CONFIG.inventorySlots} occupied slots.`,
        'One-shot capacity rejection tests use an effective capacity override without changing gameplay state.',
      );
      break;
    case 'late-game':
      maxSkills(state);
      state.gold = 999_999_999;
      state.discoveredItems = ITEMS.map((item) => item.id);
      state.discoveredMonsters = ENEMIES.map((enemy) => enemy.id);
      state.killCounts = Object.fromEntries(ENEMIES.map((enemy) => [enemy.id, 100]));
      state.unlockedAreas = AREAS.map((area) => area.id);
      state.equipment = strongestEquipment();
      state.inventory = [];
      for (const item of ITEMS)
        if (!item.slot || state.equipment[item.slot] !== item.id)
          add(state, item.id, item.stackable ? 100 : 1);
      clearAction(state);
      validHp(state);
      details.push('All current items, discoveries, areas, and useful kill counts were prepared.');
      break;
  }

  state.updatedAt = Date.now();
  state.schemaVersion = GAME_CONFIG.currentSaveVersion;
  return {
    state,
    message: `${DEBUG_PRESETS.find((entry) => entry.id === preset)?.label ?? 'Preset'} applied.`,
    details,
  };
};
