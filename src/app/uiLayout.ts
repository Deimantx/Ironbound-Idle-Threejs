import type { ScreenId } from '../game/types';

export const UI_LAYOUT_STORAGE_KEY = 'ironbound-idle-ui-layout';
export const UI_LAYOUT_VERSION = 3;
export const UI_EDITOR_COMPACT_QUERY = '(max-width: 900px)';
export const UI_EDITOR_GRID_ROW_HEIGHT = 80;

export type UiRegion = 'sidebar' | 'header' | 'content' | 'actionStrip';
export type UiPanelId = string;
export type UiPanelRegionId = string;
export type UiPanelInternalDirection = 'grid' | 'stack';

export interface UiOffset {
  x: number;
  y: number;
}

export interface UiPanelPosition {
  column: number;
  row: number;
  columnSpan: number;
  height: number;
  scale: number;
  locked: boolean;
}

export interface UiPanelDefinition {
  id: UiPanelId;
  label: string;
  description: string;
  defaultPosition: UiPanelPosition;
}

export interface UiPanelRegionPosition {
  order: number;
  column: number;
  columnSpan: number;
  row: number;
  visible: boolean;
}

export interface UiPanelInternalLayout {
  direction: UiPanelInternalDirection;
  gap: number;
  padding: number;
  regions: Record<UiPanelRegionId, UiPanelRegionPosition>;
}

export interface UiPanelRegionDefinition {
  id: UiPanelRegionId;
  label: string;
  description: string;
  defaultPosition: UiPanelRegionPosition;
  canHide?: boolean;
}

export interface UiPanelRegionPreset {
  id: string;
  label: string;
  layout: UiPanelInternalLayout;
}

export interface UiPanelRegionRegistryEntry {
  panelId: UiPanelId;
  label: string;
  regions: UiPanelRegionDefinition[];
  defaultLayout: UiPanelInternalLayout;
  presets?: UiPanelRegionPreset[];
}

export interface UiPanelAppearance {
  background?: string;
  borderColor?: string;
  borderWidth?: number;
  radius?: number;
  shadow?: boolean;
}

export interface UiLayout {
  version: number;
  sidebarWidth: number;
  headerHeight: number;
  contentPadding: number;
  actionStripHeight: number;
  panelRadius: number;
  uiScale: number;
  accent: string;
  background: string;
  panel: string;
  offsets: Record<UiRegion, UiOffset>;
  screenPanels: Partial<Record<ScreenId, Record<UiPanelId, UiPanelPosition>>>;
  panelRegions: Partial<Record<ScreenId, Record<UiPanelId, UiPanelInternalLayout>>>;
  panelAppearances: Partial<Record<ScreenId, Record<UiPanelId, UiPanelAppearance>>>;
}

export const UI_REGIONS: Array<{ id: UiRegion; label: string; description: string }> = [
  { id: 'sidebar', label: 'Sidebar', description: 'Navigation and game sections' },
  { id: 'header', label: 'Header', description: 'Character stats and save status' },
  { id: 'content', label: 'Content', description: 'The current game screen' },
  { id: 'actionStrip', label: 'Activity bar', description: 'Current mining, smithing, or combat' },
];

export const DEFAULT_COMBAT_PANEL_LAYOUT: Record<string, UiPanelPosition> = {
  combatLocations: { column: 1, row: 1, columnSpan: 12, height: 0, scale: 1, locked: false },
  player: { column: 1, row: 2, columnSpan: 3, height: 0, scale: 1, locked: false },
  liveCombat: { column: 4, row: 2, columnSpan: 6, height: 0, scale: 1, locked: false },
  enemy: { column: 10, row: 2, columnSpan: 3, height: 0, scale: 1, locked: false },
  combatOverview: { column: 1, row: 3, columnSpan: 12, height: 0, scale: 1, locked: false },
};

export const DEFAULT_INVENTORY_PANEL_LAYOUT: Record<string, UiPanelPosition> = {
  inventoryToolbar: { column: 1, row: 1, columnSpan: 12, height: 0, scale: 1, locked: false },
  inventoryBank: { column: 1, row: 2, columnSpan: 12, height: 0, scale: 1, locked: false },
};

export const DEFAULT_EQUIPMENT_PANEL_LAYOUT: Record<string, UiPanelPosition> = {
  equipmentLoadout: { column: 1, row: 1, columnSpan: 7, height: 0, scale: 1, locked: false },
  equipmentStats: { column: 8, row: 1, columnSpan: 5, height: 0, scale: 1, locked: false },
};

export const DEFAULT_MINING_PANEL_LAYOUT: Record<string, UiPanelPosition> = {
  miningOverview: { column: 1, row: 1, columnSpan: 5, height: 0, scale: 1, locked: false },
  miningNodes: { column: 6, row: 1, columnSpan: 7, height: 0, scale: 1, locked: false },
  miningDetails: { column: 1, row: 2, columnSpan: 12, height: 0, scale: 1, locked: false },
};

export const DEFAULT_SMITHING_PANEL_LAYOUT: Record<string, UiPanelPosition> = {
  smithingOverview: { column: 1, row: 1, columnSpan: 12, height: 0, scale: 1, locked: false },
  smithingForge: { column: 1, row: 2, columnSpan: 12, height: 0, scale: 1, locked: false },
  smithingAnvil: { column: 1, row: 3, columnSpan: 12, height: 0, scale: 1, locked: false },
};

