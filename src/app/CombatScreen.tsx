import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  CircleStop,
  Clock3,
  Crosshair,
  Gem,
  Lock,
  PackageOpen,
  Shield,
  Skull,
  Sparkles,
  Sword,
  Swords,
  Settings2,
  Target,
  Timer,
  TreePine,
  Trophy,
  UserRound,
  Zap,
} from 'lucide-react';
import { AREAS, areaById } from '../content/areas';
import { enemyById } from '../content/enemies';
import { eliteById } from '../content/elites';
import { itemById } from '../content/items';
import { GAME_CONFIG } from '../config/gameConfig';
import { getCombatDamageXp, getCombatStyleSkill } from '../game/formulas/combatFormulas';
import { getLevelProgress } from '../game/formulas/experienceFormulas';
import { getDerivedStats } from '../game/formulas/statFormulas';
import { getEnemyCombatStats } from '../game/formulas/combatStats';
import {
  displayDropChance,
  getCombatStyleInfo,
  getHealthPercent,
  getHealthState,
  getLootRarity,
  selectCombatProgress,
  selectCombatStatus,
  selectEnemyAttackProgress,
  selectEnemyEstimatedDps,
  selectEnemyHitChance,
  selectEstimatedKillTimeMs,
  selectExpectedKillsPerHour,
  selectPlayerHitChance,
  selectTargetTrait,
  selectPlayerAttackProgress,
  selectPlayerEstimatedDps,
  ZONE_COMPLETION_KILLS,
} from '../game/selectors/combatSelectors';
import { useGameStore } from '../game/state/gameStore';
import { getItemQuantity, occupiedSlots } from '../game/systems/inventorySystem';
import type {
  AreaId,
  CombatSessionStats,
  CombatStyle,
  CombatVisualEvent,
  EnemyDefinition,
  EnemyId,
  GameState,
  ScreenId,
} from '../game/types';
import forestRatImage from '../Art/Monsters/ForestRat.png';
import type { ConfirmDialogOptions } from './ConfirmDialog';
import { ItemIcon } from './ItemIcon';

type CombatContentTab = 'areas' | 'dungeons' | 'slayer';
type OverviewTab = 'overview' | 'loot' | 'progression';

const formatSeconds = (ms: number): string => `${(ms / 1000).toFixed(1)}s`;
const formatNumber = (value: number): string =>
  new Intl.NumberFormat('en-US').format(Math.floor(value));
const formatDuration = (ms: number): string => {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};
const formatCombatLogTime = (at: number, startedAt: number | null): string =>
  formatDuration(startedAt === null ? 0 : Math.max(0, at - startedAt));

const zoneIcon = {
  target: Target,
  crystal: Gem,
  tree: TreePine,
};

const enemyGlyph: Record<EnemyDefinition['theme'], string> = {
  rodent: '◒',
  goblin: '♟',
  bat: '⋈',
  crab: '⬢',
  wolf: '◇',
  bandit: '⚔',
};

