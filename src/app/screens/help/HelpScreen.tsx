import type { UiLayout } from '../../ui-editor/uiLayout';
import { UiPanelGrid } from '../../ui-editor/UiPanelGrid';
import { UiPanelSlot } from '../../ui-editor/UiPanelSlot';
import { UiPanelRegionGrid } from '../../ui-editor/UiPanelRegionGrid';
import { UiPanelRegionSlot } from '../../ui-editor/UiPanelRegionSlot';

export function HelpScreen({ uiLayout }: { uiLayout: UiLayout }) {
  return (
    <>
      <div className="screen-heading">
        <div>
          <div className="eyebrow">Field notes</div>
          <h1>Help</h1>
          <p className="subtle">A short guide to the systems currently in your hands.</p>
        </div>
      </div>
      <UiPanelGrid screen="help" className="help-panel-grid">
        <UiPanelSlot screen="help" id="helpGameplay" layout={uiLayout}>
          <section className="panel panel-pad">
            <UiPanelRegionGrid
              screen="help"
              panelId="helpGameplay"
              layout={uiLayout}
              className="help-gameplay-regions"
            >
              <UiPanelRegionSlot
                screen="help"
                panelId="helpGameplay"
                regionId="helpGameplayTime"
                layout={uiLayout}
              >
                <h2>How time works</h2>
                <p className="subtle">
                  Mining, smithing, and combat use elapsed time rather than animation frames. Start one
                  action, then navigate freely. Starting another action replaces it after confirmation.
                </p>
              </UiPanelRegionSlot>
              <UiPanelRegionSlot
                screen="help"
                panelId="helpGameplay"
                regionId="helpGameplayOffline"
                layout={uiLayout}
              >
                <h2>Offline progress</h2>
                <p className="subtle">
                  On load, the last simulated timestamp is replayed for up to 24 hours. Actions stop
                  safely when materials, inventory, or combat survivability run out.
                </p>
              </UiPanelRegionSlot>
            </UiPanelRegionGrid>
          </section>
        </UiPanelSlot>
        <UiPanelSlot screen="help" id="helpSaveInventory" layout={uiLayout}>
          <section className="panel panel-pad">
            <UiPanelRegionGrid
              screen="help"
              panelId="helpSaveInventory"
              layout={uiLayout}
              className="help-save-inventory-regions"
            >
              <UiPanelRegionSlot
                screen="help"
                panelId="helpSaveInventory"
                regionId="helpSaveInventorySave"
                layout={uiLayout}
              >
                <h2>Keeping your save safe</h2>
                <p className="subtle">
                  Autosave runs about every ten seconds and when the tab is hidden. Settings can export a
                  portable JSON file for backup or transfer.
                </p>
              </UiPanelRegionSlot>
              <UiPanelRegionSlot
                screen="help"
                panelId="helpSaveInventory"
                regionId="helpSaveInventoryInventory"
                layout={uiLayout}
              >
                <h2>Inventory</h2>
                <p className="subtle">
                  Identical items stack. Equipped gear does not take a slot. Lock important stacks before
                  destroying anything.
                </p>
              </UiPanelRegionSlot>
            </UiPanelRegionGrid>
          </section>
        </UiPanelSlot>
      </UiPanelGrid>
    </>
  );
}
