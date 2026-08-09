import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { ScreenId } from '../game/types';
import {
  getUiPanels,
  getUiPanelAppearance,
  UI_EDITOR_COMPACT_QUERY,
  type UiLayout,
  type UiPanelId,
  type UiPanelPosition,
} from './uiLayout';

interface UiPanelSlotProps {
  screen: ScreenId;
  id: UiPanelId;
  layout: UiLayout;
  autoHeight?: boolean;
  children: ReactNode;
}

const getPanelStyle = (
  position: UiPanelPosition,
  reservedHeight: number,
) => ({
  gridColumn: `${position.column} / span ${position.columnSpan}`,
  gridRow: position.row,
  minWidth: 0,
  minHeight: reservedHeight > 0 ? `${reservedHeight}px` : undefined,
});

export function UiPanelSlot({ screen, id, layout, autoHeight = false, children }: UiPanelSlotProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);
  const [compactViewport, setCompactViewport] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(UI_EDITOR_COMPACT_QUERY).matches
      : false,
  );
  const definition = getUiPanels(screen).find((panel) => panel.id === id);
  const position = layout.screenPanels[screen]?.[id] ?? definition?.defaultPosition;

  useEffect(() => {
    const media = window.matchMedia?.(UI_EDITOR_COMPACT_QUERY);
    if (!media) return;
    const update = () => setCompactViewport(media.matches);
    update();
    media.addEventListener?.('change', update);
    media.addListener?.(update);
    return () => {
      media.removeEventListener?.('change', update);
      media.removeListener?.(update);
    };
  }, []);

  useEffect(() => {
    const element = contentRef.current;
    if (!element) return;
    const update = (height: number) => {
      if (!Number.isFinite(height) || height < 0) return;
      setContentHeight((current) => (Math.abs(current - height) < 0.5 ? current : height));
    };
    update(element.offsetHeight);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) =>
      update(entry?.contentRect.height ?? 0),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [autoHeight, compactViewport]);

  if (!position) return null;

  const scale = compactViewport ? 1 : position.scale;
  const hasMeasurement = contentHeight > 0;
  const reservedHeight = Math.max(autoHeight ? 0 : position.height, contentHeight) * scale;
  const appearance = getUiPanelAppearance(layout, screen, id);
  const appearanceStyle = {
    ...(appearance.background ? { '--ui-panel-local-background': appearance.background } : {}),
    ...(appearance.borderColor ? { '--ui-panel-local-border': appearance.borderColor } : {}),
    ...(appearance.borderWidth !== undefined
      ? { '--ui-panel-local-border-width': `${appearance.borderWidth}px` }
      : {}),
    ...(appearance.radius !== undefined ? { '--ui-panel-local-radius': `${appearance.radius}px` } : {}),
    ...(appearance.shadow !== undefined
      ? { '--ui-panel-local-shadow': appearance.shadow ? 'var(--shadow)' : 'none' }
      : {}),
  } as CSSProperties;

  return (
    <div
      className="ui-panel-slot"
      data-ui-panel={id}
      data-ui-panel-locked={position.locked ? 'true' : 'false'}
      style={{ ...getPanelStyle(position, reservedHeight), ...appearanceStyle }}
    >
      <div
        ref={contentRef}
        className="ui-panel-scale-content"
        data-ui-panel-scale={scale}
        style={{
          width: `${100 / scale}%`,
          transform: `scale(${scale})`,
          position: hasMeasurement ? 'absolute' : 'relative',
        }}
      >
        {children}
      </div>
    </div>
  );
}
