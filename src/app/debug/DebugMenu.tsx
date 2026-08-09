import { useEffect, useMemo, useRef, useState } from 'react';
import { Bug, X } from 'lucide-react';
import { GAME_CONFIG } from '../../config/gameConfig';
import { createDebugController } from '../../game/debug/debugActions';
import type { DebugActionResult, DebugMutation } from '../../game/debug/debugTypes';
import { useGameStore } from '../../game/state/gameStore';
import type { GameState, ScreenId } from '../../game/types';
import { ConfirmDialog, type ConfirmDialogOptions } from '../components/ConfirmDialog';
import { Details, Section, activeActionLabel } from './DebugComponents';
import { CombatPanel as DebugCombatPanel } from './DebugCombatPanel';
import { EquipmentPanel as DebugEquipmentPanel } from './DebugEquipmentPanel';
import { InventoryPanel as DebugInventoryPanel } from './DebugInventoryPanel';
import { OverviewPanel as DebugOverviewPanel } from './DebugOverviewPanel';
import { ProfessionsPanel as DebugProfessionsPanel } from './DebugProfessionsPanel';
import { ProgressionPanel as DebugProgressionPanel } from './DebugProgressionPanel';
import { SavesPanel as DebugSavesPanel } from './DebugSavesPanel';
import { SimulationPanel as DebugSimulationPanel } from './DebugSimulationPanel';
import { TAB_LABELS, type DebugTab } from './debugUiTypes';

interface DebugMenuProps {
  game: GameState;
  open: boolean;
  onClose: () => void;
  screen?: ScreenId;
  onResetAllLayouts?: () => void;
  onResetCurrentScreenLayout?: (screen: ScreenId) => void;
}

export default function DebugMenu({
  game,
  open,
  onClose,
  screen = 'home',
  onResetAllLayouts,
  onResetCurrentScreenLayout,
}: DebugMenuProps) {
  const [activeTab, setActiveTab] = useState<DebugTab>('overview');
  const [feedback, setFeedback] = useState<DebugActionResult | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [confirmation, setConfirmation] = useState<ConfirmDialogOptions | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const controller = useMemo(
    () =>
      createDebugController({
        getGame: () => useGameStore.getState().game,
        applyMutation: (next, options) => useGameStore.getState().applyDebugState(next, options),
        saveNow: () => useGameStore.getState().saveNow(),
      }),
    [],
  );

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
  }, [open]);

  if (!import.meta.env.DEV || !open) return null;

  const record = (result: DebugActionResult): DebugActionResult => {
    setFeedback(result);
    setHistory((current) =>
      [`${new Date().toLocaleTimeString()} ${result.message}`, ...current].slice(0, 30),
    );
    return result;
  };
  const run = (operation: (state: GameState) => DebugMutation): DebugActionResult =>
    record(controller.execute(operation));
  const confirm = (
    options: Omit<ConfirmDialogOptions, 'onConfirm'>,
    action: () => DebugActionResult,
  ) =>
    setConfirmation({
      ...options,
      onConfirm: () => {
        setConfirmation(null);
        action();
      },
    });
  const resetDebugUi = () => {
    setActiveTab('overview');
    setFeedback(null);
  };

  const renderPanel = () => {
    switch (activeTab) {
      case 'inventory':
        return <DebugInventoryPanel game={game} run={run} confirm={confirm} />;
      case 'equipment':
        return <DebugEquipmentPanel game={game} run={run} confirm={confirm} />;
      case 'progression':
        return <DebugProgressionPanel game={game} run={run} confirm={confirm} />;
      case 'combat':
        return <DebugCombatPanel game={game} run={run} confirm={confirm} />;
      case 'professions':
        return <DebugProfessionsPanel game={game} run={run} />;
      case 'simulation':
        return <DebugSimulationPanel game={game} run={run} />;
      case 'saves':
        return (
          <DebugSavesPanel
            game={game}
            run={run}
            controller={controller}
            confirm={confirm}
            screen={screen}
            resetDebugUi={resetDebugUi}
            onResetAllLayouts={onResetAllLayouts}
            onResetCurrentScreenLayout={onResetCurrentScreenLayout}
          />
        );
      default:
        return <DebugOverviewPanel game={game} run={run} confirm={confirm} />;
    }
  };

  return (
    <div className="debug-tools-backdrop">
      <section
        className="debug-tools-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Debug menu"
        aria-describedby="debug-tools-warning"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="debug-tools-header">
          <div>
            <div className="eyebrow">
              <Bug size={13} /> Development only
            </div>
            <h2>DEVELOPMENT TOOLS</h2>
            <p id="debug-tools-warning" className="debug-tools-warning">
              Changes affect the current profile.
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="button ghost debug-tools-close"
            onClick={onClose}
            aria-label="Close debug menu"
          >
            <X size={18} />
          </button>
        </header>
        <div className="debug-tools-body">
          <aside className="debug-tools-nav" aria-label="Debug tool categories">
            {TAB_LABELS.map((tab) => (
              <button
                type="button"
                key={tab.id}
                className={`debug-tools-nav-button ${activeTab === tab.id ? 'active' : ''}`}
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </aside>
          <main className="debug-tools-content">
            <section className="debug-tools-summary" aria-label="Current profile summary">
              <span>
                <b>Profile ID</b>
                {game.profileId}
              </span>
              <span>
                <b>Character</b>
                {game.player.name}
              </span>
              <span>
                <b>Save version</b>
                {game.schemaVersion}
              </span>
              <span>
                <b>Action</b>
                {activeActionLabel(game)}
              </span>
              <span>
                <b>Inventory</b>
                {game.inventory.filter((stack) => stack.quantity > 0).length}/
                {GAME_CONFIG.inventorySlots}
              </span>
            </section>
            {feedback && (
              <div
                className={`debug-tools-result ${feedback.ok ? 'success' : 'failure'}`}
                role="status"
                aria-live="polite"
              >
                <strong>{feedback.ok ? 'Success' : 'Action failed'}</strong>
                <span>{feedback.message}</span>
                <Details details={feedback.details} />
              </div>
            )}
            {renderPanel()}
            <Section
              title="Session action history"
              description="Debug history is session-only and is never serialized into gameplay saves."
              className="debug-tools-history"
            >
              {history.length ? (
                <div className="debug-tools-action-log">
                  {history.map((entry, index) => (
                    <div key={`${entry}-${index}`}>{entry}</div>
                  ))}
                </div>
              ) : (
                <p className="muted">No debug actions yet.</p>
              )}
            </Section>
          </main>
        </div>
      </section>
      {confirmation && <ConfirmDialog {...confirmation} onCancel={() => setConfirmation(null)} />}
    </div>
  );
}