export const DEFAULT_HOME_PANEL_LAYOUT: Record<string, UiPanelPosition> = {
  homeOverview: { column: 1, row: 1, columnSpan: 12, height: 0, scale: 1, locked: false },
  homeCombatProgression: { column: 1, row: 2, columnSpan: 6, height: 0, scale: 1, locked: false },
  homeProfessionProgression: { column: 7, row: 2, columnSpan: 6, height: 0, scale: 1, locked: false },
  homeWorldRecord: { column: 1, row: 3, columnSpan: 12, height: 0, scale: 1, locked: false },
};

export const DEFAULT_COLLECTION_PANEL_LAYOUT: Record<string, UiPanelPosition> = {
  collectionSummary: { column: 1, row: 1, columnSpan: 12, height: 0, scale: 1, locked: false },
  collectionBrowser: { column: 1, row: 2, columnSpan: 12, height: 0, scale: 1, locked: false },
};

export const DEFAULT_SETTINGS_PANEL_LAYOUT: Record<string, UiPanelPosition> = {
  settingsSave: { column: 1, row: 1, columnSpan: 6, height: 0, scale: 1, locked: false },
  settingsPresentation: { column: 7, row: 1, columnSpan: 6, height: 0, scale: 1, locked: false },
};

export const DEFAULT_HELP_PANEL_LAYOUT: Record<string, UiPanelPosition> = {
  helpGameplay: { column: 1, row: 1, columnSpan: 6, height: 0, scale: 1, locked: false },
  helpSaveInventory: { column: 7, row: 1, columnSpan: 6, height: 0, scale: 1, locked: false },
};

export const UI_SCREEN_PANELS: Partial<Record<ScreenId, UiPanelDefinition[]>> = {
  home: [
    {
      id: 'homeOverview',
      label: 'Character overview',
      description: 'Character metrics, activity, and Three.js visual',
      defaultPosition: DEFAULT_HOME_PANEL_LAYOUT.homeOverview,
    },
    {
      id: 'homeCombatProgression',
      label: 'Combat progression',
      description: 'Combat levels and progression milestones',
      defaultPosition: DEFAULT_HOME_PANEL_LAYOUT.homeCombatProgression,
    },
    {
      id: 'homeProfessionProgression',
      label: 'Profession progression',
      description: 'Mining and Smithing progression',
      defaultPosition: DEFAULT_HOME_PANEL_LAYOUT.homeProfessionProgression,
    },
    {
      id: 'homeWorldRecord',
      label: 'World record',
      description: 'Collection progress and lifetime records',
      defaultPosition: DEFAULT_HOME_PANEL_LAYOUT.homeWorldRecord,
    },
  ],
  combat: [
    {
      id: 'combatLocations',
      label: 'Combat locations',
      description: 'Areas and enemy roster',
      defaultPosition: DEFAULT_COMBAT_PANEL_LAYOUT.combatLocations,
    },
    {
      id: 'player',
      label: 'Player',
      description: 'Equipment, style, and derived stats',
      defaultPosition: DEFAULT_COMBAT_PANEL_LAYOUT.player,
    },
    {
      id: 'liveCombat',
      label: 'Live combat resolution',
      description: 'Health, timing, and controls',
      defaultPosition: DEFAULT_COMBAT_PANEL_LAYOUT.liveCombat,
    },
    {
      id: 'enemy',
      label: 'Enemy',
      description: 'Enemy details and drop preview',
      defaultPosition: DEFAULT_COMBAT_PANEL_LAYOUT.enemy,
    },
    {
      id: 'combatOverview',
      label: 'Combat overview',
      description: 'Session, loot, and progression',
      defaultPosition: DEFAULT_COMBAT_PANEL_LAYOUT.combatOverview,
    },
  ],
  inventory: [
    {
      id: 'inventoryToolbar',
      label: 'Inventory controls',
      description: 'Search, category filters, capacity, and inventory navigation',
      defaultPosition: DEFAULT_INVENTORY_PANEL_LAYOUT.inventoryToolbar,
    },
    {
      id: 'inventoryBank',
      label: 'Inventory bank',
      description: 'Stored item stacks and empty inventory state',
      defaultPosition: DEFAULT_INVENTORY_PANEL_LAYOUT.inventoryBank,
    },
  ],
  equipment: [
    {
      id: 'equipmentLoadout',
      label: 'Equipment loadout',
      description: 'Combat, accessory, and profession equipment slots',
      defaultPosition: DEFAULT_EQUIPMENT_PANEL_LAYOUT.equipmentLoadout,
    },
    {
      id: 'equipmentStats',
      label: 'Equipment statistics',
      description: 'Combat statistics and profession bonuses',
      defaultPosition: DEFAULT_EQUIPMENT_PANEL_LAYOUT.equipmentStats,
    },
  ],
  mining: [
    {
      id: 'miningOverview',
      label: 'Mining overview',
      description: 'Mining scene, selected node, and current cycle',
      defaultPosition: DEFAULT_MINING_PANEL_LAYOUT.miningOverview,
    },
    {
      id: 'miningNodes',
      label: 'Mining nodes',
      description: 'Available nodes, requirements, outputs, and action controls',
      defaultPosition: DEFAULT_MINING_PANEL_LAYOUT.miningNodes,
    },
    {
      id: 'miningDetails',
      label: 'Mining details',
      description: 'Tool stats, rock stages, stamina, and rewards',
      defaultPosition: DEFAULT_MINING_PANEL_LAYOUT.miningDetails,
    },
  ],
  smithing: [
    {
      id: 'smithingOverview',
      label: 'Smithing overview',
      description: 'Active work, level progress, quantity mode, and fuel status',
      defaultPosition: DEFAULT_SMITHING_PANEL_LAYOUT.smithingOverview,
    },
    {
      id: 'smithingForge',
      label: 'Smithing Forge',
      description: 'Smelt ore into bars with authored Coal fuel',
      defaultPosition: DEFAULT_SMITHING_PANEL_LAYOUT.smithingForge,
    },
    {
      id: 'smithingAnvil',
      label: 'Smithing Anvil',
      description: 'Forge equipment and profession tools from bars',
      defaultPosition: DEFAULT_SMITHING_PANEL_LAYOUT.smithingAnvil,
    },
  ],
  collection: [
    {
      id: 'collectionSummary',
      label: 'Collection summary',
      description: 'Completion progress for items and monsters',
      defaultPosition: DEFAULT_COLLECTION_PANEL_LAYOUT.collectionSummary,
    },
    {
      id: 'collectionBrowser',
      label: 'Collection browser',
      description: 'Tabs, filters, search, and collection details',
      defaultPosition: DEFAULT_COLLECTION_PANEL_LAYOUT.collectionBrowser,
    },
  ],
  settings: [
    {
      id: 'settingsSave',
      label: 'Save controls',
      description: 'Save, export, import, profile, and character actions',
      defaultPosition: DEFAULT_SETTINGS_PANEL_LAYOUT.settingsSave,
    },
    {
      id: 'settingsPresentation',
      label: 'Presentation',
      description: 'Sound, motion, numbers, help icons, and Three.js quality',
      defaultPosition: DEFAULT_SETTINGS_PANEL_LAYOUT.settingsPresentation,
    },
  ],
  help: [
    {
      id: 'helpGameplay',
      label: 'Gameplay and time',
      description: 'Actions, elapsed time, and offline progress',
      defaultPosition: DEFAULT_HELP_PANEL_LAYOUT.helpGameplay,
    },
    {
      id: 'helpSaveInventory',
      label: 'Save and inventory',
      description: 'Save safety and inventory guidance',
      defaultPosition: DEFAULT_HELP_PANEL_LAYOUT.helpSaveInventory,
    },
  ],
};

