export const SKILL_IDS = [
  'attack',
  'strength',
  'defence',
  'hitpoints',
  'mining',
  'smithing',
] as const;
export type SkillId = (typeof SKILL_IDS)[number];

export type ItemCategory =
  'material' | 'bar' | 'weapon' | 'armor' | 'shield' | 'tool' | 'drop' | 'currency';
export type EquipmentSlot =
  'head' | 'body' | 'legs' | 'weapon' | 'shield' | 'tool' | 'amulet' | 'ring' | 'cape';
export type AreaId = 'training-grounds' | 'copper-hills' | 'ironwood-pass';
export type EnemyId =
  'forest-rat' | 'goblin-scavenger' | 'cave-bat' | 'stoneback-crab' | 'grey-wolf' | 'road-bandit';
export type MiningNodeId =
  'copper-vein' | 'tin-vein' | 'iron-vein' | 'coal-seam' | 'mithril-deposit';
export type RecipeId = string;
export type ScreenId =
  | 'home'
  | 'combat'
  | 'inventory'
  | 'equipment'
  | 'collection'
  | 'mining'
  | 'smithing'
  | 'settings'
  | 'help'
  | 'locked';
export type QuantityMode = 1 | 10 | 'all' | 'continuous';
export type CombatStyle = 'accurate' | 'aggressive' | 'defensive';
export type EnemyTraitId =
  | 'scurry'
  | 'desperate-swing'
  | 'evasive'
  | 'armoured-shell'
  | 'bleeding-bites'
  | 'heavy-strike';
export type EliteModifierId = 'savage' | 'armoured' | 'swift' | 'wealthy' | 'treasure-touched';
export type WeaponSpecialId = 'focused-slash' | 'sundering-strike' | 'executioners-cut';
export type EnemyVisualArchetype = 'rat' | 'goblin' | 'bat' | 'crab' | 'wolf' | 'bandit';
export type ZoneVisualTheme = 'training' | 'copper-cavern' | 'ironwood';

export interface ItemPresentation {
  iconKey?: string;
  visualCategory?: string;
}

export interface EnemyPresentation {
  archetype: EnemyVisualArchetype;
  primaryColor: string;
  secondaryColor: string;
  scale: number;
  idleAnimation: 'scurry' | 'hunch' | 'hover' | 'heavy' | 'alert' | 'stride';
  attackAnimation: 'lunge' | 'swipe' | 'swoop' | 'claw' | 'pounce' | 'slash';
}

export interface ZonePresentation {
  iconKey: 'target' | 'crystal' | 'tree';
  theme: ZoneVisualTheme;
  environmentKey: string;
}

export interface SkillState {
  xp: number;
  level: number;
}

export interface ItemDefinition {
  id: string;
  name: string;
  category: ItemCategory;
  description: string;
  stackable: boolean;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic';
  source: string;
  presentation?: ItemPresentation;
  slot?: EquipmentSlot;
  tier?: 'bronze' | 'iron' | 'steel';
  bonuses?: Partial<{
    attack: number;
    strength: number;
    defence: number;
    health: number;
    speed: number;
  }>;
  specialAttack?: WeaponSpecial;
}

export interface WeaponSpecial {
  id: WeaponSpecialId;
  name: string;
  description: string;
  damageMultiplier: number;
  accuracyMultiplier: number;
  ignoresFlatDamageReduction?: boolean;
  executeThreshold?: number;
  executeDamageMultiplier?: number;
}

export interface MiningNodeDefinition {
  id: MiningNodeId;
  name: string;
  level: number;
  intervalMs: number;
  rewardItemId: string;
  xp: number;
  description: string;
  theme: string;
}

export interface RecipeDefinition {
  id: RecipeId;
  name: string;
  category: 'smelting' | 'forging';
  level: number;
  intervalMs: number;
  inputs: Array<{ itemId: string; quantity: number }>;
  outputItemId: string;
  outputQuantity: number;
  xp: number;
  description: string;
}

export interface LootEntry {
  itemId: string;
  chance: number;
  min: number;
  max: number;
}

export interface EnemyDefinition {
  id: EnemyId;
  name: string;
  description: string;
  areaId: AreaId;
  displayLevel: number;
  maxHealth: number;
  attackIntervalMs: number;
  maxHit: number;
  accuracyRating: number;
  defenceRating: number;
  trait: {
    id: EnemyTraitId;
    name: string;
    description: string;
  };
  loot: LootEntry[];
  gold: [number, number];
  theme: 'rodent' | 'goblin' | 'bat' | 'crab' | 'wolf' | 'bandit';
  presentation: EnemyPresentation;
  tags?: string[];
}

export interface AreaDefinition {
  id: AreaId;
  name: string;
  description: string;
  requirement: string;
  unlock: (state: GameState) => boolean;
  enemyIds: EnemyId[];
  accent: string;
  recommendedLevel: [number, number];
  presentation: ZonePresentation;
}

export interface InventoryStack {
  itemId: string;
  quantity: number;
  locked: boolean;
}

export type EquipmentLoadout = Partial<Record<EquipmentSlot, string>>;

export interface CombatTraitState {
  firstAttackPending: boolean;
  enemyAttackCount: number;
  bleedStacks: number;
}

export interface ActiveCombatState {
  enemyHp: number;
  enemyMaxHp: number;
  playerAttackMs: number;
  enemyAttackMs: number;
  respawnMs: number;
  rngSeed: number;
  rngCursor: number;
  momentum: number;
  eliteModifier: EliteModifierId | null;
  eliteAnnounced: boolean;
  traitState: CombatTraitState;
  encounterIndex: number;
  encounterStartedAt: number;
}

