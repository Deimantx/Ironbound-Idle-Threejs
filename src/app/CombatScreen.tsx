import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight, CircleStop, Crosshair, Heart, Lock, Shield, Sparkles, Swords, Timer, Trophy, Zap } from 'lucide-react';
import { AREAS, areaById } from '../content/areas';
import { enemyById } from '../content/enemies';
import { itemById } from '../content/items';
import { GAME_CONFIG } from '../config/gameConfig';
import { getLevelProgress } from '../game/formulas/experienceFormulas';
import { getDerivedStats } from '../game/formulas/statFormulas';
import {
  displayDropChance,
  getCombatStyleInfo,
  selectAreaThreat,
  selectCombatProgress,
  selectCombatStatus,
  selectEnemyAttackProgress,
  selectEnemyEstimatedDps,
  selectPlayerAttackProgress,
  selectPlayerEstimatedDps,
  ZONE_COMPLETION_KILLS,
} from '../game/selectors/combatSelectors';
import { useGameStore } from '../game/state/gameStore';
import { getItemQuantity, occupiedSlots } from '../game/systems/inventorySystem';
import type { AreaId, CombatStyle, EnemyDefinition, EnemyId, GameState, ScreenId } from '../game/types';
import { ThreeScene } from '../three/ThreeScene';
import type { ConfirmDialogOptions } from './ConfirmDialog';

const formatSeconds = (ms: number): string => `${(ms / 1000).toFixed(1)}s`;
const formatNumber = (value: number): string => new Intl.NumberFormat('en-US').format(Math.floor(value));
const itemGlyph = (category: string): string =>
  ({ material: '◆', bar: '◈', weapon: '⚔', armor: '◇', shield: '⬡', drop: '✦' })[category] ?? '•';

function HealthBar({
  label,
  current,
  max,
  tone,
}: {
  label: string;
  current: number;
  max: number;
  tone: 'player' | 'enemy';
}) {
  const ratio = Math.max(0, Math.min(1, current / Math.max(1, max)));
  return (
    <div className={`combat-health combat-health-${tone}`}>
      <div className="combat-health-head">
        <span>{label}</span>
        <strong>{Math.ceil(Math.max(0, current))} / {max} HP</strong>
      </div>
      <div className="combat-health-track" role="progressbar" aria-label={`${label} health`} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.ceil(Math.max(0, current))}>
        <i style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  );
}