export const DEFAULT_HOME_OVERVIEW_INTERNAL_LAYOUT: UiPanelInternalLayout = {
  direction: 'grid',
  gap: 22,
  padding: 0,
  regions: {
    homeOverviewActivity: {
      order: 1,
      column: 1,
      columnSpan: 12,
      row: 1,
      visible: true,
    },
    homeOverviewStats: {
      order: 2,
      column: 1,
      columnSpan: 9,
      row: 2,
      visible: true,
    },
    homeOverviewCharacter: {
      order: 3,
      column: 10,
      columnSpan: 3,
      row: 2,
      visible: true,
    },
  },
};

export const DEFAULT_HOME_COMBAT_PROGRESSION_INTERNAL_LAYOUT: UiPanelInternalLayout = {
  direction: 'grid',
  gap: 0,
  padding: 0,
  regions: {
    homeCombatProgressionHeading: { order: 1, column: 1, columnSpan: 12, row: 1, visible: true },
    homeCombatProgressionBoard: { order: 2, column: 1, columnSpan: 12, row: 2, visible: true },
    homeCombatProgressionRecent: { order: 3, column: 1, columnSpan: 12, row: 3, visible: true },
  },
};

export const DEFAULT_HOME_PROFESSION_PROGRESSION_INTERNAL_LAYOUT: UiPanelInternalLayout = {
  direction: 'grid',
  gap: 0,
  padding: 0,
  regions: {
    homeProfessionProgressionHeading: { order: 1, column: 1, columnSpan: 12, row: 1, visible: true },
    homeProfessionProgressionBoard: { order: 2, column: 1, columnSpan: 12, row: 2, visible: true },
    homeProfessionProgressionRecent: { order: 3, column: 1, columnSpan: 12, row: 3, visible: true },
  },
};

export const DEFAULT_HOME_WORLD_RECORD_INTERNAL_LAYOUT: UiPanelInternalLayout = {
  direction: 'grid',
  gap: 0,
  padding: 0,
  regions: {
    homeWorldRecordHeading: { order: 1, column: 1, columnSpan: 12, row: 1, visible: true },
    homeWorldRecordLifetimeStats: { order: 2, column: 1, columnSpan: 12, row: 2, visible: true },
    homeWorldRecordCollection: { order: 3, column: 1, columnSpan: 12, row: 3, visible: true },
  },
};

const withRegionPositionUpdates = (
  base: UiPanelInternalLayout,
  updates: Partial<Record<UiPanelRegionId, Partial<UiPanelRegionPosition>>>,
  direction: UiPanelInternalDirection = base.direction,
): UiPanelInternalLayout => ({
  direction,
  gap: base.gap,
  padding: base.padding,
  regions: Object.fromEntries(
    Object.entries(base.regions).map(([id, position]) => [id, { ...position, ...(updates[id] ?? {}) }]),
  ),
});

