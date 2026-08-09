import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Bug, Lock, Paintbrush, Save, Settings, Skull } from 'lucide-react';
import { enemyById } from '../content/enemies';
import { GAME_CONFIG } from '../config/gameConfig';
import { getDerivedStats } from '../game/formulas/statFormulas';
import { getTotalLevel } from '../game/progression/progressionSelectors';
import { createNewGame } from '../game/state/initialState';
import { useGameStore } from '../game/state/gameStore';
import {
  importProfile,
  listProfiles,
  loadProfile,
  clearProfile,
  saveProfile,
  type SaveRecord,
} from '../game/persistence/saveManager';
import type {
  EnemyId,
  GameState,
  ScreenId,
  SimulationSummary,
} from '../game/types';
import { NAVIGATION } from '../content/navigation';
import { ThreeScene } from '../three/ThreeScene';
import { formatHealth, formatNumber } from './shared/formatters';
import { UiEditor } from './ui-editor/UIEditor';
import {
  loadUiLayout,
  resetUiLayoutScreen,
  resetUiLayout,
  sanitizeUiLayout,
  saveUiLayout,
  type UiLayout,
} from './ui-editor/uiLayout';
import { getTypographyCssVariables } from './ui-editor/typography';
import { CombatScreen as RealtimeCombatScreen } from './screens/combat/CombatScreen';
import { ConfirmDialog, type ConfirmDialogOptions } from './components/ConfirmDialog';
import { OfflineModal as OfflineReportModal } from './components/OfflineReport';
import { ActivityStrip } from './shell/ActivityStrip';
import { getCombatLogPresentation } from './screens/combat/combatLogPresentation';
import { CollectionScreen } from './screens/collection/CollectionScreen';
import { HomeScreen } from './screens/home/HomeScreen';
import { EquipmentScreen } from './screens/equipment/EquipmentScreen';
import { InventoryScreen } from './screens/inventory/InventoryScreen';
import { MiningScreen } from './screens/mining/MiningScreen';
import { SmithingScreen } from './screens/smithing/SmithingScreen';
import { SettingsScreen } from './screens/settings/SettingsScreen';
import { HelpScreen } from './screens/help/HelpScreen';

const DebugMenu = import.meta.env.DEV ? lazy(() => import('./debug/DebugMenu')) : null;

const formatFightDuration = (startedAt: number | null, now = Date.now()): string => {
  if (startedAt === null) return '0:00';
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};
const getProfileName = (record: SaveRecord): string => {
  try {
    const parsed: unknown = JSON.parse(record.payload);
    if (typeof parsed === 'object' && parsed !== null && 'player' in parsed) {
      const player: unknown = parsed.player;
      if (
        typeof player === 'object' &&
        player !== null &&
        'name' in player &&
        typeof player.name === 'string'
      )
        return player.name;
    }
  } catch {
    /* malformed records are shown as unknown */
  }
  return 'Unknown';
};

const getUiStyle = (layout: UiLayout): CSSProperties =>
  ({
    '--ui-sidebar-width': `${layout.sidebarWidth}px`,
    '--ui-header-height': `${layout.headerHeight}px`,
    '--ui-content-padding': `${layout.contentPadding}px`,
    '--ui-action-height': `${layout.actionStripHeight}px`,
    '--ui-panel-radius': `${layout.panelRadius}px`,
    '--ui-scale': String(layout.uiScale),
    '--ui-accent': layout.accent,
    '--ui-background': layout.background,
    '--ui-panel-color': layout.panel,
    '--gold': layout.accent,
    '--bg': layout.background,
    '--panel': layout.panel,
    '--ui-sidebar-x': `${layout.offsets.sidebar.x}px`,
    '--ui-sidebar-y': `${layout.offsets.sidebar.y}px`,
    '--ui-header-x': `${layout.offsets.header.x}px`,
    '--ui-header-y': `${layout.offsets.header.y}px`,
    '--ui-content-x': `${layout.offsets.content.x}px`,
    '--ui-content-y': `${layout.offsets.content.y}px`,
    '--ui-action-x': `${layout.offsets.actionStrip.x}px`,
    '--ui-action-y': `${layout.offsets.actionStrip.y}px`,
    ...getTypographyCssVariables(layout.typography),
  }) as CSSProperties;

