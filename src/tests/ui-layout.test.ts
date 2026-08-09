import { describe, expect, it } from 'vitest';
import {
  DEFAULT_COMBAT_PANEL_LAYOUT,
  DEFAULT_EQUIPMENT_PANEL_LAYOUT,
  DEFAULT_INVENTORY_PANEL_LAYOUT,
  DEFAULT_MINING_PANEL_LAYOUT,
  DEFAULT_SMITHING_PANEL_LAYOUT,
  DEFAULT_UI_LAYOUT,
  UI_LAYOUT_VERSION,
  DEFAULT_HOME_PANEL_LAYOUT,
  DEFAULT_COLLECTION_PANEL_LAYOUT,
  DEFAULT_SETTINGS_PANEL_LAYOUT,
  DEFAULT_HELP_PANEL_LAYOUT,
  DEFAULT_HOME_OVERVIEW_INTERNAL_LAYOUT,
  DEFAULT_HOME_COMBAT_PROGRESSION_INTERNAL_LAYOUT,
  DEFAULT_HOME_PROFESSION_PROGRESSION_INTERNAL_LAYOUT,
  DEFAULT_HOME_WORLD_RECORD_INTERNAL_LAYOUT,
  getUiPanels,
  getUiPanelAppearance,
  getUiPanelInternalLayout,
  getUiPanelRegionPresets,
  getUiPanelRegions,
  resetUiPanel,
  resetUiPanelRegion,
  resetUiLayoutScreen,
  resetUiLayout,
  sanitizeUiLayout,
} from '../app/uiLayout';
import { findAvailablePanelPosition } from '../app/UIEditor';
import type { ScreenId } from '../game/types';
import {
  canEditPanelLayout,
  clampPanelColumnSpan,
  clampPanelHeight,
  snapGridDelta,
  clampNestedColumnSpan,
  findAvailableNestedRegionPosition,
} from '../app/uiEditorGeometry';

