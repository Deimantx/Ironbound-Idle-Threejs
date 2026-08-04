import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleStop,
  Clock3,
  Crosshair,
  Gem,
  Heart,
  Lock,
  PackageOpen,
  Shield,
  Sparkles,
  Skull,
  Sword,
  Swords,
  Target,
  Timer,
  TreePine,
  Trophy,
  Zap,
} from 'lucide-react';
import { AREAS, areaById } from '../content/areas';
import { enemyById } from '../content/enemies';
import { itemById } from '../content/items';
import { GAME_CONFIG } from '../config/gameConfig';
import { getLevelProgress } from '../game/formulas/experienceFormulas';
import { getCombatStyleSkill } from '../game/formulas/combatFormulas';
import { getDerivedStats } from '../game/formulas/statFormulas';
import {
  displayDropChance,
  getCombatStyleInfo,
  getHealthPercent,
  getHealthState,
  getLootRarity,
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
import type {
  AreaId,
  CombatStyle,
  CombatVisualEvent,
  EnemyDefinition,
  EnemyId,
  GameState,
  ScreenId,
} from '../game/types';
import { ThreeScene } from '../three/ThreeScene';
import forestRatImage from '../Art/Monsters/ForestRat.png';
import type { ConfirmDialogOptions } from './ConfirmDialog';
import { ItemIcon } from './ItemIcon';

const formatSeconds = (ms: number): string => `${(ms / 1000).toFixed(1)}s`;
const formatNumber = (value: number): string =>
  new Intl.NumberFormat('en-US').format(Math.floor(value));
const formatDuration = (ms: number): string => {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

const zoneIcon = {
  target: Target,
  crystal: Gem,
  tree: TreePine,
};

const getEnemyGlyph = (theme: EnemyDefinition['theme']): string =>
  ({ rodent: '◒', goblin: '♟', bat: '⋈', crab: '⬢', wolf: '◇', bandit: '⚔' })[theme];

const getCombatantHp = (
  game: GameState,
  enemy: EnemyDefinition,
  events: CombatVisualEvent[] = [],
): number => {
  if (game.activeAction.type === 'combat' && game.activeAction.enemyId === enemy.id)
    return game.activeAction.combatState.enemyHp;
  const recentDefeat = [...events]
    .reverse()
    .find(
      (event) =>
        event.type === 'enemy-defeated' &&
        event.enemyId === enemy.id &&
        Date.now() - event.at < 2_500,
    );
  return recentDefeat ? 0 : enemy.maxHealth;
};

const getArmorTier = (game: GameState): 'none' | 'bronze' | 'iron' | 'steel' | 'mixed' => {
  const tiers = (['head', 'body', 'legs'] as const)
    .map((slot) => game.equipment[slot])
    .filter(Boolean)
    .map((id) => itemById[id as string]?.tier)
    .filter((tier): tier is 'bronze' | 'iron' | 'steel' => Boolean(tier));
  if (tiers.length === 0) return 'none';
  return tiers.every((tier) => tier === tiers[0]) ? tiers[0] : 'mixed';
};

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
  const percent = getHealthPercent(current, max);
  const state = getHealthState(current, max);
  const stateLabel =
    state === 'defeated'
      ? 'Defeated'
      : state === 'near-death'
        ? 'Near death'
        : state === 'critical'
          ? 'Critical health'
          : state === 'wounded'
            ? 'Wounded'
            : 'Healthy';
  return (
    <div className={`combat-health combat-health-${tone} health-state-${state}`}>
      <div className="combat-health-head">
        <span className="combat-health-label">
          {(state === 'critical' || state === 'near-death') && (
            <AlertTriangle size={13} aria-hidden="true" />
          )}
          {label}
        </span>
        <strong>
          {Math.ceil(Math.max(0, current))} / {max} HP · {percent}%
        </strong>
      </div>
      <div
        className="combat-health-track"
        role="progressbar"
        aria-label={`${label} health`}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.ceil(Math.max(0, current))}
        aria-valuetext={`${Math.ceil(Math.max(0, current))} of ${max} hit points, ${percent} percent, ${stateLabel}`}
      >
        <i style={{ width: `${percent}%` }} />
      </div>
      <small className="combat-health-state">{stateLabel}</small>
    </div>
  );
}

function AttackProgress({
  label,
  progress,
  tone,
}: {
  label: string;
  progress: ReturnType<typeof selectPlayerAttackProgress>;
  tone: 'player' | 'enemy';
}) {
  const statusLabel =
    progress.state === 'idle'
      ? 'Idle'
      : progress.state === 'ready'
        ? 'Ready'
        : progress.state === 'defeated'
          ? 'Defeated'
          : progress.state === 'respawning'
            ? 'Respawning'
            : `${formatSeconds(progress.timeUntilAttackMs)} remaining · ${formatSeconds(progress.intervalMs)} interval`;
  const timing =
    progress.state === 'active' || progress.state === 'ready'
      ? `${formatSeconds(progress.timeUntilAttackMs)} remaining · ${formatSeconds(progress.intervalMs)} interval`
      : statusLabel;
  return (
    <div className={`attack-progress attack-state-${progress.state}`}>
      <div className="attack-progress-head">
        <span className="attack-progress-label">
          {tone === 'player' ? (
            <Swords size={12} aria-hidden="true" />
          ) : (
            <Shield size={12} aria-hidden="true" />
          )}
          {label}
        </span>
        <span>{timing}</span>
      </div>
      <div
        className={`attack-progress-track ${tone}`}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress.ratio * 100)}
        aria-valuetext={`${statusLabel}, ${Math.round(progress.ratio * 100)} percent complete`}
      >
        <i style={{ width: `${progress.ratio * 100}%` }} />
      </div>
      <small className="attack-progress-state">{statusLabel}</small>
    </div>
  );
}