function ProfileSelection({
  onLoad,
}: {
  onLoad: (game: GameState, summary?: SimulationSummary | null) => void;
}) {
  const [profiles, setProfiles] = useState<Array<SaveRecord | null>>([null, null, null]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmDialogOptions | null>(null);
  const refresh = () => {
    void listProfiles().then((items) => {
      setProfiles(items);
      setLoading(false);
    });
  };
  useEffect(refresh, []);
  const create = async (slot: number) => {
    const entered = window.prompt('Name your character', `Wanderer ${slot + 1}`);
    if (entered === null) return;
    const game = createNewGame(slot, entered);
    await saveProfile(game);
    onLoad(game);
  };
  const load = async (slot: number) => {
    setError('');
    const loaded = await loadProfile(slot);
    if (!loaded) {
      setError('That profile could not be recovered.');
      return;
    }
    onLoad(loaded.state, loaded.offline);
  };
  const remove = (slot: number) => {
    setConfirmation({
      title: 'Delete character?',
      message: 'This character and its backup will be permanently deleted.',
      confirmLabel: 'Delete character',
      danger: true,
      onConfirm: async () => {
        await clearProfile(slot);
        refresh();
      },
    });
  };
  const importFile = async (file: File, slot: number) => {
    try {
      const game = await importProfile(await file.text(), slot);
      onLoad(game);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Import failed.');
    }
  };
  return (
    <>
      <div className="profile-screen">
        <div className="profile-scene">
          <ThreeScene
            screen="home"
            settings={{
              sound: true,
              music: true,
              reducedMotion: false,
              compactNumbers: false,
              showHelpIcons: true,
              huntElites: true,
              threeQuality: 'low',
            }}
          />
        </div>
        <main className="profile-wrap">
          <div className="profile-title">
            <div className="eyebrow">A quiet frontier · a living world</div>
            <h1>Ironbound Idle</h1>
            <p className="subtle">
              Build a life from ore and embers. Every interval matters, every discovery is yours.
            </p>
          </div>
          {error && (
            <div className="panel panel-pad" style={{ marginBottom: 15, color: 'var(--red)' }}>
              {error}
            </div>
          )}
          <div className="slot-grid">
            {[0, 1, 2].map((slot) => {
              const record = profiles[slot];
              const name = record ? getProfileName(record) : '';
              return (
                <section className="panel slot-card" key={slot}>
                  <div>
                    <div className="slot-number">Profile {slot + 1}</div>
                    {loading ? (
                      <p className="muted">Checking save vault…</p>
                    ) : record ? (
                      <>
                        <h2>{name}</h2>
                        <p className="subtle">
                          Last saved {new Date(record.updatedAt).toLocaleString()}
                        </p>
                      </>
                    ) : (
                      <>
                        <h2>Empty slot</h2>
                        <p className="subtle">Start a new expedition here.</p>
                      </>
                    )}
                  </div>
                  <div className="button-row">
                    {record ? (
                      <>
                        <button className="button primary" onClick={() => void load(slot)}>
                          Load profile
                        </button>
                        <button
                          className="button danger"
                          onClick={() => void remove(slot)}
                          aria-label={`Delete profile ${slot + 1}`}
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <button className="button gold" onClick={() => create(slot)}>
                        Create character
                      </button>
                    )}
                    <label className="button ghost">
                      Import
                      <input
                        type="file"
                        accept=".json,application/json"
                        hidden
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void importFile(file, slot);
                          event.currentTarget.value = '';
                        }}
                      />
                    </label>
                  </div>
                </section>
              );
            })}
          </div>
          <p className="subtle" style={{ marginTop: 20 }}>
            Local profiles are stored in this browser. Export a save from Settings before clearing
            browser data.
          </p>
        </main>
      </div>
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
function Sidebar({
  screen,
  onNavigate,
  onLocked,
}: {
  screen: ScreenId;
  onNavigate: (id: ScreenId) => void;
  onLocked: (label: string, description?: string) => void;
}) {
  return (
    <aside className="sidebar" data-ui-region="sidebar">
      <div className="brand">
        <div className="brand-mark">I</div>
        <div>
          <strong>Ironbound</strong>
          <small>Idle RPG</small>
        </div>
      </div>
      <nav className="nav">
        {['Main', 'Skills', 'World', 'System'].map((group) => (
          <div className="nav-group" key={group}>
            <div className="nav-group-title">{group}</div>
            {NAVIGATION.filter((item) => item.group === group).map((item, index) => (
              <button
                className={`nav-button ${screen === item.id && !item.locked ? 'active' : ''} ${item.locked ? 'locked-label' : ''}`}
                key={`${item.label}-${index}`}
                onClick={() =>
                  item.locked ? onLocked(item.label, item.description) : onNavigate(item.id)
                }
              >
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>
                {item.locked && <span className="lock">⌑</span>}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-foot">
        The forge remembers every interval.
        <br />v{GAME_CONFIG.version}
      </div>
    </aside>
  );
}

function Header({
  game,
  onSettings,
  onEditUi,
  onDebug,
  debugButtonRef,
}: {
  game: GameState;
  onSettings: () => void;
  onEditUi: () => void;
  onDebug: () => void;
  debugButtonRef?: { current: HTMLButtonElement | null };
}) {
  const stats = getDerivedStats(game);
  const saveStatus = useGameStore((store) => store.saveStatus);
  const savedAt = useGameStore((store) => store.savedAt);
  const totalLevel = getTotalLevel(game);
  return (
    <header className="topbar" data-ui-region="header">
      <div>
        <div className="crumb">Character / {game.player.name}</div>
        <div className="character">
          Total {totalLevel} · Combat {stats.combatLevel}
        </div>
      </div>
      <div className="header-stats">
        <span className="header-stat">
          Gold <strong>◈ {formatNumber(game.gold)}</strong>
        </span>
        <span className="header-stat">
          HP{' '}
          <strong className="numeric">
            {formatHealth(game.player.currentHp)}/{formatHealth(stats.maxHealth)}
          </strong>
        </span>
        <span className={`save-state ${saveStatus === 'failed' ? 'failed' : ''}`}>
          {saveStatus === 'saving' ? (
            'Saving…'
          ) : saveStatus === 'failed' ? (
            'Save failed'
          ) : (
            <>
              <Save size={13} /> Saved
              {savedAt
                ? ` ${new Date(savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : ''}
            </>
          )}
        </span>
        <button
          className="button ghost"
          onClick={onEditUi}
          aria-label="Edit game UI"
          title="Edit game UI"
        >
          <Paintbrush size={16} />
        </button>
        {import.meta.env.DEV && (
          <button
            ref={debugButtonRef}
            className="button ghost debug-header-button"
            onClick={onDebug}
            aria-label="Open debug menu"
            title="Open debug menu"
          >
            <Bug size={16} />
          </button>
        )}
        <button className="button ghost" onClick={onSettings} aria-label="Open settings">
          <Settings size={16} />
        </button>
      </div>
    </header>
  );
}

function LockedScreen({ name, description }: { name: string; description?: string }) {
  return (
    <div className="locked-screen">
      <div className="locked-icon">
        <Lock size={30} />
      </div>
      <span className="badge locked">Coming after MVP</span>
      <h1 style={{ marginTop: 18 }}>{name}</h1>
      <p className="subtle">
        {description ??
          'This feature is part of the wider frontier and will open in a future content pass.'}
      </p>
      <p className="subtle">
        When it arrives, it will add another meaningful way to shape your character and your
        settlement.
      </p>
    </div>
  );
}
function DeathModal({
  game,
  enemyId,
  sessionStartedAt,
  encounterStartedAt,
  onClose,
}: {
  game: GameState;
  enemyId: EnemyId | null;
  sessionStartedAt: number | null;
  encounterStartedAt: number | null;
  onClose: () => void;
}) {
  const enemy = enemyId ? enemyById[enemyId] : undefined;
  const recentActions = game.activityLogs.combat
    .filter((entry) => sessionStartedAt === null || entry.at >= sessionStartedAt)
    .slice(0, 8);
  const deathEntry = recentActions.find((entry) => entry.kind === 'player-defeated');
  const deathCause = deathEntry
    ? getCombatLogPresentation(deathEntry).text
    : enemy
      ? `You were killed by ${enemy.name}.`
      : 'The final blow ended the fight.';

  return (
    <div className="modal-backdrop death-backdrop">
      <section
        className="modal death-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="death-title"
      >
        <div className="death-heading">
          <span className="death-icon" aria-hidden="true">
            <Skull size={22} />
          </span>
          <div>
            <div className="eyebrow">Combat ended</div>
            <h2 id="death-title">You died</h2>
          </div>
        </div>
        <p className="death-cause">{deathCause}</p>
        <section className="death-recent-actions" aria-labelledby="death-actions-title">
          <div className="death-recent-actions-heading">
            <h3 id="death-actions-title">Recent actions</h3>
            <span className="muted">How the fight ended</span>
          </div>
          <div className="death-action-list">
            {recentActions.length ? (
            recentActions.map((entry) => (
                <div
                  className={`death-action ${getCombatLogPresentation(entry).category}`}
                  key={entry.id}
                >
                  <time>
                    {formatFightDuration(entry.encounterStartedAt ?? encounterStartedAt, entry.at)}
                  </time>
                  <span>{getCombatLogPresentation(entry).text}</span>
                </div>
              ))
            ) : (
              <span className="muted">No recent actions recorded.</span>
            )}
          </div>
        </section>
        <button className="button primary death-continue" onClick={onClose}>
          Continue
        </button>
      </section>
    </div>
  );
}

function GameShell({ game, onExit }: { game: GameState; onExit: () => void }) {
  const [screen, setScreen] = useState<ScreenId>('home');
  const [lockedFeature, setLockedFeature] = useState({ name: '', description: '' });
  const [editingUi, setEditingUi] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const debugButtonRef = useRef<HTMLButtonElement>(null);
  const [confirmation, setConfirmation] = useState<ConfirmDialogOptions | null>(null);
  const [uiLayout, setUiLayout] = useState<UiLayout>(() => loadUiLayout());
  const uiSaveTimer = useRef<number | null>(null);
  const pendingUiLayout = useRef(uiLayout);
  const offlineSummary = useGameStore((store) => store.offlineSummary);
  const clearOfflineSummary = useGameStore((store) => store.clearOfflineSummary);
  const combatEvents = useGameStore((store) => store.combatEvents);
  const combatSession = useGameStore((store) => store.combatSession);
  const toast = useGameStore((store) => store.toast);
  const clearToast = useGameStore((store) => store.clearToast);
  const saveNow = useGameStore((store) => store.saveNow);
  const currentGame = useGameStore((store) => store.game) ?? game;
  const previousDeathCount = useRef(currentGame.statistics.deaths);
  const [deathNotice, setDeathNotice] = useState<EnemyId | null>(null);
  const updateUiLayout = (next: UiLayout) => {
    const safeLayout = sanitizeUiLayout(next);
    pendingUiLayout.current = safeLayout;
    setUiLayout(safeLayout);
    if (uiSaveTimer.current !== null) window.clearTimeout(uiSaveTimer.current);
    uiSaveTimer.current = window.setTimeout(() => {
      saveUiLayout(pendingUiLayout.current);
      uiSaveTimer.current = null;
    }, 180);
  };
  const resetAllUiLayouts = () => {
    if (uiSaveTimer.current !== null) window.clearTimeout(uiSaveTimer.current);
    const defaults = resetUiLayout();
    pendingUiLayout.current = defaults;
    setUiLayout(defaults);
    saveUiLayout(defaults);
  };
  const resetCurrentScreenLayout = (target: ScreenId) => {
    updateUiLayout(resetUiLayoutScreen(uiLayout, target));
  };
  useEffect(() => {
    return () => {
      if (uiSaveTimer.current !== null) window.clearTimeout(uiSaveTimer.current);
      saveUiLayout(pendingUiLayout.current);
    };
  }, []);
  useEffect(() => {
    const timer = window.setInterval(
      () => useGameStore.getState().tick(Date.now()),
      GAME_CONFIG.heartbeatMs,
    );
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const timer = window.setInterval(
      () => void useGameStore.getState().saveNow(),
      GAME_CONFIG.autosaveMs,
    );
    const onVisibility = () => {
      if (document.hidden) void useGameStore.getState().saveNow();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(clearToast, 2800);
    return () => window.clearTimeout(timer);
  }, [toast, clearToast]);
  useEffect(() => {
    const deaths = currentGame.statistics.deaths;
    if (deaths > previousDeathCount.current) {
      const deathEvent = [...combatEvents]
        .reverse()
        .find((event) => event.type === 'player-defeated');
      setDeathNotice(deathEvent?.enemyId ?? null);
    }
    previousDeathCount.current = deaths;
  }, [combatEvents, currentGame.statistics.deaths]);
  const requestConfirmation = (options: ConfirmDialogOptions) => setConfirmation(options);
  const requestAction = (target: ScreenId, action: () => void) => {
    const active = useGameStore.getState().game?.activeAction.type !== 'none';
    if (active) {
      requestConfirmation({
        title: 'Replace current activity?',
        message: 'Its progress will stop safely before the new activity begins.',
        confirmLabel: 'Replace activity',
        onConfirm: () => {
          action();
          setScreen(target);
        },
      });
      return;
    }
    action();
    setScreen(target);
  };
  const nav = (target: ScreenId) => setScreen(target);
  const closeDebug = () => {
    setDebugOpen(false);
    window.setTimeout(() => debugButtonRef.current?.focus(), 0);
  };
  const render = () => {
    switch (screen) {
      case 'home':
        return <HomeScreen game={currentGame} onNavigate={nav} uiLayout={uiLayout} />;
      case 'mining':
        return (
          <MiningScreen game={currentGame} uiLayout={uiLayout} requestAction={requestAction} />
        );
      case 'smithing':
        return (
          <SmithingScreen game={currentGame} uiLayout={uiLayout} requestAction={requestAction} />
        );
      case 'combat':
        return (
          <RealtimeCombatScreen
            game={currentGame}
            uiLayout={uiLayout}
            requestAction={requestAction}
            requestConfirmation={requestConfirmation}
            onNavigate={nav}
          />
        );
      case 'inventory':
        return <InventoryScreen game={currentGame} uiLayout={uiLayout} onNavigate={nav} />;
      case 'equipment':
        return <EquipmentScreen game={currentGame} uiLayout={uiLayout} onNavigate={nav} />;
      case 'collection':
        return <CollectionScreen game={currentGame} onNavigate={nav} uiLayout={uiLayout} />;
      case 'settings':
        return (
          <SettingsScreen
            game={currentGame}
            onProfiles={async () => {
              await saveNow();
              onExit();
            }}
            onDelete={async () => {
              await clearProfile(currentGame.profileSlot);
              onExit();
            }}
            uiLayout={uiLayout}
          />
        );
      case 'help':
        return <HelpScreen uiLayout={uiLayout} />;
      default:
        return <LockedScreen name={lockedFeature.name} description={lockedFeature.description} />;
    }
  };
  const sidebar = (
    <Sidebar
      screen={screen}
      onNavigate={nav}
      onLocked={(name, description) => {
        setLockedFeature({ name, description: description ?? '' });
        setScreen('locked');
      }}
    />
  );
  const header = (
    <Header
      game={currentGame}
      onSettings={() => setScreen('settings')}
      onEditUi={() => setEditingUi(true)}
      onDebug={() => setDebugOpen((open) => !open)}
      debugButtonRef={debugButtonRef}
    />
  );
  const content = (
    <main className={`content ${screen === 'home' ? 'content-home' : ''}`} data-ui-region="content">
      {render()}
    </main>
  );
  const actionStrip = <ActivityStrip game={currentGame} onNavigate={nav} />;
  const overlays = (
    <>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
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
      {offlineSummary && (
        <OfflineReportModal
          game={currentGame}
          summary={offlineSummary}
          onClose={clearOfflineSummary}
        />
      )}
      {deathNotice && (
        <DeathModal
          game={currentGame}
          enemyId={deathNotice}
          sessionStartedAt={combatSession.startedAt}
          encounterStartedAt={combatSession.encounterStartedAt ?? combatSession.startedAt}
          onClose={() => setDeathNotice(null)}
        />
      )}
      {DebugMenu && (
        <Suspense fallback={null}>
          <DebugMenu
            game={currentGame}
            open={debugOpen}
            onClose={closeDebug}
            screen={screen}
            onResetAllLayouts={resetAllUiLayouts}
            onResetCurrentScreenLayout={resetCurrentScreenLayout}
          />
        </Suspense>
      )}
      {editingUi && (
        <UiEditor
          screen={screen}
          layout={uiLayout}
          onChange={updateUiLayout}
          onClose={() => setEditingUi(false)}
        />
      )}
    </>
  );
  const fallback = (
    <div className={`app ${editingUi ? 'ui-editor-open' : ''}`} style={getUiStyle(uiLayout)}>
      {sidebar}
      <div className="main">
        {header}
        {content}
        {actionStrip}
      </div>
      {overlays}
    </div>
  );
  return fallback;
}

export function App() {
  const game = useGameStore((store) => store.game);
  const [profiles, setProfiles] = useState(false);
  if (!game || profiles)
    return (
      <ProfileSelection
        onLoad={(loaded, summary) => {
          useGameStore.getState().setGame(loaded, summary);
          setProfiles(false);
        }}
      />
    );
  return (
    <GameShell
      game={game}
      onExit={() => {
        setProfiles(true);
        useGameStore.getState().setGame(null);
      }}
    />
  );
}
