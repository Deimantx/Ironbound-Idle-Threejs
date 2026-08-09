import { useEffect, useMemo, useRef, useState } from 'react';
import {
  GripVertical,
  LayoutGrid,
  Lock,
  Move,
  Palette,
  Redo2,
  RotateCcw,
  Unlock,
  Undo2,
  X,
} from 'lucide-react';
import {
  getUiPanels,
  UI_EDITOR_COMPACT_QUERY,
  UI_EDITOR_GRID_ROW_HEIGHT,
  UI_REGIONS,
  getUiPanelAppearance,
  getUiPanelInternalLayout,
  getUiPanelRegions,
  resetUiPanel,
  resetUiPanelRegion,
  resetUiLayoutScreen,
  resetUiLayout,
  type UiLayout,
  type UiPanelAppearance,
  type UiPanelInternalLayout,
  type UiPanelId,
  type UiPanelPosition,
  type UiPanelRegionId,
  type UiPanelRegionPosition,
  type UiRegion,
} from './uiLayout';
import {
  canEditPanelLayout,
  clampNestedColumnSpan,
  clampPanelColumnSpan,
  clampPanelHeight,
  findAvailableNestedRegionPosition,
  snapGridDelta,
} from './uiEditorGeometry';
import type { ScreenId } from '../game/types';

interface UiEditorProps {
  screen: ScreenId;
  layout: UiLayout;
  onChange: (layout: UiLayout) => void;
  onClose: () => void;
}

interface RegionBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface EditorBoxes {
  regions: Partial<Record<UiRegion, RegionBox>>;
  panels: Partial<Record<UiPanelId, RegionBox>>;
  nestedRegions: Partial<Record<string, RegionBox>>;
  grid?: RegionBox;
}

type SelectedTarget =
  | { kind: 'region'; id: UiRegion }
  | { kind: 'panel'; id: UiPanelId }
  | { kind: 'panelRegion'; panelId: UiPanelId; id: UiPanelRegionId };

interface GridMetrics {
  left: number;
  top: number;
  columnStep: number;
  rowStarts: number[];
}

interface DragState {
  target: SelectedTarget;
  startX: number;
  startY: number;
  pointerId: number;
  handle: HTMLButtonElement;
  originalOffset?: { x: number; y: number };
  grabOffsetX?: number;
  grabOffsetY?: number;
  gridMetrics?: GridMetrics;
}

type ResizeDirection = 'width' | 'height' | 'corner';

type ResizeState =
  | {
      target: { kind: 'panel'; id: UiPanelId };
      direction: ResizeDirection;
      startX: number;
      startY: number;
      pointerId: number;
      handle: HTMLButtonElement;
      original: UiPanelPosition;
      gridMetrics: GridMetrics;
    }
  | {
      target: { kind: 'panelRegion'; panelId: UiPanelId; id: UiPanelRegionId };
      direction: 'width';
      startX: number;
      startY: number;
      pointerId: number;
      handle: HTMLButtonElement;
      original: UiPanelRegionPosition;
      gridMetrics: GridMetrics;
    };

const numberLabel = (value: number): string =>
  Number.isInteger(value) ? `${value}px` : `${Math.round(value * 100)}%`;

const EMPTY_PANEL_LAYOUT: Record<UiPanelId, UiPanelPosition> = {};

const clamp = (value: number, min: number, max: number): number => {
  const safeValue = Number.isFinite(value) ? value : min;
  return Math.min(max, Math.max(min, safeValue));
};

const getGridMetrics = (
  screen: ScreenId,
  panelLayout: Record<UiPanelId, UiPanelPosition>,
  measuredPanels: Partial<Record<UiPanelId, RegionBox>>,
): GridMetrics | null => {
  const grid = document.querySelector<HTMLElement>(`[data-ui-panel-grid="${screen}"]`);
  if (!grid) return null;
  const rect = grid.getBoundingClientRect();
  if (!Number.isFinite(rect.left) || !Number.isFinite(rect.top) || rect.width <= 0) return null;
  const computed = window.getComputedStyle(grid);
  const columnGap = Number.parseFloat(computed.columnGap) || 0;
  const rowGap = Number.parseFloat(computed.rowGap) || 0;
  const columns =
    computed.gridTemplateColumns
      .match(/[\d.]+px/g)
      ?.map(Number)
      .filter((value) => Number.isFinite(value) && value > 0) ?? [];
  const fallbackColumnWidth = (rect.width - columnGap * 11) / 12;
  const columnWidth = columns.length >= 12 ? columns[0] : fallbackColumnWidth;
  if (!Number.isFinite(columnWidth) || columnWidth <= 0) return null;
  const columnStep = columnWidth + columnGap;
  const rowStep = UI_EDITOR_GRID_ROW_HEIGHT + rowGap;
  if (!Number.isFinite(columnStep) || columnStep <= 0 || rowStep <= 0) return null;
  const rowStarts = Array.from({ length: 12 }, () => Number.NaN);
  for (const panel of getUiPanels(screen)) {
    const position = panelLayout[panel.id];
    const box = measuredPanels[panel.id];
    if (!position || !box || position.row < 1 || position.row > 12) continue;
    const measuredStart = box.top - rect.top;
    if (Number.isFinite(measuredStart) && measuredStart >= 0) {
      rowStarts[position.row - 1] = measuredStart;
    }
  }
  if (!Number.isFinite(rowStarts[0])) rowStarts[0] = 0;
  for (let index = 1; index < rowStarts.length; index += 1) {
    if (!Number.isFinite(rowStarts[index])) {
      rowStarts[index] = rowStarts[index - 1] + rowStep;
    }
  }
  return {
    left: rect.left,
    top: rect.top,
    columnStep,
    rowStarts,
  };
};

const getGridRow = (metrics: GridMetrics, top: number): number => {
  const relativeTop = top - metrics.top;
  let row = 1;
  for (let index = 1; index < metrics.rowStarts.length; index += 1) {
    if (relativeTop >= metrics.rowStarts[index]) row = index + 1;
  }
  return clamp(row, 1, 12);
};

const getNestedGridMetrics = (
  screen: ScreenId,
  panelId: UiPanelId,
  internal: ReturnType<typeof getUiPanelInternalLayout>,
  measuredRegions: Partial<Record<string, RegionBox>>,
): GridMetrics | null => {
  const grid = document.querySelector<HTMLElement>(
    `[data-ui-panel-region-grid="${panelId}"][data-ui-panel-region-screen="${screen}"]`,
  );
  if (!grid) return null;
  const rect = grid.getBoundingClientRect();
  if (!Number.isFinite(rect.left) || !Number.isFinite(rect.top) || rect.width <= 0) return null;
  const computed = window.getComputedStyle(grid);
  const columnGap = Number.parseFloat(computed.columnGap) || 0;
  const columns =
    computed.gridTemplateColumns
      .match(/[\d.]+px/g)
      ?.map(Number)
      .filter((value) => Number.isFinite(value) && value > 0) ?? [];
  const fallbackColumnWidth = (rect.width - columnGap * 11) / 12;
  const columnWidth = columns.length >= 12 ? columns[0] : fallbackColumnWidth;
  const columnStep = columnWidth + columnGap;
  if (!Number.isFinite(columnStep) || columnStep <= 0) return null;
  const rowStarts = Array.from({ length: 12 }, () => Number.NaN);
  for (const region of getUiPanelRegions(screen, panelId)) {
    const position = internal.regions[region.id];
    const box = measuredRegions[`${panelId}:${region.id}`];
    if (!position || !box || position.row < 1 || position.row > 12) continue;
    rowStarts[position.row - 1] = box.top - rect.top;
  }
  if (!Number.isFinite(rowStarts[0])) rowStarts[0] = 0;
  const rowStep = Number.parseFloat(computed.gridAutoRows) || 80;
  for (let index = 1; index < rowStarts.length; index += 1) {
    if (!Number.isFinite(rowStarts[index])) rowStarts[index] = rowStarts[index - 1] + rowStep;
  }
  return { left: rect.left, top: rect.top, columnStep, rowStarts };
};

