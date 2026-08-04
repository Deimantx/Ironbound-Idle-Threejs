import { useEffect, useRef, useState } from 'react';
import { GripVertical, Move, Palette, RotateCcw, X } from 'lucide-react';
import { DEFAULT_UI_LAYOUT, UI_REGIONS, type UiLayout, type UiRegion } from './uiLayout';

interface UiEditorProps {
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

interface DragState {
  region: UiRegion;
  startX: number;
  startY: number;
  originalX: number;
  originalY: number;
}

const numberLabel = (value: number): string =>
  Number.isInteger(value) ? `${value}px` : `${Math.round(value * 100)}%`;

export function UiEditor({ layout, onChange, onClose }: UiEditorProps) {
  const [selected, setSelected] = useState<UiRegion>('content');
  const [boxes, setBoxes] = useState<Partial<Record<UiRegion, RegionBox>>>({});
  const drag = useRef<DragState | null>(null);

  useEffect(() => {
    let frame: number | undefined;
    const measure = () => {
      const next: Partial<Record<UiRegion, RegionBox>> = {};
      for (const region of UI_REGIONS) {
        const element = document.querySelector<HTMLElement>(`[data-ui-region="${region.id}"]`);
        if (!element) continue;
        const rect = element.getBoundingClientRect();
        next[region.id] = {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        };
      }
      setBoxes(next);
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
  }, [layout]);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const active = drag.current;
      if (!active) return;
      onChange({
        ...layout,
        offsets: {
          ...layout.offsets,
          [active.region]: {
            x: Math.max(-240, Math.min(240, active.originalX + event.clientX - active.startX)),
            y: Math.max(-180, Math.min(180, active.originalY + event.clientY - active.startY)),
          },
        },
      });
    };
    const stop = () => {
      drag.current = null;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
  }, [layout, onChange]);

  const beginDrag = (region: UiRegion, event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setSelected(region);
    const offset = layout.offsets[region];
    drag.current = {
      region,
      startX: event.clientX,
      startY: event.clientY,
      originalX: offset.x,
      originalY: offset.y,
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

  const selectedRegion = UI_REGIONS.find((region) => region.id === selected) ?? UI_REGIONS[0];
  const selectedOffset = layout.offsets[selected];

  return (
    <div className="ui-editor-layer" aria-label="Visual UI editor">
      {UI_REGIONS.map((region) => {
        const box = boxes[region.id];
        if (!box) return null;
        return (
          <div
            className={`ui-editor-target ${selected === region.id ? 'selected' : ''}`}
            key={region.id}
            style={{
              left: box.left,
              top: box.top,
              width: box.width,
              height: box.height,
            }}
          >
            <button
              className="ui-editor-target-label"
              onClick={() => setSelected(region.id)}
              onPointerDown={(event) => beginDrag(region.id, event)}
              title={`Drag to move ${region.label}`}
            >
              <GripVertical size={14} />
              {region.label}
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
          Drag the labeled handles on the game, or use the controls below. Changes save
          automatically in this browser.
        </p>

        <div className="ui-editor-section">
          <div className="ui-editor-section-title">
            <Move size={15} /> Move a region
          </div>
          <div className="ui-editor-region-list">
            {UI_REGIONS.map((region) => (
              <button
                className={`ui-editor-region ${selected === region.id ? 'selected' : ''}`}
                key={region.id}
                onClick={() => setSelected(region.id)}
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
          <div className="ui-editor-nudge-row">
            <button
              className="button"
              onClick={() =>
                onChange({
                  ...layout,
                  offsets: {
                    ...layout.offsets,
                    [selected]: { x: 0, y: 0 },
                  },
                })
              }
            >
              Center {selectedRegion.label}
            </button>
            <span className="muted">
              Offset {selectedOffset.x}px, {selectedOffset.y}px
            </span>
          </div>
        </div>

        <div className="ui-editor-section">
          <div className="ui-editor-section-title">
            <GripVertical size={15} /> Size and spacing
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
          <RotateCcw size={14} /> Reset layout
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
  suffix,
  displayValue,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix: string;
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
