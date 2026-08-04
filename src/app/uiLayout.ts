export const UI_LAYOUT_STORAGE_KEY = 'ironbound-idle-ui-layout';

export type UiRegion = 'sidebar' | 'header' | 'content' | 'actionStrip';

export interface UiOffset {
  x: number;
  y: number;
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
}

export const UI_REGIONS: Array<{ id: UiRegion; label: string; description: string }> = [
  { id: 'sidebar', label: 'Sidebar', description: 'Navigation and game sections' },
  { id: 'header', label: 'Header', description: 'Character stats and save status' },
  { id: 'content', label: 'Content', description: 'The current game screen' },
  { id: 'actionStrip', label: 'Activity bar', description: 'Current mining, smithing, or combat' },
];

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
    x: clamp(record.x, -240, 240, fallback.x),
    y: clamp(record.y, -180, 180, fallback.y),
  };
};

export const sanitizeUiLayout = (value: unknown): UiLayout => {
  if (!value || typeof value !== 'object') return DEFAULT_UI_LAYOUT;
  const record = value as Record<string, unknown>;
  const offsets = (record.offsets ?? {}) as Record<string, unknown>;
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
    window.localStorage.setItem(UI_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // A private browsing context can deny localStorage. The editor still works for this session.
  }
};