export type ActiveAction =
  | { type: 'none' }
  | { type: 'mining'; nodeId: MiningNodeId; startedAt: number; progressMs: number }
  | {
      type: 'smithing';
      recipeId: RecipeId;
      quantityMode: QuantityMode;
      remaining: number | null;
      progressMs: number;
    }
  | {
      type: 'combat';
      enemyId: EnemyId;
      areaId: AreaId;
      style: CombatStyle;
      pendingStyle: CombatStyle | null;
      autoRepeat: boolean;
      autoSpecial: boolean;
      specialQueued: boolean;
      combatState: ActiveCombatState;
    };

export interface GameSettings {
  sound: boolean;
  music: boolean;
  reducedMotion: boolean;
  compactNumbers: boolean;
  huntElites: boolean;
  threeQuality: 'off' | 'low' | 'high';
}

export interface GameLogEntry {
  id: string;
  at: number;
  text: string;
  tone: 'neutral' | 'success' | 'warning' | 'danger';
  combatEncounterStartedAt?: number;
}

export interface GameState {
  schemaVersion: number;
  profileId: string;
  profileSlot: number;
  createdAt: number;
  updatedAt: number;
  lastSimulatedAt: number;
  player: { name: string; currentHp: number };
  skills: Record<SkillId, SkillState>;
  inventory: InventoryStack[];
  equipment: EquipmentLoadout;
  discoveredItems: string[];
  discoveredMonsters: EnemyId[];
  killCounts: Partial<Record<EnemyId, number>>;
  statistics: {
    mined: number;
    smelted: number;
    forged: number;
    deaths: number;
    totalKills: number;
  };
  gold: number;
  activeAction: ActiveAction;
  unlockedAreas: AreaId[];
  settings: GameSettings;
  log: GameLogEntry[];
}

export interface SimulationSummary {
  elapsedMs: number;
  requestedElapsedMs: number;
  processedElapsedMs: number;
  remainingElapsedMs: number;
  completed: Record<string, number>;
  xpGained: Partial<Record<SkillId, number>>;
  levelsGained: Partial<Record<SkillId, number>>;
  itemsGained: Record<string, number>;
  itemsUsed: Record<string, number>;
  enemiesDefeated: number;
  deaths: number;
  goldGained: number;
  eliteEnemiesDefeated: number;
  combatStats: {
    playerAttacks: number;
    playerHits: number;
    enemyAttacks: number;
    enemyHits: number;
    specialAttempts: number;
    specialHits: number;
    damageDealt: number;
    damageTaken: number;
  };
  stoppedReason?: string;
}

export type CombatVisualEvent =
  | {
      id: string;
      type: 'player-hit';
      enemyId: EnemyId;
      damage: number;
      at: number;
      special?: boolean;
    }
  | {
      id: string;
      type: 'player-miss';
      enemyId: EnemyId;
      damage: number;
      at: number;
      special?: boolean;
    }
  | {
      id: string;
      type: 'enemy-hit';
      enemyId: EnemyId;
      damage: number;
      at: number;
    }
  | {
      id: string;
      type: 'enemy-miss';
      enemyId: EnemyId;
      damage: number;
      at: number;
    }
  | {
      id: string;
      type: 'enemy-bleed';
      enemyId: EnemyId;
      damage: number;
      at: number;
    }
  | {
      id: string;
      type: 'enemy-defeated';
      enemyId: EnemyId;
      at: number;
      gold: number;
      eliteModifier?: EliteModifierId | null;
    }
  | { id: string; type: 'elite-spawned'; enemyId: EnemyId; at: number; modifier: EliteModifierId }
  | { id: string; type: 'player-defeated'; enemyId: EnemyId; at: number }
  | {
      id: string;
      type: 'loot';
      enemyId: EnemyId;
      at: number;
      gold: number;
      items: Array<{ itemId: string; quantity: number }>;
    };

export interface CombatSessionStats {
  startedAt: number | null;
  encounterStartedAt: number | null;
  enemyId: EnemyId | null;
  playerAttacks: number;
  playerHits: number;
  enemyAttacks: number;
  enemyHits: number;
  specialAttempts: number;
  specialHits: number;
  damageDealt: number;
  damageTaken: number;
  enemiesDefeated: number;
  eliteEnemiesDefeated: number;
  xpGained: Partial<Record<SkillId, number>>;
  lootGained: Record<string, number>;
  goldGained: number;
}

export const emptyCombatSession = (
  enemyId: EnemyId | null = null,
  startedAt: number | null = null,
  encounterStartedAt: number | null = startedAt,
): CombatSessionStats => ({
  startedAt,
  encounterStartedAt,
  enemyId,
  playerAttacks: 0,
  playerHits: 0,
  enemyAttacks: 0,
  enemyHits: 0,
  specialAttempts: 0,
  specialHits: 0,
  damageDealt: 0,
  damageTaken: 0,
  enemiesDefeated: 0,
  eliteEnemiesDefeated: 0,
  xpGained: {},
  lootGained: {},
  goldGained: 0,
});

export const emptySummary = (elapsedMs = 0): SimulationSummary => ({
  elapsedMs,
  requestedElapsedMs: elapsedMs,
  processedElapsedMs: 0,
  remainingElapsedMs: elapsedMs,
  completed: {},
  xpGained: {},
  levelsGained: {},
  itemsGained: {},
  itemsUsed: {},
  enemiesDefeated: 0,
  deaths: 0,
  goldGained: 0,
  eliteEnemiesDefeated: 0,
  combatStats: {
    playerAttacks: 0,
    playerHits: 0,
    enemyAttacks: 0,
    enemyHits: 0,
    specialAttempts: 0,
    specialHits: 0,
    damageDealt: 0,
    damageTaken: 0,
  },
});
