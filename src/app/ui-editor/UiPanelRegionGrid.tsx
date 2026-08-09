import type { CSSProperties, ReactNode } from 'react';
import type { ScreenId } from '../../game/types';
import { getUiPanelInternalLayout, type UiLayout, type UiPanelId } from './uiLayout';

interface UiPanelRegionGridProps {
  screen: ScreenId;
  panelId: UiPanelId;
  layout: UiLayout;
  className?: string;
  children: ReactNode;
}

export function UiPanelRegionGrid({
  screen,
  panelId,
  layout,
  className,
  children,
}: UiPanelRegionGridProps) {
  const internal = getUiPanelInternalLayout(layout, screen, panelId);
  const style = {
    '--ui-panel-region-gap': `${internal.gap}px`,
    '--ui-panel-region-padding': `${internal.padding}px`,
  } as CSSProperties;

  return (
    <div
      className={['ui-panel-region-grid', className].filter(Boolean).join(' ')}
      data-ui-panel-region-grid={panelId}
      data-ui-panel-region-screen={screen}
      data-ui-panel-region-direction={internal.direction}
      style={style}
    >
      {children}
    </div>
  );
}