function StatLine({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="combat-stat-line" title={hint}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
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
  const combatLevel = getDerivedStats(game).combatLevel;
  const trainingKills =
    (game.killCounts['forest-rat'] ?? 0) + (game.killCounts['goblin-scavenger'] ?? 0);
  const copperKills = (game.killCounts['cave-bat'] ?? 0) + (game.killCounts['stoneback-crab'] ?? 0);
  return (
    <section className="combat-section zone-section" aria-labelledby="zone-selector-title">
      <div className="section-heading-row">
        <div>
          <div className="eyebrow">Choose your road</div>
          <h2 id="zone-selector-title">Combat zones</h2>
        </div>
        <span className="muted">Select a zone to inspect its targets.</span>
      </div>
      <div className="zone-scroller" role="listbox" aria-label="Combat zones">
        {AREAS.map((area) => {
          const unlocked = game.unlockedAreas.includes(area.id) || area.unlock(game);
          const selected = area.id === selectedArea;
          const kills = area.enemyIds.reduce(
            (sum, enemyId) => sum + (game.killCounts[enemyId] ?? 0),
            0,
          );
          const completed = unlocked && kills >= ZONE_COMPLETION_KILLS;
          const preview = enemyById[area.enemyIds[0]];
          const Icon = zoneIcon[area.presentation.iconKey];
          const requirement =
            area.id === 'copper-hills'
              ? `Combat level ${combatLevel}/5 or Training Grounds kills ${trainingKills}/5`
              : area.id === 'ironwood-pass'
                ? `Combat level ${combatLevel}/15 and Copper Hills kills ${copperKills}/8`
                : area.requirement;
          return (
            <button
              type="button"
              role="option"
              aria-selected={selected}
              className={`zone-card zone-theme-${area.presentation.theme} ${selected ? 'selected' : ''} ${!unlocked ? 'locked' : ''} ${completed ? 'completed' : ''}`}
              key={area.id}
              onClick={() => unlocked && onSelect(area.id)}
              disabled={!unlocked}
              title={!unlocked ? requirement : `Inspect ${area.name}`}
            >
              <div className="zone-pattern" aria-hidden="true" />
              <div className="zone-card-top">
                <span className="zone-mark">
                  <Icon size={18} />
                </span>
                <span
                  className={`status-pill ${selected ? 'selected' : !unlocked ? 'locked' : completed ? 'complete' : ''}`}
                >
                  {selected
                    ? 'Selected'
                    : !unlocked
                      ? 'Locked'
                      : completed
                        ? 'Completed'
                        : 'Available'}
                </span>
              </div>
              <strong>{area.name}</strong>
              <small>{area.description}</small>
              <div className="zone-card-meta">
                <span>
                  Recommended{' '}
                  <b>
                    {area.recommendedLevel[0]}–{area.recommendedLevel[1]}
                  </b>
                </span>
                <span>{area.enemyIds.length} enemies</span>
              </div>
              <div className="zone-card-progress">
                <div className="bar">
                  <i
                    style={{
                      width: `${Math.min(100, (kills / ZONE_COMPLETION_KILLS) * 100)}`,
                      background: area.accent,
                    }}
                  />
                </div>
                <small>
                  {kills} / {ZONE_COMPLETION_KILLS} kills
                </small>
              </div>
              {!unlocked ? (
                <div className="zone-requirement">
                  <Lock size={12} /> Requires: {requirement}
                </div>
              ) : (
                <div className="zone-drop-preview">First encounter: {preview.name}</div>
              )}
              {selected && selectedEnemy && area.enemyIds.includes(selectedEnemy) && (
                <Check className="zone-selected-check" size={16} />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function EquipmentStrip({ game }: { game: GameState }) {
  return (
    <div className="combat-equipment-strip">
      {(['weapon', 'shield', 'head', 'body', 'legs'] as const).map((slot) => {
        const itemId = game.equipment[slot];
        const item = itemId ? itemById[itemId] : undefined;
        return (
          <div
            className={`combat-equip-slot ${item ? 'filled' : ''}`}
            key={slot}
            title={item?.description ?? `${slot} slot`}
          >
            <span>{slot}</span>
            {item ? <ItemIcon itemId={item.id} size="xs" /> : <b>—</b>}
            <small>{item?.name ?? 'Empty'}</small>
          </div>
        );
      })}
    </div>
  );
}

function CombatFigure({ side, enemy }: { side: 'player' | 'enemy'; enemy: EnemyDefinition }) {
  const usesForestRatArt = side === 'enemy' && enemy.id === 'forest-rat';
  return (
    <div
      className={`combat-figure-wrap ${side}`}
      aria-label={side === 'player' ? 'Player combatant' : `${enemy.name} combatant`}
    >
      <div
        className={`combat-figure ${side} theme-${enemy.theme} ${usesForestRatArt ? 'asset-enemy' : ''}`}
      >
        <div className="figure-shadow" />
        {side === 'player' ? (
          <>
            <div className="figure-head" />
            <div className="figure-body" />
            <div className="figure-weapon" />
            <div className="figure-shield" />
          </>
        ) : usesForestRatArt ? (
          <img className="combat-enemy-art" src={forestRatImage} alt={`${enemy.name} combatant`} />
        ) : (
          <>
            <div className="figure-head enemy-head">{getEnemyGlyph(enemy.theme)}</div>
            <div className="figure-body enemy-body" />
            <div className="figure-weapon enemy-weapon" />
          </>
        )}
      </div>
      <span className="figure-name">{side === 'player' ? 'You' : enemy.name}</span>
    </div>
  );
}

function CombatPanel({
  game,
  enemy,
  side,
  playerProgress,
  enemyProgress,
  events,
}: {
  game: GameState;
  enemy: EnemyDefinition;
  side: 'player' | 'enemy';
  playerProgress: ReturnType<typeof selectPlayerAttackProgress>;
  enemyProgress: ReturnType<typeof selectEnemyAttackProgress>;
  events: CombatVisualEvent[];
}) {
  const stats = getDerivedStats(game);
  if (side === 'player') {
    return (
      <section className="combatant-panel player-panel" aria-labelledby="player-panel-title">
        <div className="combatant-heading">
          <div className="panel-avatar player-avatar">
            <Swords size={20} />
          </div>
          <div>
            <div className="eyebrow">Combatant</div>
            <h2 id="player-panel-title">{game.player.name}</h2>
            <span className="muted">Combat level {stats.combatLevel}</span>
          </div>
        </div>
        <HealthBar
          label="Player"
          current={game.player.currentHp}
          max={stats.maxHealth}
          tone="player"
        />
        <AttackProgress label="Your next attack" progress={playerProgress} tone="player" />
        <div className="combat-stat-grid">
          <StatLine
            label="Attack"
            value={stats.attack}
            hint="Attack level plus equipment bonuses"
          />
          <StatLine label="Maximum hit" value={stats.maxHit} />
          <StatLine
            label="Estimated DPS"
            value={selectPlayerEstimatedDps(game, enemy).toFixed(1)}
          />
          <StatLine label="Attack interval" value={formatSeconds(stats.attackIntervalMs)} />
          <StatLine label="Defence" value={stats.defence} />
        </div>
        <div className="panel-label">Equipped for battle</div>
        <EquipmentStrip game={game} />
        <div className="hp-note">
          <Heart size={13} /> Damage dealt grants combat-style XP and Hitpoints XP.
        </div>
      </section>
    );
  }
  const currentHp = getCombatantHp(game, enemy, events);
  return (
    <section className="combatant-panel enemy-panel" aria-labelledby="enemy-panel-title">
      <div className="combatant-heading">
        <div className={`panel-avatar enemy-avatar theme-${enemy.theme}`}>
          {enemy.id === 'forest-rat' ? (
            <img src={forestRatImage} alt="" />
          ) : (
            getEnemyGlyph(enemy.theme)
          )}
        </div>
        <div>
          <div className="eyebrow">{enemy.areaId.replaceAll('-', ' ')}</div>
          <h2 id="enemy-panel-title">{enemy.name}</h2>
          <span className="muted">Display level {enemy.displayLevel}</span>
        </div>
      </div>
      <HealthBar label={enemy.name} current={currentHp} max={enemy.maxHealth} tone="enemy" />
      <AttackProgress label="Enemy next attack" progress={enemyProgress} tone="enemy" />
      <div className="combat-stat-grid">
        <StatLine label="Maximum hit" value={enemy.maxHit} />
        <StatLine label="Estimated DPS" value={selectEnemyEstimatedDps(game, enemy).toFixed(1)} />
        <StatLine label="Attack interval" value={formatSeconds(enemy.attackIntervalMs)} />
        <StatLine label="Threat" value={selectAreaThreat(game, enemy)} />
      </div>
      <div className="enemy-tags">
        {(enemy.tags ?? []).map((tag) => (
          <span className="tag" key={tag}>
            {tag}
          </span>
        ))}
      </div>
      <div className="enemy-description">{enemy.description}</div>
      <div className="enemy-panel-footer">
        <span>
          <Trophy size={13} /> {game.killCounts[enemy.id] ?? 0} defeated
        </span>
        <span>
          {game.discoveredMonsters.includes(enemy.id) ? 'Encounter logged' : 'New encounter'}
        </span>
      </div>
    </section>
  );
}

const getRecentCombatMessage = (
  event: CombatVisualEvent | undefined,
  enemy: EnemyDefinition,
): string => {
  if (!event) return '';
  if (event.type === 'player-hit') return `You hit ${enemy.name} for ${event.damage}`;
  if (event.type === 'enemy-hit') return `${enemy.name} hit you for ${event.damage}`;
  if (event.type === 'enemy-defeated') return `${enemy.name} defeated`;
  if (event.type === 'player-defeated') return 'Your belongings are safe';
  if (event.type === 'loot')
    return event.items.length
      ? `Loot secured · ${event.items.length} drop${event.items.length === 1 ? '' : 's'}`
      : `+${event.gold} gold secured`;
  return '';
};

function BattleStateBanner({
  game,
  enemy,
  now,
  events,
}: {
  game: GameState;
  enemy: EnemyDefinition;
  now: number;
  events: CombatVisualEvent[];
}) {
  const active = game.activeAction.type === 'combat' ? game.activeAction : null;
  const session = useGameStore((store) => store.combatSession);
  const combatEvent = [...events]
    .reverse()
    .find((event) => event.enemyId === enemy.id && now - event.at < 1800);
  const recentOutcome = [...events]
    .reverse()
    .find(
      (event) =>
        event.enemyId === enemy.id &&
        now - event.at < 1800 &&
        (event.type === 'enemy-defeated' || event.type === 'player-defeated'),
    );
  const recentMessage = getRecentCombatMessage(combatEvent, enemy);
  const primary = active
    ? active.combatState.respawnMs > 0
      ? 'RESPAWNING'
      : active.combatState.enemyHp <= 0
        ? 'VICTORY'
        : game.player.currentHp <= 0
          ? 'DEFEATED'
          : 'FIGHTING'
    : recentOutcome?.type === 'enemy-defeated'
      ? 'VICTORY'
      : recentOutcome?.type === 'player-defeated'
        ? 'DEFEATED'
        : selectCombatStatus(game) === 'Inventory full'
          ? 'INVENTORY FULL'
          : session.enemyId === enemy.id && session.startedAt
            ? 'COMBAT STOPPED'
            : 'READY';
  const secondary =
    active && active.combatState.respawnMs > 0
      ? `Respawning in ${formatSeconds(active.combatState.respawnMs)}`
      : active && primary === 'FIGHTING'
        ? `Next player attack in ${formatSeconds(selectPlayerAttackProgress(game, now).timeUntilAttackMs)}`
        : primary === 'READY'
          ? `Ready to fight ${enemy.name}`
          : primary === 'COMBAT STOPPED'
            ? `Press Fight to resume against ${enemy.name}`
            : primary === 'INVENTORY FULL'
              ? 'Open Inventory to make room for rewards.'
              : primary === 'VICTORY'
                ? 'Victory secured'
                : primary === 'DEFEATED'
                  ? 'Recovering safely'
                  : '';
  return (
    <div
      className={`arena-state-banner arena-state-${primary.toLowerCase().replaceAll(' ', '-')}`}
      aria-live="polite"
    >
      <div className="arena-state-primary">
        {primary === 'VICTORY' ? (
          <Trophy size={15} />
        ) : primary === 'DEFEATED' ? (
          <Skull size={15} />
        ) : primary === 'INVENTORY FULL' ? (
          <PackageOpen size={15} />
        ) : (
          <Crosshair size={15} />
        )}
        {primary}
      </div>
      {recentMessage ? (
        <div className="arena-recent-action">{recentMessage}</div>
      ) : (
        <div className="arena-state-secondary">{secondary}</div>
      )}
      {recentMessage && <small>{secondary}</small>}
    </div>
  );
}

function BattleArena({
  game,
  areaId,
  enemy,
  now,
  events,
}: {
  game: GameState;
  areaId: AreaId;
  enemy: EnemyDefinition;
  now: number;
  events: CombatVisualEvent[];
}) {
  const area = areaById[areaId];
  const playerProgress = selectPlayerAttackProgress(game, now);
  const enemyProgress = selectEnemyAttackProgress(game, now);
  const active = game.activeAction.type === 'combat' && game.activeAction.enemyId === enemy.id;
  const visibleEvents = events
    .filter((event) => event.enemyId === enemy.id && now - event.at < 1800)
    .slice(-8);
  const recentEvent = visibleEvents.at(-1);
  const weaponTier = game.equipment.weapon
    ? (itemById[game.equipment.weapon]?.tier ?? 'none')
    : 'none';
  const shieldTier = game.equipment.shield
    ? (itemById[game.equipment.shield]?.tier ?? 'none')
    : 'none';
  return (
    <section
      className={`battle-arena ${active ? 'is-active' : ''} ${recentEvent ? `event-${recentEvent.type}` : ''}`}
      aria-label="Real-time battle arena"
    >
      <ThreeScene
        screen="combat"
        settings={game.settings}
        theme={area.accent}
        enemyTheme={enemy.theme}
        enemyPresentation={enemy.presentation}
        combatActive={active}
        playerWeaponTier={weaponTier}
        playerShieldTier={shieldTier}
        playerArmorTier={getArmorTier(game)}
        playerHasHelmet={Boolean(game.equipment.head)}
        playerHasBodyArmor={Boolean(game.equipment.body)}
        playerHasLegArmor={Boolean(game.equipment.legs)}
        playerHasShield={Boolean(game.equipment.shield)}
      />
      <div className="arena-side-label arena-side-player">
        <Swords size={12} /> PLAYER
      </div>
      <div className="arena-side-label arena-side-enemy">
        ENEMY <Shield size={12} />
      </div>
      <div className="arena-topline">
        <span className="arena-zone-dot" style={{ background: area.accent }} />
        {area.name}
        <span className="arena-divider">·</span>
        {enemy.name}
        <span className="arena-threat">{selectAreaThreat(game, enemy)}</span>
      </div>
      <div className="arena-combatants">
        <CombatFigure side="player" enemy={enemy} />
        <div className="arena-center">
          <BattleStateBanner game={game} enemy={enemy} now={now} events={events} />
          <div className="arena-divider-mark" aria-hidden="true" />
        </div>
        <CombatFigure side="enemy" enemy={enemy} />
      </div>
      <div className="arena-health-row">
        <HealthBar
          label="Player"
          current={game.player.currentHp}
          max={getDerivedStats(game).maxHealth}
          tone="player"
        />
        <HealthBar
          label={enemy.name}
          current={getCombatantHp(game, enemy, events)}
          max={enemy.maxHealth}
          tone="enemy"
        />
      </div>
      <div className="arena-floating-events" aria-live="polite">
        {visibleEvents.map((event) => (
          <span
            className={`floating-event ${event.type} ${event.type === 'player-hit' ? 'near-enemy' : event.type === 'enemy-hit' ? 'near-player' : 'center-event'}`}
            key={event.id}
          >
            {event.type === 'enemy-defeated'
              ? 'Defeated'
              : event.type === 'player-defeated'
                ? 'Down'
                : event.type === 'loot'
                  ? 'Loot!'
                  : 'damage' in event
                    ? `-${event.damage}`
                    : 'Event'}
          </span>
        ))}
      </div>
      <div className="arena-progress-row">
        <AttackProgress label="Your next attack" progress={playerProgress} tone="player" />
        <AttackProgress label="Enemy next attack" progress={enemyProgress} tone="enemy" />
      </div>
    </section>
  );
}

function StyleControls({
  style,
  onChange,
}: {
  style: CombatStyle;
  onChange: (style: CombatStyle) => void;
}) {
  return (
    <section className="combat-section style-section" aria-labelledby="style-title">
      <div className="section-heading-row">
        <div>
          <div className="eyebrow">Choose how you train</div>
          <h2 id="style-title">Combat style</h2>
        </div>
        <span className="muted">Updates live during combat.</span>
      </div>
      <div className="style-grid">
        {(['accurate', 'aggressive', 'defensive'] as CombatStyle[]).map((option) => {
          const info = getCombatStyleInfo(option);
          return (
            <button
              type="button"
              className={`style-card ${style === option ? 'selected' : ''}`}
              aria-pressed={style === option}
              key={option}
              onClick={() => onChange(option)}
            >
              <span className="style-icon">
                {option === 'accurate' ? (
                  <Crosshair size={18} />
                ) : option === 'aggressive' ? (
                  <Zap size={18} />
                ) : (
                  <Shield size={18} />
                )}
              </span>
              <strong>{info.name}</strong>
              <small>{info.skill}</small>
              <span>{info.benefit}</span>
              <em>{info.modifier}</em>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function EnemyRoster({
  game,
  areaId,
  selectedEnemy,
  activeEnemy,
  onSelect,
}: {
  game: GameState;
  areaId: AreaId;
  selectedEnemy: EnemyId;
  activeEnemy: EnemyId | null;
  onSelect: (enemyId: EnemyId) => void;
}) {
  const area = areaById[areaId];
  return (
    <section className="combat-section roster-section" aria-labelledby="roster-title">
      <div className="section-heading-row">
        <div>
          <div className="eyebrow">Know your enemy</div>
          <h2 id="roster-title">{area.name} roster</h2>
        </div>
        <span className="muted">Review the threat, then select or switch targets.</span>
      </div>
      <div className="enemy-roster">
        {area.enemyIds.map((enemyId) => {
          const enemy = enemyById[enemyId];
          const selected = enemyId === selectedEnemy;
          const fighting = enemyId === activeEnemy;
          const discovered = game.discoveredMonsters.includes(enemyId);
          const kills = game.killCounts[enemyId] ?? 0;
          const status = fighting
            ? 'Fighting'
            : selected
              ? 'Selected'
              : kills > 0
                ? 'Defeated before'
                : 'New';
          const action = fighting
            ? 'Fighting'
            : selected
              ? 'Selected'
              : activeEnemy
                ? 'Switch target'
                : 'Select';
          return (
            <button
              type="button"
              className={`enemy-roster-card enemy-state-${status.toLowerCase().replaceAll(' ', '-')} ${selected ? 'selected' : ''} ${fighting ? 'fighting' : ''}`}
              aria-pressed={selected}
              aria-label={`${action} ${enemy.name}, level ${enemy.displayLevel}`}
              key={enemyId}
              onClick={() => onSelect(enemyId)}
            >
              <div className={`roster-portrait theme-${enemy.theme}`}>
                {enemy.id === 'forest-rat' ? (
                  <img src={forestRatImage} alt="" />
                ) : (
                  getEnemyGlyph(enemy.theme)
                )}
              </div>
              <div className="roster-copy">
                <div className="roster-title">
                  <strong>{enemy.name}</strong>
                  <span className="badge">Lv {enemy.displayLevel}</span>
                  <span className="status-pill">{status}</span>
                </div>
                <p>{enemy.description}</p>
                <div className="roster-stats">
                  <span>{enemy.maxHealth} HP</span>
                  <span>{enemy.maxHit} max hit</span>
                  <span>{formatSeconds(enemy.attackIntervalMs)}</span>
                  <span>{selectAreaThreat(game, enemy)}</span>
                  <span>{kills} kills</span>
                </div>
                <div className="roster-drops">
                  <span>Drops</span>
                  {enemy.loot.slice(0, 3).map((drop) => (
                    <ItemIcon
                      itemId={drop.itemId}
                      discovered={discovered || game.discoveredItems.includes(drop.itemId)}
                      size="xs"
                      key={drop.itemId}
                    />
                  ))}
                </div>
              </div>
              <span className="roster-action-label">
                {action}
                <ChevronRight size={15} />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function LootPanel({
  game,
  enemy,
  events,
}: {
  game: GameState;
  enemy: EnemyDefinition;
  events: CombatVisualEvent[];
}) {
  const recentLoot = events
    .filter(
      (event): event is Extract<CombatVisualEvent, { type: 'loot' }> =>
        event.type === 'loot' && event.enemyId === enemy.id,
    )
    .slice(-4)
    .reverse();
  return (
    <section className="combat-section loot-panel" aria-labelledby="loot-title">
      <div className="section-heading-row">
        <div>
          <div className="eyebrow">What the road gives back</div>
          <h2 id="loot-title">Loot table</h2>
        </div>
        <span className="muted">
          {game.discoveredMonsters.includes(enemy.id)
            ? 'Encounter discovered'
            : 'Discover drops by fighting'}
        </span>
      </div>
      <div className="loot-table">
        <div className="loot-row loot-head">
          <span>Item</span>
          <span>Quantity</span>
          <span>Chance</span>
          <span>Owned</span>
        </div>
        {enemy.loot.map((drop) => {
          const item = itemById[drop.itemId];
          const discovered = game.discoveredItems.includes(drop.itemId);
          const rarity = getLootRarity(drop.chance);
          return (
            <div className="loot-row" key={drop.itemId}>
              <span className="loot-item">
                <ItemIcon itemId={drop.itemId} discovered={discovered} size="sm" />
                <span className="loot-item-copy">
                  <b>{discovered ? item?.name : '???'}</b>
                  <small
                    className={`loot-rarity loot-rarity-${rarity.toLowerCase().replace(' ', '-')}`}
                  >
                    {rarity}
                  </small>
                </span>
              </span>
              <span>
                {drop.min}–{drop.max}
              </span>
              <span className="loot-chance">{displayDropChance(drop.chance)}</span>
              <span>{getItemQuantity(game.inventory, drop.itemId)}</span>
            </div>
          );
        })}
        <div className="loot-row gold-row">
          <span className="loot-item">
            <ItemIcon gold size="sm" />
            <span className="loot-item-copy">
              <b>Gold</b>
              <small className="loot-rarity loot-rarity-common">Guaranteed</small>
            </span>
          </span>
          <span>
            {enemy.gold[0]}–{enemy.gold[1]}
          </span>
          <span className="loot-chance">Guaranteed</span>
          <span>{formatNumber(game.gold)}</span>
        </div>
      </div>
      <div className="recent-loot">
        <div className="panel-label">Recent rewards</div>
        {recentLoot.length ? (
          recentLoot.map((event) => (
            <div className="recent-loot-event" key={event.id}>
              <div className="recent-loot-event-head">
                <Trophy size={12} /> <strong>Victory reward</strong>
                <time>
                  {new Date(event.at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </time>
              </div>
              {event.gold > 0 && (
                <div className="recent-loot-row">
                  <ItemIcon gold size="xs" />+{event.gold} Gold
                </div>
              )}
              {event.items.map((item) => (
                <div className="recent-loot-row" key={`${event.id}-${item.itemId}`}>
                  <ItemIcon
                    itemId={item.itemId}
                    discovered={game.discoveredItems.includes(item.itemId)}
                    size="xs"
                  />
                  +{item.quantity} {itemById[item.itemId]?.name ?? item.itemId}
                  {game.discoveredItems.includes(item.itemId) && (
                    <span className="discovery-note">· discovered</span>
                  )}
                </div>
              ))}
            </div>
          ))
        ) : (
          <span className="muted">Rewards from this enemy will appear here.</span>
        )}
      </div>
    </section>
  );
}

const getNextUnlockText = (game: GameState): { name: string; requirement: string } => {
  const combatLevel = getDerivedStats(game).combatLevel;
  const trainingKills =
    (game.killCounts['forest-rat'] ?? 0) + (game.killCounts['goblin-scavenger'] ?? 0);
  const copperKills = (game.killCounts['cave-bat'] ?? 0) + (game.killCounts['stoneback-crab'] ?? 0);
  if (!game.unlockedAreas.includes('copper-hills'))
    return {
      name: 'Copper Hills',
      requirement: `Combat level ${combatLevel}/5 or Training Grounds kills ${trainingKills}/5`,
    };
  if (!game.unlockedAreas.includes('ironwood-pass'))
    return {
      name: 'Ironwood Pass',
      requirement: `Combat level ${combatLevel}/15 and Copper Hills kills ${copperKills}/8`,
    };
  return {
    name: 'All current zones unlocked',
    requirement: 'Keep training for the next content pass.',
  };
};

function ProgressionPanel({
  game,
  session,
  style,
}: {
  game: GameState;
  session: ReturnType<typeof useGameStore.getState>['combatSession'];
  style: CombatStyle;
}) {
  const skills = ['attack', 'strength', 'defence', 'hitpoints'] as const;
  const started = session.startedAt ? Math.max(1_000, Date.now() - session.startedAt) : 0;
  const totalXp = Object.values(session.xpGained).reduce((sum, amount) => sum + (amount ?? 0), 0);
  const selectedSkill = getCombatStyleSkill(style);
  const selectedXpHour = started
    ? ((session.xpGained[selectedSkill] ?? 0) * 3_600_000) / started
    : 0;
  const killsHour = started ? (session.enemiesDefeated * 3_600_000) / started : 0;
  const unlock = getNextUnlockText(game);
  return (
    <section className="combat-section progression-panel" aria-labelledby="progression-title">
      <div className="section-heading-row">
        <div>
          <div className="eyebrow">The long game</div>
          <h2 id="progression-title">Combat progression</h2>
        </div>
        <span className="muted">Current session</span>
      </div>
      <div className="training-focus">
        <ArrowUpRight size={15} />
        <div>
          <span>Training</span>
          <strong>
            {selectedSkill[0].toUpperCase() + selectedSkill.slice(1)} ·{' '}
            {formatNumber(session.xpGained[selectedSkill] ?? 0)} XP this session
          </strong>
        </div>
        <small>{formatNumber(selectedXpHour)} XP/hour</small>
      </div>
      <div className="xp-grid">
        {skills.map((skill) => {
          const progress = getLevelProgress(game.skills[skill]);
          return (
            <div className="xp-row" key={skill}>
              <div className="xp-label">
                <span>{skill[0].toUpperCase() + skill.slice(1)}</span>
                <b>Lv {game.skills[skill].level}</b>
              </div>
              <div className="bar">
                <i style={{ width: `${progress.percent}%` }} />
              </div>
              <small>
                {formatNumber(progress.current)} / {progress.next || 'MAX'} XP
                {session.xpGained[skill]
                  ? ` · +${formatNumber(session.xpGained[skill] ?? 0)} session`
                  : ''}
              </small>
            </div>
          );
        })}
      </div>
      <div className="session-stats">
        <div>
          <b>{formatDuration(started)}</b>
          <span>session duration</span>
        </div>
        <div>
          <b>{formatNumber(session.enemiesDefeated)}</b>
          <span>kills · {formatNumber(killsHour)}/hr</span>
        </div>
        <div>
          <b>{formatNumber(totalXp)}</b>
          <span>XP gained</span>
        </div>
        <div>
          <b>{formatNumber(session.goldGained)}</b>
          <span>gold gained</span>
        </div>
      </div>
      <div className="next-unlock">
        <div>
          <span className="panel-label">Next unlock</span>
          <strong>{unlock.name}</strong>
        </div>
        <small>{unlock.requirement}</small>
      </div>
    </section>
  );
}

type LogFilter = 'all' | 'damage' | 'loot' | 'progression' | 'system';
const getLogPresentation = (
  text: string,
  tone: GameState['log'][number]['tone'],
): { category: string; label: string; icon: typeof Sword; important: boolean } => {
  const lower = text.toLowerCase();
  if (lower.includes('defeated'))
    return { category: 'defeat', label: 'Defeat', icon: Skull, important: true };
  if (lower.includes('received') || lower.includes('gold'))
    return { category: 'loot', label: 'Loot', icon: Sparkles, important: tone === 'success' };
  if (lower.includes('reached level'))
    return { category: 'level', label: 'Level', icon: ArrowUpRight, important: true };
  if (lower.includes('accessible'))
    return { category: 'unlock', label: 'Unlock', icon: Trophy, important: true };
  if (lower.includes('discovered') || lower.includes('collection'))
    return { category: 'discovery', label: 'Discovery', icon: Gem, important: true };
  if (lower.includes('hit'))
    return {
      category: tone === 'danger' ? 'enemy-hit' : 'player-hit',
      label: 'Damage',
      icon: Sword,
      important: false,
    };
  if (lower.includes('inventory') || lower.includes('save') || lower.includes('stopped'))
    return { category: 'warning', label: 'System', icon: AlertTriangle, important: true };
  return { category: 'system', label: 'System', icon: Clock3, important: false };
};

function CombatLog({ game }: { game: GameState }) {
  const [filter, setFilter] = useState<LogFilter>('all');
  const entries = useMemo(
    () =>
      game.log
        .filter((entry) => {
          const category = getLogPresentation(entry.text, entry.tone).category;
          if (filter === 'all') return true;
          if (filter === 'damage') return category === 'player-hit' || category === 'enemy-hit';
          if (filter === 'loot') return category === 'loot';
          if (filter === 'progression') return ['level', 'unlock', 'discovery'].includes(category);
          return ['system', 'warning', 'defeat'].includes(category);
        })
        .slice(0, 50),
    [game.log, filter],
  );
  return (
    <section className="combat-section log-panel" aria-labelledby="combat-log-title">
      <div className="section-heading-row">
        <div>
          <div className="eyebrow">Readable feedback</div>
          <h2 id="combat-log-title">Combat log</h2>
        </div>
        <span className="muted">Latest {entries.length} of 50 entries</span>
      </div>
      <div className="log-filters" role="group" aria-label="Combat log filters">
        {(['all', 'damage', 'loot', 'progression', 'system'] as LogFilter[]).map((option) => (
          <button
            type="button"
            className={filter === option ? 'active' : ''}
            aria-pressed={filter === option}
            key={option}
            onClick={() => setFilter(option)}
          >
            {option}
          </button>
        ))}
      </div>
      <div className="combat-log" aria-live="polite">
        {entries.length ? (
          entries.map((entry) => {
            const presentation = getLogPresentation(entry.text, entry.tone);
            const Icon = presentation.icon;
            return (
              <div
                className={`combat-log-entry ${entry.tone} log-category-${presentation.category} ${presentation.important ? 'important' : ''}`}
                key={entry.id}
              >
                <time>
                  {new Date(entry.at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </time>
                <span className="log-entry-icon">
                  <Icon size={12} />
                </span>
                <b className="log-entry-label">{presentation.label}</b>
                <span>{entry.text}</span>
              </div>
            );
          })
        ) : (
          <span className="muted">No entries in this filter yet.</span>
        )}
      </div>
    </section>
  );
}

export function CombatScreen({
  game,
  requestAction,
  requestConfirmation,
  onNavigate,
}: {
  game: GameState;
  requestAction: (screen: ScreenId, action: () => void) => void;
  requestConfirmation: (options: ConfirmDialogOptions) => void;
  onNavigate: (screen: ScreenId) => void;
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
  const progress = selectCombatProgress(game);
  const inventoryFull = occupiedSlots(game.inventory) >= GAME_CONFIG.inventorySlots;
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (active) {
      setSelectedArea(active.areaId);
      setSelectedEnemy(active.enemyId);
      setStyle(active.style);
      setAutoRepeat(active.autoRepeat);
    }
  }, [active]);
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
  const changeStyle = (next: CombatStyle) => {
    setStyle(next);
    if (active) setCombatStyle(next);
  };
  const beginFight = () =>
    requestAction('combat', () => startCombat(currentAreaId, currentEnemyId, style, autoRepeat));
  const actionText = locked
    ? 'Target locked'
    : inventoryFull && !active
      ? 'Inventory full'
      : active
        ? 'Stop combat'
        : 'Fight';
  const actionDisabled = locked || (!active && inventoryFull);
  return (
    <div className={`combat-screen ${game.settings.reducedMotion ? 'reduced-motion' : ''}`}>
      <div className="combat-header">
        <div>
          <div className="eyebrow">World · Live encounter</div>
          <h1>Combat</h1>
          <p className="subtle">
            Read the rhythm of the fight, tune your style, and let the frontier keep time.
          </p>
        </div>
        <div className="combat-header-actions">
          <div className="combat-level-badge">
            <span>Combat level</span>
            <strong>{stats.combatLevel}</strong>
          </div>
          <label className="auto-repeat-toggle">
            <input
              type="checkbox"
              checked={active?.autoRepeat ?? autoRepeat}
              onChange={(event) => {
                setAutoRepeat(event.target.checked);
                if (active) setCombatAutoRepeat(event.target.checked);
              }}
            />{' '}
            <span>Auto Repeat</span>
          </label>
          <button
            type="button"
            aria-label={actionText}
            className={`button ${active ? 'danger' : 'primary'} combat-main-action`}
            disabled={actionDisabled}
            title={
              actionDisabled
                ? locked
                  ? currentArea.requirement
                  : 'Your inventory is full. Open Inventory to continue.'
                : `${actionText} ${currentEnemy.name}`
            }
            onClick={active ? stopAction : beginFight}
          >
            {active ? <CircleStop size={17} /> : <Swords size={17} />}
            {actionText}
            <small>
              {!active && !locked && !inventoryFull
                ? currentEnemy.name
                : active
                  ? currentEnemy.name
                  : ''}
            </small>
          </button>
          {inventoryFull && !active && (
            <button
              type="button"
              className="button ghost inventory-shortcut"
              onClick={() => onNavigate('inventory')}
            >
              <PackageOpen size={14} /> Open Inventory
            </button>
          )}
        </div>
      </div>
      <div className="combat-context-bar">
        <span className="context-item">
          <span className="context-kicker">Zone</span>
          <b>{currentArea.name}</b>
        </span>
        <ChevronRight size={15} />
        <span className="context-item">
          <span className="context-kicker">Target</span>
          <b>{currentEnemy.name}</b>
        </span>
        <span
          className={`combat-status status-${selectCombatStatus(game).toLowerCase().replaceAll(' ', '-')}`}
        >
          {active
            ? selectCombatStatus(game)
            : locked
              ? 'Target locked'
              : inventoryFull
                ? 'Inventory full'
                : 'Ready'}
        </span>
        <span className="context-spacer" />
        <span className="muted">
          {progress.killed} / {progress.target} zone kills
        </span>
      </div>
      <ZoneSelector
        game={game}
        selectedArea={selectedArea}
        selectedEnemy={selectedEnemy}
        onSelect={selectArea}
      />
      <EnemyRoster
        game={game}
        areaId={currentAreaId}
        selectedEnemy={selectedEnemy}
        activeEnemy={active?.enemyId ?? null}
        onSelect={selectEnemy}
      />
      <div className="battle-layout">
        <CombatPanel
          game={game}
          enemy={currentEnemy}
          side="player"
          playerProgress={selectPlayerAttackProgress(game, now)}
          enemyProgress={selectEnemyAttackProgress(game, now)}
          events={events}
        />
        <BattleArena
          game={game}
          areaId={currentAreaId}
          enemy={currentEnemy}
          now={now}
          events={events}
        />
        <CombatPanel
          game={game}
          enemy={currentEnemy}
          side="enemy"
          playerProgress={selectPlayerAttackProgress(game, now)}
          enemyProgress={selectEnemyAttackProgress(game, now)}
          events={events}
        />
      </div>
      <div className="combat-detail-grid">
        <div>
          <StyleControls style={active?.style ?? style} onChange={changeStyle} />
          <ProgressionPanel game={game} session={session} style={active?.style ?? style} />
        </div>
        <div>
          <LootPanel game={game} enemy={currentEnemy} events={events} />
          <CombatLog game={game} />
        </div>
      </div>
      <div className="combat-footnote">
        <Timer size={13} /> Timers are simulation-driven; presentation interpolates between
        authoritative ticks.{' '}
        <span className="muted">
          {game.settings.reducedMotion
            ? 'Reduced motion enabled.'
            : 'Animations can be reduced in Settings.'}
        </span>
      </div>
    </div>
  );
}