const stackedRegionLayout = (base: UiPanelInternalLayout): UiPanelInternalLayout =>
  withRegionPositionUpdates(
    base,
    Object.fromEntries(
      Object.keys(base.regions).map((id, index) => [
        id,
        { column: 1, columnSpan: 12, row: index + 1, order: index + 1 },
      ]),
    ),
    'stack',
  );

const splitRegionLayout = (
  base: UiPanelInternalLayout,
  firstRegionId: UiPanelRegionId,
  secondRegionId: UiPanelRegionId,
  firstSpan: number,
): UiPanelInternalLayout =>
  withRegionPositionUpdates(base, {
    [firstRegionId]: { column: 1, columnSpan: firstSpan, row: 2 },
    [secondRegionId]: { column: firstSpan + 1, columnSpan: 12 - firstSpan, row: 2 },
  });

const homeOverviewRatioLayout = (statsSpan: number): UiPanelInternalLayout =>
  withRegionPositionUpdates(DEFAULT_HOME_OVERVIEW_INTERNAL_LAYOUT, {
    homeOverviewStats: { column: 1, columnSpan: statsSpan, row: 2 },
    homeOverviewCharacter: { column: statsSpan + 1, columnSpan: 12 - statsSpan, row: 2 },
  });

const homeOverviewPresets: UiPanelRegionPreset[] = [
  { id: 'default', label: 'Default', layout: DEFAULT_HOME_OVERVIEW_INTERNAL_LAYOUT },
  { id: '75-25', label: '75 / 25', layout: homeOverviewRatioLayout(9) },
  { id: '67-33', label: '67 / 33', layout: homeOverviewRatioLayout(8) },
  { id: '50-50', label: '50 / 50', layout: homeOverviewRatioLayout(6) },
  { id: 'stacked', label: 'Stacked', layout: stackedRegionLayout(DEFAULT_HOME_OVERVIEW_INTERNAL_LAYOUT) },
];

const homeProgressionPresets = (
  base: UiPanelInternalLayout,
  boardId: UiPanelRegionId,
  recentId: UiPanelRegionId,
): UiPanelRegionPreset[] => [
  { id: 'default', label: 'Default', layout: base },
  {
    id: 'board-recent-columns',
    label: 'Board + Recent Columns',
    layout: splitRegionLayout(base, boardId, recentId, 8),
  },
  { id: 'stacked', label: 'Stacked', layout: stackedRegionLayout(base) },
];

const homeWorldRecordPresets: UiPanelRegionPreset[] = [
  { id: 'default', label: 'Default', layout: DEFAULT_HOME_WORLD_RECORD_INTERNAL_LAYOUT },
  {
    id: 'split-record',
    label: 'Split Record',
    layout: splitRegionLayout(
      DEFAULT_HOME_WORLD_RECORD_INTERNAL_LAYOUT,
      'homeWorldRecordLifetimeStats',
      'homeWorldRecordCollection',
      7,
    ),
  },
  {
    id: '50-50',
    label: '50 / 50',
    layout: splitRegionLayout(
      DEFAULT_HOME_WORLD_RECORD_INTERNAL_LAYOUT,
      'homeWorldRecordLifetimeStats',
      'homeWorldRecordCollection',
      6,
    ),
  },
  { id: 'stacked', label: 'Stacked', layout: stackedRegionLayout(DEFAULT_HOME_WORLD_RECORD_INTERNAL_LAYOUT) },
];

export const UI_PANEL_REGION_REGISTRY: Partial<
  Record<ScreenId, Partial<Record<UiPanelId, UiPanelRegionRegistryEntry>>>
