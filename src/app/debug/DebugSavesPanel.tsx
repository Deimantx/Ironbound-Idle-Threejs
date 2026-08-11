import { useState } from 'react';
import { debugApplyPreset } from '../../game/debug/debugActions';
import { exportProfile, importProfile } from '../../game/persistence/saveManager';
import { savePayloadSchema } from '../../game/persistence/saveSchema';
import { useGameStore } from '../../game/state/gameStore';
import { DEFAULT_UI_LAYOUT, saveUiLayout } from '../ui-editor/uiLayout';
import { resetInventoryViewPreferences } from '../shared/inventoryPreferences';
import { ActionButton, Section } from './DebugComponents';
import { createDebugController } from '../../game/debug/debugActions';
import type { PanelProps } from './debugUiTypes';
import type { ScreenId } from '../../game/types';

export function SavesPanel({
  game,
  run,
  controller,
  confirm,
  screen,
  resetDebugUi,
  onResetAllLayouts,
  onResetCurrentScreenLayout,
}: PanelProps & {
  controller: ReturnType<typeof createDebugController>;
  screen: ScreenId;
  resetDebugUi: () => void;
  onResetAllLayouts?: () => void;
  onResetCurrentScreenLayout?: (screen: ScreenId) => void;
}) {
  const [fixtureFeedback, setFixtureFeedback] = useState<string[]>([]);
  const downloadExport = async () => {
    const text = await exportProfile(game);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    link.download = `${game.player.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-debug.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    setFixtureFeedback(['Save exported using the current format.']);
  };
  const importFile = async (file: File) => {
    try {
      const imported = await importProfile(await file.text(), game.profileSlot);
      useGameStore.getState().setGame(imported);
      setFixtureFeedback(['Save imported and migrated into the current profile.']);
    } catch (cause) {
      setFixtureFeedback([cause instanceof Error ? cause.message : 'Import failed.']);
    }
  };
  const resetAllLayouts = () => {
    onResetAllLayouts?.();
    if (!onResetAllLayouts) saveUiLayout(DEFAULT_UI_LAYOUT);
    setFixtureFeedback(['All UI layouts reset without changing gameplay.']);
  };
  const resetCurrentLayout = () => {
    onResetCurrentScreenLayout?.(screen);
    if (!onResetCurrentScreenLayout) saveUiLayout(DEFAULT_UI_LAYOUT);
    setFixtureFeedback([`Layout reset for ${screen}.`]);
  };
  return (
    <>
      <Section
        title="Profile Save"
        description="Persistence actions use the current save queue, checksum, schema validation, and migration implementations."
      >
        <div className="button-row">
          <ActionButton
            onClick={() => {
              void controller
                .save()
                .then((ok) =>
                  setFixtureFeedback([
                    ok
                      ? `Force Save completed at ${new Date().toLocaleTimeString()}.`
                      : 'Force Save failed.',
                  ]),
                );
            }}
          >
            Force Save
          </ActionButton>
          <ActionButton
            onClick={() => {
              void downloadExport();
            }}
          >
            Export Save
          </ActionButton>
          <label className="button">
            Import Save
            <input
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file)
                  confirm(
                    {
                      title: 'Import Save?',
                      message:
                        'This replaces the current profile through the normal validation and migration path.',
                      confirmLabel: 'Import Save',
                      danger: true,
                    },
                    () => {
                      void importFile(file);
                      return { ok: true, message: 'Import started.' };
                    },
                  );
                event.currentTarget.value = '';
              }}
            />
          </label>
          <ActionButton
            onClick={() => {
              const result = savePayloadSchema.safeParse(game);
              setFixtureFeedback([
                result.success
                  ? 'Current state passes the save schema.'
                  : 'Current state failed the save schema.',
              ]);
            }}
          >
            Validate Current Save
          </ActionButton>
        </div>
        {fixtureFeedback.map((message) => (
          <p className="debug-tools-inline-note" key={message}>
            {message}
          </p>
        ))}
      </Section>
      <Section
        title="UI Preferences"
        description="These controls touch browser UI storage only; gameplay and Inventory stacks are not changed."
      >
        <div className="button-row">
          <ActionButton
            danger
            onClick={() =>
              confirm(
                {
                  title: 'Reset all UI layouts?',
                  message:
                    'Global and screen layouts will return to defaults. Gameplay is preserved.',
                  confirmLabel: 'Reset layouts',
                  danger: true,
                },
                () => {
                  resetAllLayouts();
                  return { ok: true, message: 'Layouts reset.' };
                },
              )
            }
          >
            Reset All UI Layouts
          </ActionButton>
          <ActionButton onClick={resetCurrentLayout}>Reset Current Screen Layout</ActionButton>
          <ActionButton
            onClick={() => {
              resetInventoryViewPreferences(game.profileId);
              setFixtureFeedback([
                'Inventory view preferences reset and the mounted Inventory UI reloaded defaults.',
              ]);
            }}
          >
            Reset Inventory View Preferences
          </ActionButton>
          <ActionButton
            onClick={() => {
              resetDebugUi();
              setFixtureFeedback(['Debug menu UI state reset for this session.']);
            }}
          >
            Reset Debug Menu UI State
          </ActionButton>
        </div>
      </Section>
      <Section title="Danger Zone" className="debug-tools-danger-zone">
        <ActionButton
          danger
          onClick={() =>
            confirm(
              {
                title: 'Reset Current Profile?',
                message:
                  'Gameplay resets to a fresh character. Profile ID, name, settings, and UI preferences remain.',
                confirmLabel: 'Reset Current Profile',
                danger: true,
              },
              () => run((state) => debugApplyPreset(state, 'fresh')),
            )
          }
        >
          Reset Current Profile
        </ActionButton>
      </Section>
    </>
  );
}
