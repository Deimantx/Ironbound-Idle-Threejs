import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  Bug,
  Hammer,
  Heart,
  Lock,
  Paintbrush,
  Pickaxe,
  Save,
  Settings,
  Shield,
  Skull,
  Swords,
  Timer,
  Zap,
} from 'lucide-react';
import { AREAS, areaById } from '../content/areas';
import { ENEMIES, enemyById } from '../content/enemies';
import { ITEMS } from '../content/items';
import { miningNodeById } from '../content/miningNodes';
import { recipeById } from '../content/recipes';
import { GAME_CONFIG } from '../config/gameConfig';
import { getLevelProgress } from '../game/formulas/experienceFormulas';
import { getDerivedStats } from '../game/formulas/statFormulas';
import { progressRatio } from '../game/engine/simulation';
import { getMiningRuntimeState, getMiningTool } from '../game/formulas/miningFormulas';
import { MINING_TUNING } from '../config/miningTuning';
import { createNewGame } from '../game/state/initialState';
import { useGameStore } from '../game/state/gameStore';
import { getItemQuantity } from '../game/systems/inventorySystem';
import {
  exportProfile,
  importProfile,
  listProfiles,
  loadProfile,
  clearProfile,
  saveProfile,
  type SaveRecord,
} from '../game/persistence/saveManager';
import type {
  AreaId,
  CombatStyle,
  EnemyId,
  GameState,
  ScreenId,
  SimulationSummary,
} from '../game/types';
import { NAVIGATION } from '../content/navigation';
import { ThreeScene } from '../three/ThreeScene';
import { UiEditor } from './UIEditor';
import { EquipmentScreen } from './EquipmentScreen';
import { InventoryScreen } from './InventoryScreen';
import { MiningScreen } from './MiningScreen';
import { SmithingScreen } from './SmithingScreen';
import { formatNumber } from './formatters';
import { ItemIcon } from './ItemIcon';
import {
  DEFAULT_UI_LAYOUT,
  loadUiLayout,
  sanitizeUiLayout,
  saveUiLayout,
  type UiLayout,
} from './uiLayout';
import { CombatScreen as RealtimeCombatScreen } from './CombatScreen';
import { ConfirmDialog, type ConfirmDialogOptions } from './ConfirmDialog';

const DebugMenu = import.meta.env.DEV ? lazy(() => import('./debug/DebugMenu')) : null;