function AttackProgress({
  label,
  progress,
  tone,
}: {
  label: string;
  progress: { ratio: number; timeUntilAttackMs: number; intervalMs: number };
  tone: 'player' | 'enemy';
}) {
  return (
    <div className="attack-progress">
      <div className="attack-progress-head"><span>{label}</span><span>{formatSeconds(progress.timeUntilAttackMs)} / {formatSeconds(progress.intervalMs)}</span></div>
      <div className={`attack-progress-track ${tone}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={1} aria-valuenow={progress.ratio}>
        <i style={{ width: `${progress.ratio * 100}%` }} />
      </div>
    </div>
  );
}

function StatLine({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return <div className="combat-stat-line" title={hint}><span>{label}</span><strong>{value}</strong></div>;
}

function ZoneSelector({
  game,
  selectedArea,
  onSelect,
  selectedEnemy,
}: {
  game: GameState;
  selectedArea: AreaId;
  selectedEnemy: EnemyId;
  onSelect: (id: AreaId) => void;
}) {
  return (
    <section className="combat-section zone-section" aria-labelledby="zone-selector-title">
      <div className="section-heading-row">
        <div><div className="eyebrow">Choose your road</div><h2 id="zone-selector-title">Combat zones</h2></div>
        <span className="muted">The fight does not start when you select a zone.</span>
      </div>
      <div className="zone-scroller" role="listbox" aria-label="Combat zones">
        {AREAS.map((area) => {
          const unlocked = game.unlockedAreas.includes(area.id) || area.unlock(game);
          const selected = area.id === selectedArea;
          const kills = area.enemyIds.reduce((sum, enemyId) => sum + (game.killCounts[enemyId] ?? 0), 0);
          const completed = unlocked && kills >= ZONE_COMPLETION_KILLS;
          const preview = enemyById[area.enemyIds[0]];
          return (
            <button
              type="button"
              role="option"
              aria-selected={selected}
              className={`zone-card ${selected ? 'selected' : ''} ${!unlocked ? 'locked' : ''} ${completed ? 'completed' : ''}`}
              key={area.id}
              onClick={() => unlocked && onSelect(area.id)}
              disabled={!unlocked}
            >
              <div className="zone-card-top"><span className="zone-mark" style={{ background: area.accent }}>{area.id === 'training-grounds' ? '✚' : area.id === 'copper-hills' ? '⬟' : '♣'}</span><span className={`status-pill ${selected ? 'selected' : !unlocked ? 'locked' : completed ? 'complete' : ''}`}>{selected ? 'Selected' : !unlocked ? 'Locked' : completed ? 'Completed' : 'Available'}</span></div>
              <strong>{area.name}</strong>
              <small>{area.description}</small>
              <div className="zone-card-meta"><span>Recommended <b>{area.recommendedLevel[0]}–{area.recommendedLevel[1]}</b></span><span>{area.enemyIds.length} enemies</span></div>
              <div className="zone-card-progress"><div className="bar"><i style={{ width: `${Math.min(100, (kills / ZONE_COMPLETION_KILLS) * 100)}%`, background: area.accent }} /></div><small>{kills} / {ZONE_COMPLETION_KILLS} kills</small></div>
              {!unlocked ? <div className="zone-requirement"><Lock size={12} /> Requires: {area.requirement}</div> : <div className="zone-drop-preview">First encounter: {preview.name}</div>}
              {selected && selectedEnemy && area.enemyIds.includes(selectedEnemy) && <Check className="zone-selected-check" size={16} />}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function EquipmentStrip({ game }: { game: GameState }) {
  return <div className="combat-equipment-strip">
    {(['weapon', 'shield', 'head', 'body', 'legs'] as const).map((slot) => {
      const item = game.equipment[slot] ? itemById[game.equipment[slot] as string] : undefined;
      return <div className={`combat-equip-slot ${item ? 'filled' : ''}`} key={slot} title={item?.description ?? `${slot} slot`}><span>{slot}</span><b>{item ? itemGlyph(item.category) : '—'}</b><small>{item?.name ?? 'Empty'}</small></div>;
    })}
  </div>;
}

function CombatFigure({ side, enemy }: { side: 'player' | 'enemy'; enemy: EnemyDefinition }) {
  const enemyGlyph: Record<EnemyDefinition['theme'], string> = { rodent: '◒', goblin: '♟', bat: '⋈', crab: '⬢', wolf: '◇', bandit: '⚔' };
  return <div className={`combat-figure-wrap ${side}`} aria-label={side === 'player' ? 'Player combatant' : `${enemy.name} combatant`}><div className={`combat-figure ${side} theme-${enemy.theme}`}><div className="figure-shadow" />{side === 'player' ? <><div className="figure-head" /><div className="figure-body" /><div className="figure-weapon" /><div className="figure-shield" /></> : <><div className="figure-head enemy-head">{enemyGlyph[enemy.theme]}</div><div className="figure-body enemy-body" /><div className="figure-weapon enemy-weapon" /></>}</div><span className="figure-name">{side === 'player' ? 'You' : enemy.name}</span></div>;
}

function CombatPanel({
  game,
  enemy,
  side,
  playerProgress,
  enemyProgress,
}: {
  game: GameState;
  enemy: EnemyDefinition;
  side: 'player' | 'enemy';
  playerProgress: ReturnType<typeof selectPlayerAttackProgress>;
  enemyProgress: ReturnType<typeof selectEnemyAttackProgress>;
}) {
  const stats = getDerivedStats(game);
  if (side === 'player') {
    return <section className="combatant-panel player-panel" aria-labelledby="player-panel-title"><div className="combatant-heading"><div className="panel-avatar player-avatar"><Swords size={20} /></div><div><div className="eyebrow">Combatant</div><h2 id="player-panel-title">{game.player.name}</h2><span className="muted">Combat level {stats.combatLevel}</span></div></div><HealthBar label="Player health" current={game.player.currentHp} max={stats.maxHealth} tone="player" /><AttackProgress label="Next attack" progress={playerProgress} tone="player" /><div className="combat-stat-grid"><StatLine label="Attack" value={stats.attack} hint="Attack level plus equipment bonuses" /><StatLine label="Maximum hit" value={stats.maxHit} /><StatLine label="Estimated DPS" value={selectPlayerEstimatedDps(game, enemy).toFixed(1)} /><StatLine label="Attack interval" value={formatSeconds(stats.attackIntervalMs)} /><StatLine label="Defence" value={stats.defence} /></div><div className="panel-label">Equipped for battle</div><EquipmentStrip game={game} /><div className="hp-note"><Heart size={13} /> Damage dealt grants combat-style XP and Hitpoints XP.</div></section>;
  }
  const currentHp = game.activeAction.type === 'combat' && game.activeAction.enemyId === enemy.id ? game.activeAction.combatState.enemyHp : enemy.maxHealth;
  return <section className="combatant-panel enemy-panel" aria-labelledby="enemy-panel-title"><div className="combatant-heading"><div className={`panel-avatar enemy-avatar theme-${enemy.theme}`}>{enemy.theme === 'wolf' ? '◇' : enemy.theme === 'bat' ? '⋈' : enemy.theme === 'crab' ? '⬢' : '✦'}</div><div><div className="eyebrow">{enemy.areaId.replaceAll('-', ' ')}</div><h2 id="enemy-panel-title">{enemy.name}</h2><span className="muted">Display level {enemy.displayLevel}</span></div></div><HealthBar label="Enemy health" current={currentHp} max={enemy.maxHealth} tone="enemy" /><AttackProgress label="Enemy attack" progress={enemyProgress} tone="enemy" /><div className="combat-stat-grid"><StatLine label="Maximum hit" value={enemy.maxHit} /><StatLine label="Estimated DPS" value={selectEnemyEstimatedDps(game, enemy).toFixed(1)} /><StatLine label="Attack interval" value={formatSeconds(enemy.attackIntervalMs)} /></div><div className="enemy-tags">{(enemy.tags ?? []).map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div><div className="enemy-description">{enemy.description}</div><div className="enemy-panel-footer"><span><Trophy size={13} /> {game.killCounts[enemy.id] ?? 0} defeated</span><span>{game.discoveredMonsters.includes(enemy.id) ? 'Encounter logged' : 'New encounter'}</span></div></section>;
}

function BattleArena({ game, areaId, enemy, now, events }: { game: GameState; areaId: AreaId; enemy: EnemyDefinition; now: number; events: ReturnType<typeof useGameStore.getState>['combatEvents'] }) {
  const area = areaById[areaId];
  const playerProgress = selectPlayerAttackProgress(game, now);
  const enemyProgress = selectEnemyAttackProgress(game, now);
  const active = game.activeAction.type === 'combat' && game.activeAction.enemyId === enemy.id;
  const status = selectCombatStatus(game);
  const visibleEvents = events.filter((event) => event.enemyId === enemy.id && now - event.at < 1800).slice(-8);
  const lastEvent = events.at(-1);
  const currentEnemyHp = active && game.activeAction.type === 'combat' ? game.activeAction.combatState.enemyHp : enemy.maxHealth;
  const weaponTier = game.equipment.weapon ? itemById[game.equipment.weapon]?.tier ?? 'none' : 'none';
  return <section className={`battle-arena ${active ? 'is-active' : ''} ${lastEvent && now - lastEvent.at < 800 ? `event-${lastEvent.type}` : ''}`} aria-label="Real-time battle arena"><ThreeScene screen="combat" settings={game.settings} theme={area.accent} enemyTheme={enemy.theme} combatActive={active} playerWeaponTier={weaponTier} playerHasShield={Boolean(game.equipment.shield)} /><div className="arena-topline"><span className="arena-zone-dot" style={{ background: area.accent }} />{area.name}<span className="arena-divider">·</span>{enemy.name}<span className="arena-threat">{selectAreaThreat(game, enemy)}</span></div><div className="arena-combatants"><CombatFigure side="player" enemy={enemy} /><div className="arena-center"><div className="arena-crosshair"><Crosshair size={25} /></div><strong className="arena-status">{status}</strong>{status === 'Respawning enemy' && game.activeAction.type === 'combat' && <span className="respawn-countdown">{formatSeconds(game.activeAction.combatState.respawnMs)} until return</span>}{status === 'Enemy defeated' && <span className="respawn-countdown">Victory secured</span>}</div><CombatFigure side="enemy" enemy={enemy} /></div><div className="arena-health-row"><HealthBar label="You" current={game.player.currentHp} max={getDerivedStats(game).maxHealth} tone="player" /><HealthBar label={enemy.name} current={currentEnemyHp} max={enemy.maxHealth} tone="enemy" /></div><div className="arena-floating-events" aria-live="polite">{visibleEvents.map((event) => <span className={`floating-event ${event.type} ${event.type === 'player-hit' ? 'near-enemy' : event.type === 'enemy-hit' ? 'near-player' : 'center-event'}`} key={event.id}>{event.type === 'enemy-defeated' ? 'Defeated' : event.type === 'player-defeated' ? 'Down' : event.type === 'loot' ? 'Loot!' : 'damage' in event ? `-${event.damage}` : 'Event'}</span>)}</div><div className="arena-progress-row"><AttackProgress label="Your next attack" progress={playerProgress} tone="player" /><AttackProgress label="Enemy next attack" progress={enemyProgress} tone="enemy" /></div></section>;
}

function StyleControls({ style, onChange }: { style: CombatStyle; onChange: (style: CombatStyle) => void }) {
  return <section className="combat-section style-section" aria-labelledby="style-title"><div className="section-heading-row"><div><div className="eyebrow">Choose how you train</div><h2 id="style-title">Combat style</h2></div><span className="muted">Updates live during combat.</span></div><div className="style-grid">{(['accurate', 'aggressive', 'defensive'] as CombatStyle[]).map((option) => { const info = getCombatStyleInfo(option); return <button type="button" className={`style-card ${style === option ? 'selected' : ''}`} aria-pressed={style === option} key={option} onClick={() => onChange(option)}><span className="style-icon">{option === 'accurate' ? <Crosshair size={18} /> : option === 'aggressive' ? <Zap size={18} /> : <Shield size={18} />}</span><strong>{info.name}</strong><small>{info.skill}</small><span>{info.benefit}</span><em>{info.modifier}</em></button>; })}</div></section>;
}

function EnemyRoster({ game, areaId, selectedEnemy, activeEnemy, onSelect }: { game: GameState; areaId: AreaId; selectedEnemy: EnemyId; activeEnemy: EnemyId | null; onSelect: (enemyId: EnemyId) => void }) {
  const area = areaById[areaId];
  return <section className="combat-section roster-section" aria-labelledby="roster-title"><div className="section-heading-row"><div><div className="eyebrow">Know your enemy</div><h2 id="roster-title">{area.name} roster</h2></div><span className="muted">Select a target, then start the fight.</span></div><div className="enemy-roster">{area.enemyIds.map((enemyId) => { const enemy = enemyById[enemyId]; const selected = enemyId === selectedEnemy; const fighting = enemyId === activeEnemy; const discovered = game.discoveredMonsters.includes(enemyId); const ownedDrops = enemy.loot.reduce((sum, drop) => sum + getItemQuantity(game.inventory, drop.itemId), 0); return <button type="button" className={`enemy-roster-card ${selected ? 'selected' : ''} ${fighting ? 'fighting' : ''}`} aria-pressed={selected} key={enemyId} onClick={() => onSelect(enemyId)}><div className={`roster-portrait theme-${enemy.theme}`}>{enemy.theme === 'rodent' ? '◒' : enemy.theme === 'goblin' ? '♟' : enemy.theme === 'bat' ? '⋈' : enemy.theme === 'crab' ? '⬢' : enemy.theme === 'wolf' ? '◇' : '⚔'}</div><div className="roster-copy"><div className="roster-title"><strong>{enemy.name}</strong><span className="badge">Lv {enemy.displayLevel}</span>{fighting && <span className="status-pill fighting">Fighting</span>}</div><p>{enemy.description}</p><div className="roster-stats"><span>{enemy.maxHealth} HP</span><span>{enemy.maxHit} max hit</span><span>{formatSeconds(enemy.attackIntervalMs)}</span><span>{game.killCounts[enemyId] ?? 0} kills</span></div><div className="roster-drops">Drops: {enemy.loot.slice(0, 3).map((drop) => itemById[drop.itemId]?.name ?? drop.itemId).join(' · ')}{ownedDrops > 0 ? ` · ${ownedDrops} owned` : ''}</div></div><span className="roster-action">{selected ? <Check size={16} /> : <ChevronRight size={17} />}</span><span className="sr-only">{discovered ? 'Encounter discovered' : 'New encounter'}</span></button>; })}</div></section>;
}

function LootPanel({ game, enemy }: { game: GameState; enemy: EnemyDefinition }) {
  const recentLoot = game.log.filter((entry) => entry.text.includes('Received')).slice(0, 4);
  return <section className="combat-section loot-panel" aria-labelledby="loot-title"><div className="section-heading-row"><div><div className="eyebrow">What the road gives back</div><h2 id="loot-title">Loot table</h2></div><span className="muted">{game.discoveredMonsters.includes(enemy.id) ? 'Encounter discovered' : 'Discover drops by fighting'}</span></div><div className="loot-table"><div className="loot-row loot-head"><span>Item</span><span>Quantity</span><span>Chance</span><span>Owned</span></div>{enemy.loot.map((drop) => { const item = itemById[drop.itemId]; const discovered = game.discoveredItems.includes(drop.itemId); return <div className="loot-row" key={drop.itemId}><span className="loot-item"><i className={`item-icon-mini ${item?.category ?? 'drop'}`}>{discovered ? itemGlyph(item?.category ?? 'drop') : '?'}</i><b>{discovered ? item?.name : '???'}</b></span><span>{drop.min}–{drop.max}</span><span className="loot-chance">{displayDropChance(drop.chance)}</span><span>{getItemQuantity(game.inventory, drop.itemId)}</span></div>; })}<div className="loot-row gold-row"><span className="loot-item"><i className="item-icon-mini gold">◈</i><b>Gold</b></span><span>{enemy.gold[0]}–{enemy.gold[1]}</span><span className="loot-chance">Guaranteed</span><span>{formatNumber(game.gold)}</span></div></div><div className="recent-loot"><div className="panel-label">Recent loot</div>{recentLoot.length ? recentLoot.map((entry) => <div className="recent-loot-row" key={entry.id}><Sparkles size={12} />{entry.text}</div>) : <span className="muted">Rewards from this enemy will appear here.</span>}</div></section>;
}

function ProgressionPanel({ game, session }: { game: GameState; session: ReturnType<typeof useGameStore.getState>['combatSession'] }) {
  const skills = ['attack', 'strength', 'defence', 'hitpoints'] as const;
  const started = session.startedAt ? Math.max(1, Date.now() - session.startedAt) : 0;
  const xpHour = Object.values(session.xpGained).reduce((sum, amount) => sum + (amount ?? 0), 0) * 3_600_000 / Math.max(1, started);
  return <section className="combat-section progression-panel" aria-labelledby="progression-title"><div className="section-heading-row"><div><div className="eyebrow">The long game</div><h2 id="progression-title">Combat progression</h2></div><span className="muted">Current session</span></div><div className="xp-grid">{skills.map((skill) => { const progress = getLevelProgress(game.skills[skill]); return <div className="xp-row" key={skill}><div className="xp-label"><span>{skill[0].toUpperCase() + skill.slice(1)}</span><b>Lv {game.skills[skill].level}</b></div><div className="bar"><i style={{ width: `${progress.percent}%` }} /></div><small>{formatNumber(progress.current)} / {progress.next || 'MAX'} XP</small></div>; })}</div><div className="session-stats"><div><b>{formatNumber(session.damageDealt)}</b><span>damage dealt</span></div><div><b>{formatNumber(session.enemiesDefeated)}</b><span>defeated</span></div><div><b>{formatNumber(session.goldGained)}</b><span>gold gained</span></div><div><b>{formatNumber(xpHour)}</b><span>XP / hour</span></div></div></section>;
}

function CombatLog({ game }: { game: GameState }) {
  const [filter, setFilter] = useState<'all' | 'damage' | 'loot' | 'progression'>('all');
  const entries = useMemo(() => game.log.filter((entry) => { if (filter === 'all') return true; if (filter === 'loot') return entry.text.includes('Received') || entry.text.includes('gold'); if (filter === 'progression') return entry.text.includes('level') || entry.text.includes('accessible') || entry.text.includes('discovered'); return entry.text.includes('hit') || entry.text.includes('defeated'); }).slice(0, 40), [game.log, filter]);
  return <section className="combat-section log-panel" aria-labelledby="combat-log-title"><div className="section-heading-row"><div><div className="eyebrow">Readable feedback</div><h2 id="combat-log-title">Combat log</h2></div><span className="muted">Latest 40 entries</span></div><div className="log-filters">{(['all', 'damage', 'loot', 'progression'] as const).map((option) => <button type="button" className={filter === option ? 'active' : ''} key={option} onClick={() => setFilter(option)}>{option}</button>)}</div><div className="combat-log" aria-live="polite">{entries.length ? entries.map((entry) => <div className={`combat-log-entry ${entry.tone}`} key={entry.id}><time>{new Date(entry.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time><span>{entry.text}</span></div>) : <span className="muted">No entries in this filter yet.</span>}</div></section>;
}

export function CombatScreen({
  game,
  requestAction,
  requestConfirmation,
}: {
  game: GameState;
  requestAction: (screen: ScreenId, action: () => void) => void;
  requestConfirmation: (options: ConfirmDialogOptions) => void;
}) {
  const [now, setNow] = useState(Date.now());
  const active = game.activeAction.type === 'combat' ? game.activeAction : null;
  const [selectedArea, setSelectedArea] = useState<AreaId>(active?.areaId ?? 'training-grounds');
  const [selectedEnemy, setSelectedEnemy] = useState<EnemyId>(active?.enemyId ?? 'forest-rat');
  const [style, setStyle] = useState<CombatStyle>(active?.style ?? 'accurate');
  const [autoRepeat, setAutoRepeat] = useState(active?.autoRepeat ?? true);
  const startCombat = useGameStore((store) => store.startCombat);
  const stopAction = useGameStore((store) => store.stopAction);
  const setCombatStyle = useGameStore((store) => store.setCombatStyle);
  const setCombatAutoRepeat = useGameStore((store) => store.setCombatAutoRepeat);
  const events = useGameStore((store) => store.combatEvents);
  const session = useGameStore((store) => store.combatSession);
  const currentAreaId = active?.areaId ?? selectedArea;
  const currentEnemyId = active?.enemyId ?? selectedEnemy;
  const currentArea = areaById[currentAreaId];
  const currentEnemy = enemyById[currentEnemyId];
  const locked = !game.unlockedAreas.includes(currentAreaId) && !currentArea.unlock(game);
  const stats = getDerivedStats(game);
  const status = selectCombatStatus(game);
  const progress = selectCombatProgress(game);
  const inventoryFull = occupiedSlots(game.inventory) >= GAME_CONFIG.inventorySlots;
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 200); return () => window.clearInterval(timer); }, []);
  useEffect(() => { if (active) { setSelectedArea(active.areaId); setSelectedEnemy(active.enemyId); setStyle(active.style); setAutoRepeat(active.autoRepeat); } }, [active]);
  const selectArea = (areaId: AreaId) => {
    const applySelection = () => {
      const nextEnemy = areaById[areaId].enemyIds[0];
      setSelectedArea(areaId);
      setSelectedEnemy(nextEnemy);
    };
    if (active && active.areaId !== areaId) {
      requestConfirmation({
        title: 'Switch combat zone?',
        message: 'Current combat will restart against the first target in the new zone.',
        confirmLabel: 'Switch zone',
        onConfirm: () => {
          const nextEnemy = areaById[areaId].enemyIds[0];
          startCombat(areaId, nextEnemy, active.style, active.autoRepeat);
          applySelection();
        },
      });
      return;
    }
    applySelection();
  };
  const selectEnemy = (enemyId: EnemyId) => {
    if (active && active.enemyId !== enemyId) {
      requestConfirmation({
        title: 'Switch target?',
        message: 'Current combat will restart against the new target.',
        confirmLabel: 'Switch target',
        onConfirm: () => {
          startCombat(active.areaId, enemyId, active.style, active.autoRepeat);
          setSelectedEnemy(enemyId);
        },
      });
      return;
    }
    setSelectedEnemy(enemyId);
  };
  const changeStyle = (next: CombatStyle) => { setStyle(next); if (active) setCombatStyle(next); };
  const beginFight = () => requestAction('combat', () => startCombat(currentAreaId, currentEnemyId, style, autoRepeat));
  const actionText = locked ? 'Enemy locked' : inventoryFull && !active ? 'Inventory full' : active ? 'Stop combat' : 'Fight';
  return <div className={`combat-screen ${game.settings.reducedMotion ? 'reduced-motion' : ''}`}>
    <div className="combat-header"><div><div className="eyebrow">World · Live encounter</div><h1>Combat</h1><p className="subtle">Read the rhythm of the fight, tune your style, and let the frontier keep time.</p></div><div className="combat-header-actions"><div className="combat-level-badge"><span>Combat level</span><strong>{stats.combatLevel}</strong></div><label className="auto-repeat-toggle"><input type="checkbox" checked={active?.autoRepeat ?? autoRepeat} onChange={(event) => { setAutoRepeat(event.target.checked); if (active) setCombatAutoRepeat(event.target.checked); }} /> <span>Auto Repeat</span></label><button type="button" className={`button ${active ? 'danger' : 'primary'} combat-main-action`} disabled={locked || (!active && inventoryFull)} onClick={active ? stopAction : beginFight}>{active ? <CircleStop size={16} /> : <Swords size={16} />}{actionText}</button></div></div>
    <div className="combat-context-bar"><span className="context-item"><span className="context-kicker">Zone</span><b>{currentArea.name}</b></span><ChevronRight size={15} /><span className="context-item"><span className="context-kicker">Target</span><b>{currentEnemy.name}</b></span><span className={`combat-status status-${status.toLowerCase().replaceAll(' ', '-')}`}>{status}</span><span className="context-spacer" /><span className="muted">{progress.killed} / {progress.target} zone kills</span></div>
    <ZoneSelector game={game} selectedArea={selectedArea} selectedEnemy={selectedEnemy} onSelect={selectArea} />
    <EnemyRoster game={game} areaId={currentAreaId} selectedEnemy={selectedEnemy} activeEnemy={active?.enemyId ?? null} onSelect={selectEnemy} />
    <div className="battle-layout"><CombatPanel game={game} enemy={currentEnemy} side="player" playerProgress={selectPlayerAttackProgress(game, now)} enemyProgress={selectEnemyAttackProgress(game, now)} /><BattleArena game={game} areaId={currentAreaId} enemy={currentEnemy} now={now} events={events} /><CombatPanel game={game} enemy={currentEnemy} side="enemy" playerProgress={selectPlayerAttackProgress(game, now)} enemyProgress={selectEnemyAttackProgress(game, now)} /></div>
    <div className="combat-detail-grid"><div><StyleControls style={active?.style ?? style} onChange={changeStyle} /><ProgressionPanel game={game} session={session} /></div><div><LootPanel game={game} enemy={currentEnemy} /><CombatLog game={game} /></div></div>
    <div className="combat-footnote"><Timer size={13} /> Timers are simulation-driven; presentation interpolates between authoritative ticks. <span className="muted">{game.settings.reducedMotion ? 'Reduced motion enabled.' : 'Animations can be reduced in Settings.'}</span></div>
  </div>;
}
