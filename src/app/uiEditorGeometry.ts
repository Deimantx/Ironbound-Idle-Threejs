import type { ScreenId } from '../game/types';
import { getUiPanels, type UiLayout, type UiPanelId, type UiPanelPosition } from './uiLayout';

export const snapGridDelta = (delta: number, columnStep: number): number => {
  if (!Number.isFinite(delta) || !Number.isFinite(columnStep) || columnStep <= 0) return 0;
  return Math.round(delta / columnStep);
};

const overlaps = (first: UiPanelPosition, second: UiPanelPosition): boolean =>
  first.row === second.row &&
  first.column < second.column + second.columnSpan &&
  second.column < first.column + first.columnSpan;

export const clampPanelColumnSpan = (
  layout: UiLayout,
  screen: ScreenId,
  panelId: UiPanelId,
  requestedSpan: number,
): number => {
  const current = layout.screenPanels[screen]?.[panelId];
  if (!current) return 1;
  const maxSpan = Math.min(12, 13 - current.column);
  const requested = Math.max(1, Math.min(maxSpan, Math.round(requestedSpan)));
  const others = getUiPanels(screen)
    .filter((panel) => panel.id !== panelId)
    .map((panel) => layout.screenPanels[screen]?.[panel.id])
    .filter((position): position is UiPanelPosition => Boolean(position));
  for (let span = requested; span >= 1; span -= 1) {
    const candidate = { ...current, columnSpan: span };
    if (!others.some((position) => overlaps(candidate, position))) return span;
  }
  return Math.min(current.columnSpan, maxSpan);
};

export const clampPanelHeight = (height: number): number =>
  Math.round(Math.min(900, Math.max(0, Number.isFinite(height) ? height : 0)));

export const canEditPanelLayout = (position: UiPanelPosition | undefined): boolean =>
  Boolean(position && !position.locked);