const formatFightDuration = (startedAt: number | null, now = Date.now()): string => {
  if (startedAt === null) return '0:00';
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};
const actionLabel = (state: GameState): string => {
  const action = state.activeAction;
  if (action.type === 'mining') return miningNodeById[action.nodeId]?.name ?? 'Mining';
  if (action.type === 'smithing') return recipeById[action.recipeId]?.name ?? 'Smithing';
  if (action.type === 'combat') return `Fighting ${enemyById[action.enemyId]?.name ?? 'enemy'}`;
  return 'No active action';
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
  const totalLevel = Object.values(game.skills).reduce((total, skill) => total + skill.level, 0);
  return (
    <header className="topbar" data-ui-region="header">
      <div>
        <div className="crumb">Character / {game.player.name}</div>
        <div className="character">
          Level {totalLevel} · Combat {stats.combatLevel}
        </div>
      </div>
      <div className="header-stats">
        <span className="header-stat">
          Gold <strong>◈ {formatNumber(game.gold)}</strong>
        </span>
        <span className="header-stat">
          HP{' '}
          <strong>
            {game.player.currentHp}/{stats.maxHealth}
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

function ActionStrip({
  game,
  onNavigate,
}: {
  game: GameState;
  onNavigate: (screen: ScreenId) => void;
}) {
  const action = game.activeAction;
  const stopAction = useGameStore((store) => store.stopAction);
  const combatSession = useGameStore((store) => store.combatSession);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const ratio = progressRatio(action, now, game);
  if (action.type === 'none') return null;
  const screen: ScreenId =
    action.type === 'mining' ? 'mining' : action.type === 'smithing' ? 'smithing' : 'combat';
  if (action.type === 'combat') {
    const enemy = enemyById[action.enemyId];
    const combatStats = getDerivedStats(game, action.style);
    const combatStartedAt = combatSession.startedAt ?? game.updatedAt;
    return (
      <div className="action-strip combat-strip" data-ui-region="actionStrip">
        <div className="action-icon">
          <Swords size={19} />
        </div>
        <div className="combat-activity-stats" aria-label="Combat activity summary">
          <div className="combat-activity-stat">
            <span>Combat level</span>
            <strong>{combatStats.combatLevel}</strong>
          </div>
          <div className="combat-activity-stat">
            <span>HP</span>
            <strong>
              <Heart size={13} /> {Math.ceil(game.player.currentHp)} / {combatStats.maxHealth}
            </strong>
          </div>
        </div>
        <button className="action-main button ghost" onClick={() => onNavigate('combat')}>
          <strong>Fighting {enemy?.name ?? 'enemy'}</strong>
          <small>Click to open Live Combat Resolution</small>
        </button>
        <div className="action-meta action-fight-time">
          <Timer size={13} /> {formatFightDuration(combatStartedAt, now)}
        </div>
      </div>
    );
  }
  const miningNode = action.type === 'mining' ? miningNodeById[action.nodeId] : undefined;
  const miningRuntime =
    action.type === 'mining' ? getMiningRuntimeState(game.mining, action.nodeId) : undefined;
  const miningRemainingMs =
    action.type !== 'mining'
      ? 0
      : action.phase === 'respawn'
        ? (miningRuntime?.respawnRemainingMs ?? 0)
        : Math.max(
            0,
            (action.phase === 'rest'
              ? MINING_TUNING.restDurationMs
              : getMiningTool(game).swingIntervalMs) - action.progressMs,
          );
  const miningPhaseText =
    action.type !== 'mining'
      ? ''
      : action.phase === 'rest'
        ? 'Resting'
        : action.phase === 'respawn'
          ? 'Rock reforming'
          : 'Swinging';
  const miningStageText =
    action.type === 'mining'
      ? `Stage ${(miningRuntime?.stageIndex ?? 0) + 1}/${miningNode?.stages.length ?? 0}`
      : '';
  return (
    <div className="action-strip" data-ui-region="actionStrip">
      <div className="action-icon">
        {action.type === 'mining' ? (
          <Pickaxe size={19} />
        ) : action.type === 'smithing' ? (
          <Hammer size={19} />
        ) : (
          <Swords size={19} />
        )}
      </div>
      <button className="action-main button ghost" onClick={() => onNavigate(screen)}>
        <strong>{actionLabel(game)}</strong>
        <small className="mining-activity-legacy-label" aria-hidden="true">
          {action.type === 'mining'
            ? `${action.phase === 'rest' ? 'Resting' : action.phase === 'respawn' ? 'Respawning' : 'Swinging'} · Stage ${miningRuntime?.stageIndex ? miningRuntime.stageIndex + 1 : 1}/${miningNode?.stages.length ?? 0}`
            : 'Active in background'}
        </small>
        <small className="mining-activity-label">
          {action.type === 'mining'
            ? `${miningPhaseText} · ${miningStageText}`
            : 'Active in background'}
        </small>
      </button>
      <div className="progress-track">
        <div
          className="progress-fill"
          style={{ width: `${Math.max(4, Math.min(100, ratio * 100))}%` }}
        />
      </div>
      <div className="action-meta">
        {action.type === 'mining'
          ? `Stamina ${Math.round(game.mining.stamina)} · ${Math.ceil(miningRemainingMs / 1000)}s`
          : 'Cycle in progress'}
      </div>
      <button className="button danger" onClick={stopAction}>
        Stop
      </button>
    </div>
  );
}

function HomeScreen({
  game,
  onNavigate,
}: {
  game: GameState;
  onNavigate: (screen: ScreenId) => void;
}) {
  const stats = getDerivedStats(game);
  const objectives = [
    {
      text: 'Mine Stone and Iron',
      done:
        getItemQuantity(game.inventory, 'stone-ore') > 0 &&
        getItemQuantity(game.inventory, 'iron-ore') > 0,
      target: 'mining' as const,
    },
    {
      text: 'Smelt a Bronze Bar',
      done: getItemQuantity(game.inventory, 'bronze-bar') > 0,
      target: 'smithing' as const,
    },
    {
      text: 'Forge a Bronze Sword',
      done: game.discoveredItems.includes('bronze-sword'),
      target: 'smithing' as const,
    },
    { text: 'Equip a Weapon', done: Boolean(game.equipment.weapon), target: 'equipment' as const },
    {
      text: 'Defeat a Forest Rat',
      done: (game.killCounts['forest-rat'] ?? 0) > 0,
      target: 'combat' as const,
    },
  ];
  return (
    <>
      <div className="screen-heading">
        <div>
          <div className="eyebrow">The frontier is awake</div>
          <h1>Good to see you, {game.player.name}.</h1>
          <p className="subtle">A small forge, a deep mine, and a road that keeps going.</p>
        </div>
        <button
          className="button primary"
          onClick={() =>
            onNavigate(
              game.activeAction.type === 'none'
                ? 'mining'
                : game.activeAction.type === 'combat'
                  ? 'combat'
                  : game.activeAction.type === 'smithing'
                    ? 'smithing'
                    : 'mining',
            )
          }
        >
          Continue journey →
        </button>
      </div>
      <div className="dashboard-grid">
        <section className="panel hero">
          <ThreeScene screen="home" settings={game.settings} theme="#b58b53" />
          <div className="hero-copy">
            <span className="badge gold">Current standing</span>
            <h2 style={{ fontSize: 28, marginTop: 18 }}>
              {stats.combatLevel < 5 ? 'A spark becomes a craft.' : 'The road opens before you.'}
            </h2>
            <p className="subtle">
              {game.activeAction.type === 'none'
                ? 'Choose a skill or seek a fight. The world will keep time while you explore.'
                : `Currently ${actionLabel(game).toLowerCase()}. You can navigate freely while it continues.`}
            </p>
            <div className="button-row" style={{ marginTop: 22 }}>
              <button className="button" onClick={() => onNavigate('combat')}>
                <Swords size={14} /> Combat
              </button>
              <button className="button" onClick={() => onNavigate('equipment')}>
                <Shield size={14} /> Equipment
              </button>
            </div>
          </div>
        </section>
        <section className="panel panel-pad">
          <div className="split">
            <div>
              <div className="eyebrow">Starter path</div>
              <h2>First embers</h2>
            </div>
            <span className="badge">
              {objectives.filter((objective) => objective.done).length}/{objectives.length}
            </span>
          </div>
          <div>
            {objectives.map((objective) => (
              <button
                className={`objective ${objective.done ? 'done' : ''}`}
                key={objective.text}
                onClick={() => onNavigate(objective.target)}
                style={{
                  width: '100%',
                  border: 0,
                  background: 'transparent',
                  color: 'inherit',
                  textAlign: 'left',
                }}
              >
                <span className="objective-check">{objective.done ? '✓' : ''}</span>
                <span>{objective.text}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
      <div className="grid grid-4" style={{ marginTop: 16 }}>
        <div className="panel stat-card">
          <div className="label">Mining</div>
          <div className="value">{game.skills.mining.level}</div>
          <div className="bar">
            <i style={{ width: `${getLevelProgress(game.skills.mining).percent}%` }} />
          </div>
        </div>
        <div className="panel stat-card">
          <div className="label">Smithing</div>
          <div className="value">{game.skills.smithing.level}</div>
          <div className="bar">
            <i style={{ width: `${getLevelProgress(game.skills.smithing).percent}%` }} />
          </div>
        </div>
        <div className="panel stat-card">
          <div className="label">Enemies defeated</div>
          <div className="value">{formatNumber(game.statistics.totalKills)}</div>
          <div className="label">The log grows</div>
        </div>
        <div className="panel stat-card">
          <div className="label">Discoveries</div>
          <div className="value">
            {game.discoveredItems.length}/{ITEMS.length}
          </div>
          <div className="label">Collection log</div>
        </div>
      </div>
      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <section className="panel panel-pad">
          <div className="split">
            <h2>Recent activity</h2>
            <button className="button ghost" onClick={() => onNavigate('collection')}>
              Collection log
            </button>
          </div>
          <div className="list" style={{ marginTop: 12 }}>
            {game.log.slice(0, 5).map((entry) => (
              <div className="list-row" key={entry.id}>
                <div className="row-main">
                  <strong>{entry.text}</strong>
                  <small>
                    {new Date(entry.at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </small>
                </div>
                <span className={`badge ${entry.tone === 'danger' ? 'locked' : ''}`}>
                  {entry.tone}
                </span>
              </div>
            ))}
          </div>
        </section>
        <section className="panel panel-pad">
          <div className="split">
            <h2>Combat profile</h2>
            <button className="button ghost" onClick={() => onNavigate('equipment')}>
              View gear
            </button>
          </div>
          {(['attack', 'strength', 'defence', 'hitpoints'] as const).map((skill) => (
            <div className="stat-line" key={skill}>
              <span>{skill[0].toUpperCase() + skill.slice(1)}</span>
              <strong>{game.skills[skill].level}</strong>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}

/* eslint-disable react-hooks/rules-of-hooks -- retained for the migration diff; the routed screen is RealtimeCombatScreen. */
function _LegacyCombatScreen({
  game,
  requestAction,
}: {
  game: GameState;
  requestAction: (screen: ScreenId, action: () => void) => void;
}) {
  const [areaId, setAreaId] = useState<AreaId>('training-grounds');
  const [style, setStyle] = useState<CombatStyle>('accurate');
  const [autoRepeat, setAutoRepeat] = useState(true);
  const startCombat = useGameStore((store) => store.startCombat);
  const stopAction = useGameStore((store) => store.stopAction);
  const active = game.activeAction.type === 'combat' ? game.activeAction : null;
  const area = areaById[areaId];
  const stats = getDerivedStats(game);
  return (
    <>
      <div className="screen-heading">
        <div>
          <div className="eyebrow">World · Automated combat</div>
          <h1>Combat</h1>
          <p className="subtle">
            Choose a road, settle into a style, and let the intervals resolve.
          </p>
        </div>
        <span className="badge gold">Combat level {stats.combatLevel}</span>
      </div>
      <div className="button-row" style={{ marginBottom: 15 }}>
        {AREAS.map((candidate) => {
          const unlocked = game.unlockedAreas.includes(candidate.id) || candidate.unlock(game);
          return (
            <button
              key={candidate.id}
              className={`button ${candidate.id === areaId ? 'gold' : 'ghost'}`}
              disabled={!unlocked}
              onClick={() => setAreaId(candidate.id)}
            >
              {unlocked ? (
                candidate.name
              ) : (
                <>
                  <Lock size={13} /> {candidate.name}
                </>
              )}
            </button>
          );
        })}
      </div>
      <div className="dashboard-grid">
        <section className="panel scene-panel">
          <div style={{ position: 'relative', padding: 22 }}>
            <span className="badge">{area.name}</span>
            <h2 style={{ marginTop: 18 }}>{area.name}</h2>
            <p className="subtle">{area.description}</p>
            <div className="grid grid-2" style={{ marginTop: 25 }}>
              <div>
                <div className="muted">Your attack</div>
                <strong>
                  {stats.attack} attack · {stats.maxHit} max hit
                </strong>
              </div>
              <div>
                <div className="muted">Your defence</div>
                <strong>
                  {stats.defence} rating · {stats.maxHealth} health
                </strong>
              </div>
            </div>
          </div>
        </section>
        <section className="panel panel-pad">
          <div className="split">
            <h2>Available targets</h2>
            <label className="subtle">
              <input
                type="checkbox"
                checked={autoRepeat}
                onChange={(event) => setAutoRepeat(event.target.checked)}
              />{' '}
              Auto Repeat
            </label>
          </div>
          <div className="list" style={{ marginTop: 12 }}>
            {area.enemyIds.map((enemyId) => {
              const enemy = enemyById[enemyId];
              const isActive = active?.enemyId === enemyId;
              return (
                <div className="list-row" key={enemy.id}>
                  <div className="enemy-art">
                    {enemy.theme === 'wolf'
                      ? '◒'
                      : enemy.theme === 'bat'
                        ? '◓'
                        : enemy.theme === 'crab'
                          ? '◇'
                          : '◈'}
                  </div>
                  <div className="row-main">
                    <strong>
                      {enemy.name} <span className="badge">Lv {enemy.displayLevel}</span>
                    </strong>
                    <small>
                      {enemy.description}
                      <br />
                      {enemy.maxHealth} HP · {game.killCounts[enemy.id] ?? 0} defeated
                    </small>
                  </div>
                  {isActive ? (
                    <button className="button danger" onClick={stopAction}>
                      Stop
                    </button>
                  ) : (
                    <button
                      className="button primary"
                      onClick={() =>
                        requestAction('combat', () =>
                          startCombat(areaId, enemy.id, style, autoRepeat),
                        )
                      }
                    >
                      Fight
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 18 }}>
            <div className="eyebrow">Combat style</div>
            <div className="button-row">
              {(['accurate', 'aggressive', 'defensive'] as CombatStyle[]).map((option) => (
                <button
                  className={`button ${style === option ? 'gold' : 'ghost'}`}
                  key={option}
                  onClick={() => setStyle(option)}
                >
                  {option[0].toUpperCase() + option.slice(1)}
                </button>
              ))}
            </div>
            <p className="subtle" style={{ marginTop: 10 }}>
              {style === 'accurate'
                ? 'Attack XP from every point of damage.'
                : style === 'aggressive'
                  ? 'Strength XP from every point of damage.'
                  : 'Defence XP from every point of damage.'}{' '}
              Damage also grants Hitpoints XP.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}

/* eslint-enable react-hooks/rules-of-hooks */
function CollectionScreen({ game }: { game: GameState }) {
  const [tab, setTab] = useState<'items' | 'monsters' | 'skills'>('items');
  return (
    <>
      <div className="screen-heading">
        <div>
          <div className="eyebrow">Records of the road</div>
          <h1>Collection Log</h1>
          <p className="subtle">
            First acquisition is permanent. Unknown entries preserve their clues.
          </p>
        </div>
        <span className="badge gold">
          {game.discoveredItems.length}/{ITEMS.length} items
        </span>
      </div>
      <section className="panel panel-pad">
        <div className="tabs">
          <button
            className={`tab ${tab === 'items' ? 'active' : ''}`}
            onClick={() => setTab('items')}
          >
            Items
          </button>
          <button
            className={`tab ${tab === 'monsters' ? 'active' : ''}`}
            onClick={() => setTab('monsters')}
          >
            Monsters
          </button>
          <button
            className={`tab ${tab === 'skills' ? 'active' : ''}`}
            onClick={() => setTab('skills')}
          >
            Skills / Achievements
          </button>
        </div>
        {tab === 'items' && (
          <div className="inventory-grid">
            {ITEMS.map((item) => {
              const found = game.discoveredItems.includes(item.id);
              return (
                <div className="item-card" key={item.id} style={{ opacity: found ? 1 : 0.58 }}>
                  <ItemIcon itemId={item.id} discovered={found} size="md" />
                  <strong>{found ? item.name : '???'}</strong>
                  <small>
                    {item.category} · {found ? item.source : 'Source unknown'}
                  </small>
                </div>
              );
            })}
          </div>
        )}
        {tab === 'monsters' && (
          <div className="grid grid-3">
            {ENEMIES.map((enemy) => {
              const found = game.discoveredMonsters.includes(enemy.id);
              return (
                <div className="panel card" key={enemy.id}>
                  <div className="enemy-art">{found ? '◈' : '?'}</div>
                  <h3>{found ? enemy.name : 'Unknown foe'}</h3>
                  <p className="subtle">
                    {found ? enemy.description : 'Defeat this enemy to reveal its record.'}
                  </p>
                  <span className="badge">{game.killCounts[enemy.id] ?? 0} kills</span>
                </div>
              );
            })}
          </div>
        )}
        {tab === 'skills' && (
          <div className="empty">
            <Zap size={26} />
            <p>Milestones and mastery records arrive after the first season.</p>
            <span className="badge locked">Coming after MVP</span>
          </div>
        )}
      </section>
    </>
  );
}

function SettingsScreen({
  game,
  onProfiles,
  onDelete,
}: {
  game: GameState;
  onProfiles: () => void;
  onDelete: () => void;
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
      <div className="grid grid-2">
        <section className="panel panel-pad">
          <h2>Save controls</h2>
          <div className="button-row" style={{ margin: '15px 0' }}>
            <button className="button primary" onClick={() => void saveNow()}>
              <Save size={14} /> Save Now
            </button>
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
          <p className="subtle">
            Primary and last-known-good backup are maintained locally. Offline progress is capped at
            24 hours.
          </p>
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
        </section>
        <section className="panel panel-pad">
          <h2>Presentation</h2>
          {[
            ['sound', 'Sound effects'],
            ['music', 'Music'],
            ['reducedMotion', 'Reduced motion'],
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
        </section>
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
function HelpScreen() {
  return (
    <>
      <div className="screen-heading">
        <div>
          <div className="eyebrow">Field notes</div>
          <h1>Help</h1>
          <p className="subtle">A short guide to the systems currently in your hands.</p>
        </div>
      </div>
      <div className="grid grid-2">
        <section className="panel panel-pad">
          <h2>How time works</h2>
          <p className="subtle">
            Mining, smithing, and combat use elapsed time rather than animation frames. Start one
            action, then navigate freely. Starting another action replaces it after confirmation.
          </p>
          <h2 style={{ marginTop: 20 }}>Offline progress</h2>
          <p className="subtle">
            On load, the last simulated timestamp is replayed for up to 24 hours. Actions stop
            safely when materials, inventory, or combat survivability run out.
          </p>
        </section>
        <section className="panel panel-pad">
          <h2>Keeping your save safe</h2>
          <p className="subtle">
            Autosave runs about every ten seconds and when the tab is hidden. Settings can export a
            portable JSON file for backup or transfer.
          </p>
          <h2 style={{ marginTop: 20 }}>Inventory</h2>
          <p className="subtle">
            Identical items stack. Equipped gear does not take a slot. Lock important stacks before
            destroying anything.
          </p>
        </section>
      </div>
    </>
  );
}

function OfflineModal({ summary, onClose }: { summary: SimulationSummary; onClose: () => void }) {
  const entries = Object.entries(summary.completed);
  return (
    <div className="modal-backdrop">
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="offline-title">
        <div className="eyebrow">Welcome back</div>
        <h2 id="offline-title">Your time away has been counted.</h2>
        <p className="subtle">{Math.round(summary.elapsedMs / 60_000)} minutes simulated safely.</p>
        {summary.remainingElapsedMs > 0 && (
          <p className="subtle">
            {Math.round(summary.remainingElapsedMs / 60_000)} minutes remain queued for a safe
            follow-up simulation.
          </p>
        )}
        <div className="offline-summary">
          <div className="summary-stat">
            <strong>{summary.enemiesDefeated}</strong>
            <span className="muted">foes defeated</span>
          </div>
          <div className="summary-stat">
            <strong>{Object.values(summary.itemsGained).reduce((a, b) => a + b, 0)}</strong>
            <span className="muted">items gained</span>
          </div>
          <div className="summary-stat">
            <strong>{Object.values(summary.xpGained).reduce((a, b) => a + b, 0)}</strong>
            <span className="muted">XP earned</span>
          </div>
        </div>
        {entries.length > 0 && (
          <div className="list">
            {entries.slice(0, 8).map(([label, amount]) => (
              <div className="list-row" key={label}>
                <span>{label.replace(':', ' · ')}</span>
                <strong>×{amount}</strong>
              </div>
            ))}
          </div>
        )}
        {summary.stoppedReason && (
          <p style={{ color: 'var(--gold)', marginTop: 15 }}>Stopped: {summary.stoppedReason}</p>
        )}
        <button className="button primary" style={{ marginTop: 18 }} onClick={onClose}>
          Continue
        </button>
      </section>
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
  const recentActions = game.log
    .filter((entry) => sessionStartedAt === null || entry.at >= sessionStartedAt)
    .slice(0, 8);
  const deathCause =
    recentActions.find((entry) => entry.text.startsWith('You were killed by'))?.text ??
    (enemy ? `You were killed by ${enemy.name}.` : 'The final blow ended the fight.');

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
                <div className={`death-action ${entry.tone}`} key={entry.id}>
                  <time>
                    {formatFightDuration(
                      entry.combatEncounterStartedAt ?? encounterStartedAt,
                      entry.at,
                    )}
                  </time>
                  <span>{entry.text}</span>
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
    const defaults = sanitizeUiLayout(DEFAULT_UI_LAYOUT);
    pendingUiLayout.current = defaults;
    setUiLayout(defaults);
    saveUiLayout(defaults);
  };
  const resetCurrentScreenLayout = (target: ScreenId) => {
    const defaults = DEFAULT_UI_LAYOUT.screenPanels[target];
    if (!defaults) return;
    updateUiLayout({
      ...uiLayout,
      screenPanels: { ...uiLayout.screenPanels, [target]: structuredClone(defaults) },
    });
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
        return <HomeScreen game={currentGame} onNavigate={nav} />;
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
        return <CollectionScreen game={currentGame} />;
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
          />
        );
      case 'help':
        return <HelpScreen />;
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
    <main className="content" data-ui-region="content">
      {render()}
    </main>
  );
  const actionStrip = <ActionStrip game={currentGame} onNavigate={nav} />;
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
      {offlineSummary && <OfflineModal summary={offlineSummary} onClose={clearOfflineSummary} />}
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
