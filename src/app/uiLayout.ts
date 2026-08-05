import type { ScreenId } from '../game/types';

export const UI_LAYOUT_STORAGE_KEY = 'ironbound-idle-ui-layout';
export const UI_EDITOR_COMPACT_QUERY = '(max-width: 900px)';
export const UI_EDITOR_GRID_ROW_HEIGHT = 80;

export type UiRegion = 'sidebar' | 'header' | 'content' | 'actionStrip';
export type UiPanelId = string;

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
}

export interface UiPanelDefinition {
  id: UiPanelId;
  label: string;
  description: string;
  defaultPosition: UiPanelPosition;
}

export interface UiLayout {
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
}

export const UI_REGIONS: Array<{ id: UiRegion; label: string; description: string }> = [
  { id: 'sidebar', label: 'Sidebar', description: 'Navigation and game sections' },
  { id: 'header', label: 'Header', description: 'Character stats and save status' },
  { id: 'content', label: 'Content', description: 'The current game screen' },
  { id: 'actionStrip', label: 'Activity bar', description: 'Current mining, smithing, or combat' },
];

export const DEFAULT_COMBAT_PANEL_LAYOUT: Record<string, UiPanelPosition> = {
  combatLocations: { column: 1, row: 1, columnSpan: 12, height: 0, scale: 1 },
  targetPreview: { column: 1, row: 2, columnSpan: 12, height: 0, scale: 1 },
  player: { column: 1, row: 3, columnSpan: 3, height: 0, scale: 1 },
  liveCombat: { column: 4, row: 3, columnSpan: 6, height: 0, scale: 1 },
  enemy: { column: 10, row: 3, columnSpan: 3, height: 0, scale: 1 },
  combatOverview: { column: 1, row: 4, columnSpan: 12, height: 0, scale: 1 },
};

export const UI_SCREEN_PANELS: Partial<Record<ScreenId, UiPanelDefinition[]>> = {
  combat: [
    {
      id: 'combatLocations',
      label: 'Combat locations',
      description: 'Areas and enemy roster',
      defaultPosition: DEFAULT_COMBAT_PANEL_LAYOUT.combatLocations,
    },
    {
      id: 'targetPreview',
      label: 'Target Preview',
      description: 'Target analysis and forecasts',
      defaultPosition: DEFAULT_COMBAT_PANEL_LAYOUT.targetPreview,
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
};

const EMPTY_UI_PANELS: UiPanelDefinition[] = [];

export const getUiPanels = (screen: ScreenId): UiPanelDefinition[] =>
  UI_SCREEN_PANELS[screen] ?? EMPTY_UI_PANELS;

export const DEFAULT_UI_LAYOUT: UiLayout = {
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
  screenPanels: {
    combat: DEFAULT_COMBAT_PANEL_LAYOUT,
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
  };
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
  if (!value || typeof value !== 'object') return DEFAULT_UI_LAYOUT;
  const record = value as Record<string, unknown>;
  const offsets = (record.offsets ?? {}) as Record<string, unknown>;
  const storedScreenPanels = (record.screenPanels ?? {}) as Record<string, unknown>;
  const legacyCombatPanels = record.combatPanels;
  const screenPanels: Partial<Record<ScreenId, Record<UiPanelId, UiPanelPosition>>> = {};

  for (const [screen, definitions] of Object.entries(UI_SCREEN_PANELS) as Array<
    [ScreenId, UiPanelDefinition[]]
  >) {
    const source =
      screen === 'combat'
        ? (storedScreenPanels.combat ?? legacyCombatPanels)
        : storedScreenPanels[screen];
    screenPanels[screen] = safeScreenPanelLayout(source, definitions);
  }

  return {
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
  };
};

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
