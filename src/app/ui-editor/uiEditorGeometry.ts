import type { ScreenId } from '../../game/types';
import {
  getUiPanelInternalLayout,
  getUiPanelRegions,
  getUiPanels,
  type UiLayout,
  type UiPanelId,
  type UiPanelPosition,
  type UiPanelRegionId,
  type UiPanelRegionPosition,
} from './uiLayout';

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

const nestedOverlaps = (
  first: UiPanelRegionPosition,
  second: UiPanelRegionPosition,
): boolean =>
  first.row === second.row &&
  first.column < second.column + second.columnSpan &&
  second.column < first.column + first.columnSpan;

export const clampNestedColumnSpan = (
  layout: UiLayout,
  screen: ScreenId,
  panelId: UiPanelId,
  regionId: UiPanelRegionId,
  requestedSpan: number,
): number => {
  const internal = getUiPanelInternalLayout(layout, screen, panelId);
  const current = internal.regions[regionId];
  if (!current) return 1;
  const maxSpan = Math.min(12, 13 - current.column);
  const requested = Math.max(1, Math.min(maxSpan, Math.round(requestedSpan)));
  const others = getUiPanelRegions(screen, panelId)
    .filter((region) => region.id !== regionId)
    .map((region) => internal.regions[region.id])
    .filter((position): position is UiPanelRegionPosition => Boolean(position));
  for (let span = requested; span >= 1; span -= 1) {
    const candidate = { ...current, columnSpan: span };
    if (!others.some((position) => nestedOverlaps(candidate, position))) return span;
  }
  return Math.min(current.columnSpan, maxSpan);
};

export const findAvailableNestedRegionPosition = (
  layout: UiLayout,
  screen: ScreenId,
  panelId: UiPanelId,
  regionId: UiPanelRegionId,
  proposed: UiPanelRegionPosition,
): UiPanelRegionPosition => {
  const internal = getUiPanelInternalLayout(layout, screen, panelId);
  const current = internal.regions[regionId];
  if (!current) return proposed;
  const columnSpan = Math.max(1, Math.min(12, Math.round(proposed.columnSpan)));
  const normalized = {
    ...proposed,
    column: Math.max(1, Math.min(13 - columnSpan, Math.round(proposed.column))),
    row: Math.max(1, Math.min(12, Math.round(proposed.row))),
    columnSpan,
  };
  const others = getUiPanelRegions(screen, panelId)
    .filter((region) => region.id !== regionId)
    .map((region) => internal.regions[region.id])
    .filter((position): position is UiPanelRegionPosition => Boolean(position));
  if (!others.some((position) => nestedOverlaps(normalized, position))) return normalized;
  const maxColumn = 13 - normalized.columnSpan;
  const rowCandidates = Array.from({ length: 12 }, (_, index) => index + 1).sort(
    (first, second) => Math.abs(first - normalized.row) - Math.abs(second - normalized.row),
  );
  const columnCandidates = Array.from({ length: maxColumn }, (_, index) => index + 1).sort(
    (first, second) => Math.abs(first - normalized.column) - Math.abs(second - normalized.column),
  );
  for (const row of rowCandidates) {
    for (const column of columnCandidates) {
      const candidate = { ...normalized, column, row };
      if (!others.some((position) => nestedOverlaps(candidate, position))) return candidate;
    }
  }
  return { ...current };
};
