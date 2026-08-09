import type { ReactNode } from 'react';
import type { ScreenId } from '../../game/types';

interface UiPanelGridProps {
  screen: ScreenId;
  className?: string;
  children: ReactNode;
}

export function UiPanelGrid({ screen, className, children }: UiPanelGridProps) {
  return (
    <div className={['ui-panel-grid', className].filter(Boolean).join(' ')} data-ui-panel-grid={screen}>
      {children}
    </div>
  );
}
