import { describe, expect, it } from 'vitest';
import {
  DEFAULT_COMBAT_PANEL_LAYOUT,
  DEFAULT_EQUIPMENT_PANEL_LAYOUT,
  DEFAULT_INVENTORY_PANEL_LAYOUT,
  DEFAULT_MINING_PANEL_LAYOUT,
  DEFAULT_SMITHING_PANEL_LAYOUT,
  DEFAULT_UI_LAYOUT,
  getUiPanels,
  sanitizeUiLayout,
} from '../app/uiLayout';
import { findAvailablePanelPosition } from '../app/UIEditor';

describe('visual UI layout', () => {
  it('exposes panel definitions by active screen', () => {
    expect(getUiPanels('combat')).toHaveLength(5);
    expect(getUiPanels('combat').map((panel) => panel.id)).toEqual([
      'combatLocations',
      'player',
      'liveCombat',
      'enemy',
      'combatOverview',
    ]);
    expect(getUiPanels('inventory')).toHaveLength(2);
    expect(getUiPanels('equipment')).toHaveLength(2);
    expect(getUiPanels('mining')).toHaveLength(3);
    expect(getUiPanels('smithing')).toHaveLength(3);
    expect(getUiPanels('inventory').map((panel) => panel.id)).toEqual([
      'inventoryToolbar',
      'inventoryBank',
    ]);
    expect(getUiPanels('equipment').map((panel) => panel.id)).toEqual([
      'equipmentLoadout',
      'equipmentStats',
    ]);
    expect(getUiPanels('mining').map((panel) => panel.id)).toEqual([
      'miningOverview',
      'miningNodes',
      'miningDetails',
    ]);
    expect(getUiPanels('smithing').map((panel) => panel.id)).toEqual([
      'smithingOverview',
      'smithingForge',
      'smithingAnvil',
    ]);
  });

  it('adds the default combat panel grid to older saved layouts', () => {
    const layout = sanitizeUiLayout({
      sidebarWidth: 240,
      offsets: { content: { x: 12, y: -8 } },
    });

    expect(layout.sidebarWidth).toBe(240);
    expect(layout.offsets.content).toEqual({ x: 12, y: -8 });
    expect(layout.screenPanels.combat).toEqual(DEFAULT_COMBAT_PANEL_LAYOUT);
    expect(layout.screenPanels.inventory).toEqual(DEFAULT_INVENTORY_PANEL_LAYOUT);
    expect(layout.screenPanels.equipment).toEqual(DEFAULT_EQUIPMENT_PANEL_LAYOUT);
    expect(layout.screenPanels.equipment?.equipmentLoadout).toMatchObject({
      column: 1,
      columnSpan: 7,
    });
    expect(layout.screenPanels.equipment?.equipmentStats).toMatchObject({
      column: 8,
      columnSpan: 5,
    });
    expect(layout.screenPanels.mining).toEqual(DEFAULT_MINING_PANEL_LAYOUT);
    expect(layout.screenPanels.smithing).toEqual(DEFAULT_SMITHING_PANEL_LAYOUT);
  });

  it('backfills new screen panels without changing custom combat values', () => {
    const layout = sanitizeUiLayout({
      screenPanels: {
        combat: {
          player: { column: 5, row: 5, columnSpan: 4, height: 140, scale: 1.25 },
        },
      },
    });

    expect(layout.screenPanels.combat?.player).toEqual({
      column: 5,
      row: 5,
      columnSpan: 4,
      height: 140,
      scale: 1.25,
    });
    expect(layout.screenPanels.inventory).toEqual(DEFAULT_INVENTORY_PANEL_LAYOUT);
    expect(layout.screenPanels.equipment).toEqual(DEFAULT_EQUIPMENT_PANEL_LAYOUT);
    expect(layout.screenPanels.mining).toEqual(DEFAULT_MINING_PANEL_LAYOUT);
    expect(layout.screenPanels.smithing).toEqual(DEFAULT_SMITHING_PANEL_LAYOUT);
  });

  it('repairs invalid non-combat panel positions', () => {
    const layout = sanitizeUiLayout({
      screenPanels: {
        equipment: {
          equipmentLoadout: {
            column: 12,
            row: 99,
            columnSpan: 8,
            height: -100,
            scale: 4,
          },
        },
      },
    });

    expect(layout.screenPanels.equipment?.equipmentLoadout).toEqual({
      column: 12,
      row: 12,
      columnSpan: 1,
      height: 0,
      scale: 1.5,
    });
  });

  it('preserves an older saved six-six Equipment split', () => {
    const layout = sanitizeUiLayout({
      screenPanels: {
        equipment: {
          equipmentLoadout: { column: 1, row: 1, columnSpan: 6, scale: 1 },
          equipmentStats: { column: 7, row: 1, columnSpan: 6, scale: 1 },
        },
      },
    });

    expect(layout.screenPanels.equipment).toMatchObject({
      equipmentLoadout: { column: 1, columnSpan: 6 },
      equipmentStats: { column: 7, columnSpan: 6 },
    });
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

  it('keeps global region offsets inside the recoverable editor range', () => {
    const layout = sanitizeUiLayout({
      offsets: { content: { x: 500, y: -500 } },
    });
    expect(layout.offsets.content).toEqual({ x: 80, y: -60 });
  });

  it('keeps the complete default layout valid', () => {
    expect(sanitizeUiLayout(DEFAULT_UI_LAYOUT)).toEqual(DEFAULT_UI_LAYOUT);
  });

  it('uses stacked full-width Smithing panels and resets the legacy five-seven split', () => {
    expect(DEFAULT_SMITHING_PANEL_LAYOUT).toMatchObject({
      smithingOverview: { column: 1, row: 1, columnSpan: 12 },
      smithingForge: { column: 1, row: 2, columnSpan: 12 },
      smithingAnvil: { column: 1, row: 3, columnSpan: 12 },
    });
    const layout = sanitizeUiLayout({
      screenPanels: {
        smithing: {
          smithingOverview: { column: 1, row: 1, columnSpan: 12 },
          smithingForge: { column: 1, row: 2, columnSpan: 5 },
          smithingAnvil: { column: 6, row: 2, columnSpan: 7 },
        },
      },
    });
    expect(layout.screenPanels.smithing).toEqual(DEFAULT_SMITHING_PANEL_LAYOUT);
  });

  it('resolves a panel collision on the intended row direction deterministically', () => {
    const layout = sanitizeUiLayout(DEFAULT_UI_LAYOUT);
    const player = layout.screenPanels.combat?.player;
    expect(player).toBeDefined();
    const resolved = findAvailablePanelPosition(layout, 'combat', 'player', { ...player!, row: 4 });
    expect(resolved).toMatchObject({ column: 1, row: 4, columnSpan: 3 });
  });
});
