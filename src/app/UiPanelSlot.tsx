import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ScreenId } from '../game/types';
import { getUiPanels, type UiLayout, type UiPanelId, type UiPanelPosition } from './uiLayout';

interface UiPanelSlotProps {
  screen: ScreenId;
  id: UiPanelId;
  layout: UiLayout;
  children: ReactNode;
}

const getPanelStyle = (
  position: UiPanelPosition,
  reservedWidth: number,
  reservedHeight: number,
) => ({
  gridColumn: `${position.column} / span ${position.columnSpan}`,
  gridRow: position.row,
  minWidth: reservedWidth > 0 ? `${reservedWidth}px` : undefined,
  minHeight: reservedHeight > 0 ? `${reservedHeight}px` : undefined,
});

export function UiPanelSlot({ screen, id, layout, children }: UiPanelSlotProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [compactViewport, setCompactViewport] = useState(false);
  const definition = getUiPanels(screen).find((panel) => panel.id === id);
  const position = layout.screenPanels[screen]?.[id] ?? definition?.defaultPosition;

  useEffect(() => {
    const media = window.matchMedia?.('(max-width: 900px)');
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
    const update = (width: number, height: number) => {
      if (!Number.isFinite(width) || !Number.isFinite(height) || width < 0 || height < 0) return;
      setContentWidth((current) => (Math.abs(current - width) < 0.5 ? current : width));
      setContentHeight((current) => (Math.abs(current - height) < 0.5 ? current : height));
    };
    update(element.offsetWidth, element.offsetHeight);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) =>
      update(entry?.contentRect.width ?? 0, entry?.contentRect.height ?? 0),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  if (!position) return null;

  const scale = compactViewport ? 1 : position.scale;
  const hasMeasurement = contentHeight > 0;
  const reservedWidth = contentWidth * scale;
  const reservedHeight = Math.max(position.height, contentHeight) * scale;

  return (
    <div
      className="ui-panel-slot"
      data-ui-panel={id}
      style={getPanelStyle(position, reservedWidth, reservedHeight)}
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
