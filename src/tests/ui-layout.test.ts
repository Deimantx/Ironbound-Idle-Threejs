import { describe, expect, it } from 'vitest';
import {
  DEFAULT_COMBAT_PANEL_LAYOUT,
  DEFAULT_UI_LAYOUT,
  getUiPanels,
  sanitizeUiLayout,
} from '../app/uiLayout';

describe('visual UI layout', () => {
  it('exposes panel definitions by active screen', () => {
    expect(getUiPanels('combat')).toHaveLength(6);
    expect(getUiPanels('inventory')).toEqual([]);
  });

  it('adds the default combat panel grid to older saved layouts', () => {
    const layout = sanitizeUiLayout({
      sidebarWidth: 240,
      offsets: { content: { x: 12, y: -8 } },
    });

    expect(layout.sidebarWidth).toBe(240);
    expect(layout.offsets.content).toEqual({ x: 12, y: -8 });
    expect(layout.screenPanels.combat).toEqual(DEFAULT_COMBAT_PANEL_LAYOUT);
  });

  it('clamps combat panel positions to the twelve-column grid', () => {
    const layout = sanitizeUiLayout({
      combatPanels: {
        player: { column: 11, row: 99, columnSpan: 8 },
      },
    });

    expect(layout.screenPanels.combat?.player).toEqual({
      column: 11,
      row: 12,
      columnSpan: 2,
      height: 0,
      scale: 1,
    });
    expect(layout.screenPanels.combat?.liveCombat).toEqual(DEFAULT_COMBAT_PANEL_LAYOUT.liveCombat);
  });

  it('repairs non-finite panel values instead of allowing NaN into CSS', () => {
    const layout = sanitizeUiLayout({
      combatPanels: {
        combatLocations: {
          column: Number.NaN,
          row: Number.NaN,
          columnSpan: Number.NaN,
          height: Number.NaN,
          scale: Number.NaN,
        },
      },
    });

    expect(layout.screenPanels.combat?.combatLocations).toEqual(
      DEFAULT_COMBAT_PANEL_LAYOUT.combatLocations,
    );
  });

  it('clamps individual panel scale to fifty through one hundred fifty percent', () => {
    const layout = sanitizeUiLayout({
      screenPanels: {
        combat: {
          player: { scale: 0.1 },
          enemy: { scale: 2 },
        },
      },
    });

    expect(layout.screenPanels.combat?.player.scale).toBe(0.5);
    expect(layout.screenPanels.combat?.enemy.scale).toBe(1.5);
  });

  it('keeps the complete default layout valid', () => {
    expect(sanitizeUiLayout(DEFAULT_UI_LAYOUT)).toEqual(DEFAULT_UI_LAYOUT);
  });
});
