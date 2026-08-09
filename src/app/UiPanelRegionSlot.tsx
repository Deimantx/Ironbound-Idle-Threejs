import type { CSSProperties, ReactNode } from 'react';
import type { ScreenId } from '../game/types';
import {
  getUiPanelInternalLayout,
  getUiPanelRegionRegistry,
  type UiLayout,
  type UiPanelId,
  type UiPanelRegionId,
} from './uiLayout';

interface UiPanelRegionSlotProps {
  screen: ScreenId;
  panelId: UiPanelId;
  regionId: UiPanelRegionId;
  layout: UiLayout;
  className?: string;
  children: ReactNode;
}

export function UiPanelRegionSlot({
  screen,
  panelId,
  regionId,
  layout,
  className,
  children,
}: UiPanelRegionSlotProps) {
  const internal = getUiPanelInternalLayout(layout, screen, panelId);
  const position = internal.regions[regionId] ?? getUiPanelRegionRegistry(screen, panelId)?.defaultLayout.regions[regionId];
  if (!position) return null;
  const hidden = !position.visible;
  const style = {
    gridColumn: internal.direction === 'stack' ? '1 / -1' : `${position.column} / span ${position.columnSpan}`,
    gridRow: internal.direction === 'stack' ? position.order : position.row,
    order: position.order,
    display: hidden ? 'none' : undefined,
  } as CSSProperties;

  return (
    <div
      className={['ui-panel-region-slot', className].filter(Boolean).join(' ')}
      data-ui-panel-region={regionId}
      data-ui-panel-owner={panelId}
      data-ui-panel-region-visible={hidden ? 'false' : 'true'}
      style={style}
    >
      {children}
    </div>
  );
}