> = {
  home: {
    homeOverview: {
      panelId: 'homeOverview',
      label: 'Character overview contents',
      defaultLayout: DEFAULT_HOME_OVERVIEW_INTERNAL_LAYOUT,
      presets: homeOverviewPresets,
      regions: [
        {
          id: 'homeOverviewActivity',
          label: 'Current Activity',
          description: 'The latest combat, mining, or smithing activity',
          defaultPosition: DEFAULT_HOME_OVERVIEW_INTERNAL_LAYOUT.regions.homeOverviewActivity,
          canHide: true,
        },
        {
          id: 'homeOverviewStats',
          label: 'Stats',
          description: 'Character level and derived metrics',
          defaultPosition: DEFAULT_HOME_OVERVIEW_INTERNAL_LAYOUT.regions.homeOverviewStats,
          canHide: true,
        },
        {
          id: 'homeOverviewCharacter',
          label: 'Character Visual',
          description: 'The Three.js character scene',
          defaultPosition: DEFAULT_HOME_OVERVIEW_INTERNAL_LAYOUT.regions.homeOverviewCharacter,
          canHide: true,
        },
      ],
    },
    homeCombatProgression: {
      panelId: 'homeCombatProgression',
      label: 'Combat progression contents',
      defaultLayout: DEFAULT_HOME_COMBAT_PROGRESSION_INTERNAL_LAYOUT,
      presets: homeProgressionPresets(
        DEFAULT_HOME_COMBAT_PROGRESSION_INTERNAL_LAYOUT,
        'homeCombatProgressionBoard',
        'homeCombatProgressionRecent',
      ),
      regions: [
        {
          id: 'homeCombatProgressionHeading',
          label: 'Heading',
          description: 'Panel title and Combat section label',
          defaultPosition: DEFAULT_HOME_COMBAT_PROGRESSION_INTERNAL_LAYOUT.regions.homeCombatProgressionHeading,
          canHide: true,
        },
        {
          id: 'homeCombatProgressionBoard',
          label: 'Skill Board',
          description: 'Hitpoints and melee progression groups',
          defaultPosition: DEFAULT_HOME_COMBAT_PROGRESSION_INTERNAL_LAYOUT.regions.homeCombatProgressionBoard,
          canHide: true,
        },
        {
          id: 'homeCombatProgressionRecent',
          label: 'Recent Combat',
          description: 'Latest combat level-up milestones',
          defaultPosition: DEFAULT_HOME_COMBAT_PROGRESSION_INTERNAL_LAYOUT.regions.homeCombatProgressionRecent,
          canHide: true,
        },
      ],
    },
    homeProfessionProgression: {
      panelId: 'homeProfessionProgression',
      label: 'Profession progression contents',
      defaultLayout: DEFAULT_HOME_PROFESSION_PROGRESSION_INTERNAL_LAYOUT,
      presets: homeProgressionPresets(
        DEFAULT_HOME_PROFESSION_PROGRESSION_INTERNAL_LAYOUT,
        'homeProfessionProgressionBoard',
        'homeProfessionProgressionRecent',
      ),
      regions: [
        {
          id: 'homeProfessionProgressionHeading',
          label: 'Heading',
          description: 'Panel title and Professions section label',
          defaultPosition: DEFAULT_HOME_PROFESSION_PROGRESSION_INTERNAL_LAYOUT.regions.homeProfessionProgressionHeading,
          canHide: true,
        },
        {
          id: 'homeProfessionProgressionBoard',
          label: 'Skill Board',
          description: 'Mining and Smithing progression groups',
          defaultPosition: DEFAULT_HOME_PROFESSION_PROGRESSION_INTERNAL_LAYOUT.regions.homeProfessionProgressionBoard,
          canHide: true,
        },
        {
          id: 'homeProfessionProgressionRecent',
          label: 'Recent Profession',
          description: 'Latest profession level-up milestones',
          defaultPosition: DEFAULT_HOME_PROFESSION_PROGRESSION_INTERNAL_LAYOUT.regions.homeProfessionProgressionRecent,
          canHide: true,
        },
      ],
    },
    homeWorldRecord: {
      panelId: 'homeWorldRecord',
      label: 'World record contents',
      defaultLayout: DEFAULT_HOME_WORLD_RECORD_INTERNAL_LAYOUT,
      presets: homeWorldRecordPresets,
      regions: [
        {
          id: 'homeWorldRecordHeading',
          label: 'Heading',
          description: 'World Record title and Collection navigation action',
          defaultPosition: DEFAULT_HOME_WORLD_RECORD_INTERNAL_LAYOUT.regions.homeWorldRecordHeading,
          canHide: true,
        },
        {
          id: 'homeWorldRecordLifetimeStats',
          label: 'Lifetime Stats',
          description: 'Enemies defeated, total items gained, and time played',
          defaultPosition: DEFAULT_HOME_WORLD_RECORD_INTERNAL_LAYOUT.regions.homeWorldRecordLifetimeStats,
          canHide: true,
        },
        {
          id: 'homeWorldRecordCollection',
          label: 'Collection Progress',
          description: 'Items, monsters, overall completion, and progress bar',
          defaultPosition: DEFAULT_HOME_WORLD_RECORD_INTERNAL_LAYOUT.regions.homeWorldRecordCollection,
          canHide: true,
        },
      ],
    },
  },
};

const EMPTY_UI_PANELS: UiPanelDefinition[] = [];

export const getUiPanels = (screen: ScreenId): UiPanelDefinition[] =>
  UI_SCREEN_PANELS[screen] ?? EMPTY_UI_PANELS;

const EMPTY_PANEL_REGIONS: UiPanelRegionDefinition[] = [];

export const getUiPanelRegionRegistry = (
  screen: ScreenId,
  panelId: UiPanelId,
): UiPanelRegionRegistryEntry | undefined => UI_PANEL_REGION_REGISTRY[screen]?.[panelId];

export const getUiPanelRegions = (
  screen: ScreenId,
  panelId: UiPanelId,
): UiPanelRegionDefinition[] => getUiPanelRegionRegistry(screen, panelId)?.regions ?? EMPTY_PANEL_REGIONS;

const EMPTY_PANEL_PRESETS: UiPanelRegionPreset[] = [];

export const getUiPanelRegionPresets = (
  screen: ScreenId,
  panelId: UiPanelId,
): UiPanelRegionPreset[] => getUiPanelRegionRegistry(screen, panelId)?.presets ?? EMPTY_PANEL_PRESETS;

const internalLayoutsMatch = (first: UiPanelInternalLayout, second: UiPanelInternalLayout): boolean =>
  first.direction === second.direction &&
  first.gap === second.gap &&
  first.padding === second.padding &&
  Object.keys(first.regions).every((id) => {
    const firstPosition = first.regions[id];
    const secondPosition = second.regions[id];
    return (
      secondPosition &&
      firstPosition.order === secondPosition.order &&
      firstPosition.column === secondPosition.column &&
      firstPosition.columnSpan === secondPosition.columnSpan &&
      firstPosition.row === secondPosition.row &&
      firstPosition.visible === secondPosition.visible
    );
  });

export const getUiPanelRegionPreset = (
  screen: ScreenId,
  panelId: UiPanelId,
  layout: UiPanelInternalLayout,
): UiPanelRegionPreset | undefined =>
  getUiPanelRegionPresets(screen, panelId).find((preset) => internalLayoutsMatch(preset.layout, layout));

