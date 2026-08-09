import { useRef, useState } from 'react';
import { Save } from 'lucide-react';
import { createNewGame } from '../../../game/state/initialState';
import { useGameStore } from '../../../game/state/gameStore';
import {
  exportProfile,
  importProfile,
} from '../../../game/persistence/saveManager';
import type { GameState } from '../../../game/types';
import { ConfirmDialog, type ConfirmDialogOptions } from '../../components/ConfirmDialog';
import { UiPanelGrid } from '../../ui-editor/UiPanelGrid';
import { UiPanelSlot } from '../../ui-editor/UiPanelSlot';
import { UiPanelRegionGrid } from '../../ui-editor/UiPanelRegionGrid';
import { UiPanelRegionSlot } from '../../ui-editor/UiPanelRegionSlot';
import type { UiLayout } from '../../ui-editor/uiLayout';

export function SettingsScreen({
  game,
  onProfiles,
  onDelete,
  uiLayout,
}: {
  game: GameState;
  onProfiles: () => void;
  onDelete: () => void;
  uiLayout: UiLayout;
}) {
  const saveNow = useGameStore((store) => store.saveNow);
  const setSettings = useGameStore((store) => store.setSettings);
  const setGame = useGameStore((store) => store.setGame);
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmation, setConfirmation] = useState<ConfirmDialogOptions | null>(null);
  const exportSave = async () => {
    const text = await exportProfile(game);
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${game.player.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-ironbound.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const importSave = async (file: File) => {
    try {
      const imported = await importProfile(await file.text(), game.profileSlot);
      setGame(imported);
    } catch (cause) {
      window.alert(cause instanceof Error ? cause.message : 'Import failed.');
    }
  };
  const reset = () => {
    setConfirmation({
      title: 'Reset character?',
      message: 'The current save will be replaced with a fresh character.',
      confirmLabel: 'Reset character',
      danger: true,
      onConfirm: () => setGame(createNewGame(game.profileSlot, game.player.name)),
    });
  };
  return (
    <>
      <div className="screen-heading">
        <div>
          <div className="eyebrow">System</div>
          <h1>Settings</h1>
          <p className="subtle">Controls for this browser profile and its presentation.</p>
        </div>
      </div>
      <UiPanelGrid screen="settings" className="settings-panel-grid">
        <UiPanelSlot screen="settings" id="settingsSave" layout={uiLayout}>
          <section className="panel panel-pad">
            <UiPanelRegionGrid
              screen="settings"
              panelId="settingsSave"
              layout={uiLayout}
              className="settings-save-regions"
            >
              <UiPanelRegionSlot
                screen="settings"
                panelId="settingsSave"
                regionId="settingsSavePrimary"
                layout={uiLayout}
              >
                <h2>Save controls</h2>
                <div className="button-row" style={{ margin: '15px 0' }}>
                  <button className="button primary" onClick={() => void saveNow()}>
                    <Save size={14} /> Save Now
                  </button>
                </div>
                <p className="subtle">
                  Primary and last-known-good backup are maintained locally. Offline progress is capped at
                  24 hours.
                </p>
              </UiPanelRegionSlot>
              <UiPanelRegionSlot
                screen="settings"
                panelId="settingsSave"
                regionId="settingsSaveTransfer"
                layout={uiLayout}
              >
                <div className="button-row">
                  <button className="button" onClick={() => void exportSave()}>
                    Export Save
                  </button>
                  <label className="button">
                    Import Save
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".json,application/json"
                      hidden
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void importSave(file);
                        event.currentTarget.value = '';
                      }}
                    />
                  </label>
                </div>
              </UiPanelRegionSlot>
              <UiPanelRegionSlot
                screen="settings"
                panelId="settingsSave"
                regionId="settingsSaveDanger"
                layout={uiLayout}
              >
                <div className="button-row">
                  <button className="button ghost" onClick={onProfiles}>
                    Return to profiles
                  </button>
                  <button className="button danger" onClick={reset}>
                    Reset current character
                  </button>
                  <button
                    className="button danger"
                    onClick={() =>
                      setConfirmation({
                        title: 'Delete character?',
                        message: 'This character and its backup will be permanently deleted.',
                        confirmLabel: 'Delete character',
                        danger: true,
                        onConfirm: onDelete,
                      })
                    }
                  >
                    Delete current character
                  </button>
                </div>
              </UiPanelRegionSlot>
            </UiPanelRegionGrid>
          </section>
        </UiPanelSlot>
        <UiPanelSlot screen="settings" id="settingsPresentation" layout={uiLayout}>
          <section className="panel panel-pad">
            <UiPanelRegionGrid
              screen="settings"
              panelId="settingsPresentation"
              layout={uiLayout}
              className="settings-presentation-regions"
            >
              <UiPanelRegionSlot
                screen="settings"
                panelId="settingsPresentation"
                regionId="settingsPresentationGeneral"
                layout={uiLayout}
              >
                <h2>Presentation</h2>
                {[
                  ['sound', 'Sound effects'],
                  ['music', 'Music'],
                  ['compactNumbers', 'Compact numbers'],
                ].map(([key, label]) => (
                  <label className="stat-line" key={key}>
                    <span>{label}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(game.settings[key as keyof typeof game.settings])}
                      onChange={(event) => setSettings({ [key]: event.target.checked })}
                    />
                  </label>
                ))}
              </UiPanelRegionSlot>
              <UiPanelRegionSlot
                screen="settings"
                panelId="settingsPresentation"
                regionId="settingsPresentationAccessibility"
                layout={uiLayout}
              >
                <h3>Accessibility</h3>
                {[
                  ['reducedMotion', 'Reduced motion'],
                  ['showHelpIcons', 'Show help icons'],
                ].map(([key, label]) => (
                  <label className="stat-line" key={key}>
                    <span>{label}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(game.settings[key as keyof typeof game.settings])}
                      onChange={(event) => setSettings({ [key]: event.target.checked })}
                    />
                  </label>
                ))}
                <p className="settings-option-description">
                  Display small help markers beside explained stats and mechanics. Tooltips still work
                  when hidden.
                </p>
              </UiPanelRegionSlot>
              <UiPanelRegionSlot
                screen="settings"
                panelId="settingsPresentation"
                regionId="settingsPresentationGraphics"
                layout={uiLayout}
              >
                <h3>Graphics</h3>
                <label className="stat-line">
                  <span>Three.js quality</span>
                  <select
                    className="select"
                    value={game.settings.threeQuality}
                    onChange={(event) =>
                      setSettings({
                        threeQuality: event.target.value as GameState['settings']['threeQuality'],
                      })
                    }
                  >
                    <option value="off">Off</option>
                    <option value="low">Low</option>
                    <option value="high">High</option>
                  </select>
                </label>
              </UiPanelRegionSlot>
            </UiPanelRegionGrid>
          </section>
        </UiPanelSlot>
      </UiPanelGrid>
      {confirmation && (
        <ConfirmDialog
          title={confirmation.title}
          message={confirmation.message}
          confirmLabel={confirmation.confirmLabel}
          cancelLabel={confirmation.cancelLabel}
          danger={confirmation.danger}
          onCancel={() => setConfirmation(null)}
          onConfirm={() => {
            const action = confirmation.onConfirm;
            setConfirmation(null);
            void action();
          }}
        />
      )}
    </>
  );
}
