import { useEffect, useMemo, useRef, useState } from 'react';
import { GripVertical, LayoutGrid, Move, Palette, RotateCcw, X } from 'lucide-react';
import {
  DEFAULT_UI_LAYOUT,
  getUiPanels,
  UI_REGIONS,
  type UiLayout,
  type UiPanelId,
  type UiPanelPosition,
  type UiRegion,
} from './uiLayout';
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
}

type SelectedTarget = { kind: 'region'; id: UiRegion } | { kind: 'panel'; id: UiPanelId };

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
  originalOffset?: { x: number; y: number };
  grabOffsetX?: number;
  grabOffsetY?: number;
  gridMetrics?: GridMetrics;
}

const numberLabel = (value: number): string =>
  Number.isInteger(value) ? `${value}px` : `${Math.round(value * 100)}%`;

const EMPTY_PANEL_LAYOUT: Record<UiPanelId, UiPanelPosition> = {};

const clamp = (value: number, min: number, max: number): number => {
  const safeValue = Number.isFinite(value) ? value : min;
  return Math.min(max, Math.max(min, safeValue));
};

const getGridMetrics = (screen: ScreenId): GridMetrics | null => {
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
  const rowHeights =
    computed.gridTemplateRows
      .match(/[\d.]+px/g)
      ?.map(Number)
      .filter((value) => Number.isFinite(value) && value > 0) ?? [];
  if (!Number.isFinite(columnWidth) || columnWidth <= 0) return null;
  const rowStarts = [0];
  const fallbackRowHeight = Math.max(64, rowHeights[0] ?? 0);
  for (let index = 0; index < 12; index += 1) {
    const rowHeight = rowHeights[index] ?? fallbackRowHeight;
    rowStarts.push(rowStarts[index] + rowHeight + rowGap);
  }
  const columnStep = columnWidth + columnGap;
  if (!Number.isFinite(columnStep) || columnStep <= 0) return null;
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

const panelOverlaps = (first: UiPanelPosition, second: UiPanelPosition): boolean =>
  first.row === second.row &&
  first.column < second.column + second.columnSpan &&
  second.column < first.column + first.columnSpan;

const findAvailablePanelPosition = (
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
  const [boxes, setBoxes] = useState<EditorBoxes>({ regions: {}, panels: {} });
  const drag = useRef<DragState | null>(null);
  const panelDefinitions = getUiPanels(screen);
  const panelLayout = useMemo(
    () => layout.screenPanels[screen] ?? EMPTY_PANEL_LAYOUT,
    [layout.screenPanels, screen],
  );
  const screenLabel = screen.charAt(0).toUpperCase() + screen.slice(1);

  useEffect(() => {
    let frame: number | undefined;
    const measure = () => {
      const regions: Partial<Record<UiRegion, RegionBox>> = {};
      const panels: Partial<Record<UiPanelId, RegionBox>> = {};
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
      }
      setBoxes({ regions, panels });
      frame = 0;
    };
    const scheduleMeasure = () => {
      if (frame !== undefined) return;
      frame = window.setTimeout(() => {
        measure();
        frame = undefined;
      }, 0);
    };
    measure();
    window.addEventListener('resize', scheduleMeasure);
    window.addEventListener('scroll', scheduleMeasure, true);
    return () => {
      window.removeEventListener('resize', scheduleMeasure);
      window.removeEventListener('scroll', scheduleMeasure, true);
      if (frame !== undefined) window.clearTimeout(frame);
    };
  }, [layout, panelDefinitions]);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const active = drag.current;
      if (!active) return;
      if (active.target.kind === 'region' && active.originalOffset) {
        onChange({
          ...layout,
          offsets: {
            ...layout.offsets,
            [active.target.id]: {
              x: clamp(active.originalOffset.x + event.clientX - active.startX, -240, 240),
              y: clamp(active.originalOffset.y + event.clientY - active.startY, -180, 180),
            },
          },
        });
        return;
      }
      if (active.target.kind !== 'panel' || !active.gridMetrics) return;
      const current = panelLayout[active.target.id];
      if (!current) return;
      const desiredLeft = event.clientX - (active.grabOffsetX ?? 0);
      const desiredTop = event.clientY - (active.grabOffsetY ?? 0);
      const column = clamp(
        Math.round((desiredLeft - active.gridMetrics.left) / active.gridMetrics.columnStep) + 1,
        1,
        13 - current.columnSpan,
      );
      const row = getGridRow(active.gridMetrics, desiredTop);
      const position = findAvailablePanelPosition(layout, screen, active.target.id, {
        ...current,
        column,
        row,
      });
      if (position.column === current.column && position.row === current.row) return;
      onChange({
        ...layout,
        screenPanels: {
          ...layout.screenPanels,
          [screen]: {
            ...panelLayout,
            [active.target.id]: position,
          },
        },
      });
    };
    const stop = () => {
      drag.current = null;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
  }, [layout, onChange, panelLayout, screen]);

  const beginDrag = (target: SelectedTarget, event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setSelected(target);
    if (target.kind === 'region') {
      const offset = layout.offsets[target.id];
      drag.current = {
        target,
        startX: event.clientX,
        startY: event.clientY,
        originalOffset: offset,
      };
      return;
    }
    const box = boxes.panels[target.id];
    const gridMetrics = getGridMetrics(screen);
    if (!box || !gridMetrics) return;
    drag.current = {
      target,
      startX: event.clientX,
      startY: event.clientY,
      grabOffsetX: event.clientX - box.left,
      grabOffsetY: event.clientY - box.top,
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
    onChange({ ...layout, [key]: value });
  };

  const updatePanel = (key: keyof UiPanelPosition, value: number) => {
    if (selected.kind !== 'panel') return;
    const current = panelLayout[selected.id];
    if (!current) return;
    const next = { ...current, [key]: value } as UiPanelPosition;
    if (key === 'columnSpan') next.column = Math.min(next.column, 13 - value);
    const position = findAvailablePanelPosition(layout, screen, selected.id, next);
    onChange({
      ...layout,
      screenPanels: {
        ...layout.screenPanels,
        [screen]: {
          ...panelLayout,
          [selected.id]: position,
        },
      },
    });
  };

  const resetRegion = () => {
    if (selected.kind !== 'region') return;
    onChange({
      ...layout,
      offsets: {
        ...layout.offsets,
        [selected.id]: { x: 0, y: 0 },
      },
    });
  };

  const centerPanel = () => {
    if (selected.kind !== 'panel') return;
    const current = panelLayout[selected.id];
    if (!current) return;
    const position = findAvailablePanelPosition(
      layout,
      screen,
      selected.id,
      {
        ...current,
        column: Math.max(1, Math.floor((12 - current.columnSpan) / 2) + 1),
      },
      'center',
    );
    onChange({
      ...layout,
      screenPanels: {
        ...layout.screenPanels,
        [screen]: {
          ...panelLayout,
          [selected.id]: position,
        },
      },
    });
  };

  const resetPanel = () => {
    if (selected.kind !== 'panel') return;
    const definition = panelDefinitions.find((panel) => panel.id === selected.id);
    if (!definition) return;
    onChange({
      ...layout,
      screenPanels: {
        ...layout.screenPanels,
        [screen]: {
          ...panelLayout,
          [selected.id]: { ...definition.defaultPosition },
        },
      },
    });
  };

  const selectedRegion =
    selected.kind === 'region'
      ? (UI_REGIONS.find((region) => region.id === selected.id) ?? UI_REGIONS[0])
      : null;
  const selectedPanel =
    selected.kind === 'panel'
      ? (panelDefinitions.find((panel) => panel.id === selected.id) ?? panelDefinitions[0])
      : null;
  const selectedOffset = selectedRegion ? layout.offsets[selectedRegion.id] : null;
  const selectedPanelPosition = selectedPanel ? panelLayout[selectedPanel.id] : null;
  const panelsVisible = panelDefinitions.some((panel) => boxes.panels[panel.id]);

  return (
    <div className="ui-editor-layer" aria-label="Visual UI editor">
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
        return (
          <div
            className={`ui-editor-target ui-editor-panel-target ${selected.kind === 'panel' && selected.id === panel.id ? 'selected' : ''}`}
            key={panel.id}
            style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
          >
            <button
              className="ui-editor-target-label"
              onClick={() => setSelected(target)}
              onPointerDown={(event) => beginDrag(target, event)}
              title={`Drag to move ${panel.label}`}
            >
              <GripVertical size={14} />
              {panel.label}
            </button>
          </div>
        );
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
        <p className="subtle">
          Drag a labeled handle, or use the controls below. Changes save automatically in this
          browser.
        </p>

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
            <div className="ui-editor-nudge-row">
              <button className="button" onClick={resetRegion}>
                Reset {selectedRegion.label} position
              </button>
              <span className="muted">
                Offset {selectedOffset.x}px, {selectedOffset.y}px
              </span>
            </div>
          )}
        </div>

        <div className="ui-editor-section">
          <div className="ui-editor-section-title">
            <LayoutGrid size={15} /> {screenLabel} panels
          </div>
          {panelsVisible ? (
            <>
              <div className="ui-editor-region-list">
                {panelDefinitions.map((panel) => {
                  const position = panelLayout[panel.id];
                  if (!position) return null;
                  return (
                    <button
                      className={`ui-editor-region ${selected.kind === 'panel' && selected.id === panel.id ? 'selected' : ''}`}
                      key={panel.id}
                      onClick={() => setSelected({ kind: 'panel', id: panel.id })}
                    >
                      <span>
                        <strong>{panel.label}</strong>
                        <small>{panel.description}</small>
                      </span>
                      <small>
                        C{position.column} · R{position.row}
                      </small>
                    </button>
                  );
                })}
              </div>
              {selectedPanel && selectedPanelPosition && (
                <>
                  <div className="ui-editor-nudge-row">
                    <button className="button" onClick={centerPanel}>
                      Center {selectedPanel.label}
                    </button>
                    <button className="button ghost" onClick={resetPanel}>
                      Reset {selectedPanel.label}
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
                      onChange={(value) => updatePanel('column', value)}
                    />
                    <EditorRange
                      label="Grid row"
                      value={selectedPanelPosition.row}
                      min={1}
                      max={12}
                      onChange={(value) => updatePanel('row', value)}
                    />
                    <EditorRange
                      label="Panel width"
                      value={selectedPanelPosition.columnSpan}
                      min={1}
                      max={12}
                      suffix=" columns"
                      onChange={(value) => updatePanel('columnSpan', value)}
                    />
                    <EditorRange
                      label="Panel height"
                      value={selectedPanelPosition.height}
                      min={0}
                      max={900}
                      step={10}
                      displayValue={
                        selectedPanelPosition.height > 0
                          ? `${selectedPanelPosition.height}px`
                          : 'Auto'
                      }
                      onChange={(value) => updatePanel('height', value)}
                    />
                    <EditorRange
                      label="Panel scale"
                      value={selectedPanelPosition.scale}
                      min={0.5}
                      max={1.5}
                      step={0.05}
                      displayValue={`${Math.round(selectedPanelPosition.scale * 100)}%`}
                      onChange={(value) => updatePanel('scale', value)}
                    />
                  </div>
                </>
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
            onChange={(accent) => onChange({ ...layout, accent })}
          />
          <EditorColor
            label="Game background"
            value={layout.background}
            onChange={(background) => onChange({ ...layout, background })}
          />
          <EditorColor
            label="Panel color"
            value={layout.panel}
            onChange={(panel) => onChange({ ...layout, panel })}
          />
        </div>

        <button
          className="button danger ui-editor-reset"
          onClick={() => onChange(DEFAULT_UI_LAYOUT)}
        >
          <RotateCcw size={14} /> Reset entire layout
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
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  displayValue?: string;
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
      <input type="color" value={value} onChange={(event) => onChange(event.target.value)} />
      <code>{value}</code>
    </label>
  );
}