const cloneInternalLayout = (layout: UiPanelInternalLayout): UiPanelInternalLayout => ({
  direction: layout.direction,
  gap: layout.gap,
  padding: layout.padding,
  regions: Object.fromEntries(
    Object.entries(layout.regions).map(([id, position]) => [id, { ...position }]),
  ),
});

export const getUiPanelInternalLayout = (
  layout: UiLayout,
  screen: ScreenId,
  panelId: UiPanelId,
): UiPanelInternalLayout => {
  const stored = layout.panelRegions[screen]?.[panelId];
  const fallback = getUiPanelRegionRegistry(screen, panelId)?.defaultLayout;
  return cloneInternalLayout(stored ?? fallback ?? { direction: 'grid', gap: 0, padding: 0, regions: {} });
};

export const getUiPanelAppearance = (
  layout: UiLayout,
  screen: ScreenId,
  panelId: UiPanelId,
): UiPanelAppearance => ({ ...(layout.panelAppearances[screen]?.[panelId] ?? {}) });

export const DEFAULT_UI_LAYOUT: UiLayout = {
  version: UI_LAYOUT_VERSION,
  sidebarWidth: 236,
  headerHeight: 70,
  contentPadding: 28,
  actionStripHeight: 77,
  panelRadius: 12,
  uiScale: 1,
  accent: '#d5aa62',
  background: '#0d1012',
  panel: '#171b1f',
  offsets: {
    sidebar: { x: 0, y: 0 },
    header: { x: 0, y: 0 },
    content: { x: 0, y: 0 },
    actionStrip: { x: 0, y: 0 },
  },
  panelRegions: {
    home: {
      homeOverview: cloneInternalLayout(DEFAULT_HOME_OVERVIEW_INTERNAL_LAYOUT),
      homeCombatProgression: cloneInternalLayout(DEFAULT_HOME_COMBAT_PROGRESSION_INTERNAL_LAYOUT),
      homeProfessionProgression: cloneInternalLayout(DEFAULT_HOME_PROFESSION_PROGRESSION_INTERNAL_LAYOUT),
      homeWorldRecord: cloneInternalLayout(DEFAULT_HOME_WORLD_RECORD_INTERNAL_LAYOUT),
    },
  },
  panelAppearances: {},
  screenPanels: {
    home: DEFAULT_HOME_PANEL_LAYOUT,
    combat: DEFAULT_COMBAT_PANEL_LAYOUT,
    inventory: DEFAULT_INVENTORY_PANEL_LAYOUT,
    equipment: DEFAULT_EQUIPMENT_PANEL_LAYOUT,
    mining: DEFAULT_MINING_PANEL_LAYOUT,
    smithing: DEFAULT_SMITHING_PANEL_LAYOUT,
    collection: DEFAULT_COLLECTION_PANEL_LAYOUT,
    settings: DEFAULT_SETTINGS_PANEL_LAYOUT,
    help: DEFAULT_HELP_PANEL_LAYOUT,
  },
};

const clamp = (value: unknown, min: number, max: number, fallback: number): number => {
  const number = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, number));
};

const safeColor = (value: unknown, fallback: string): string =>
  typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;

const safeOffset = (value: unknown, fallback: UiOffset): UiOffset => {
  if (!value || typeof value !== 'object') return fallback;
  const record = value as Record<string, unknown>;
  return {
    x: clamp(record.x, -80, 80, fallback.x),
    y: clamp(record.y, -60, 60, fallback.y),
  };
};

const safePanelPosition = (value: unknown, fallback: UiPanelPosition): UiPanelPosition => {
  if (!value || typeof value !== 'object') return fallback;
  const record = value as Record<string, unknown>;
  const column = Math.round(clamp(record.column, 1, 12, fallback.column));
  return {
    column,
    row: Math.round(clamp(record.row, 1, 12, fallback.row)),
    columnSpan: Math.round(
      clamp(record.columnSpan, 1, 13 - column, Math.min(fallback.columnSpan, 13 - column)),
    ),
    height: Math.round(clamp(record.height, 0, 900, fallback.height)),
    scale: clamp(record.scale, 0.5, 1.5, fallback.scale),
    locked: typeof record.locked === 'boolean' ? record.locked : false,
  };
};

const safeRegionPosition = (
  value: unknown,
  fallback: UiPanelRegionPosition,
): UiPanelRegionPosition => {
  if (!value || typeof value !== 'object') return { ...fallback };
  const record = value as Record<string, unknown>;
  const column = Math.round(clamp(record.column, 1, 12, fallback.column));
  return {
    order: Math.round(clamp(record.order, 1, 100, fallback.order)),
    column,
    row: Math.round(clamp(record.row, 1, 12, fallback.row)),
    columnSpan: Math.round(
      clamp(record.columnSpan, 1, 13 - column, Math.min(fallback.columnSpan, 13 - column)),
    ),
    visible: typeof record.visible === 'boolean' ? record.visible : fallback.visible,
  };
};

const safePanelInternalLayout = (
  value: unknown,
  fallback: UiPanelInternalLayout,
): UiPanelInternalLayout => {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const storedRegions = source.regions && typeof source.regions === 'object'
    ? (source.regions as Record<string, unknown>)
    : {};
  return {
    direction: source.direction === 'stack' ? 'stack' : 'grid',
    gap: Math.round(clamp(source.gap, 0, 32, fallback.gap)),
    padding: Math.round(clamp(source.padding, 0, 40, fallback.padding)),
    regions: Object.fromEntries(
      Object.entries(fallback.regions).map(([id, defaultPosition]) => [
        id,
        safeRegionPosition(storedRegions[id], defaultPosition),
      ]),
    ),
  };
};

