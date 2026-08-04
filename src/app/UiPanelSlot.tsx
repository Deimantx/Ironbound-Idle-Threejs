import type { ReactNode } from 'react';
import type { ScreenId } from '../game/types';
import { getUiPanels, type UiLayout, type UiPanelId, type UiPanelPosition } from './uiLayout';

interface UiPanelSlotProps {
  screen: ScreenId;
  id: UiPanelId;
  layout: UiLayout;
  children: ReactNode;
}

const getPanelStyle = (position: UiPanelPosition) => ({
  gridColumn: `${position.column} / span ${position.columnSpan}`,
  gridRow: position.row,
  transform: `scale(${position.scale})`,
  transformOrigin: 'top left',
  ...(position.height > 0 ? { minHeight: `${position.height}px` } : {}),
});

export function UiPanelSlot({ screen, id, layout, children }: UiPanelSlotProps) {
  const definition = getUiPanels(screen).find((panel) => panel.id === id);
  const position = layout.screenPanels[screen]?.[id] ?? definition?.defaultPosition;
  if (!position) return null;

  return (
    <div className="ui-panel-slot" data-ui-panel={id} style={getPanelStyle(position)}>
      {children}
    </div>
  );
}