const getCombatantHp = (
  game: GameState,
  enemy: EnemyDefinition,
  events: CombatVisualEvent[],
  now: number,
): number => {
  if (game.activeAction.type === 'combat' && game.activeAction.enemyId === enemy.id)
    return game.activeAction.combatState.enemyHp;
  const recentDefeat = [...events]
    .reverse()
    .find(
      (event) =>
        event.type === 'enemy-defeated' && event.enemyId === enemy.id && now - event.at < 2_500,
    );
  return recentDefeat ? 0 : enemy.maxHealth;
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
  return (
    <div className={`combat-health combat-health-${tone} health-state-${state}`}>
      <div className="combat-health-head">
        <span className="combat-health-label">
          {(state === 'critical' || state === 'near-death') && (
            <AlertTriangle size={13} aria-hidden="true" />
          )}
          {label}
          <span className="combat-health-separator" aria-hidden="true">
            —
          </span>
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
        aria-valuetext={`${Math.ceil(Math.max(0, current))} of ${max} hit points`}
      >
        <i style={{ width: `${percent}%` }} />
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
  progress: ReturnType<typeof selectPlayerAttackProgress>;
  tone: 'player' | 'enemy';
}) {
  const statusLabel =
    progress.state === 'idle' || progress.state === 'ready'
      ? 'Ready'
      : progress.state === 'defeated'
        ? 'Defeated'
        : progress.state === 'respawning'
          ? 'Respawning'
          : formatSeconds(progress.timeUntilAttackMs);
  return (
    <div className={`attack-progress attack-state-${progress.state}`}>
      <div className="attack-progress-head">
        <span className="attack-progress-label">
          {label}
          <span className="attack-progress-separator" aria-hidden="true">
            —
          </span>
        </span>
        <span>{statusLabel}</span>
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

function CombatPortrait({ enemy, large = false }: { enemy: EnemyDefinition; large?: boolean }) {
  const usesForestRatArt = enemy.id === 'forest-rat';
  return (
    <div
      className={`combat-portrait theme-${enemy.theme} ${large ? 'combat-portrait-large' : ''}`}
      role="img"
      aria-label={`${enemy.name} portrait`}
    >
      {usesForestRatArt ? <img src={forestRatImage} alt="" /> : enemyGlyph[enemy.theme]}
    </div>
  );
}

function EquipmentStrip({ game }: { game: GameState }) {
  const slots = ['weapon', 'head', 'body', 'legs', 'shield'] as const;
  return (
    <div className="combat-equipment-strip" aria-label="Equipped items">
      {slots.map((slot) => {
        const itemId = game.equipment[slot];
        const item = itemId ? itemById[itemId] : undefined;
        const label = slot === 'head' ? 'Helmet' : slot[0].toUpperCase() + slot.slice(1);
        return (
          <div className={`combat-equip-slot ${item ? 'filled' : ''}`} key={slot}>
            <span>{label}</span>
            {item ? <ItemIcon itemId={item.id} size="xs" /> : <b>—</b>}
            <small title={item?.name}>{item?.name ?? 'Empty'}</small>
          </div>
        );
      })}
    </div>
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
    <div className="combat-style-block">
      <div className="combat-subheading-row">
        <span className="combat-panel-kicker">Combat style</span>
      </div>
      <div className="combat-style-list" role="group" aria-label="Combat style">
        {(['accurate', 'aggressive', 'defensive'] as CombatStyle[]).map((option) => {
          const info = getCombatStyleInfo(option);
          return (
            <button
              type="button"
              className={`combat-style-option ${style === option ? 'selected' : ''}`}
              aria-pressed={style === option}
              key={option}
              onClick={() => onChange(option)}
            >
              <span className="combat-style-option-icon">
                {option === 'accurate' ? (
                  <Crosshair size={14} />
                ) : option === 'aggressive' ? (
                  <Zap size={14} />
                ) : (
                  <Shield size={14} />
                )}
              </span>
              <span>
                <strong>{info.name}</strong>
                <small>{info.modifier}</small>
              </span>
              {style === option && <Check size={14} aria-label="Selected" />}
            </button>
          );
        })}
      </div>
      <p className="combat-style-description">
        {getCombatStyleInfo(style).benefit}. Hitpoints always gains 1 XP per damage.
      </p>
    </div>
  );
}

function PlayerSummaryPanel({
  game,
  enemy,
  style,
  onStyleChange,
  onNavigate,
}: {
  game: GameState;
  enemy: EnemyDefinition;
  style: CombatStyle;
  onStyleChange: (style: CombatStyle) => void;
  onNavigate: (screen: ScreenId) => void;
}) {
  const stats = getDerivedStats(game, style);
  return (
    <section className="combat-dashboard-panel combat-player-panel" aria-labelledby="player-title">
      <div className="combat-panel-heading">
        <div className="combat-panel-kicker">Player</div>
        <div className="combat-player-heading-line">
          <div className="combat-player-portrait" aria-hidden="true">
            <UserRound size={25} />
          </div>
          <div>
            <h2 id="player-title">{game.player.name}</h2>
            <span className="muted">Combat level {stats.combatLevel}</span>
          </div>
        </div>
      </div>
      <div className="combat-panel-divider" />
      <div className="combat-panel-kicker">Equipment</div>
      <EquipmentStrip game={game} />
      <StyleControls style={style} onChange={onStyleChange} />
      <div className="combat-subheading-row">
        <span className="combat-panel-kicker">Derived stats</span>
        <button type="button" className="combat-text-link" onClick={() => onNavigate('equipment')}>
          Full character statistics <ArrowUpRight size={13} />
        </button>
      </div>
      <div className="combat-stats-grid">
        <StatLine label="Accuracy" value={Math.round(stats.effectiveAccuracyRating)} />
        <StatLine label="Damage" value={`1–${stats.effectiveMaxHit}`} />
        <StatLine label="Defence" value={Math.round(stats.effectiveDefenceRating)} />
        <StatLine label="Attack speed" value={formatSeconds(stats.attackIntervalMs)} />
      </div>
      <span className="sr-only">Current target: {enemy.name}</span>
    </section>
  );
}

function EnemySummaryPanel({
  game,
  enemy,
  onViewLoot,
}: {
  game: GameState;
  enemy: EnemyDefinition;
  onViewLoot: () => void;
}) {
  const [combatDetailsExpanded, setCombatDetailsExpanded] = useState(false);
  const active = game.activeAction.type === 'combat' && game.activeAction.enemyId === enemy.id
    ? game.activeAction
    : null;
  const enemyStats = getEnemyCombatStats(
    enemy,
    active?.combatState.eliteModifier ?? null,
    active?.combatState.enemyHp ?? enemy.maxHealth,
  );
  const baseEnemyDps = ((1 + enemyStats.maxHit) / 2) / Math.max(0.001, enemyStats.attackIntervalMs / 1000);
  const discovered = game.discoveredMonsters.includes(enemy.id);
  return (
    <section className="combat-dashboard-panel combat-enemy-panel" aria-labelledby="enemy-title">
      <div className="combat-panel-heading">
        <div className="combat-panel-kicker">Enemy</div>
        <div className="combat-enemy-heading-line">
          <CombatPortrait enemy={enemy} large />
          <div>
            <h2 id="enemy-title">{enemy.name}</h2>
            <span className="muted">
              Level {enemy.displayLevel} · {enemy.tags?.[0] ?? 'Unknown type'}
            </span>
            {active?.combatState.eliteModifier && (
              <div className="badge gold" aria-label="Elite enemy">
                ELITE · {eliteById[active.combatState.eliteModifier].name}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="combat-enemy-tags">
        {(enemy.tags ?? []).map((tag) => (
          <span className="combat-tag" key={tag}>
            {tag}
          </span>
        ))}
      </div>
      <p className="combat-enemy-description">{enemy.description}</p>
      <div className="combat-subheading-row">
        <span className="combat-panel-kicker">Combat details</span>
        <div className="combat-disclosure-actions">
          <span className="combat-enemy-discovery">
            {discovered ? 'Encounter logged' : 'Undiscovered'}
          </span>
          <button
            type="button"
            className="combat-locations-toggle"
            aria-expanded={combatDetailsExpanded}
            aria-controls="enemy-combat-details"
            onClick={() => setCombatDetailsExpanded((expanded) => !expanded)}
          >
            {combatDetailsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {combatDetailsExpanded ? 'Collapse' : 'Expand'}
          </button>
        </div>
      </div>
      <div id="enemy-combat-details" className="combat-stats-grid combat-enemy-details" hidden={!combatDetailsExpanded}>
        <StatLine label="Accuracy" value={enemyStats.accuracyRating} />
        <StatLine label="Defence" value={enemyStats.defenceRating} />
        <StatLine label="Maximum hit" value={enemyStats.maxHit} />
        <StatLine label="Attack interval" value={formatSeconds(enemyStats.attackIntervalMs)} />
        <StatLine label="Base DPS" value={baseEnemyDps.toFixed(1)} />
      </div>
      <div className="combat-panel-note">
        <strong>{enemy.trait.name}</strong> — {enemy.trait.description}
      </div>
      <div className="combat-enemy-kill-count">
        <Trophy size={15} />
        <span>
          <strong>{formatNumber(game.killCounts[enemy.id] ?? 0)}</strong> defeated
        </span>
      </div>
      <div className="combat-drop-preview">
        <div className="combat-subheading-row">
          <span className="combat-panel-kicker">Drop preview</span>
          <button type="button" className="combat-text-link" onClick={onViewLoot}>
            Full drop table <ArrowUpRight size={13} />
          </button>
        </div>
        <div className="combat-drop-list">
          {enemy.loot.slice(0, 3).map((drop) => (
            <div className="combat-drop-item" key={drop.itemId}>
              <ItemIcon
                itemId={drop.itemId}
                discovered={game.discoveredItems.includes(drop.itemId)}
                size="xs"
              />
              <span>
                {game.discoveredItems.includes(drop.itemId)
                  ? itemById[drop.itemId]?.name
                  : 'Undiscovered'}
              </span>
              <small>{displayDropChance(drop.chance)}</small>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CombatPortraitSmall({ enemy }: { enemy: EnemyDefinition }) {
  const usesForestRatArt = enemy.id === 'forest-rat';
  return (
    <div className={`combat-roster-portrait theme-${enemy.theme}`} aria-hidden="true">
      {usesForestRatArt ? <img src={forestRatImage} alt="" /> : enemyGlyph[enemy.theme]}
    </div>
  );
}

function EnemyRoster({
  game,
  area,
  selectedEnemy,
  activeEnemy,
  onSelect,
}: {
  game: GameState;
  area: (typeof AREAS)[number];
  selectedEnemy: EnemyId;
  activeEnemy: EnemyId | null;
  onSelect: (enemyId: EnemyId, areaId: AreaId) => void;
}) {
  return (
    <div className="combat-enemy-roster" aria-label={`${area.name} enemies`}>
      {area.enemyIds.map((enemyId) => {
        const enemy = enemyById[enemyId];
        const selected = selectedEnemy === enemyId;
        const fighting = activeEnemy === enemyId;
        const kills = game.killCounts[enemyId] ?? 0;
        const status = fighting ? 'Fighting' : selected ? 'Selected' : kills ? 'Defeated' : 'New';
        const action = fighting ? 'Fighting' : activeEnemy ? 'Switch target' : 'Select target';
        return (
          <button
            type="button"
            className={`combat-enemy-card ${selected ? 'selected' : ''} ${fighting ? 'fighting' : ''}`}
            aria-pressed={selected}
            aria-label={`${action} ${enemy.name}, level ${enemy.displayLevel}`}
            key={enemyId}
            onClick={() => onSelect(enemyId, area.id)}
          >
            <CombatPortraitSmall enemy={enemy} />
            <span className="combat-enemy-card-copy">
              <strong>{enemy.name}</strong>
              <span>Lv {enemy.displayLevel}</span>
              <small>{status}</small>
            </span>
            {fighting && <Swords size={14} aria-label="Currently fighting" />}
          </button>
        );
      })}
    </div>
  );
}

function AreaAccordion({
  game,
  selectedArea,
  expandedArea,
  selectedEnemy,
  activeEnemy,
  locationsExpanded,
  onToggle,
  onSelectEnemy,
  onToggleLocations,
}: {
  game: GameState;
  selectedArea: AreaId;
  expandedArea: AreaId | null;
  selectedEnemy: EnemyId;
  activeEnemy: EnemyId | null;
  locationsExpanded: boolean;
  onToggle: (areaId: AreaId) => void;
  onSelectEnemy: (enemyId: EnemyId, areaId: AreaId) => void;
  onToggleLocations: () => void;
}) {
  return (
    <section className="combat-locations" aria-labelledby="combat-locations-title">
      <div className="combat-section-heading">
        <div>
          <div className="eyebrow">Choose your road</div>
          <h2 id="combat-locations-title">Combat locations</h2>
        </div>
        <button
          type="button"
          className="combat-locations-toggle"
          aria-expanded={locationsExpanded}
          aria-controls="combat-location-list"
          onClick={onToggleLocations}
        >
          {locationsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {locationsExpanded ? 'Collapse locations' : 'Expand locations'}
        </button>
      </div>
      <div id="combat-location-list" className="combat-location-list" hidden={!locationsExpanded}>
        {AREAS.map((area) => {
          const unlocked = game.unlockedAreas.includes(area.id) || area.unlock(game);
          const expanded = expandedArea === area.id;
          const selected = selectedArea === area.id;
          const kills = area.enemyIds.reduce((sum, id) => sum + (game.killCounts[id] ?? 0), 0);
          const Icon = zoneIcon[area.presentation.iconKey];
          return (
            <div
              className={`combat-location ${expanded ? 'expanded' : ''} ${selected ? 'selected' : ''} ${!unlocked ? 'locked' : ''}`}
              key={area.id}
            >
              <button
                type="button"
                className="combat-location-row"
                aria-expanded={expanded}
                disabled={!unlocked}
                aria-controls={`combat-location-${area.id}`}
                onClick={() => onToggle(area.id)}
              >
                <span className="combat-location-chevron" aria-hidden="true">
                  {expanded ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
                </span>
                <span className="combat-location-icon">
                  <Icon size={17} />
                </span>
                <span className="combat-location-name">
                  <strong>{area.name}</strong>
                  <small>{area.description}</small>
                </span>
                <span className="combat-location-level">
                  Recommended {area.recommendedLevel[0]}–{area.recommendedLevel[1]}
                </span>
                <span className="combat-location-progress">
                  {kills}/{ZONE_COMPLETION_KILLS} kills
                </span>
                <span className={`combat-location-status ${unlocked ? '' : 'locked'}`}>
                  {unlocked ? (selected ? 'Selected' : 'Available') : 'Locked'}
                </span>
              </button>
              {!unlocked && (
                <div className="combat-location-requirement">
                  <Lock size={13} /> Requires: {area.requirement}
                </div>
              )}
              {expanded && unlocked && (
                <div className="combat-location-content" id={`combat-location-${area.id}`}>
                  <div className="combat-location-content-heading">
                    <span className="combat-panel-kicker">Know your enemy</span>
                    <span className="muted">Select a target to update the live panels.</span>
                  </div>
                  <EnemyRoster
                    game={game}
                    area={area}
                    selectedEnemy={selectedEnemy}
                    activeEnemy={activeEnemy}
                    onSelect={onSelectEnemy}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CombatContentTabs({
  activeTab,
  onChange,
}: {
  activeTab: CombatContentTab;
  onChange: (tab: CombatContentTab) => void;
}) {
  const tabs: Array<{ id: CombatContentTab; label: string; description: string }> = [
    { id: 'areas', label: 'Areas', description: 'Open-world combat locations' },
    { id: 'dungeons', label: 'Dungeons', description: 'Future multi-stage encounters' },
    { id: 'slayer', label: 'Slayer Areas', description: 'Future task-based hunts' },
  ];
  return (
    <div className="combat-content-tabs" role="tablist" aria-label="Combat content">
      {tabs.map((tab) => (
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          className={activeTab === tab.id ? 'selected' : ''}
          key={tab.id}
          onClick={() => onChange(tab.id)}
        >
          <span>{tab.label}</span>
          <small>{tab.description}</small>
        </button>
      ))}
    </div>
  );
}

function LockedCombatContent({ tab }: { tab: Exclude<CombatContentTab, 'areas'> }) {
  const label = tab === 'dungeons' ? 'Dungeons' : 'Slayer Areas';
  return (
    <section className="combat-future-content" role="tabpanel" aria-label={label}>
      <Lock size={19} />
      <div>
        <strong>{label} are not available yet</strong>
        <span>This content slot is ready for a future combat system.</span>
      </div>
    </section>
  );
}

function getLiveStatus(
  game: GameState,
  enemy: EnemyDefinition,
  events: CombatVisualEvent[],
  now: number,
): string {
  const active = game.activeAction.type === 'combat' ? game.activeAction : null;
  if (active) {
    if (active.combatState.respawnMs > 0) return 'RESPAWNING';
    if (active.combatState.enemyHp <= 0) return 'VICTORY';
    if (game.player.currentHp <= 0) return 'DEFEATED';
    return 'FIGHTING';
  }
  const recentOutcome = [...events]
    .reverse()
    .find(
      (event) =>
        event.enemyId === enemy.id &&
        now - event.at < 2_000 &&
        (event.type === 'enemy-defeated' || event.type === 'player-defeated'),
    );
  if (recentOutcome?.type === 'enemy-defeated') return 'VICTORY';
  if (recentOutcome?.type === 'player-defeated') return 'DEFEATED';
  if (selectCombatStatus(game) === 'Inventory full') return 'INVENTORY FULL';
  return 'READY';
}

function TargetAnalysis({
  game,
  enemy,
  style,
}: {
  game: GameState;
  enemy: EnemyDefinition;
  style: CombatStyle;
}) {
  const [expanded, setExpanded] = useState(true);
  const enemyStats = getEnemyCombatStats(enemy);
  const trait = selectTargetTrait(game, enemy);
  const rows = [
    ['Your chance to hit', `${Math.round(selectPlayerHitChance(game, enemy, style) * 100)}%`],
    ['Estimated kill time', formatSeconds(selectEstimatedKillTimeMs(game, enemy, style))],
    ['Expected kills/hour', selectExpectedKillsPerHour(game, enemy, style).toFixed(1)],
    ['Enemy chance to hit', `${Math.round(selectEnemyHitChance(game, enemy, style) * 100)}%`],
    ['Enemy health', `${enemyStats.maxHealth} HP`],
    ['Expected XP from full kill', `${getCombatDamageXp(enemyStats.maxHealth)} XP`],
    ['Enemy expected DPS', selectEnemyEstimatedDps(game, enemy).toFixed(1)],
  ];
  return (
    <section className="combat-analysis" aria-labelledby="target-analysis-title">
      <div className="combat-section-heading">
        <div>
          <div className="eyebrow">Preparation</div>
          <h2 id="target-analysis-title">Target Preview</h2>
        </div>
        <div
          className="combat-analysis-target"
          role="group"
          aria-label={`Selected target: ${enemy.name}, level ${enemy.displayLevel}`}
        >
          <CombatPortraitSmall enemy={enemy} />
          <span className="combat-analysis-target-copy">
            <strong>{enemy.name}</strong>
            <span>Lv {enemy.displayLevel}</span>
          </span>
        </div>
        <div className="combat-analysis-heading-actions">
          <button
            type="button"
            className="combat-locations-toggle"
            aria-expanded={expanded}
            aria-controls="target-analysis-content"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {expanded ? 'Collapse analysis' : 'Expand analysis'}
          </button>
        </div>
      </div>
      <div id="target-analysis-content" className="combat-analysis-content" hidden={!expanded}>
        <div className="combat-analysis-grid">
          {rows.map(([label, value]) => (
            <div className="combat-analysis-row" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        <div className="combat-analysis-trait">
          <strong>Important enemy trait: {trait.name}</strong>
          <span>{trait.description}</span>
        </div>
      </div>
    </section>
  );
}

function getLogPresentation(
  text: string,
  tone: GameState['log'][number]['tone'],
): { label: string; icon: typeof Sword; category: string; important: boolean } {
  const lower = text.toLowerCase();
  if (lower.includes('defeated'))
    return { label: 'Defeat', icon: Skull, category: 'defeat', important: true };
  if (lower.includes('received') || lower.includes('gold'))
    return { label: 'Loot', icon: Sparkles, category: 'loot', important: tone === 'success' };
  if (lower.includes('reached level'))
    return { label: 'Level', icon: ArrowUpRight, category: 'level', important: true };
  if (lower.includes('accessible'))
    return { label: 'Unlock', icon: Trophy, category: 'unlock', important: true };
  if (lower.includes('hit'))
    return {
      label: 'Damage',
      icon: Sword,
      category: tone === 'danger' ? 'enemy-hit' : 'player-hit',
      important: false,
    };
  return { label: 'System', icon: Clock3, category: 'system', important: false };
}

function RecentActions({
  game,
  enemy,
  sessionStartedAt,
  encounterStartedAt,
}: {
  game: GameState;
  enemy: EnemyDefinition;
  sessionStartedAt: number | null;
  encounterStartedAt: number | null;
}) {
  const entries = useMemo(
    () =>
      game.log
        .filter((entry) => sessionStartedAt === null || entry.at >= sessionStartedAt)
        .filter((entry) => {
          const lower = entry.text.toLowerCase();
          return (
            lower.includes('hit') ||
            lower.includes('defeated') ||
            lower.includes('received') ||
            lower.includes('gold') ||
            lower.includes('level') ||
            lower.includes('combat') ||
            lower.includes('inventory')
          );
        })
        .filter(
          (entry) =>
            entry.text.toLowerCase().includes(enemy.name.toLowerCase()) ||
            !entry.text.toLowerCase().includes('hit'),
        )
        .slice(0, 8),
    [game.log, enemy.name, sessionStartedAt],
  );
  return (
    <div className="combat-recent-actions">
      <div className="combat-subheading-row">
        <span className="combat-panel-kicker">Recent actions</span>
        <span className="muted">Live combat log</span>
      </div>
      <div className="combat-live-log" aria-live="polite">
        {entries.length ? (
          entries.map((entry) => {
            const presentation = getLogPresentation(entry.text, entry.tone);
            const Icon = presentation.icon;
            return (
              <div
                className={`combat-live-log-entry ${presentation.category} ${presentation.important ? 'important' : ''}`}
                key={entry.id}
              >
                <time>
                  {formatCombatLogTime(
                    entry.at,
                    entry.combatEncounterStartedAt ?? encounterStartedAt,
                  )}
                </time>
                <span className="combat-live-log-icon">
                  <Icon size={12} />
                </span>
                <span>{entry.text}</span>
              </div>
            );
          })
        ) : (
          <span className="muted">Combat actions will appear here.</span>
        )}
      </div>
    </div>
  );
}

function LiveCombatResolution({
  game,
  enemy,
  events,
  autoRepeat,
  onAutoRepeatChange,
  autoSpecial,
  onAutoSpecialChange,
  onUseSpecial,
  huntElites,
  onHuntElitesChange,
  actionText,
  actionTargetName,
  actionDisabled,
  onAction,
  inventoryFull,
  onNavigate,
  sessionStartedAt,
  encounterStartedAt,
}: {
  game: GameState;
  enemy: EnemyDefinition;
  events: CombatVisualEvent[];
  autoRepeat: boolean;
  onAutoRepeatChange: (checked: boolean) => void;
  autoSpecial: boolean;
  onAutoSpecialChange: (checked: boolean) => void;
  onUseSpecial: () => void;
  huntElites: boolean;
  onHuntElitesChange: (checked: boolean) => void;
  actionText: string;
  actionTargetName?: string;
  actionDisabled: boolean;
  onAction: () => void;
  inventoryFull: boolean;
  onNavigate: (screen: ScreenId) => void;
  sessionStartedAt: number | null;
  encounterStartedAt: number | null;
}) {
  const [now, setNow] = useState(Date.now());
  const [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, []);
  const status = getLiveStatus(game, enemy, events, now);
  const active = game.activeAction.type === 'combat' && game.activeAction.enemyId === enemy.id;
  const playerProgress = selectPlayerAttackProgress(game, now);
  const enemyProgress = selectEnemyAttackProgress(game, now);
  const enemyHp = getCombatantHp(game, enemy, events, now);
  const combatAction = game.activeAction.type === 'combat' && game.activeAction.enemyId === enemy.id
    ? game.activeAction
    : null;
  const enemyStats = getEnemyCombatStats(
    enemy,
    combatAction?.combatState.eliteModifier ?? null,
    combatAction?.combatState.enemyHp ?? enemy.maxHealth,
  );
  const special = itemById[game.equipment.weapon ?? '']?.specialAttack;
  const momentum = combatAction?.combatState.momentum ?? 0;
  const effects: string[] = [];
  if (combatAction?.combatState.eliteModifier)
    effects.push(`ELITE · ${eliteById[combatAction.combatState.eliteModifier].name}`);
  if (enemy.trait.id === 'desperate-swing' && enemyHp <= enemyStats.maxHealth * 0.3)
    effects.push('Desperate Swing active');
  if (enemy.trait.id === 'bleeding-bites' && (combatAction?.combatState.traitState.bleedStacks ?? 0) > 0)
    effects.push(`Bleed stacks: ${combatAction?.combatState.traitState.bleedStacks}`);
  if (enemy.trait.id === 'heavy-strike' && (combatAction?.combatState.traitState.enemyAttackCount ?? 0) % 4 === 3)
    effects.push('Heavy Strike incoming');
  if (combatAction?.pendingStyle) effects.push(`Style change applies next enemy: ${getCombatStyleInfo(combatAction.pendingStyle).name}`);
  const statusIcon =
    status === 'VICTORY' ? (
      <Trophy size={15} />
    ) : status === 'DEFEATED' ? (
      <Skull size={15} />
    ) : (
      <Crosshair size={15} />
    );
  return (
    <section
      className={`combat-live-panel status-${status.toLowerCase().replaceAll(' ', '-')}`}
      aria-label="Live combat resolution"
    >
      <div className="combat-live-heading">
        <div>
          <div className="combat-panel-kicker">Live combat resolution</div>
          <h2 id="live-combat-title">{enemy.name}</h2>
        </div>
        <div className="combat-live-status" aria-live="polite">
          {statusIcon} {status}
        </div>
      </div>
      <div className="combat-resolution-compare">
        <div className="combat-resolution-side player">
          <HealthBar
            label="YOU"
            current={game.player.currentHp}
            max={getDerivedStats(game).maxHealth}
            tone="player"
          />
          <AttackProgress label="Next attack" progress={playerProgress} tone="player" />
        </div>
        <div className="combat-resolution-vs" aria-hidden="true">
          VS
        </div>
        <div className="combat-resolution-side enemy">
          <HealthBar label={enemy.name} current={enemyHp} max={combatAction?.combatState.enemyMaxHp ?? enemyStats.maxHealth} tone="enemy" />
          <AttackProgress label="Next attack" progress={enemyProgress} tone="enemy" />
        </div>
      </div>
      <div className="combat-resolution-state">
        <span>
          <Timer size={14} />
          {active &&
          game.activeAction.type === 'combat' &&
          game.activeAction.combatState.respawnMs > 0
            ? `Respawning in ${formatSeconds(game.activeAction.combatState.respawnMs)}`
            : status === 'READY'
              ? `Ready to fight ${enemy.name}`
              : status === 'INVENTORY FULL'
                ? 'Open Inventory to make room for rewards.'
                : status === 'DEFEATED'
                  ? 'Recovering safely'
                  : status === 'VICTORY'
                    ? 'Victory secured'
                    : active
                      ? `Next player attack in ${formatSeconds(playerProgress.timeUntilAttackMs)}`
                      : 'Combat stopped'}
        </span>
        <span className="combat-effects">
          <Sparkles size={13} /> Active effects: {effects.length ? effects.join(' · ') : 'None'}
        </span>
      </div>
      <div className="combat-momentum" aria-label="Momentum">
        <div className="combat-momentum-head">
          <span>Momentum</span>
          <strong>{momentum} / 100 {momentum >= 100 ? '· READY' : ''}</strong>
        </div>
        <div className="combat-momentum-track" role="progressbar" aria-label="Momentum" aria-valuemin={0} aria-valuemax={100} aria-valuenow={momentum}>
          <i style={{ width: `${momentum}%` }} />
        </div>
        <small>
          {special ? `${special.name}: ${special.description}` : 'Equip a weapon with a special attack'}
        </small>
      </div>
      <div className="combat-live-controls">
        <div className="combat-settings-control">
          <button
            type="button"
            className="combat-settings-button"
            aria-label="Combat settings"
            aria-expanded={settingsOpen}
            aria-controls="combat-settings-popover"
            title="Combat settings"
            onClick={() => setSettingsOpen((open) => !open)}
          >
            <Settings2 size={15} />
          </button>
          {settingsOpen && (
            <div id="combat-settings-popover" className="combat-settings-popover" role="dialog" aria-label="Combat settings">
              <strong>Combat settings</strong>
              <label className="combat-settings-option">
                <input
                  type="checkbox"
                  aria-label="Hunt elites"
                  checked={huntElites}
                  onChange={(event) => onHuntElitesChange(event.target.checked)}
                />
                <span>
                  <b>Hunt elites</b>
                  <small>Allow the normal 5% elite spawn chance.</small>
                </span>
              </label>
              <label className="combat-settings-option">
                <input
                  type="checkbox"
                  aria-label="Auto Repeat"
                  checked={autoRepeat}
                  onChange={(event) => onAutoRepeatChange(event.target.checked)}
                />
                <span>
                  <b>Auto Repeat</b>
                  <small>Continue fighting the next enemy automatically.</small>
                </span>
              </label>
              <label className="combat-settings-option">
                <input
                  type="checkbox"
                  aria-label="Auto Special"
                  checked={autoSpecial}
                  onChange={(event) => onAutoSpecialChange(event.target.checked)}
                />
                <span>
                  <b>Auto Special</b>
                  <small>Use a ready special attack automatically.</small>
                </span>
              </label>
            </div>
          )}
        </div>
        {!autoSpecial && special && momentum >= 100 && (
          <button type="button" className="button ghost" onClick={onUseSpecial} disabled={!active}>
            Use Special
          </button>
        )}
        <button
          type="button"
          aria-label={actionText}
          className={`button ${active ? 'danger' : 'primary'} combat-main-action`}
          disabled={actionDisabled}
          onClick={onAction}
        >
          {active ? <CircleStop size={17} /> : <Swords size={17} />}
          {actionText}
          <small>{!inventoryFull ? (actionTargetName ?? enemy.name) : ''}</small>
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
      <RecentActions
        game={game}
        enemy={enemy}
        sessionStartedAt={sessionStartedAt}
        encounterStartedAt={encounterStartedAt}
      />
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
    <section className="combat-overview-content combat-loot-content" aria-labelledby="loot-title">
      <div className="combat-section-heading">
        <div>
          <div className="eyebrow">Rewards and discovery</div>
          <h2 id="loot-title">Loot table</h2>
        </div>
        <span className="muted">
          {game.discoveredMonsters.includes(enemy.id)
            ? 'Encounter discovered'
            : 'Discover drops by fighting'}
        </span>
      </div>
      <div className="combat-loot-table">
        <div className="combat-loot-row header">
          <span>Item</span>
          <span>Quantity</span>
          <span>Chance</span>
          <span>Owned</span>
        </div>
        {enemy.loot.map((drop) => {
          const discovered = game.discoveredItems.includes(drop.itemId);
          const rarity = getLootRarity(drop.chance);
          return (
            <div className="combat-loot-row" key={drop.itemId}>
              <span className="combat-loot-item">
                <ItemIcon itemId={drop.itemId} discovered={discovered} size="sm" />
                <span>
                  <strong>{discovered ? itemById[drop.itemId]?.name : 'Undiscovered'}</strong>
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
              <span>{displayDropChance(drop.chance)}</span>
              <span>{getItemQuantity(game.inventory, drop.itemId)}</span>
            </div>
          );
        })}
        <div className="combat-loot-row gold">
          <span className="combat-loot-item">
            <ItemIcon gold size="sm" />
            <span>
              <strong>Gold</strong>
              <small>Guaranteed</small>
            </span>
          </span>
          <span>
            {enemy.gold[0]}–{enemy.gold[1]}
          </span>
          <span>Guaranteed</span>
          <span>{formatNumber(game.gold)}</span>
        </div>
      </div>
      <div className="combat-rewards-list">
        <span className="combat-panel-kicker">Recent rewards</span>
        {recentLoot.length ? (
          recentLoot.map((event) => (
            <div className="combat-reward-row" key={event.id}>
              <Trophy size={13} />
              <span>
                +{event.gold} Gold
                {event.items.length
                  ? ` · ${event.items.length} item drop${event.items.length === 1 ? '' : 's'}`
                  : ''}
              </span>
            </div>
          ))
        ) : (
          <span className="muted">Rewards from this enemy will appear here.</span>
        )}
      </div>
    </section>
  );
}

function getNextUnlockText(game: GameState): { name: string; requirement: string } {
  const next = AREAS.find((area) => !game.unlockedAreas.includes(area.id) && !area.unlock(game));
  return next
    ? { name: next.name, requirement: next.requirement }
    : {
        name: 'All current zones unlocked',
        requirement: 'Keep training for the next content pass.',
      };
}

function ProgressionPanel({
  game,
  session,
  style,
}: {
  game: GameState;
  session: CombatSessionStats;
  style: CombatStyle;
}) {
  const skills = ['attack', 'strength', 'defence', 'hitpoints'] as const;
  const started = session.startedAt ? Math.max(1_000, Date.now() - session.startedAt) : 0;
  const selectedSkill = getCombatStyleSkill(style);
  const totalXp = Object.values(session.xpGained).reduce((sum, amount) => sum + (amount ?? 0), 0);
  const xpHour = started ? ((session.xpGained[selectedSkill] ?? 0) * 3_600_000) / started : 0;
  return (
    <section className="combat-overview-content" aria-labelledby="progression-title">
      <div className="combat-section-heading">
        <div>
          <div className="eyebrow">The long game</div>
          <h2 id="progression-title">Combat progression</h2>
        </div>
        <span className="muted">Current session</span>
      </div>
      <div className="combat-training-focus">
        <ArrowUpRight size={15} />
        <span>Training {selectedSkill[0].toUpperCase() + selectedSkill.slice(1)}</span>
        <strong>{formatNumber(session.xpGained[selectedSkill] ?? 0)} XP</strong>
        <small>{formatNumber(xpHour)} XP/hour</small>
      </div>
      <div className="combat-xp-grid">
        {skills.map((skill) => {
          const progress = getLevelProgress(game.skills[skill]);
          return (
            <div className="combat-xp-row" key={skill}>
              <div>
                <span>{skill[0].toUpperCase() + skill.slice(1)}</span>
                <b>Lv {game.skills[skill].level}</b>
              </div>
              <div className="combat-xp-bar">
                <i style={{ width: `${progress.percent}%` }} />
              </div>
              <small>
                {formatNumber(progress.current)} / {progress.next || 'MAX'} XP
              </small>
            </div>
          );
        })}
      </div>
      <div className="combat-session-stat-grid">
        <div>
          <strong>{formatDuration(started)}</strong>
          <span>time active</span>
        </div>
        <div>
          <strong>{formatNumber(session.enemiesDefeated)}</strong>
          <span>enemies defeated</span>
        </div>
        <div>
          <strong>{formatNumber(totalXp)}</strong>
          <span>XP gained</span>
        </div>
        <div>
          <strong>{formatNumber(session.goldGained)}</strong>
          <span>gold gained</span>
        </div>
      </div>
      <div className="combat-next-unlock">
        <span>
          Next unlock: <strong>{getNextUnlockText(game).name}</strong>
        </span>
        <small>{getNextUnlockText(game).requirement}</small>
      </div>
    </section>
  );
}

function OverviewSummary({
  game,
  enemy,
  session,
  style,
  autoRepeat,
}: {
  game: GameState;
  enemy: EnemyDefinition;
  session: CombatSessionStats;
  style: CombatStyle;
  autoRepeat: boolean;
}) {
  const stats = getDerivedStats(game);
  const sessionStartedAt =
    session.startedAt ?? (game.activeAction.type === 'combat' ? game.updatedAt : null);
  const started = sessionStartedAt ? Math.max(1_000, Date.now() - sessionStartedAt) : 0;
  const totalXp = Object.values(session.xpGained).reduce((sum, amount) => sum + (amount ?? 0), 0);
  const itemsGained = Object.values(session.lootGained).reduce((sum, amount) => sum + amount, 0);
  const dps = selectPlayerEstimatedDps(game, enemy);
  const hitRate = session.playerAttacks > 0
    ? `${Math.round((session.playerHits / session.playerAttacks) * 100)}%`
    : '—';
  return (
    <section className="combat-overview-content" aria-labelledby="session-summary-title">
      <div className="combat-section-heading">
        <div>
          <div className="eyebrow">Session summary</div>
          <h2 id="session-summary-title">Session summary</h2>
        </div>
        <span className="muted">Live values from this combat session</span>
      </div>
      <div className="combat-overview-columns">
        <div>
          <span className="combat-panel-kicker">Session totals</span>
          <strong>{formatDuration(started)}</strong>
          <small>time active</small>
          <strong>{formatNumber(session.enemiesDefeated)}</strong>
          <small>enemies defeated</small>
          <strong>{formatNumber(totalXp)}</strong>
          <small>XP gained</small>
        </div>
        <div>
          <span className="combat-panel-kicker">Performance</span>
          <strong>{dps.toFixed(1)}</strong>
          <small>estimated DPS</small>
           <strong>{hitRate}</strong>
           <small>actual hit rate</small>
           <strong>{session.specialHits} / {session.specialAttempts}</strong>
           <small>special hits</small>
          <strong>{formatSeconds((enemy.maxHealth / Math.max(0.1, dps)) * 1_000)}</strong>
          <small>estimated kill time</small>
        </div>
        <div>
          <span className="combat-panel-kicker">Resources</span>
          <strong>{formatNumber(session.goldGained)}</strong>
          <small>gold gained</small>
          <strong>{formatNumber(itemsGained)}</strong>
          <small>items gained</small>
          <strong>
            {occupiedSlots(game.inventory)} / {GAME_CONFIG.inventorySlots}
          </strong>
          <small>inventory slots used</small>
        </div>
        <div>
          <span className="combat-panel-kicker">Status</span>
          <strong>{autoRepeat ? 'On' : 'Off'}</strong>
          <small>auto repeat</small>
          <strong>{getCombatStyleInfo(style).name}</strong>
          <small>combat style</small>
           <strong>{stats.maxHealth}</strong>
           <small>maximum HP</small>
           <strong>{session.eliteEnemiesDefeated}</strong>
           <small>elite kills</small>
        </div>
      </div>
    </section>
  );
}

function CombatOverviewTabs({
  game,
  enemy,
  session,
  style,
  autoRepeat,
  events,
  tab,
  onTabChange,
}: {
  game: GameState;
  enemy: EnemyDefinition;
  session: CombatSessionStats;
  style: CombatStyle;
  autoRepeat: boolean;
  events: CombatVisualEvent[];
  tab: OverviewTab;
  onTabChange: (tab: OverviewTab) => void;
}) {
  const tabLabels: Record<OverviewTab, string> = {
    overview: 'Session summary',
    loot: 'Loot',
    progression: 'Progression',
  };
  return (
    <section className="combat-overview" aria-label="Combat summary">
      <div className="combat-overview-tabs" role="tablist" aria-label="Combat summary tabs">
        {(['overview', 'loot', 'progression'] as OverviewTab[]).map((option) => (
          <button
            type="button"
            role="tab"
            aria-selected={tab === option}
            className={tab === option ? 'selected' : ''}
            key={option}
            onClick={() => onTabChange(option)}
          >
            {tabLabels[option]}
          </button>
        ))}
      </div>
      {tab === 'overview' ? (
        <OverviewSummary
          game={game}
          enemy={enemy}
          session={session}
          style={style}
          autoRepeat={autoRepeat}
        />
      ) : tab === 'loot' ? (
        <LootPanel game={game} enemy={enemy} events={events} />
      ) : (
        <ProgressionPanel game={game} session={session} style={style} />
      )}
    </section>
  );
}

export function CombatScreen({
  game,
  requestAction,
  requestConfirmation: _requestConfirmation,
  onNavigate,
}: {
  game: GameState;
  requestAction: (screen: ScreenId, action: () => void) => void;
  requestConfirmation: (options: ConfirmDialogOptions) => void;
  onNavigate: (screen: ScreenId) => void;
}) {
  const active = game.activeAction.type === 'combat' ? game.activeAction : null;
  const activeAreaId = active?.areaId;
  const activeEnemyId = active?.enemyId;
  const activeStyle = active?.style;
  const activeAutoRepeat = active?.autoRepeat;
  const activeAutoSpecial = active?.autoSpecial;
  const [contentTab, setContentTab] = useState<CombatContentTab>('areas');
  const [locationsExpanded, setLocationsExpanded] = useState(true);
  const [overviewTab, setOverviewTab] = useState<OverviewTab>('overview');
  const [selectedArea, setSelectedArea] = useState<AreaId>(activeAreaId ?? 'training-grounds');
  const [expandedArea, setExpandedArea] = useState<AreaId | null>(
    activeAreaId ?? 'training-grounds',
  );
  const [selectedEnemy, setSelectedEnemy] = useState<EnemyId>(activeEnemyId ?? 'forest-rat');
  const [style, setStyle] = useState<CombatStyle>(activeStyle ?? 'accurate');
  const [autoRepeat, setAutoRepeat] = useState(activeAutoRepeat ?? true);
  const [autoSpecial, setAutoSpecial] = useState(activeAutoSpecial ?? true);
  const startCombat = useGameStore((store) => store.startCombat);
  const stopAction = useGameStore((store) => store.stopAction);
  const setCombatStyle = useGameStore((store) => store.setCombatStyle);
  const setCombatAutoRepeat = useGameStore((store) => store.setCombatAutoRepeat);
  const setCombatAutoSpecial = useGameStore((store) => store.setCombatAutoSpecial);
  const queueCombatSpecial = useGameStore((store) => store.queueCombatSpecial);
  const setSettings = useGameStore((store) => store.setSettings);
  const events = useGameStore((store) => store.combatEvents);
  const session = useGameStore((store) => store.combatSession);
  const saveStatus = useGameStore((store) => store.saveStatus);
  const savedAt = useGameStore((store) => store.savedAt);
  const startPending = useRef(false);
  const currentAreaId = activeAreaId ?? selectedArea;
  const currentEnemyId = activeEnemyId ?? selectedEnemy;
  const currentArea = areaById[currentAreaId] ?? areaById['training-grounds'];
  const currentEnemy = enemyById[currentEnemyId] ?? enemyById['forest-rat'];
  const selectedTargetArea = areaById[selectedArea] ?? areaById['training-grounds'];
  const selectedTarget = enemyById[selectedEnemy] ?? enemyById['forest-rat'];
  const targetChanged = Boolean(
    active && (active.areaId !== selectedTargetArea.id || active.enemyId !== selectedTarget.id),
  );
  const encounterStartedAt =
    active?.combatState.encounterStartedAt ?? session.encounterStartedAt ?? session.startedAt;
  const progress = selectCombatProgress(game);
  const inventoryFull = occupiedSlots(game.inventory) >= GAME_CONFIG.inventorySlots;
  const locked =
    !game.unlockedAreas.includes(selectedTargetArea.id) && !selectedTargetArea.unlock(game);

  useEffect(() => {
    if (
      activeAreaId === undefined ||
      activeEnemyId === undefined ||
      activeStyle === undefined ||
      activeAutoRepeat === undefined
    )
      return;
    setSelectedArea(activeAreaId);
    setExpandedArea((expanded) => (expanded === null ? activeAreaId : expanded));
    setSelectedEnemy(activeEnemyId);
    setStyle(activeStyle);
    setAutoRepeat(activeAutoRepeat);
    setAutoSpecial(activeAutoSpecial ?? true);
  }, [activeAreaId, activeEnemyId, activeStyle, activeAutoRepeat, activeAutoSpecial]);

  const selectArea = (areaId: AreaId) => {
    const area = areaById[areaId];
    if (!area || (game.unlockedAreas.includes(areaId) === false && !area.unlock(game))) return;
    if (active?.areaId === areaId) {
      setExpandedArea((expanded) => (expanded === areaId ? null : areaId));
      return;
    }
    // Area and enemy changes are browsing-only while combat is active. The
    // action button applies the selected target to the live encounter.
    setSelectedArea(areaId);
    setSelectedEnemy(area.enemyIds[0]);
    setExpandedArea((expanded) => (expanded === areaId ? null : areaId));
  };

  const selectEnemy = (enemyId: EnemyId, areaId: AreaId) => {
    setSelectedArea(areaId);
    setExpandedArea(areaId);
    setSelectedEnemy(enemyId);
  };

  const beginFight = () => {
    if (startPending.current || locked || inventoryFull) return;
    startPending.current = true;
    requestAction('combat', () => {
      startCombat(selectedTargetArea.id, selectedTarget.id, style, autoRepeat, autoSpecial);
      startPending.current = false;
    });
  };
  const startSelectedTarget = () => {
    if (startPending.current || locked) return;
    if (active && targetChanged) {
      startCombat(
        selectedTargetArea.id,
        selectedTarget.id,
        active.pendingStyle ?? active.style,
        active.autoRepeat,
        active.autoSpecial,
      );
      setSelectedArea(selectedTargetArea.id);
      setExpandedArea(selectedTargetArea.id);
      setSelectedEnemy(selectedTarget.id);
      return;
    }
    beginFight();
  };
  const changeStyle = (next: CombatStyle) => {
    setStyle(next);
    if (active) setCombatStyle(next);
  };
  const activeStyleValue = active?.pendingStyle ?? active?.style ?? style;
  const activeAutoRepeatValue = active?.autoRepeat ?? autoRepeat;
  const actionText = locked
    ? 'Target locked'
    : inventoryFull && !active
      ? 'Inventory full'
      : active && targetChanged
        ? 'New target'
        : active?.combatState.respawnMs
        ? 'Waiting for respawn'
        : active
          ? 'Stop combat'
          : session.enemyId === currentEnemy.id && session.enemiesDefeated > 0
            ? 'Resume combat'
            : 'Fight';
  const actionDisabled = locked || (!active && inventoryFull) || startPending.current;
  const saveLabel =
    saveStatus === 'saved' && savedAt
      ? `Saved ${new Date(savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : saveStatus === 'saving'
        ? 'Saving…'
        : saveStatus === 'failed'
          ? 'Save failed'
          : 'Not saved';
  return (
    <div
      className={`combat-screen combat-redesign ${game.settings.reducedMotion ? 'reduced-motion' : ''}`}
    >
      <header className="combat-header combat-redesign-header">
        <div>
          <div className="eyebrow">World · Live encounter</div>
          <h1>Combat</h1>
          <p className="subtle">
            Read the rhythm of the fight, tune your style, and let the frontier keep time.
          </p>
        </div>
        <div className="combat-header-actions">
          <span className="combat-save-status">
            <Check size={13} /> {saveLabel}
          </span>
        </div>
      </header>
      <div className="combat-context-bar combat-redesign-context">
        <span>
          <span className="context-kicker">Location</span> <b>{currentArea.name}</b>
        </span>
        <ChevronRight size={15} />
        <span>
          <span className="context-kicker">Target</span> <b>{currentEnemy.name}</b>
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
        <span className="combat-context-meta">
          {progress.killed} / {progress.target} area kills
        </span>
      </div>
      <CombatContentTabs activeTab={contentTab} onChange={setContentTab} />
      {contentTab === 'areas' ? (
        <AreaAccordion
          game={game}
          selectedArea={selectedArea}
          expandedArea={expandedArea}
          selectedEnemy={selectedEnemy}
          activeEnemy={active?.enemyId ?? null}
          locationsExpanded={locationsExpanded}
          onToggle={selectArea}
          onSelectEnemy={selectEnemy}
          onToggleLocations={() => setLocationsExpanded((expanded) => !expanded)}
        />
      ) : (
        <LockedCombatContent tab={contentTab} />
      )}
      <TargetAnalysis game={game} enemy={selectedTarget} style={activeStyleValue} />
      <main className="combat-dashboard" aria-label="Combat dashboard">
        <PlayerSummaryPanel
          game={game}
          enemy={currentEnemy}
          style={activeStyleValue}
          onStyleChange={changeStyle}
          onNavigate={onNavigate}
        />
          <LiveCombatResolution
          game={game}
          enemy={currentEnemy}
          events={events}
          autoRepeat={activeAutoRepeatValue}
          onAutoRepeatChange={(checked) => {
            setAutoRepeat(checked);
            if (active) setCombatAutoRepeat(checked);
          }}
          autoSpecial={active?.autoSpecial ?? autoSpecial}
          onAutoSpecialChange={(checked) => {
            setAutoSpecial(checked);
            if (active) setCombatAutoSpecial(checked);
          }}
            onUseSpecial={queueCombatSpecial}
            huntElites={game.settings.huntElites !== false}
            onHuntElitesChange={(checked) => setSettings({ huntElites: checked })}
            actionText={actionText}
          actionTargetName={targetChanged ? selectedTarget.name : currentEnemy.name}
          actionDisabled={actionDisabled}
          onAction={active && !targetChanged ? stopAction : startSelectedTarget}
          inventoryFull={inventoryFull}
          onNavigate={onNavigate}
          sessionStartedAt={session.startedAt}
          encounterStartedAt={encounterStartedAt}
        />
        <EnemySummaryPanel
          game={game}
          enemy={currentEnemy}
          onViewLoot={() => setOverviewTab('loot')}
        />
      </main>
      <CombatOverviewTabs
        game={game}
        enemy={currentEnemy}
        session={session}
        style={activeStyleValue}
        autoRepeat={activeAutoRepeatValue}
        events={events}
        tab={overviewTab}
        onTabChange={setOverviewTab}
      />
    </div>
  );
}