const safePanelAppearance = (value: unknown): UiPanelAppearance => {
  if (!value || typeof value !== 'object') return {};
  const source = value as Record<string, unknown>;
  const appearance: UiPanelAppearance = {};
  if (typeof source.background === 'string' && /^#[0-9a-f]{6}$/i.test(source.background)) {
    appearance.background = source.background;
  }
  if (typeof source.borderColor === 'string' && /^#[0-9a-f]{6}$/i.test(source.borderColor)) {
    appearance.borderColor = source.borderColor;
  }
  if (source.borderWidth !== undefined) appearance.borderWidth = clamp(source.borderWidth, 0, 4, 1);
  if (source.radius !== undefined) appearance.radius = clamp(source.radius, 0, 28, 12);
  if (typeof source.shadow === 'boolean') appearance.shadow = source.shadow;
  return appearance;
};

export const migrateUiLayout = (value: unknown): unknown => {
  if (!value || typeof value !== 'object') return value;
  const source = value as Record<string, unknown>;
  const migrated: Record<string, unknown> = {
    ...source,
    version: UI_LAYOUT_VERSION,
  };
  if (!('panelRegions' in source)) migrated.panelRegions = DEFAULT_UI_LAYOUT.panelRegions;
  if (!('panelAppearances' in source)) migrated.panelAppearances = DEFAULT_UI_LAYOUT.panelAppearances;
  return migrated;
};

const hasLegacySmithingSplit = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false;
  const source = value as Record<string, unknown>;
  const forge = source.smithingForge;
  const anvil = source.smithingAnvil;
  if (!forge || typeof forge !== 'object' || !anvil || typeof anvil !== 'object') return false;
  const forgePosition = forge as Record<string, unknown>;
  const anvilPosition = anvil as Record<string, unknown>;
  return (
    forgePosition.row === anvilPosition.row &&
    typeof forgePosition.columnSpan === 'number' &&
    typeof anvilPosition.columnSpan === 'number' &&
    (forgePosition.columnSpan < 12 || anvilPosition.columnSpan < 12)
  );
};

const safeScreenPanelLayout = (
  value: unknown,
  definitions: UiPanelDefinition[],
): Record<UiPanelId, UiPanelPosition> => {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return Object.fromEntries(
    definitions.map((panel) => [
      panel.id,
      safePanelPosition(source[panel.id], panel.defaultPosition),
    ]),
  );
};

export const sanitizeUiLayout = (value: unknown): UiLayout => {
  const migrated = migrateUiLayout(value);
  if (!migrated || typeof migrated !== 'object') return DEFAULT_UI_LAYOUT;
  const record = migrated as Record<string, unknown>;
  const offsets = (record.offsets ?? {}) as Record<string, unknown>;
  const storedScreenPanels = (record.screenPanels ?? {}) as Record<string, unknown>;
  const legacyCombatPanels = record.combatPanels;
  const screenPanels: Partial<Record<ScreenId, Record<UiPanelId, UiPanelPosition>>> = {};
  const storedPanelRegions = (record.panelRegions ?? {}) as Record<string, unknown>;
  const panelRegions: Partial<Record<ScreenId, Record<UiPanelId, UiPanelInternalLayout>>> = {};
  const storedPanelAppearances = (record.panelAppearances ?? {}) as Record<string, unknown>;
  const panelAppearances: Partial<Record<ScreenId, Record<UiPanelId, UiPanelAppearance>>> = {};

  for (const [screen, definitions] of Object.entries(UI_SCREEN_PANELS) as Array<
    [ScreenId, UiPanelDefinition[]]
  >) {
    const source =
      screen === 'combat'
        ? (storedScreenPanels.combat ?? legacyCombatPanels)
        : storedScreenPanels[screen];
    screenPanels[screen] = safeScreenPanelLayout(
      screen === 'smithing' && hasLegacySmithingSplit(source) ? undefined : source,
      definitions,
    );

    const storedRegionsForScreen = storedPanelRegions[screen];
    const regionSource = storedRegionsForScreen && typeof storedRegionsForScreen === 'object'
      ? (storedRegionsForScreen as Record<string, unknown>)
      : {};
    const registeredRegions = UI_PANEL_REGION_REGISTRY[screen];
    if (registeredRegions) {
      panelRegions[screen] = {};
      for (const [panelId, entry] of Object.entries(registeredRegions)) {
        if (!entry) continue;
        panelRegions[screen][panelId] = safePanelInternalLayout(
          regionSource[panelId],
          entry.defaultLayout,
        );
      }
    }

    const storedAppearancesForScreen = storedPanelAppearances[screen];
    const appearanceSource = storedAppearancesForScreen && typeof storedAppearancesForScreen === 'object'
      ? (storedAppearancesForScreen as Record<string, unknown>)
      : {};
    const sanitizedAppearances = Object.fromEntries(
      definitions
        .map((panel) => [panel.id, safePanelAppearance(appearanceSource[panel.id])] as const)
        .filter(([, appearance]) => Object.keys(appearance).length > 0),
    );
    if (Object.keys(sanitizedAppearances).length > 0) {
      panelAppearances[screen] = sanitizedAppearances;
    }
  }

  return {
    version: UI_LAYOUT_VERSION,
    sidebarWidth: clamp(record.sidebarWidth, 170, 360, DEFAULT_UI_LAYOUT.sidebarWidth),
    headerHeight: clamp(record.headerHeight, 52, 110, DEFAULT_UI_LAYOUT.headerHeight),
    contentPadding: clamp(record.contentPadding, 10, 54, DEFAULT_UI_LAYOUT.contentPadding),
    actionStripHeight: clamp(
      record.actionStripHeight,
      58,
      125,
      DEFAULT_UI_LAYOUT.actionStripHeight,
    ),
    panelRadius: clamp(record.panelRadius, 0, 28, DEFAULT_UI_LAYOUT.panelRadius),
    uiScale: clamp(record.uiScale, 0.85, 1.15, DEFAULT_UI_LAYOUT.uiScale),
    accent: safeColor(record.accent, DEFAULT_UI_LAYOUT.accent),
    background: safeColor(record.background, DEFAULT_UI_LAYOUT.background),
    panel: safeColor(record.panel, DEFAULT_UI_LAYOUT.panel),
    offsets: {
      sidebar: safeOffset(offsets.sidebar, DEFAULT_UI_LAYOUT.offsets.sidebar),
      header: safeOffset(offsets.header, DEFAULT_UI_LAYOUT.offsets.header),
      content: safeOffset(offsets.content, DEFAULT_UI_LAYOUT.offsets.content),
      actionStrip: safeOffset(offsets.actionStrip, DEFAULT_UI_LAYOUT.offsets.actionStrip),
    },
    screenPanels,
    panelRegions,
    panelAppearances,
  };
};

