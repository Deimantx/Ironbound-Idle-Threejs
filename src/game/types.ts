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
  | 'head'
  | 'armor'
  | 'gloves'
  | 'boots'
  | 'weapon'
  | 'offhand'
  | 'amulet'
  | 'ring'
  | 'cape'
  | 'tool';
export type LegacyCombatRegionId = 'greenvale' | 'stonehill' | 'ashmoor';
export type CombatRegionId = 'tauraque' | LegacyCombatRegionId;
export type CombatSubRegionId =
  | 'lornwick-vale'
  | 'greymoss-woods'
  | 'whitecliff-coast'
  | 'redwater-basin'
  | 'brackenmoor'
  | 'crowmere-hills'
  | 'alderwatch'
  | 'veyran-reach';
export type CombatAvailability = 'available' | 'locked';
export type CombatRegionAvailability = CombatAvailability;
/** @deprecated Future combat activity types are represented by Activity cards. */
export type CombatContentCategory = 'areas' | 'dungeons' | 'special' | 'conquest';
export type CurrentAreaId =
  | 'redknife-road-camp'
  | 'greyfang-pastures'
  | 'brambletooth-camp'
  | 'mossfang-encampment'
  | 'deepwood-den'
  | 'thornhide-grove'
  | 'saltknife-cove'
  | 'reefback-shore'
  | 'gullwatch-cliffs'
  | 'broken-banner-camp'
  | 'redwater-reedbanks'
  | 'mudtusk-crossing'
  | 'the-drowned-fen'
  | 'mirecrawler-nest'
  | 'fenclaw-grounds'
  | 'crowclaw-warband'
  | 'ramstone-slopes'
  | 'cragwing-roost'
  | 'blackcloak-hideout'
  | 'rookery-slums'
  | 'old-barracks'
  | 'gloomfang-territory'
  | 'razorhorn-range'
  | 'ashmane-hunting-grounds';
export type LegacyAreaId =
  | 'forest-path' | 'wolf-den' | 'abandoned-camp' | 'old-shrine'
  | 'rocky-foothills' | 'abandoned-mine' | 'mountain-pass' | 'ruined-watchtower';
export type AreaId = CurrentAreaId | LegacyAreaId;
export type CurrentEnemyId =
  | 'redknife-lookout'
  | 'redknife-brigand'
  | 'redknife-bowhand'
  | 'redknife-enforcer'
  | 'greyfang-wolf'
  | 'greyfang-stalker'
  | 'greyfang-ravager'
  | 'greyfang-alpha'
  | 'brambletooth-scavenger'
  | 'brambletooth-spearman'
  | 'brambletooth-trapper'
  | 'brambletooth-boarhandler';
export type LegacyEnemyId =
  | 'forest-rat' | 'goblin-scavenger' | 'cave-bat' | 'stoneback-crab' | 'grey-wolf'
  | 'road-bandit' | 'hill-boar' | 'stonehide-ram' | 'tunnel-crawler' | 'forsaken-miner'
  | 'cliff-harpy' | 'stonehill-marauder' | 'ironbound-sentinel' | 'watchtower-captain';
export type EnemyId = CurrentEnemyId | LegacyEnemyId;
export type MiningNodeId = 'stone-outcrop' | 'iron-vein' | 'coal-seam';
export type LegacyMiningNodeId = 'copper-vein' | 'tin-vein' | 'mithril-deposit';
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
  | 'watchful'
  | 'dirty-fighter'
  | 'precise'
  | 'heavy-hitter'
  | 'pack-hunter'
  | 'evasive'
  | 'ferocious'
  | 'apex-predator'
  | 'scrappy'
  | 'cautious-fighter'
  | 'opportunist'
  | 'beast-handler'
  /** Legacy save/test identifiers; never used by current content. */
  | 'scurry' | 'desperate-swing' | 'armoured-shell' | 'bleeding-bites' | 'cornered-fury'
  | 'stonehide' | 'blood-scent' | 'patchwork-plate' | 'elusive-flight' | 'battle-fury'
  | 'reinforced-plating' | 'last-stand';
export type EliteModifierId = 'savage' | 'armoured' | 'swift' | 'wealthy' | 'treasure-touched';
export type WeaponSpecialId = 'focused-slash' | 'sundering-strike' | 'executioners-cut';
export type EnemySpecialId = string;
export type CombatEffectTarget = 'player' | 'enemy';
export type CombatEffectPolarity = 'buff' | 'debuff' | 'status';
export type CombatEffectKind =
  | 'bleed'
  | 'stun'
  | 'defence-debuff'
  | 'attack-speed-debuff'
  | 'accuracy-debuff'
  | 'damage-buff'
  | 'defence-buff'
  | 'attack-speed-buff'
  | 'combined-buff'
  | 'status';
export type EnemyVisualArchetype = 'rat' | 'goblin' | 'bat' | 'crab' | 'wolf' | 'bandit';
export type ZoneVisualTheme = string;

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
  iconKey: 'target' | 'crystal' | 'tree' | 'mountain';
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
    attackSpeed: number;
    miningSpeed: number;
  }>;
  specialAttack?: WeaponSpecial;
  weaponHands?: 1 | 2;
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