describe('visual UI layout', () => {
  it('exposes panel definitions by active screen', () => {
    expect(UI_LAYOUT_VERSION).toBe(3);
    expect(getUiPanels('home')).toHaveLength(4);
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
    expect(getUiPanels('collection')).toHaveLength(2);
    expect(getUiPanels('settings')).toHaveLength(2);
    expect(getUiPanels('help')).toHaveLength(2);
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

  it('registers stable nested definitions for every Home panel', () => {
    const expected = {
      homeOverview: ['homeOverviewActivity', 'homeOverviewStats', 'homeOverviewCharacter'],
      homeCombatProgression: [
        'homeCombatProgressionHeading',
        'homeCombatProgressionBoard',
        'homeCombatProgressionRecent',
      ],
      homeProfessionProgression: [
        'homeProfessionProgressionHeading',
        'homeProfessionProgressionBoard',
        'homeProfessionProgressionRecent',
      ],
      homeWorldRecord: ['homeWorldRecordHeading', 'homeWorldRecordLifetimeStats', 'homeWorldRecordCollection'],
    } as const;

    for (const [panelId, regionIds] of Object.entries(expected)) {
      expect(getUiPanelRegions('home', panelId).map((region) => region.id)).toEqual(regionIds);
      expect(getUiPanelRegionPresets('home', panelId).length).toBeGreaterThan(0);
    }
  });

  it('registers stable nested definitions for every Phase 2C screen', () => {
    const expected: Record<string, Record<string, string[]>> = {
      mining: {
        miningOverview: ['miningOverviewScene', 'miningOverviewActivity'],
        miningNodes: ['miningNodesHeading', 'miningNodesBrowser'],
        miningDetails: ['miningDetailsRock', 'miningDetailsTool'],
      },
      smithing: {
        smithingOverview: ['smithingOverviewActiveWork', 'smithingOverviewControls'],
        smithingForge: ['smithingForgeHeading', 'smithingForgeRecipes'],
        smithingAnvil: ['smithingAnvilHeading', 'smithingAnvilRecipes'],
      },
      inventory: {
        inventoryToolbar: ['inventoryToolbarSearch', 'inventoryToolbarCapacity', 'inventoryToolbarFilters'],
        inventoryBank: ['inventoryBankHeading', 'inventoryBankItems', 'inventoryBankDetails'],
      },
      equipment: {
        equipmentLoadout: [
          'equipmentLoadoutCombat',
          'equipmentLoadoutAccessories',
          'equipmentLoadoutProfession',
          'equipmentLoadoutInspection',
        ],
        equipmentStats: [
          'equipmentStatsCombat',
          'equipmentStatsComparison',
          'equipmentStatsSpecial',
          'equipmentStatsProfession',
        ],
      },
      collection: {
        collectionSummary: ['collectionSummaryItems', 'collectionSummaryMonsters', 'collectionSummaryOverall'],
        collectionBrowser: ['collectionBrowserControls', 'collectionBrowserContent'],
      },
      settings: {
        settingsSave: ['settingsSavePrimary', 'settingsSaveTransfer', 'settingsSaveDanger'],
        settingsPresentation: [
          'settingsPresentationGeneral',
          'settingsPresentationAccessibility',
          'settingsPresentationGraphics',
        ],
      },
      help: {
        helpGameplay: ['helpGameplayTime', 'helpGameplayOffline'],
        helpSaveInventory: ['helpSaveInventorySave', 'helpSaveInventoryInventory'],
      },
      combat: {
        combatLocations: ['combatLocationsNavigation', 'combatLocationsAreas', 'combatLocationsEnemies'],
        player: ['playerIdentity', 'playerEquipment', 'playerCombatStyle', 'playerDerivedStats'],
        liveCombat: ['liveCombatStatus', 'liveCombatTimeline', 'liveCombatControls', 'liveCombatLog'],
        enemy: ['enemyIdentity', 'enemyStats', 'enemyTraits', 'enemyDrops'],
        combatOverview: ['combatOverviewTabs', 'combatOverviewContent'],
      },
    };

    for (const [screen, panels] of Object.entries(expected)) {
      for (const [panelId, regionIds] of Object.entries(panels)) {
        expect(getUiPanelRegions(screen as ScreenId, panelId).map((region) => region.id)).toEqual(regionIds);
        expect(getUiPanelRegionPresets(screen as ScreenId, panelId).length).toBeGreaterThan(0);
      }
    }
  });

  it('protects essential controls while allowing informational regions to be hidden', () => {
    expect(getUiPanelRegions('settings', 'settingsSave').every((region) => region.canHide === false)).toBe(true);
    expect(getUiPanelRegions('combat', 'liveCombat').map((region) => region.canHide)).toEqual([
      false,
      true,
      false,
      true,
    ]);
    expect(getUiPanelRegions('inventory', 'inventoryToolbar').map((region) => region.canHide)).toEqual([
      false,
      true,
      false,
    ]);
  });

  it('migrates legacy layouts into the current version and backfills new panels and locks', () => {
    const layout = sanitizeUiLayout({
      sidebarWidth: 248,
      screenPanels: {
        combat: { player: { column: 5, row: 4, columnSpan: 4, scale: 1.2 } },
      },
    });

    expect(layout.version).toBe(UI_LAYOUT_VERSION);
    expect(layout.sidebarWidth).toBe(248);
    expect(layout.screenPanels.combat?.player).toMatchObject({
      column: 5,
      row: 4,
      columnSpan: 4,
      scale: 1.2,
      locked: false,
    });
    expect(layout.screenPanels.home).toEqual(DEFAULT_HOME_PANEL_LAYOUT);
    expect(layout.screenPanels.collection).toEqual(DEFAULT_COLLECTION_PANEL_LAYOUT);
    expect(layout.screenPanels.settings).toEqual(DEFAULT_SETTINGS_PANEL_LAYOUT);
    expect(layout.screenPanels.help).toEqual(DEFAULT_HELP_PANEL_LAYOUT);
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
      locked: false,
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
      locked: false,
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
      locked: false,
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

  it('keeps screen resets isolated and clamps direct resize geometry', () => {
    const custom = sanitizeUiLayout({
      screenPanels: {
        home: {
          homeOverview: { column: 3, row: 4, columnSpan: 4, locked: true },
        },
        inventory: {
          inventoryBank: { column: 2, row: 5, columnSpan: 8 },
        },
      },
    });
    const reset = resetUiLayoutScreen(custom, 'home');
    expect(reset.screenPanels.home).toEqual(DEFAULT_HOME_PANEL_LAYOUT);
    expect(reset.screenPanels.inventory?.inventoryBank).toMatchObject({
      column: 2,
      row: 5,
      columnSpan: 8,
    });

    expect(snapGridDelta(37, 12)).toBe(3);
    expect(clampPanelHeight(-10)).toBe(0);
    expect(clampPanelHeight(901)).toBe(900);
    expect(clampPanelColumnSpan(custom, 'equipment', 'equipmentLoadout', 12)).toBe(7);
    expect(canEditPanelLayout(custom.screenPanels.home?.homeOverview)).toBe(false);
    expect(canEditPanelLayout(custom.screenPanels.inventory?.inventoryBank)).toBe(true);
  });

  it('provides a complete UI reset independent of gameplay state', () => {
    const reset = resetUiLayout();
    expect(reset).toEqual(DEFAULT_UI_LAYOUT);
    expect(Object.keys(reset.screenPanels)).toEqual([
      'home',
      'combat',
      'inventory',
      'equipment',
      'mining',
      'smithing',
      'collection',
      'settings',
      'help',
    ]);
  });

  it('migrates Phase 1 layouts to v3 without losing panel state', () => {
    const layout = sanitizeUiLayout({
      version: 2,
      accent: '#123456',
      offsets: { content: { x: 12, y: -8 } },
      screenPanels: {
        home: {
          homeOverview: { column: 2, row: 4, columnSpan: 8, scale: 1.2, locked: true },
        },
      },
    });
    expect(layout.version).toBe(3);
    expect(layout.accent).toBe('#123456');
    expect(layout.offsets.content).toEqual({ x: 12, y: -8 });
    expect(layout.screenPanels.home?.homeOverview).toMatchObject({
      column: 2,
      row: 4,
      columnSpan: 8,
      scale: 1.2,
      locked: true,
    });
    expect(getUiPanelRegions('home', 'homeOverview').map((region) => region.id)).toEqual([
      'homeOverviewActivity',
      'homeOverviewStats',
      'homeOverviewCharacter',
    ]);
    expect(getUiPanelInternalLayout(layout, 'home', 'homeOverview').regions).toEqual(
      DEFAULT_HOME_OVERVIEW_INTERNAL_LAYOUT.regions,
    );
    expect(getUiPanelInternalLayout(layout, 'home', 'homeCombatProgression')).toEqual(
      DEFAULT_HOME_COMBAT_PROGRESSION_INTERNAL_LAYOUT,
    );
    expect(getUiPanelInternalLayout(layout, 'home', 'homeProfessionProgression')).toEqual(
      DEFAULT_HOME_PROFESSION_PROGRESSION_INTERNAL_LAYOUT,
    );
    expect(getUiPanelInternalLayout(layout, 'home', 'homeWorldRecord')).toEqual(
      DEFAULT_HOME_WORLD_RECORD_INTERNAL_LAYOUT,
    );
    expect(getUiPanelAppearance(layout, 'home', 'homeOverview')).toEqual({});
  });

  it('sanitizes nested layout and panel appearance overrides', () => {
    const layout = sanitizeUiLayout({
      panelRegions: {
        home: {
          homeOverview: {
            direction: 'invalid',
            gap: 99,
            padding: -4,
            regions: {
              homeOverviewStats: { column: 99, columnSpan: 99, row: 99, visible: false },
            },
          },
        },
      },
      panelAppearances: {
        home: {
          homeOverview: {
            background: 'not-a-color',
            borderColor: '#123456',
            borderWidth: 9,
            radius: -4,
            shadow: false,
          },
        },
      },
    });
    const internal = getUiPanelInternalLayout(layout, 'home', 'homeOverview');
    expect(internal.direction).toBe('grid');
    expect(internal.gap).toBe(32);
    expect(internal.padding).toBe(0);
    expect(internal.regions.homeOverviewStats).toMatchObject({
      column: 12,
      columnSpan: 1,
      row: 12,
      visible: false,
    });
    expect(getUiPanelAppearance(layout, 'home', 'homeOverview')).toEqual({
      borderColor: '#123456',
      borderWidth: 4,
      radius: 0,
      shadow: false,
    });
  });

  it('clamps nested widths and resolves internal grid collisions', () => {
    const layout = sanitizeUiLayout(DEFAULT_UI_LAYOUT);
    expect(clampNestedColumnSpan(layout, 'home', 'homeOverview', 'homeOverviewStats', 12)).toBe(9);
    const moved = findAvailableNestedRegionPosition(
      layout,
      'home',
      'homeOverview',
      'homeOverviewCharacter',
      { ...layout.panelRegions.home!.homeOverview.regions.homeOverviewCharacter, column: 1 },
    );
    expect(moved).toMatchObject({ row: 2, column: 10, columnSpan: 3 });
  });

  it('resets nested regions, panel appearance, and panel layout together', () => {
    const custom = sanitizeUiLayout({
      screenPanels: { home: { homeOverview: { column: 3, row: 4, locked: true } } },
      panelRegions: {
        home: {
          homeOverview: {
            regions: {
              homeOverviewCharacter: { column: 1, columnSpan: 12, row: 5, visible: false },
            },
          },
        },
      },
      panelAppearances: { home: { homeOverview: { background: '#123456', shadow: false } } },
    });
    const regionReset = resetUiPanelRegion(custom, 'home', 'homeOverview', 'homeOverviewCharacter');
    expect(getUiPanelInternalLayout(regionReset, 'home', 'homeOverview').regions.homeOverviewCharacter).toEqual(
      DEFAULT_HOME_OVERVIEW_INTERNAL_LAYOUT.regions.homeOverviewCharacter,
    );
    const panelReset = resetUiPanel(custom, 'home', 'homeOverview');
    expect(panelReset.screenPanels.home).toEqual(DEFAULT_HOME_PANEL_LAYOUT);
    expect(panelReset.panelRegions.home?.homeOverview).toEqual(DEFAULT_HOME_OVERVIEW_INTERNAL_LAYOUT);
    expect(panelReset.panelAppearances.home ?? {}).toEqual({});
  });
});