const panelOverlaps = (first: UiPanelPosition, second: UiPanelPosition): boolean =>
  first.row === second.row &&
  first.column < second.column + second.columnSpan &&
  second.column < first.column + first.columnSpan;

export const findAvailablePanelPosition = (
  layout: UiLayout,
  screen: ScreenId,
  panelId: UiPanelId,
  proposed: UiPanelPosition,
  strategy: 'nearest' | 'center' = 'nearest',
): UiPanelPosition => {
  const panelLayout = layout.screenPanels[screen] ?? EMPTY_PANEL_LAYOUT;
  const occupied = getUiPanels(screen)
    .filter((panel) => panel.id !== panelId)
    .map((panel) => panelLayout[panel.id])
    .filter((position): position is UiPanelPosition => Boolean(position));
  if (!occupied.some((position) => panelOverlaps(proposed, position))) return proposed;

  let best: UiPanelPosition | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  const maxColumn = 13 - proposed.columnSpan;
  if (strategy === 'nearest') {
    const rowCandidates = Array.from({ length: 12 }, (_, index) => index + 1).sort(
      (first, second) =>
        Math.abs(first - proposed.row) - Math.abs(second - proposed.row) ||
        (first < proposed.row ? 1 : -1) - (second < proposed.row ? 1 : -1),
    );
    const columnCandidates = Array.from({ length: maxColumn }, (_, index) => index + 1).sort(
      (first, second) => Math.abs(first - proposed.column) - Math.abs(second - proposed.column),
    );
    for (const row of rowCandidates) {
      for (const column of columnCandidates) {
        const candidate = { ...proposed, column, row };
        if (!occupied.some((position) => panelOverlaps(candidate, position))) return candidate;
      }
    }
    return proposed;
  }
  for (let row = 1; row <= 12; row += 1) {
    for (let column = 1; column <= maxColumn; column += 1) {
      const candidate = { ...proposed, column, row };
      if (occupied.some((position) => panelOverlaps(candidate, position))) continue;
      const distance =
        strategy === 'center'
          ? Math.abs(column - proposed.column) * 100 + Math.abs(row - proposed.row)
          : Math.abs(row - proposed.row) * 12 + Math.abs(column - proposed.column);
      if (distance < bestDistance) {
        best = candidate;
        bestDistance = distance;
      }
    }
  }
  return best ?? proposed;
};