export const resetUiPanelRegion = (
  layout: UiLayout,
  screen: ScreenId,
  panelId: UiPanelId,
  regionId: UiPanelRegionId,
): UiLayout => {
  const registry = getUiPanelRegionRegistry(screen, panelId);
  const defaultPosition = registry?.defaultLayout.regions[regionId];
  if (!defaultPosition) return sanitizeUiLayout(layout);
  const internal = getUiPanelInternalLayout(layout, screen, panelId);
  return sanitizeUiLayout({
    ...layout,
    panelRegions: {
      ...layout.panelRegions,
      [screen]: {
        ...(layout.panelRegions[screen] ?? {}),
        [panelId]: {
          ...internal,
          regions: {
            ...internal.regions,
            [regionId]: { ...defaultPosition },
          },
        },
      },
    },
  });
};

export const resetUiPanel = (layout: UiLayout, screen: ScreenId, panelId: UiPanelId): UiLayout => {
  const definition = getUiPanels(screen).find((panel) => panel.id === panelId);
  if (!definition) return sanitizeUiLayout(layout);
  const appearances = { ...(layout.panelAppearances[screen] ?? {}) };
  delete appearances[panelId];
  return sanitizeUiLayout({
    ...layout,
    screenPanels: {
      ...layout.screenPanels,
      [screen]: {
        ...(layout.screenPanels[screen] ?? {}),
        [panelId]: { ...definition.defaultPosition },
      },
    },
    panelRegions: {
      ...layout.panelRegions,
      [screen]: {
        ...(layout.panelRegions[screen] ?? {}),
        ...(getUiPanelRegionRegistry(screen, panelId)
          ? { [panelId]: cloneInternalLayout(getUiPanelRegionRegistry(screen, panelId)!.defaultLayout) }
          : {}),
      },
    },
    panelAppearances: {
      ...layout.panelAppearances,
      [screen]: appearances,
    },
  });
};

export const resetUiLayoutScreen = (layout: UiLayout, screen: ScreenId): UiLayout => {
  const defaults = DEFAULT_UI_LAYOUT.screenPanels[screen];
  if (!defaults) return sanitizeUiLayout(layout);
  const nestedDefaults = Object.fromEntries(
    Object.entries(UI_PANEL_REGION_REGISTRY[screen] ?? {}).map(([panelId, entry]) => [
      panelId,
      cloneInternalLayout(entry!.defaultLayout),
    ]),
  );
  return sanitizeUiLayout({
    ...layout,
    screenPanels: {
      ...layout.screenPanels,
      [screen]: Object.fromEntries(
        Object.entries(defaults).map(([id, position]) => [id, { ...position }]),
      ),
    },
    panelRegions: {
      ...layout.panelRegions,
      [screen]: nestedDefaults,
    },
    panelAppearances: {
      ...layout.panelAppearances,
      [screen]: {},
    },
  });
};

export const resetUiLayout = (): UiLayout => sanitizeUiLayout(DEFAULT_UI_LAYOUT);

export const loadUiLayout = (): UiLayout => {
  try {
    const raw = window.localStorage.getItem(UI_LAYOUT_STORAGE_KEY);
    return raw ? sanitizeUiLayout(JSON.parse(raw)) : DEFAULT_UI_LAYOUT;
  } catch {
    return DEFAULT_UI_LAYOUT;
  }
};

export const saveUiLayout = (layout: UiLayout): void => {
  try {
    window.localStorage.setItem(UI_LAYOUT_STORAGE_KEY, JSON.stringify(sanitizeUiLayout(layout)));
  } catch {
    // A private browsing context can deny localStorage. The editor still works for this session.
  }
};