export interface CombatEffectDefinition {
  id: string;
  kind: CombatEffectKind;
  name: string;
  polarity: CombatEffectPolarity;
  description: string;
  durationMs?: number | null;
  maxStacks?: number;
  stacking?: 'refresh' | 'stack' | 'replace';
  periodicDamage?: {
    intervalMs: number;
    damagePerStack: number;
    ignoresDefence?: boolean;
  };
  modifiers?: Partial<{
    accuracyMultiplier: number;
    defenceMultiplier: number;
    damageMultiplier: number;
    attackIntervalMultiplier: number;
    flatDamageReduction: number;
    periodicDamageIntervalMs: number;
  }>;
}

export interface ActiveCombatEffect {
  instanceId: string;
  effectId: string;
  target: CombatEffectTarget;
  sourceEnemyId?: EnemyId;
  sourceSpecialId?: EnemySpecialId;
  remainingMs: number | null;
  stacks: number;
  nextTickMs?: number;
  magnitude?: number;
}

export interface CombatEffectsState {
  player: ActiveCombatEffect[];
  enemy: ActiveCombatEffect[];
}

export type EnemySpecialEffect =
  | {
      kind: 'player-attack-progress-pushback';
      fractionOfAttackInterval: number;
      applyOn: 'hit' | 'always';
    }
  | { kind: 'player-attack-delay'; amountMs: number; applyOn: 'hit' | 'always' }
  | { kind: 'player-attack-delay-fraction'; fractionOfAttackInterval: number; applyOn: 'hit' | 'always' }
  | {
      kind: 'apply-combat-effect';
      effectId: string;
      target: CombatEffectTarget;
      applyOn: 'hit' | 'always';
    };

export interface EnemySpecialDefinition {
  id: EnemySpecialId;
  name: string;
  description: string;
  delivery: 'attack' | 'self';
  damageMultiplier?: number;
  accuracyMultiplier?: number;
  playerHealthThreshold?: number;
  conditionalDamageMultiplier?: number;
  effects?: EnemySpecialEffect[];
}

export interface MiningNodeDefinition {
  id: MiningNodeId;
  name: string;
  level: number;
  requiredPenetration: number;
  damagePerPrimaryReward: number;
  xpPerSwing: number;
  primaryRewardItemId: string;
  respawnMs: number;
  stages: MiningStageDefinition[];
  bonusDrops: MiningBonusDrop[];
  description: string;
  theme: string;
}

export interface MiningToolDefinition {
  itemId: string;
  requiredMiningLevel: number;
  rockDamage: number;
  penetration: number;
  swingIntervalMs: number;
  staminaCost: number;
}

export interface MiningBonusDrop {
  itemId: string;
  chance: number;
  minQuantity: number;
  maxQuantity: number;
}

export interface MiningStageDefinition {
  id: string;
  name: string;
  durability: number;
  bonusChanceMultiplier: number;
}

export interface MiningNodeRuntimeState {
  stageIndex: number;
  stageDurability: number;
  primaryYieldProgress: number;
  respawnRemainingMs: number;
  rngSeed: number;
  rngCursor: number;
}

export interface MiningState {
  stamina: number;
  nodeStates: Partial<Record<MiningNodeId, MiningNodeRuntimeState>>;
}

export interface SmithingState {
  rngSeed: number;
  rngCursor: number;
  forgeFuel: ForgeFuelState;
}

export interface ForgeFuelState {
  selectedFuelItemId: string | null;
  loadedFuelItemId: string | null;
  loadedFuelQuantity: number;
  autoRefuel: boolean;
}

export type MiningPhase = 'swing' | 'rest' | 'respawn';

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
  legacy?: boolean;
  forgeFuelUnits?: number;
  /** @deprecated Use forgeFuelUnits with the Forge hopper. */
  fuel?: { itemId: string; quantity: number };
}

export interface SmithingToolDefinition {
  itemId: string;
  requiredSmithingLevel: number;
  speedBonus: number;
  materialPreservationChance: number;
}

export interface SmithingFuelDefinition {
  itemId: string;
  name: string;
  fuelValue: number;
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
  specialAttack: EnemySpecialDefinition;
  signatureLoot: LootEntry;
  theme: 'rodent' | 'goblin' | 'bat' | 'crab' | 'wolf' | 'bandit';
  presentation: EnemyPresentation;
}

export interface AreaDefinition {
  id: AreaId;
  regionId: CombatRegionId;
  subRegionId: CombatSubRegionId;
  name: string;
  description: string;
  identity: string;
  activityType: 'area';
  availability: CombatAvailability;
  requiredCombatLevel: number;
  enemyIds: EnemyId[];
  sharedLoot: LootEntry[];
  gold?: [number, number];
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
  enemyAttackCount: number;
  consecutiveEnemyHits: number;
  packHunterStacks: number;
  scrappyStacks: number;
  /** @deprecated v15 save fields, read only during migration. */
  firstAttackPending?: boolean;
  bleedStacks?: number;
  corneredFuryTriggered?: boolean;
  lastStandTriggered?: boolean;
}