export function UiEditor({ screen, layout, onChange, onClose }: UiEditorProps) {
  const [selected, setSelected] = useState<SelectedTarget>({ kind: 'region', id: 'content' });
  const [boxes, setBoxes] = useState<EditorBoxes>({ regions: {}, panels: {}, nestedRegions: {} });
  const [expandedPanels, setExpandedPanels] = useState<Record<UiPanelId, boolean>>({});
  const [compactViewport, setCompactViewport] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(UI_EDITOR_COMPACT_QUERY).matches
      : false,
  );
  const drag = useRef<DragState | null>(null);
  const resize = useRef<ResizeState | null>(null);
  const history = useRef<{ entries: UiLayout[]; index: number; pending: UiLayout | null; timer: number | null }>({
    entries: [layout],
    index: 0,
    pending: null,
    timer: null,
  });
  const historyScreen = useRef(screen);
  const [, setHistoryVersion] = useState(0);
  const panelDefinitions = useMemo(() => getUiPanels(screen), [screen]);
  const panelLayout = useMemo(
    () => layout.screenPanels[screen] ?? EMPTY_PANEL_LAYOUT,
    [layout.screenPanels, screen],
  );
  const boxesRef = useRef(boxes);
  const layoutRef = useRef(layout);
  const onChangeRef = useRef(onChange);
  const panelLayoutRef = useRef(panelLayout);
  const screenRef = useRef(screen);
  const scheduleMeasureRef = useRef<() => void>(() => undefined);
  const screenLabel = screen.charAt(0).toUpperCase() + screen.slice(1);

  const syncLayout = (next: UiLayout) => {
    layoutRef.current = next;
    onChangeRef.current(next);
  };

  const recordHistory = (next: UiLayout) => {
    const state = history.current;
    const current = state.entries[state.index];
    if (JSON.stringify(current) === JSON.stringify(next)) return;
    state.entries = [...state.entries.slice(0, state.index + 1), next].slice(-80);
    state.index = state.entries.length - 1;
    state.pending = null;
    setHistoryVersion((value) => value + 1);
  };

  const flushHistory = () => {
    const state = history.current;
    if (state.timer !== null) window.clearTimeout(state.timer);
    state.timer = null;
    if (state.pending) {
      recordHistory(state.pending);
      state.pending = null;
    }
  };

  const commitLayout = (next: UiLayout, mode: 'immediate' | 'debounced' | 'none' = 'debounced') => {
    syncLayout(next);
    if (mode === 'none') return;
    if (mode === 'immediate') {
      flushHistory();
      recordHistory(next);
      return;
    }
    const state = history.current;
    if (state.index < state.entries.length - 1) {
      state.entries = state.entries.slice(0, state.index + 1);
      setHistoryVersion((value) => value + 1);
    }
    state.pending = next;
    if (state.timer !== null) window.clearTimeout(state.timer);
    state.timer = window.setTimeout(() => {
      state.timer = null;
      if (state.pending) recordHistory(state.pending);
    }, 240);
  };

  const undo = () => {
    flushHistory();
    const state = history.current;
    if (state.index <= 0) return;
    state.index -= 1;
    syncLayout(state.entries[state.index]);
    setHistoryVersion((value) => value + 1);
  };

  const redo = () => {
    flushHistory();
    const state = history.current;
    if (state.index >= state.entries.length - 1) return;
    state.index += 1;
    syncLayout(state.entries[state.index]);
    setHistoryVersion((value) => value + 1);
  };
  const undoRef = useRef(undo);
  const redoRef = useRef(redo);
  undoRef.current = undo;
  redoRef.current = redo;

  useEffect(() => {
    boxesRef.current = boxes;
    layoutRef.current = layout;
    onChangeRef.current = onChange;
    panelLayoutRef.current = panelLayout;
    screenRef.current = screen;
  }, [boxes, layout, onChange, panelLayout, screen]);

  useEffect(() => {
    if (historyScreen.current === screen) return;
    const state = history.current;
    if (state.timer !== null) window.clearTimeout(state.timer);
    state.timer = null;
    state.pending = null;
    state.entries = [layoutRef.current];
    state.index = 0;
    historyScreen.current = screen;
    drag.current = null;
    resize.current = null;
    setSelected({ kind: 'region', id: 'content' });
    setHistoryVersion((value) => value + 1);
  }, [screen]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mediaQuery = window.matchMedia(UI_EDITOR_COMPACT_QUERY);
    const updateViewport = () => setCompactViewport(mediaQuery.matches);
    updateViewport();
    mediaQuery.addEventListener?.('change', updateViewport);
    mediaQuery.addListener?.(updateViewport);
    return () => {
      mediaQuery.removeEventListener?.('change', updateViewport);
      mediaQuery.removeListener?.(updateViewport);
    };
  }, []);

  useEffect(() => {
    const historyState = history.current;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName.toLowerCase();
      if (
        tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select' ||
        target?.isContentEditable
      )
        return;
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return;
      event.preventDefault();
      if (event.shiftKey) redoRef.current();
      else undoRef.current();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName.toLowerCase();
      if (
        tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select' ||
        target?.isContentEditable
      )
        return;
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'y') return;
      event.preventDefault();
      redoRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keydown', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keydown', onKeyUp);
      if (historyState.timer !== null) window.clearTimeout(historyState.timer);
    };
  }, []);

  useEffect(() => {
    let frame: number | null = null;
    const requestFrame = (callback: () => void): number =>
      window.requestAnimationFrame
        ? window.requestAnimationFrame(callback)
        : window.setTimeout(callback, 0);
    const cancelFrame = (frameId: number): void => {
      if (window.cancelAnimationFrame) window.cancelAnimationFrame(frameId);
      else window.clearTimeout(frameId);
    };
    const measure = () => {
      const regions: Partial<Record<UiRegion, RegionBox>> = {};
      const panels: Partial<Record<UiPanelId, RegionBox>> = {};
      const nestedRegions: Partial<Record<string, RegionBox>> = {};
      const gridElement = document.querySelector<HTMLElement>(`[data-ui-panel-grid="${screen}"]`);
      const gridRect = gridElement?.getBoundingClientRect();
      for (const region of UI_REGIONS) {
        const element = document.querySelector<HTMLElement>(`[data-ui-region="${region.id}"]`);
        if (!element) continue;
        const rect = element.getBoundingClientRect();
        regions[region.id] = {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        };
      }
      for (const panel of panelDefinitions) {
        const element = document.querySelector<HTMLElement>(`[data-ui-panel="${panel.id}"]`);
        if (!element) continue;
        const rect = element.getBoundingClientRect();
        panels[panel.id] = {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        };
        for (const region of getUiPanelRegions(screen, panel.id)) {
          const nestedElement = document.querySelector<HTMLElement>(
            `[data-ui-panel-region="${region.id}"][data-ui-panel-owner="${panel.id}"]`,
          );
          if (!nestedElement) continue;
          const nestedRect = nestedElement.getBoundingClientRect();
          if (nestedRect.width <= 0 || nestedRect.height <= 0) continue;
          nestedRegions[`${panel.id}:${region.id}`] = {
            left: nestedRect.left,
            top: nestedRect.top,
            width: nestedRect.width,
            height: nestedRect.height,
          };
        }
      }
      const grid = gridRect
        ? { left: gridRect.left, top: gridRect.top, width: gridRect.width, height: gridRect.height }
        : undefined;
      setBoxes({ regions, panels, nestedRegions, grid });
    };
    const scheduleMeasure = () => {
      if (frame !== null) return;
      frame = requestFrame(() => {
        measure();
        frame = null;
      });
    };
    scheduleMeasureRef.current = scheduleMeasure;
    measure();
    window.addEventListener('resize', scheduleMeasure);
    window.addEventListener('scroll', scheduleMeasure, true);
    const observedElements = [
      ...UI_REGIONS.map((region) =>
        document.querySelector<HTMLElement>(`[data-ui-region="${region.id}"]`),
      ),
      ...panelDefinitions.map((panel) =>
        document.querySelector<HTMLElement>(`[data-ui-panel="${panel.id}"]`),
      ),
      ...panelDefinitions.flatMap((panel) =>
        getUiPanelRegions(screen, panel.id).map((region) =>
          document.querySelector<HTMLElement>(
            `[data-ui-panel-region="${region.id}"][data-ui-panel-owner="${panel.id}"]`,
          ),
        ),
      ),
      document.querySelector<HTMLElement>(`[data-ui-panel-grid="${screen}"]`),
    ].filter((element): element is HTMLElement => Boolean(element));
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleMeasure);
    observedElements.forEach((element) => observer?.observe(element));
    return () => {
      window.removeEventListener('resize', scheduleMeasure);
      window.removeEventListener('scroll', scheduleMeasure, true);
      observer?.disconnect();
      if (frame !== null) cancelFrame(frame);
      if (scheduleMeasureRef.current === scheduleMeasure) scheduleMeasureRef.current = () => undefined;
    };
  }, [panelDefinitions, screen]);

  useEffect(() => {
    scheduleMeasureRef.current();
  }, [layout]);

  useEffect(() => {
    let frame: number | null = null;
    let latestPointer: { clientX: number; clientY: number } | null = null;
    const requestFrame = (callback: () => void): number =>
      window.requestAnimationFrame
        ? window.requestAnimationFrame(callback)
        : window.setTimeout(callback, 0);
    const cancelFrame = (frameId: number): void => {
      if (window.cancelAnimationFrame) window.cancelAnimationFrame(frameId);
      else window.clearTimeout(frameId);
    };
    const applyMove = (clientX: number, clientY: number) => {
      const active = drag.current;
      if (!active) return;
      const currentLayout = layoutRef.current;
      const currentScreen = screenRef.current;
      const currentPanelLayout = panelLayoutRef.current;
      if (active.target.kind === 'region' && active.originalOffset) {
        const nextOffset = {
          x: clamp(active.originalOffset.x + clientX - active.startX, -80, 80),
          y: clamp(active.originalOffset.y + clientY - active.startY, -60, 60),
        };
        const currentOffset = currentLayout.offsets[active.target.id];
        if (currentOffset.x === nextOffset.x && currentOffset.y === nextOffset.y) return;
        syncLayout({
          ...currentLayout,
          offsets: {
            ...currentLayout.offsets,
            [active.target.id]: nextOffset,
          },
        });
        return;
      }
      if (active.target.kind === 'panelRegion' && active.gridMetrics) {
        const owner = currentPanelLayout[active.target.panelId];
        const internal = getUiPanelInternalLayout(currentLayout, currentScreen, active.target.panelId);
        const current = internal.regions[active.target.id];
        if (!owner || owner.locked || !current) return;
        const desiredLeft = clientX - (active.grabOffsetX ?? 0);
        const desiredTop = clientY - (active.grabOffsetY ?? 0);
        const column = clamp(
          Math.round((desiredLeft - active.gridMetrics.left) / active.gridMetrics.columnStep) + 1,
          1,
          13 - current.columnSpan,
        );
        const row = getGridRow(active.gridMetrics, desiredTop);
        const position = findAvailableNestedRegionPosition(
          currentLayout,
          currentScreen,
          active.target.panelId,
          active.target.id,
          { ...current, column, row, order: internal.direction === 'stack' ? row : current.order },
        );
        if (position.column === current.column && position.row === current.row) return;
        syncLayout({
          ...currentLayout,
          panelRegions: {
            ...currentLayout.panelRegions,
            [currentScreen]: {
              ...(currentLayout.panelRegions[currentScreen] ?? {}),
              [active.target.panelId]: {
                ...internal,
                regions: { ...internal.regions, [active.target.id]: position },
              },
            },
          },
        });
        return;
      }
      if (active.target.kind !== 'panel' || !active.gridMetrics) return;
      const current = currentPanelLayout[active.target.id];
      if (!current) return;
      const desiredLeft = clientX - (active.grabOffsetX ?? 0);
      const desiredTop = clientY - (active.grabOffsetY ?? 0);
      const column = clamp(
        Math.round((desiredLeft - active.gridMetrics.left) / active.gridMetrics.columnStep) + 1,
        1,
        13 - current.columnSpan,
      );
      const row = getGridRow(active.gridMetrics, desiredTop);
      const position = findAvailablePanelPosition(currentLayout, currentScreen, active.target.id, {
        ...current,
        column,
        row,
      });
      if (position.column === current.column && position.row === current.row) return;
      syncLayout({
        ...currentLayout,
        screenPanels: {
          ...currentLayout.screenPanels,
          [currentScreen]: {
            ...currentPanelLayout,
            [active.target.id]: position,
          },
        },
      });
    };
    const applyResize = (clientX: number, clientY: number) => {
      const active = resize.current;
      if (!active) return;
      const currentLayout = layoutRef.current;
      const currentScreen = screenRef.current;
      if (active.target.kind === 'panelRegion') {
        const owner = currentLayout.screenPanels[currentScreen]?.[active.target.panelId];
        const internal = getUiPanelInternalLayout(currentLayout, currentScreen, active.target.panelId);
        const current = internal.regions[active.target.id];
        if (!owner || owner.locked || !current) return;
        const deltaX = clientX - active.startX;
        const columnDelta = snapGridDelta(deltaX, active.gridMetrics.columnStep);
        const nextSpan = clampNestedColumnSpan(
          currentLayout,
          currentScreen,
          active.target.panelId,
          active.target.id,
          active.original.columnSpan + columnDelta,
        );
        if (nextSpan === current.columnSpan) return;
        syncLayout({
          ...currentLayout,
          panelRegions: {
            ...currentLayout.panelRegions,
            [currentScreen]: {
              ...(currentLayout.panelRegions[currentScreen] ?? {}),
              [active.target.panelId]: {
                ...internal,
                regions: {
                  ...internal.regions,
                  [active.target.id]: { ...current, columnSpan: nextSpan },
                },
              },
            },
          },
        });
        return;
      }
      const current = currentLayout.screenPanels[currentScreen]?.[active.target.id];
      if (!current || current.locked) return;
      const deltaX = clientX - active.startX;
      const deltaY = clientY - active.startY;
      const columnDelta = snapGridDelta(deltaX, active.gridMetrics.columnStep);
      const nextSpan =
        active.direction === 'height'
          ? current.columnSpan
          : clampPanelColumnSpan(
              currentLayout,
              currentScreen,
              active.target.id,
              active.original.columnSpan + columnDelta,
            );
      const nextHeight =
        active.direction === 'width'
          ? current.height
          : clampPanelHeight(active.original.height + deltaY);
      if (nextSpan === current.columnSpan && nextHeight === current.height) return;
      syncLayout({
        ...currentLayout,
        screenPanels: {
          ...currentLayout.screenPanels,
          [currentScreen]: {
            ...(currentLayout.screenPanels[currentScreen] ?? EMPTY_PANEL_LAYOUT),
            [active.target.id]: {
              ...current,
              columnSpan: nextSpan,
              height: nextHeight,
            },
          },
        },
      });
    };
    const move = (event: PointerEvent) => {
      const active = drag.current ?? resize.current;
      if (!active || event.pointerId !== active.pointerId) return;
      latestPointer = { clientX: event.clientX, clientY: event.clientY };
      if (frame !== null) return;
      frame = requestFrame(() => {
        const pointer = latestPointer;
        latestPointer = null;
        frame = null;
        if (pointer) {
          if (drag.current) applyMove(pointer.clientX, pointer.clientY);
          else applyResize(pointer.clientX, pointer.clientY);
        }
      });
    };
    const stop = (event: PointerEvent) => {
      const active = drag.current ?? resize.current;
      if (!active || event.pointerId !== active.pointerId) return;
      latestPointer = { clientX: event.clientX, clientY: event.clientY };
      if (frame !== null) cancelFrame(frame);
      frame = null;
      const pointer = latestPointer;
      latestPointer = null;
      if (pointer) {
        if (drag.current) applyMove(pointer.clientX, pointer.clientY);
        else applyResize(pointer.clientX, pointer.clientY);
      }
      if (active?.handle.hasPointerCapture?.(active.pointerId)) {
        active.handle.releasePointerCapture(active.pointerId);
      }
      drag.current = null;
      resize.current = null;
      recordHistory(layoutRef.current);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      const active = drag.current;
      if (active?.handle.hasPointerCapture?.(active.pointerId)) {
        active.handle.releasePointerCapture(active.pointerId);
      }
      const activeResize = resize.current;
      if (activeResize?.handle.hasPointerCapture?.(activeResize.pointerId)) {
        activeResize.handle.releasePointerCapture(activeResize.pointerId);
      }
      drag.current = null;
      resize.current = null;
      recordHistory(layoutRef.current);
      if (frame !== null) cancelFrame(frame);
    };
  }, []);

  const beginDrag = (target: SelectedTarget, event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setSelected(target);
    if (target.kind === 'panel' && (compactViewport || !canEditPanelLayout(panelLayout[target.id]))) return;
    if (target.kind === 'region') {
      const offset = layout.offsets[target.id];
      event.currentTarget.setPointerCapture?.(event.pointerId);
      drag.current = {
        target,
        startX: event.clientX,
        startY: event.clientY,
        pointerId: event.pointerId,
        handle: event.currentTarget,
        originalOffset: offset,
      };
      return;
    }
    if (target.kind === 'panelRegion') {
      const owner = panelLayout[target.panelId];
      if (compactViewport || !owner || owner.locked) return;
      const internal = getUiPanelInternalLayout(layoutRef.current, screen, target.panelId);
      const measuredRegions =
        Object.keys(boxesRef.current.nestedRegions).length > 0
          ? boxesRef.current.nestedRegions
          : boxes.nestedRegions;
      const box = measuredRegions[`${target.panelId}:${target.id}`];
      const gridMetrics = getNestedGridMetrics(screen, target.panelId, internal, measuredRegions);
      if (!box || !gridMetrics) return;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      drag.current = {
        target,
        startX: event.clientX,
        startY: event.clientY,
        pointerId: event.pointerId,
        handle: event.currentTarget,
        grabOffsetX: event.clientX - box.left,
        grabOffsetY: event.clientY - box.top,
        gridMetrics,
      };
      return;
    }
    const measuredPanels =
      Object.keys(boxesRef.current.panels).length > 0 ? boxesRef.current.panels : boxes.panels;
    const box = measuredPanels[target.id];
    const gridMetrics = getGridMetrics(screen, panelLayout, measuredPanels);
    if (!box || !gridMetrics) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drag.current = {
      target,
      startX: event.clientX,
      startY: event.clientY,
      pointerId: event.pointerId,
      handle: event.currentTarget,
      grabOffsetX: event.clientX - box.left,
      grabOffsetY: event.clientY - box.top,
      gridMetrics,
    };
  };

  const beginResize = (
    panelId: UiPanelId,
    direction: ResizeDirection,
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setSelected({ kind: 'panel', id: panelId });
    if (compactViewport) return;
    const position = panelLayout[panelId];
    if (!canEditPanelLayout(position)) return;
    const measuredPanels =
      Object.keys(boxesRef.current.panels).length > 0 ? boxesRef.current.panels : boxes.panels;
    const gridMetrics = getGridMetrics(screen, panelLayout, measuredPanels);
    if (!position || !gridMetrics) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    resize.current = {
      target: { kind: 'panel', id: panelId },
      direction,
      startX: event.clientX,
      startY: event.clientY,
      pointerId: event.pointerId,
      handle: event.currentTarget,
      original: { ...position },
      gridMetrics,
    };
  };

  const beginNestedResize = (
    panelId: UiPanelId,
    regionId: UiPanelRegionId,
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setSelected({ kind: 'panelRegion', panelId, id: regionId });
    const owner = panelLayout[panelId];
    if (compactViewport || !owner || owner.locked) return;
    const internal = getUiPanelInternalLayout(layoutRef.current, screen, panelId);
    const measuredRegions =
      Object.keys(boxesRef.current.nestedRegions).length > 0
        ? boxesRef.current.nestedRegions
        : boxes.nestedRegions;
    const gridMetrics = getNestedGridMetrics(screen, panelId, internal, measuredRegions);
    const position = internal.regions[regionId];
    if (!position || !gridMetrics) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    resize.current = {
      target: { kind: 'panelRegion', panelId, id: regionId },
      direction: 'width',
      startX: event.clientX,
      startY: event.clientY,
      pointerId: event.pointerId,
      handle: event.currentTarget,
      original: { ...position },
      gridMetrics,
    };
  };

  const updateNumber = (
    key: keyof Pick<
      UiLayout,
      | 'sidebarWidth'
      | 'headerHeight'
      | 'contentPadding'
      | 'actionStripHeight'
      | 'panelRadius'
      | 'uiScale'
    >,
    value: number,
  ) => {
    const currentLayout = layoutRef.current;
    commitLayout({ ...currentLayout, [key]: value });
  };

  const updatePanel = (key: keyof UiPanelPosition, value: number) => {
    if (selected.kind !== 'panel') return;
    const currentLayout = layoutRef.current;
    const currentPanelLayout = currentLayout.screenPanels[screen] ?? EMPTY_PANEL_LAYOUT;
    const current = currentPanelLayout[selected.id];
    if (!current || (current.locked && key !== 'locked')) return;
    const next = { ...current, [key]: value } as UiPanelPosition;
    if (key === 'columnSpan') next.column = Math.min(next.column, 13 - value);
    const position = findAvailablePanelPosition(currentLayout, screen, selected.id, next);
    commitLayout({
      ...currentLayout,
      screenPanels: {
        ...currentLayout.screenPanels,
        [screen]: {
          ...currentPanelLayout,
          [selected.id]: position,
        },
      },
    });
  };

  const updateNestedRegion = (
    key: keyof Pick<UiPanelRegionPosition, 'column' | 'row' | 'columnSpan' | 'visible'>,
    value: number | boolean,
  ) => {
    if (selected.kind !== 'panelRegion') return;
    const currentLayout = layoutRef.current;
    const owner = currentLayout.screenPanels[screen]?.[selected.panelId];
    if (owner?.locked) return;
    const internal = getUiPanelInternalLayout(currentLayout, screen, selected.panelId);
    const current = internal.regions[selected.id];
    if (!current) return;
    let next = { ...current, [key]: value } as UiPanelRegionPosition;
    if (key === 'columnSpan') {
      next.columnSpan = clampNestedColumnSpan(
        currentLayout,
        screen,
        selected.panelId,
        selected.id,
        Number(value),
      );
      next.column = Math.min(next.column, 13 - next.columnSpan);
    }
    if (key === 'column' || key === 'row' || key === 'columnSpan') {
      if (key === 'row' && internal.direction === 'stack') next.order = Number(value);
      next = findAvailableNestedRegionPosition(
        currentLayout,
        screen,
        selected.panelId,
        selected.id,
        next,
      );
    }
    commitLayout({
      ...currentLayout,
      panelRegions: {
        ...currentLayout.panelRegions,
        [screen]: {
          ...(currentLayout.panelRegions[screen] ?? {}),
          [selected.panelId]: {
            ...internal,
            regions: { ...internal.regions, [selected.id]: next },
          },
        },
      },
    });
  };

  const updateInternalLayout = (
    key: 'gap' | 'padding',
    value: number,
  ) => {
    if (selected.kind !== 'panel') return;
    const currentLayout = layoutRef.current;
    const currentPanel = currentLayout.screenPanels[screen]?.[selected.id];
    if (currentPanel?.locked) return;
    const internal = getUiPanelInternalLayout(currentLayout, screen, selected.id);
    commitLayout({
      ...currentLayout,
      panelRegions: {
        ...currentLayout.panelRegions,
        [screen]: {
          ...(currentLayout.panelRegions[screen] ?? {}),
          [selected.id]: { ...internal, [key]: value },
        },
      },
    });
  };

  const updatePanelAppearance = <K extends keyof UiPanelAppearance>(
    key: K,
    value: UiPanelAppearance[K] | undefined,
  ) => {
    if (selected.kind !== 'panel') return;
    const currentLayout = layoutRef.current;
    const appearance = getUiPanelAppearance(currentLayout, screen, selected.id);
    if (value === undefined) delete appearance[key];
    else appearance[key] = value;
    const appearances = { ...(currentLayout.panelAppearances[screen] ?? {}) };
    if (Object.keys(appearance).length > 0) appearances[selected.id] = appearance;
    else delete appearances[selected.id];
    commitLayout({
      ...currentLayout,
      panelAppearances: {
        ...currentLayout.panelAppearances,
        [screen]: appearances,
      },
    });
  };

  const applyHomeOverviewPreset = (preset: string) => {
    if (selected.kind !== 'panel' || selected.id !== 'homeOverview') return;
    const currentLayout = layoutRef.current;
    const currentPanel = currentLayout.screenPanels[screen]?.[selected.id];
    if (currentPanel?.locked) return;
    const internal = getUiPanelInternalLayout(currentLayout, screen, selected.id);
    const activity = internal.regions.homeOverviewActivity;
    const stats = internal.regions.homeOverviewStats;
    const character = internal.regions.homeOverviewCharacter;
    if (!activity || !stats || !character) return;
    const next: UiPanelInternalLayout = { ...internal, direction: 'grid' };
    if (preset === 'Stacked') {
      next.direction = 'stack';
      next.regions = {
        ...internal.regions,
        homeOverviewActivity: { ...activity, column: 1, columnSpan: 12, row: 1, order: 1 },
        homeOverviewStats: { ...stats, column: 1, columnSpan: 12, row: 2, order: 2 },
        homeOverviewCharacter: { ...character, column: 1, columnSpan: 12, row: 3, order: 3 },
      };
    } else {
      const statsSpan = preset === '50 / 50' ? 6 : preset === '67 / 33' ? 8 : 9;
      next.regions = {
        ...internal.regions,
        homeOverviewActivity: { ...activity, column: 1, columnSpan: 12, row: 1, order: 1 },
        homeOverviewStats: { ...stats, column: 1, columnSpan: statsSpan, row: 2, order: 2 },
        homeOverviewCharacter: {
          ...character,
          column: statsSpan + 1,
          columnSpan: 12 - statsSpan,
          row: 2,
          order: 3,
        },
      };
    }
    commitLayout({
      ...currentLayout,
      panelRegions: {
        ...currentLayout.panelRegions,
        [screen]: {
          ...(currentLayout.panelRegions[screen] ?? {}),
          [selected.id]: next,
        },
      },
    }, 'immediate');
  };

  const resetRegion = () => {
    if (selected.kind !== 'region') return;
    const currentLayout = layoutRef.current;
    commitLayout({
      ...currentLayout,
      offsets: {
        ...currentLayout.offsets,
        [selected.id]: { x: 0, y: 0 },
      },
    });
  };

  const resetNestedRegion = () => {
    if (selected.kind !== 'panelRegion') return;
    const owner = layoutRef.current.screenPanels[screen]?.[selected.panelId];
    if (owner?.locked) return;
    commitLayout(resetUiPanelRegion(layoutRef.current, screen, selected.panelId, selected.id), 'immediate');
  };

  const centerPanel = () => {
    if (selected.kind !== 'panel') return;
    const currentLayout = layoutRef.current;
    const currentPanelLayout = currentLayout.screenPanels[screen] ?? EMPTY_PANEL_LAYOUT;
    const current = currentPanelLayout[selected.id];
    if (!current || current.locked) return;
    const position = findAvailablePanelPosition(
      currentLayout,
      screen,
      selected.id,
      {
        ...current,
        column: Math.max(1, Math.floor((12 - current.columnSpan) / 2) + 1),
      },
      'center',
    );
    commitLayout({
      ...currentLayout,
      screenPanels: {
        ...currentLayout.screenPanels,
        [screen]: {
          ...currentPanelLayout,
          [selected.id]: position,
        },
      },
    });
  };

  const resetPanel = () => {
    if (selected.kind !== 'panel') return;
    commitLayout(resetUiPanel(layoutRef.current, screen, selected.id), 'immediate');
  };

  const togglePanelLock = () => {
    if (selected.kind !== 'panel') return;
    const currentLayout = layoutRef.current;
    const currentPanelLayout = currentLayout.screenPanels[screen] ?? EMPTY_PANEL_LAYOUT;
    const current = currentPanelLayout[selected.id];
    if (!current) return;
    commitLayout(
      {
        ...currentLayout,
        screenPanels: {
          ...currentLayout.screenPanels,
          [screen]: {
            ...currentPanelLayout,
            [selected.id]: { ...current, locked: !current.locked },
          },
        },
      },
      'immediate',
    );
  };

  const resetCurrentScreen = () => commitLayout(resetUiLayoutScreen(layoutRef.current, screen), 'immediate');

  const selectedRegion =
    selected.kind === 'region'
      ? (UI_REGIONS.find((region) => region.id === selected.id) ?? UI_REGIONS[0])
      : null;
  const selectedPanel =
    selected.kind === 'panel' || selected.kind === 'panelRegion'
      ? (panelDefinitions.find((panel) => panel.id === (selected.kind === 'panel' ? selected.id : selected.panelId)) ?? panelDefinitions[0])
      : null;
  const selectedOffset = selectedRegion ? layout.offsets[selectedRegion.id] : null;
  const selectedPanelPosition = selectedPanel ? panelLayout[selectedPanel.id] : null;
  const selectedInternalLayout = selectedPanel
    ? getUiPanelInternalLayout(layout, screen, selectedPanel.id)
    : null;
  const selectedNestedRegion =
    selected.kind === 'panelRegion'
      ? (getUiPanelRegions(screen, selected.panelId).find((region) => region.id === selected.id) ?? null)
      : null;
  const selectedNestedPosition =
    selected.kind === 'panelRegion' && selectedInternalLayout
      ? selectedInternalLayout.regions[selected.id] ?? null
      : null;
  const selectedAppearance =
    selected.kind === 'panel' && selectedPanel
      ? getUiPanelAppearance(layout, screen, selectedPanel.id)
      : null;
  const panelsVisible = panelDefinitions.length > 0;

  return (
    <div className="ui-editor-layer" aria-label="Visual UI editor">
      {boxes.grid && (
        <div
          className="ui-editor-grid-guide"
          aria-hidden="true"
          style={{
            left: boxes.grid.left,
            top: boxes.grid.top,
            width: boxes.grid.width,
            height: boxes.grid.height,
          }}
        >
          {Array.from({ length: 12 }, (_, index) => (
            <span key={index} />
          ))}
        </div>
      )}
      {UI_REGIONS.map((region) => {
        const box = boxes.regions[region.id];
        if (!box) return null;
        const target = { kind: 'region', id: region.id } as const;
        return (
          <div
            className={`ui-editor-target ${selected.kind === 'region' && selected.id === region.id ? 'selected' : ''}`}
            key={region.id}
            style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
          >
            <button
              className="ui-editor-target-label"
              onClick={() => setSelected(target)}
              onPointerDown={(event) => beginDrag(target, event)}
              title={`Drag to move ${region.label}`}
            >
              <GripVertical size={14} />
              {region.label}
            </button>
          </div>
        );
      })}
      {panelDefinitions.map((panel) => {
        const box = boxes.panels[panel.id];
        if (!box) return null;
        const target = { kind: 'panel', id: panel.id } as const;
        const position = panelLayout[panel.id];
        if (!position) return null;
        const locked = position.locked;
        const selectedPanelTarget = selected.kind === 'panel' && selected.id === panel.id;
        const dragDisabled = compactViewport || locked;
        return (
          <div
            className={`ui-editor-target ui-editor-panel-target ${selectedPanelTarget ? 'selected' : ''} ${locked ? 'locked' : ''}`}
            key={panel.id}
            style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
          >
            <button
              className={`ui-editor-target-label ${dragDisabled ? 'disabled' : ''}`}
              onClick={() => setSelected(target)}
              onPointerDown={(event) => beginDrag(target, event)}
              aria-disabled={dragDisabled}
              title={
                compactViewport
                  ? 'Panel dragging is available above 900px viewport width'
                  : locked
                    ? 'Panel is locked. Unlock it to move or resize it.'
                  : `Drag to move ${panel.label}`
              }
            >
              {locked ? <Lock size={13} aria-hidden="true" /> : <GripVertical size={14} />}
              {panel.label}
            </button>
            {selectedPanelTarget && !locked && !compactViewport && (
              <>
                <button
                  type="button"
                  className="ui-editor-resize-handle right"
                  aria-label={`Resize ${panel.label} width`}
                  title={`Resize ${panel.label} width`}
                  onPointerDown={(event) => beginResize(panel.id, 'width', event)}
                />
                <button
                  type="button"
                  className="ui-editor-resize-handle bottom"
                  aria-label={`Resize ${panel.label} height`}
                  title={`Resize ${panel.label} height`}
                  onPointerDown={(event) => beginResize(panel.id, 'height', event)}
                />
                <button
                  type="button"
                  className="ui-editor-resize-handle corner"
                  aria-label={`Resize ${panel.label}`}
                  title={`Resize ${panel.label}`}
                  onPointerDown={(event) => beginResize(panel.id, 'corner', event)}
                />
              </>
            )}
          </div>
        );
      })}
      {panelDefinitions.flatMap((panel) => {
        const expanded = expandedPanels[panel.id] || (selected.kind === 'panelRegion' && selected.panelId === panel.id);
        if (!expanded) return [];
        const ownerPosition = panelLayout[panel.id];
        if (!ownerPosition) return [];
        return getUiPanelRegions(screen, panel.id).flatMap((region) => {
          const box = boxes.nestedRegions[`${panel.id}:${region.id}`];
          if (!box) return [];
          const position = getUiPanelInternalLayout(layout, screen, panel.id).regions[region.id];
          if (!position || !position.visible) return [];
          const target = { kind: 'panelRegion', panelId: panel.id, id: region.id } as const;
          const isSelected = selected.kind === 'panelRegion' && selected.panelId === panel.id && selected.id === region.id;
          const locked = ownerPosition.locked;
          return [
            <div
              className={`ui-editor-target ui-editor-nested-target ${isSelected ? 'selected' : ''} ${locked ? 'locked' : ''}`}
              key={`${panel.id}:${region.id}`}
              style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
            >
              <button
                className={`ui-editor-target-label ${locked || compactViewport ? 'disabled' : ''}`}
                onClick={() => {
                  setExpandedPanels((current) => ({ ...current, [panel.id]: true }));
                  setSelected(target);
                }}
                onPointerDown={(event) => beginDrag(target, event)}
                aria-disabled={locked || compactViewport}
                title={
                  compactViewport
                    ? 'Nested editing is available above 900px viewport width'
                    : locked
                      ? 'Unlock the parent panel to edit this region'
                      : `Drag to move ${region.label}`
                }
              >
                <GripVertical size={13} /> {region.label}
              </button>
              {isSelected && !locked && !compactViewport && (
                <button
                  type="button"
                  className="ui-editor-resize-handle right nested"
                  aria-label={`Resize ${region.label} width`}
                  title={`Resize ${region.label} width`}
                  onPointerDown={(event) => beginNestedResize(panel.id, region.id, event)}
                />
              )}
            </div>,
          ];
        });
      })}

      <aside className="ui-editor-panel panel" role="dialog" aria-label="Edit game UI">
        <div className="ui-editor-heading">
          <div>
            <div className="eyebrow">No-code layout</div>
            <h2>Edit game UI</h2>
          </div>
          <button className="button ghost" onClick={onClose} aria-label="Close UI editor">
            <X size={17} />
          </button>
        </div>
        <div className="ui-editor-toolbar" aria-label="Editor history controls">
          <button className="button" onClick={undo} disabled={history.current.index <= 0} aria-label="Undo UI change">
            <Undo2 size={14} /> Undo
          </button>
          <button
            className="button"
            onClick={redo}
            disabled={history.current.index >= history.current.entries.length - 1}
            aria-label="Redo UI change"
          >
            <Redo2 size={14} /> Redo
          </button>
          <span className="ui-editor-history-status" aria-live="polite">
            {history.current.index + 1} / {history.current.entries.length}
          </span>
        </div>
        <p className="subtle">
          Drag a labeled handle, or use the controls below. Changes save automatically in this
          browser.
        </p>

        <div className="ui-editor-current-screen" aria-label="Current screen status">
          <span className="eyebrow">Current screen</span>
          <strong>{screenLabel.toUpperCase()}</strong>
          <small>{panelDefinitions.length} editable panels</small>
        </div>

        {selected.kind === 'panel' && selectedPanel && selectedAppearance && (
          <div className="ui-editor-section">
            <div className="ui-editor-section-title">
              <Palette size={15} /> Panel appearance
            </div>
            <p className="muted ui-editor-inherit-note">
              Unset values inherit the global editor appearance.
            </p>
            <EditorColor
              label="Background"
              value={selectedAppearance.background ?? layout.panel}
              onChange={(value) => updatePanelAppearance('background', value)}
            />
            {selectedAppearance.background && (
              <button className="button ghost ui-editor-small-button" onClick={() => updatePanelAppearance('background', undefined)}>
                Use global background
              </button>
            )}
            <EditorColor
              label="Border color"
              value={selectedAppearance.borderColor ?? '#354047'}
              onChange={(value) => updatePanelAppearance('borderColor', value)}
            />
            {selectedAppearance.borderColor && (
              <button className="button ghost ui-editor-small-button" onClick={() => updatePanelAppearance('borderColor', undefined)}>
                Use global border color
              </button>
            )}
            <EditorRange
              label="Border width"
              value={selectedAppearance.borderWidth ?? 1}
              min={0}
              max={4}
              suffix="px"
              onChange={(value) => updatePanelAppearance('borderWidth', value)}
            />
            {selectedAppearance.borderWidth !== undefined && (
              <button className="button ghost ui-editor-small-button" onClick={() => updatePanelAppearance('borderWidth', undefined)}>
                Use global border width
              </button>
            )}
            <EditorRange
              label="Corner radius"
              value={selectedAppearance.radius ?? layout.panelRadius}
              min={0}
              max={28}
              suffix="px"
              onChange={(value) => updatePanelAppearance('radius', value)}
            />
            {selectedAppearance.radius !== undefined && (
              <button className="button ghost ui-editor-small-button" onClick={() => updatePanelAppearance('radius', undefined)}>
                Use global radius
              </button>
            )}
            <label className="ui-editor-check-row">
              <span>Panel shadow</span>
              <input
                type="checkbox"
                checked={selectedAppearance.shadow ?? true}
                onChange={(event) => updatePanelAppearance('shadow', event.target.checked)}
              />
            </label>
            {selectedAppearance.shadow !== undefined && (
              <button className="button ghost ui-editor-small-button" onClick={() => updatePanelAppearance('shadow', undefined)}>
                Use global shadow
              </button>
            )}
          </div>
        )}

        <div className="ui-editor-section">
          <div className="ui-editor-section-title">
            <Move size={15} /> Global regions
          </div>
          <div className="ui-editor-region-list">
            {UI_REGIONS.map((region) => (
              <button
                className={`ui-editor-region ${selected.kind === 'region' && selected.id === region.id ? 'selected' : ''}`}
                key={region.id}
                onClick={() => setSelected({ kind: 'region', id: region.id })}
              >
                <span>
                  <strong>{region.label}</strong>
                  <small>{region.description}</small>
                </span>
                <small>
                  {layout.offsets[region.id].x}, {layout.offsets[region.id].y}
                </small>
              </button>
            ))}
          </div>
          {selectedRegion && selectedOffset && (
            <>
              <div className="ui-editor-nudge-row">
                <button className="button" onClick={resetRegion}>
                  Reset {selectedRegion.label} position
                </button>
                <span className="muted">
                  Offset {selectedOffset.x}px, {selectedOffset.y}px
                </span>
              </div>
              <EditorRange
                label="Horizontal offset"
                value={selectedOffset.x}
                min={-80}
                max={80}
                suffix="px"
                onChange={(value) =>
                  commitLayout({
                    ...layoutRef.current,
                    offsets: {
                      ...layoutRef.current.offsets,
                      [selectedRegion.id]: { ...selectedOffset, x: value },
                    },
                  })
                }
              />
              <EditorRange
                label="Vertical offset"
                value={selectedOffset.y}
                min={-60}
                max={60}
                suffix="px"
                onChange={(value) =>
                  commitLayout({
                    ...layoutRef.current,
                    offsets: {
                      ...layoutRef.current.offsets,
                      [selectedRegion.id]: { ...selectedOffset, y: value },
                    },
                  })
                }
              />
              <p className="ui-editor-warning">
                Region offsets are limited so the interface can always be recovered.
              </p>
            </>
          )}
        </div>

        <div className="ui-editor-section">
          <div className="ui-editor-section-title">
            <LayoutGrid size={15} /> {screenLabel} panels
          </div>
          {panelsVisible ? (
            <>
              {compactViewport && (
                <p className="ui-editor-warning" role="note">
                  Panel drag placement requires a viewport wider than 900px. Enlarge the window or
                  reset browser zoom to 100%; the panel controls remain available here.
                </p>
              )}
              <div className="ui-editor-region-list">
                {panelDefinitions.map((panel) => {
                  const position = panelLayout[panel.id];
                  if (!position) return null;
                  const nestedRegions = getUiPanelRegions(screen, panel.id);
                  const expanded = expandedPanels[panel.id] ?? false;
                  const panelSelected =
                    (selected.kind === 'panel' && selected.id === panel.id) ||
                    (selected.kind === 'panelRegion' && selected.panelId === panel.id);
                  return (
                    <div className="ui-editor-tree-node" key={panel.id}>
                      <div className={`ui-editor-tree-panel ${panelSelected ? 'selected' : ''}`}>
                        <button
                          className="ui-editor-region"
                          onClick={() => {
                            setSelected({ kind: 'panel', id: panel.id });
                            if (nestedRegions.length > 0) {
                              setExpandedPanels((current) => ({ ...current, [panel.id]: true }));
                            }
                          }}
                        >
                          <span>
                            <strong>{panel.label}</strong>
                            <small>{panel.description}</small>
                          </span>
                          <small>
                            {position.locked ? 'Locked · ' : ''}C{position.column} · R{position.row}
                          </small>
                        </button>
                        {nestedRegions.length > 0 && (
                          <button
                            type="button"
                            className="ui-editor-tree-toggle"
                            aria-label={expanded ? 'Collapse nested contents' : 'Expand nested contents'}
                            onClick={() => setExpandedPanels((current) => ({ ...current, [panel.id]: !expanded }))}
                          >
                            {expanded ? '▾' : '▸'}
                          </button>
                        )}
                      </div>
                      {expanded && nestedRegions.length > 0 && (
                        <div className="ui-editor-tree-children">
                          {nestedRegions.map((region) => {
                            const regionPosition = getUiPanelInternalLayout(layout, screen, panel.id).regions[region.id];
                            if (!regionPosition) return null;
                            const regionSelected =
                              selected.kind === 'panelRegion' &&
                              selected.panelId === panel.id &&
                              selected.id === region.id;
                            return (
                              <button
                                className={`ui-editor-region ui-editor-nested-region-row ${regionSelected ? 'selected' : ''}`}
                                key={region.id}
                                onClick={() => {
                                  setExpandedPanels((current) => ({ ...current, [panel.id]: true }));
                                  setSelected({ kind: 'panelRegion', panelId: panel.id, id: region.id });
                                }}
                              >
                                <span>
                                  <strong>{region.label}</strong>
                                  <small>{regionPosition.visible ? region.description : 'Hidden · ' + region.description}</small>
                                </span>
                                <small>
                                  C{regionPosition.column} · R{regionPosition.row} · W{regionPosition.columnSpan}
                                </small>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {selected.kind === 'panel' && selectedPanel && selectedPanelPosition && (
                <>
                  <div className="ui-editor-nudge-row">
                    <button className="button" onClick={centerPanel} disabled={selectedPanelPosition.locked}>
                      Center {selectedPanel.label}
                    </button>
                    <button className="button ghost" onClick={resetPanel}>
                      Reset {selectedPanel.label}
                    </button>
                    <button
                      className="button ghost"
                      onClick={togglePanelLock}
                      aria-label={`${selectedPanelPosition.locked ? 'Unlock' : 'Lock'} ${selectedPanel.label}`}
                    >
                      {selectedPanelPosition.locked ? <Unlock size={14} /> : <Lock size={14} />}
                      {selectedPanelPosition.locked ? 'Unlock panel' : 'Lock panel'}
                    </button>
                    <span className="muted">
                      C{selectedPanelPosition.column}, R{selectedPanelPosition.row}, W
                      {selectedPanelPosition.columnSpan}
                    </span>
                  </div>
                  <div className="ui-editor-panel-controls">
                    <EditorRange
                      label="Grid column"
                      value={selectedPanelPosition.column}
                      min={1}
                      max={13 - selectedPanelPosition.columnSpan}
                      disabled={selectedPanelPosition.locked}
                      onChange={(value) => updatePanel('column', value)}
                    />
                    <EditorRange
                      label="Grid row"
                      value={selectedPanelPosition.row}
                      min={1}
                      max={12}
                      disabled={selectedPanelPosition.locked}
                      onChange={(value) => updatePanel('row', value)}
                    />
                    <EditorRange
                      label="Panel width"
                      value={selectedPanelPosition.columnSpan}
                      min={1}
                      max={12}
                      disabled={selectedPanelPosition.locked}
                      suffix=" columns"
                      onChange={(value) => updatePanel('columnSpan', value)}
                    />
                    <EditorRange
                      label="Minimum panel height"
                      value={selectedPanelPosition.height}
                      min={0}
                      max={900}
                      step={10}
                      displayValue={
                        selectedPanelPosition.height > 0
                          ? `${selectedPanelPosition.height}px`
                          : 'Auto'
                      }
                      disabled={selectedPanelPosition.locked}
                      onChange={(value) => updatePanel('height', value)}
                    />
                    <EditorRange
                      label="Panel scale"
                      value={selectedPanelPosition.scale}
                      min={0.5}
                      max={1.5}
                      step={0.05}
                      displayValue={`${Math.round(selectedPanelPosition.scale * 100)}%`}
                      disabled={selectedPanelPosition.locked}
                      onChange={(value) => updatePanel('scale', value)}
                    />
                  </div>
                  {selectedInternalLayout && getUiPanelRegions(screen, selectedPanel.id).length > 0 && (
                    <div className="ui-editor-panel-controls ui-editor-internal-controls">
                      <div className="ui-editor-subsection-title">Internal layout</div>
                      <button
                        className="button ghost"
                        onClick={() => setExpandedPanels((current) => ({
                          ...current,
                          [selectedPanel.id]: !(current[selectedPanel.id] ?? false),
                        }))}
                      >
                        {expandedPanels[selectedPanel.id] ? 'Hide contents' : 'Edit contents'}
                      </button>
                      <EditorSelect
                        label="Layout preset"
                        value={
                          selectedInternalLayout.direction === 'stack'
                            ? 'Stacked'
                            : selectedInternalLayout.regions.homeOverviewStats?.columnSpan === 6
                              ? '50 / 50'
                              : selectedInternalLayout.regions.homeOverviewStats?.columnSpan === 8
                                ? '67 / 33'
                                : selectedInternalLayout.regions.homeOverviewStats?.columnSpan === 9
                                  ? 'Default'
                                  : 'Custom'
                        }
                        options={['Default', '75 / 25', '67 / 33', '50 / 50', 'Stacked']}
                        disabled={selectedPanelPosition.locked}
                        onChange={applyHomeOverviewPreset}
                      />
                      <EditorRange
                        label="Internal gap"
                        value={selectedInternalLayout.gap}
                        min={0}
                        max={32}
                        suffix="px"
                        disabled={selectedPanelPosition.locked}
                        onChange={(value) => updateInternalLayout('gap', value)}
                      />
                      <EditorRange
                        label="Internal padding"
                        value={selectedInternalLayout.padding}
                        min={0}
                        max={40}
                        suffix="px"
                        disabled={selectedPanelPosition.locked}
                        onChange={(value) => updateInternalLayout('padding', value)}
                      />
                    </div>
                  )}
                </>
              )}
              {selected.kind === 'panelRegion' && selectedNestedRegion && selectedNestedPosition && selectedPanel && (
                <div className="ui-editor-panel-controls ui-editor-nested-controls">
                  <div className="ui-editor-subsection-title">Selected region</div>
                  <div className="ui-editor-selection-summary">
                    <strong>{selectedNestedRegion.label}</strong>
                    <small>Owner: {selectedPanel.label}</small>
                  </div>
                  {compactViewport && (
                    <p className="ui-editor-warning" role="note">
                      Nested drag and resize are available above 900px. The precise controls remain available here.
                    </p>
                  )}
                  <label className="ui-editor-check-row">
                    <span>Visible</span>
                    <input
                      type="checkbox"
                      checked={selectedNestedPosition.visible}
                      disabled={selectedPanelPosition?.locked || selectedNestedRegion.canHide === false}
                      onChange={(event) => updateNestedRegion('visible', event.target.checked)}
                    />
                  </label>
                  <EditorRange
                    label="Column"
                    value={selectedNestedPosition.column}
                    min={1}
                    max={13 - selectedNestedPosition.columnSpan}
                    disabled={selectedPanelPosition?.locked}
                    onChange={(value) => updateNestedRegion('column', value)}
                  />
                  <EditorRange
                    label="Row"
                    value={selectedNestedPosition.row}
                    min={1}
                    max={12}
                    disabled={selectedPanelPosition?.locked}
                    onChange={(value) => updateNestedRegion('row', value)}
                  />
                  <EditorRange
                    label="Region width"
                    value={selectedNestedPosition.columnSpan}
                    min={1}
                    max={12}
                    suffix=" columns"
                    disabled={selectedPanelPosition?.locked}
                    onChange={(value) => updateNestedRegion('columnSpan', value)}
                  />
                  <button className="button ghost" onClick={resetNestedRegion} disabled={selectedPanelPosition?.locked}>
                    Reset {selectedNestedRegion.label}
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="muted ui-editor-empty">
              No editable panels are registered for {screenLabel} yet.
            </p>
          )}
        </div>

        <div className="ui-editor-section">
          <div className="ui-editor-section-title">
            <GripVertical size={15} /> Global size and spacing
          </div>
          <EditorRange
            label="Sidebar width"
            value={layout.sidebarWidth}
            min={170}
            max={360}
            suffix="px"
            onChange={(value) => updateNumber('sidebarWidth', value)}
          />
          <EditorRange
            label="Header height"
            value={layout.headerHeight}
            min={52}
            max={110}
            suffix="px"
            onChange={(value) => updateNumber('headerHeight', value)}
          />
          <EditorRange
            label="Content spacing"
            value={layout.contentPadding}
            min={10}
            max={54}
            suffix="px"
            onChange={(value) => updateNumber('contentPadding', value)}
          />
          <EditorRange
            label="Activity bar height"
            value={layout.actionStripHeight}
            min={58}
            max={125}
            suffix="px"
            onChange={(value) => updateNumber('actionStripHeight', value)}
          />
          <EditorRange
            label="Corner roundness"
            value={layout.panelRadius}
            min={0}
            max={28}
            suffix="px"
            onChange={(value) => updateNumber('panelRadius', value)}
          />
          <EditorRange
            label="Interface scale"
            value={layout.uiScale}
            min={0.85}
            max={1.15}
            step={0.01}
            suffix=""
            displayValue={numberLabel(layout.uiScale)}
            onChange={(value) => updateNumber('uiScale', value)}
          />
        </div>

        <div className="ui-editor-section">
          <div className="ui-editor-section-title">
            <Palette size={15} /> Colors
          </div>
          <EditorColor
            label="Accent color"
            value={layout.accent}
            onChange={(accent) => commitLayout({ ...layoutRef.current, accent })}
          />
          <EditorColor
            label="Game background"
            value={layout.background}
            onChange={(background) => commitLayout({ ...layoutRef.current, background })}
          />
          <EditorColor
            label="Panel color"
            value={layout.panel}
            onChange={(panel) => commitLayout({ ...layoutRef.current, panel })}
          />
        </div>

        {panelsVisible && (
          <div className="ui-editor-section ui-editor-reset-section">
            <div className="ui-editor-section-title">
              <RotateCcw size={15} /> Reset current screen
            </div>
            <p className="muted">Reset only the {screenLabel} panel positions, sizes, scales, and locks.</p>
            <button className="button" onClick={resetCurrentScreen} aria-label={`Reset ${screenLabel} layout`}>
              <RotateCcw size={14} /> Reset {screenLabel} layout
            </button>
          </div>
        )}

        <button
          className="button danger ui-editor-reset"
          onClick={() => commitLayout(resetUiLayout(), 'immediate')}
          title="Restore all interface positions, sizes, colors, and panel locks"
        >
          <RotateCcw size={14} /> Emergency reset — entire UI
        </button>
      </aside>
    </div>
  );
}

function EditorRange({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = '',
  displayValue,
  disabled = false,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  displayValue?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="ui-editor-range">
      <span>
        {label}
        <output>{displayValue ?? `${value}${suffix}`}</output>
      </span>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function EditorColor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="ui-editor-color">
      <span>{label}</span>
      <input
        type="color"
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <code>{value}</code>
    </label>
  );
}

function EditorSelect({
  label,
  value,
  options,
  disabled = false,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="ui-editor-select">
      <span>{label}</span>
      <select aria-label={label} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}