export interface ActiveCombatState {
  enemyHp: number;
  enemyMaxHp: number;
  playerAttackMs: number;
  enemyAttackMs: number;
  respawnMs: number;
  rngSeed: number;
  rngCursor: number;
  adrenaline: number;
  enemySpecialCharge: number;
  effects: CombatEffectsState;
  eliteModifier: EliteModifierId | null;
  eliteAnnounced: boolean;
  traitState: CombatTraitState;
  encounterIndex: number;
  encounterStartedAt: number;
}

export type ActiveAction =
  | { type: 'none' }
  | {
      type: 'mining';
      nodeId: MiningNodeId;
      startedAt: number;
      phase: MiningPhase;
      progressMs: number;
    }
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
  showHelpIcons: boolean;
  huntElites: boolean;
  threeQuality: 'off' | 'low' | 'high';
}

export interface MilestoneLogEntry {
  id: string;
  at: number;
  kind: 'level-up';
  skillId: SkillId;
  level: number;
}

export type CombatDefeatCause =
  | { kind: 'enemy-hit'; damage: number; heavy: boolean }
  | { kind: 'enemy-special'; specialId: EnemySpecialId; damage: number }
  | { kind: 'bleed'; damage: number }
  | {
      kind: 'combat-effect';
      effectId: string;
      sourceEnemyId?: EnemyId;
      sourceSpecialId?: EnemySpecialId;
      damage: number;
    };

export interface CombatLogBase {
  id: string;
  at: number;
  enemyId: EnemyId;
  encounterStartedAt: number;
}

export type CombatLogEntry =
  | (CombatLogBase & { kind: 'player-hit'; damage: number; special: boolean })
  | (CombatLogBase & { kind: 'player-miss'; special: boolean })
  | (CombatLogBase & { kind: 'enemy-hit'; damage: number; heavy: boolean })
  | (CombatLogBase & { kind: 'enemy-miss' })
  | (CombatLogBase & { kind: 'enemy-special-hit'; specialId: EnemySpecialId; damage: number })
  | (CombatLogBase & { kind: 'enemy-special-miss'; specialId: EnemySpecialId })
  | (CombatLogBase & { kind: 'enemy-special-used'; specialId: EnemySpecialId })
  | (CombatLogBase & { kind: 'enemy-bleed'; damage: number })
  | (CombatLogBase & {
      kind: 'combat-effect-damage';
      effectId: string;
      sourceEnemyId?: EnemyId;
      sourceSpecialId?: EnemySpecialId;
      damage: number;
    })
  | (CombatLogBase & {
      kind: 'enemy-defeated';
      gold: number;
      eliteModifier: EliteModifierId | null;
    })
  | (CombatLogBase & { kind: 'loot'; itemId: string; quantity: number })
  | (CombatLogBase & { kind: 'gold'; amount: number })
  | (CombatLogBase & { kind: 'elite-spawned'; modifier: EliteModifierId })
  | (CombatLogBase & { kind: 'enemy-spawned'; encounterIndex: number })
  | (CombatLogBase & { kind: 'player-defeated'; cause: CombatDefeatCause })
  | {
      id: string;
      kind: 'legacy';
      at: number;
      message: string;
      encounterStartedAt: number;
      enemyId?: EnemyId;
    };

export interface ActivityLogsState {
  milestones: MilestoneLogEntry[];
  combat: CombatLogEntry[];
}

/** @deprecated Legacy save-only shape. Runtime state uses ActivityLogsState. */
export interface LegacyGameLogEntry {
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
    /** @deprecated Use miningSwings. */
    mined: number;
    miningSwings: number;
    miningStagesDepleted: number;
    miningRocksDepleted: number;
    smelted: number;
    forged: number;
    deaths: number;
    totalKills: number;
    totalItemsGained: number;
    playTimeMs: number;
  };
  gold: number;
  mining: MiningState;
  smithing: SmithingState;
  activeAction: ActiveAction;
  unlockedAreas: AreaId[];
  settings: GameSettings;
  activityLogs: ActivityLogsState;
}

export interface SimulationSummary {
  elapsedMs: number;
  requestedElapsedMs: number;
  processedElapsedMs: number;
  remainingElapsedMs: number;
  offlineCapped?: boolean;
  offlineContext?: SimulationContext;
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

export interface SimulationContext {
  activity: 'mining' | 'smithing' | 'combat' | 'idle';
  miningNodeId?: MiningNodeId;
  recipeId?: RecipeId;
  enemyId?: EnemyId;
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
      type: 'enemy-special-hit';
      enemyId: EnemyId;
      specialId: EnemySpecialId;
      damage: number;
      at: number;
    }
  | {
      id: string;
      type: 'enemy-special-miss' | 'enemy-special-used';
      enemyId: EnemyId;
      specialId: EnemySpecialId;
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
      type: 'combat-effect-damage';
      enemyId: EnemyId;
      effectId: string;
      damage: number;
      at: number;
      target: CombatEffectTarget;
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
