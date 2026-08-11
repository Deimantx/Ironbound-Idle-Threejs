import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  CircleStop,
  Crosshair,
  Gem,
  Flame,
  Lock,
  Mountain,
  PackageOpen,
  Shield,
  Skull,
  Swords,
  Settings2,
  Target,
  Timer,
  TreePine,
  Trophy,
  UserRound,
  Zap,
} from 'lucide-react';
import { AREAS, areaById } from '../../../content/areas';
import { COMBAT_REGIONS, combatRegionById } from '../../../content/combatRegions';
import { COMBAT_SUB_REGIONS, combatSubRegionById } from '../../../content/combatSubRegions';
import { enemyById } from '../../../content/enemies';
import { eliteById } from '../../../content/elites';
import { itemById } from '../../../content/items';
import { GAME_CONFIG } from '../../../config/gameConfig';
import { getCombatDamageXp, getCombatStyleSkill } from '../../../game/formulas/combatFormulas';
import { getLevelProgress } from '../../../game/formulas/experienceFormulas';
import { getDerivedStats } from '../../../game/formulas/statFormulas';
import { getEnemyCombatStats } from '../../../game/formulas/combatStats';
import {
  displayDropChance,
  getCombatStyleInfo,
  getHealthPercent,
  getHealthState,
  getLootRarity,
  selectCombatStatus,
  selectEnemyAttackProgress,
  selectEnemyHitChance,
  selectEstimatedKillTimeMs,
  selectExpectedKillsPerHour,
  selectPlayerHitChance,
  selectTargetTrait,
  selectPlayerAttackProgress,
  selectEnemySpecialCharge,
  selectEnemySpecialReady,
  selectEnemySpecialProgress,
  selectPlayerCombatEffects,
  selectEnemyCombatEffects,
  isCombatAreaUnlocked,
} from '../../../game/selectors/combatSelectors';
import { useGameStore } from '../../../game/state/gameStore';
import { getItemQuantity, occupiedSlots } from '../../../game/systems/inventorySystem';
import type {
  AreaId,
  CombatRegionId,
  CombatSessionStats,
  CombatStyle,
  CombatVisualEvent,
  EnemyDefinition,
  EnemyId,
  GameState,
  ScreenId,
} from '../../../game/types';
import type { ConfirmDialogOptions } from '../../components/ConfirmDialog';
import { ItemIcon } from '../../items/ItemIcon';
import { EnemyArt } from '../../art/EnemyArt';
import { WorldArt } from '../../art/WorldArt';
import { AREA_ART, REGION_ART, SUB_REGION_ART } from '../../art/artRegistry';
import { ItemTooltip } from '../../items/ItemTooltip';
import { GameTooltip } from '../../items/GameTooltip';
import { ExplainedTerm } from '../../tooltips/GameConceptTooltip';
import { EnemyTooltip } from '../../tooltips/EnemyTooltip';
import type { GameConceptId } from '../../tooltips/gameConcepts';
import { getEquipmentSlotLabel } from '../../../game/equipmentSlots';
import type { CombatEquipmentSlot } from '../../../game/equipmentSlots';
import type { UiLayout } from '../../ui-editor/uiLayout';
import { UiPanelSlot } from '../../ui-editor/UiPanelSlot';
import { UiPanelGrid } from '../../ui-editor/UiPanelGrid';
import { UiPanelRegionGrid } from '../../ui-editor/UiPanelRegionGrid';
import { UiPanelRegionSlot } from '../../ui-editor/UiPanelRegionSlot';
import { getCombatLogPresentation } from './combatLogPresentation';
import { formatHealth } from '../../shared/formatters';
import { getActualDps, getActualKillsPerHour } from './sessionMetrics';
import { SpecialAttackDetails } from '../../items/SpecialAttackDetails';
import { COMBAT_TUNING } from '../../../config/combatTuning';
import { formatDamageRange } from '../../combat/combatPresentation';
import {
  getCombatGoldRange,
  getResolvedLootSections,
  sortLootByChance,
} from '../../../game/formulas/combatLoot';
import { EnemySpecialDetails } from '../../combat/EnemySpecialDetails';
import { CombatEffectLane } from './CombatEffectLanes';

type OverviewTab = 'overview' | 'loot' | 'progression';

const formatSeconds = (ms: number): string => `${(ms / 1000).toFixed(1)}s`;
const formatNumber = (value: number): string =>
  new Intl.NumberFormat('en-US').format(Math.floor(value));
const formatRecentRewardSummary = (
  goldGained: number,
  items: Array<{ itemId: string; quantity: number }>,
): string => {
  const segments: string[] = [];
  if (goldGained > 0) segments.push(`${goldGained} Gold`);
  for (const item of items) {
    const name = itemById[item.itemId]?.name ?? 'Unknown item';
    segments.push(item.quantity > 1 ? `${item.quantity} ${name}` : name);
  }
  return segments.join(` ${'\u00b7'} `);
};
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
  mountain: Mountain,
};

const regionIcon = {
  tree: TreePine,
  mountain: Mountain,
  flame: Flame,
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
  accessibleName,
  current,
  max,
  tone,
}: {
  accessibleName: string;
  current: number;
  max: number;
  tone: 'player' | 'enemy';
}) {
  const percent = getHealthPercent(current, max);
  const state = getHealthState(current, max);
  return (
    <div className={`combat-health combat-health-${tone} health-state-${state}`}>
      <div className="combat-health-head">
        {(state === 'critical' || state === 'near-death') && (
          <AlertTriangle size={13} aria-hidden="true" />
        )}
        <strong className="ui-stat-compact combat-health-value">
          {formatHealth(current)} / {formatHealth(max)} HP · {percent}%
        </strong>
      </div>
      <div
        className="combat-health-track"
        role="progressbar"
        aria-label={`${accessibleName} health`}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.ceil(Math.max(0, current))}
        aria-valuetext={`${accessibleName}: ${formatHealth(current)} of ${formatHealth(max)} hit points`}
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
  concept,
  showHelpIcons = true,
}: {
  label: string;
  value: string | number;
  hint?: string;
  concept?: GameConceptId;
  showHelpIcons?: boolean;
}) {
  return (
    <div className="combat-stat-line" title={concept ? undefined : hint}>
      <span className="combat-stat-label">
        {concept ? <ExplainedTerm concept={concept} label={label} showHelpIcon={showHelpIcons} /> : label}
      </span>
      <strong className="ui-stat-compact combat-stat-value">{value}</strong>
    </div>
  );
}

function CombatPortrait({
  enemy,
  large = false,
  ariaLabel,
}: {
  enemy: EnemyDefinition;
  large?: boolean;
  ariaLabel?: string;
}) {
  return (
    <div
      className={`combat-portrait theme-${enemy.theme} ${large ? 'combat-portrait-large' : ''}`}
      role="img"
      aria-label={ariaLabel ?? `${enemy.name} portrait`}
    >
      <EnemyArt enemyId={enemy.id} variant={large ? 'arena' : 'preview'} large={large} />
    </div>
  );
}

function EquipmentStrip({ game }: { game: GameState }) {
  const renderSlots = (slots: CombatEquipmentSlot[]) =>
    slots.map((slot) => {
      const itemId = game.equipment[slot];
      const item = itemId ? itemById[itemId] : undefined;
      const label = getEquipmentSlotLabel(slot);
      const itemLabel = item?.name ?? (itemId ? 'Unknown item' : 'Empty');
      return (
        <ItemTooltip item={item} disabled={!itemId} key={slot}>
          <div
            className={`combat-equip-slot ${item ? 'filled' : ''}`}
            tabIndex={item ? 0 : undefined}
            aria-label={`${label}: ${itemLabel}`}
          >
            <span className="combat-equip-slot-label">{label}</span>
            {item ? <ItemIcon itemId={item.id} size="xs" /> : <b>—</b>}
            <small className="combat-equip-slot-item">{itemLabel}</small>
          </div>
        </ItemTooltip>
      );
    });
  return (
    <div className="combat-equipment-strip" aria-label="Equipped items">
      <section className="combat-equipment-group" aria-labelledby="combat-gear-summary-title">
        <div className="combat-equipment-group-title" id="combat-gear-summary-title">
          Combat Gear
        </div>
        <div className="combat-equipment-grid-main">
          {renderSlots(['weapon', 'head', 'armor', 'offhand', 'gloves', 'boots'])}
        </div>
      </section>
      <section className="combat-equipment-group" aria-labelledby="accessories-summary-title">
        <div className="combat-equipment-group-title" id="accessories-summary-title">
          Accessories
        </div>
        <div className="combat-equipment-grid-accessories">
          {renderSlots(['amulet', 'ring', 'cape'])}
        </div>
      </section>
    </div>
  );
}

function StyleControls({
  style,
  queuedStyle,
  onChange,
}: {
  style: CombatStyle;
  queuedStyle?: CombatStyle | null;
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
          const current = style === option;
          const queued = queuedStyle === option && !current;
          return (
            <GameTooltip
              key={option}
              label={`${info.name} combat style`}
              content={
                <div className="concept-tooltip-content">
                  <strong>{info.name}</strong>
                  <p>{info.benefit}.</p>
                  <span>{info.modifier}</span>
                  <span>Style changes apply after your current attack.</span>
                </div>
              }
            >
              <button
                type="button"
                className={`combat-style-option ${current ? 'selected' : ''} ${queued ? 'queued' : ''}`}
                aria-pressed={current}
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
                  {queued && <small>Queued — after current attack</small>}
                </span>
                {current && <Check size={14} aria-label="Current" />}
              </button>
            </GameTooltip>
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
  uiLayout,
  style,
  queuedStyle,
  onStyleChange,
  onNavigate,
}: {
  game: GameState;
  enemy: EnemyDefinition;
  uiLayout: UiLayout;
  style: CombatStyle;
  queuedStyle?: CombatStyle | null;
  onStyleChange: (style: CombatStyle) => void;
  onNavigate: (screen: ScreenId) => void;
}) {
  const stats = getDerivedStats(game, style);
  return (
    <section className="combat-dashboard-panel combat-player-panel" aria-labelledby="player-title">
      <UiPanelRegionGrid screen="combat" panelId="player" layout={uiLayout} className="combat-player-regions">
        <UiPanelRegionSlot screen="combat" panelId="player" regionId="playerIdentity" layout={uiLayout}>
          <div className="combat-panel-heading">
            <div className="combat-panel-kicker">Player</div>
            <div className="combat-player-heading-line">
              <div className="combat-player-portrait" aria-hidden="true">
                <UserRound size={25} />
              </div>
              <div>
                <h2 id="player-title">{game.player.name}</h2>
                <span className="muted">
                  <ExplainedTerm concept="combat-level" showHelpIcon={game.settings.showHelpIcons}>
                    Combat level
                  </ExplainedTerm>{' '}
                  {stats.combatLevel}
                </span>
              </div>
            </div>
          </div>
        </UiPanelRegionSlot>
        <UiPanelRegionSlot screen="combat" panelId="player" regionId="playerEquipment" layout={uiLayout}>
          <div className="combat-player-equipment-region">
            <div className="combat-panel-divider" />
            <div className="combat-panel-kicker">Equipment</div>
            <EquipmentStrip game={game} />
          </div>
        </UiPanelRegionSlot>
        <UiPanelRegionSlot screen="combat" panelId="player" regionId="playerCombatStyle" layout={uiLayout}>
          <StyleControls style={style} queuedStyle={queuedStyle} onChange={onStyleChange} />
        </UiPanelRegionSlot>
        <UiPanelRegionSlot screen="combat" panelId="player" regionId="playerDerivedStats" layout={uiLayout}>
          <div className="combat-player-derived-region">
            <div className="combat-subheading-row">
              <span className="combat-panel-kicker">Derived stats</span>
              <button type="button" className="combat-text-link" onClick={() => onNavigate('equipment')}>
                Full character statistics <ArrowUpRight size={13} />
              </button>
            </div>
            <div className="combat-stats-grid">
              <StatLine label="Accuracy" value={Math.round(stats.effectiveAccuracyRating)} concept="accuracy" showHelpIcons={game.settings.showHelpIcons} />
              <StatLine label="Damage" value={formatDamageRange(stats.effectiveMaxHit)} concept="damage-range" showHelpIcons={game.settings.showHelpIcons} />
              <StatLine label="Defence" value={Math.round(stats.effectiveDefenceRating)} concept="defence" showHelpIcons={game.settings.showHelpIcons} />
              <StatLine label="Attack speed" value={formatSeconds(stats.attackIntervalMs)} concept="attack-speed" showHelpIcons={game.settings.showHelpIcons} />
            </div>
            <span className="sr-only">Current target: {enemy.name}</span>
          </div>
        </UiPanelRegionSlot>
      </UiPanelRegionGrid>
    </section>
  );
}

function EnemySummaryPanel({
  game,
  enemy,
  onViewLoot,
  uiLayout,
}: {
  game: GameState;
  enemy: EnemyDefinition;
  onViewLoot: (enemyId: EnemyId) => void;
  uiLayout: UiLayout;
}) {
  const [combatDetailsExpanded, setCombatDetailsExpanded] = useState(false);
  const active =
    game.activeAction.type === 'combat' && game.activeAction.enemyId === enemy.id
      ? game.activeAction
      : null;
  const enemyStats = getEnemyCombatStats(
    enemy,
    active?.combatState.eliteModifier ?? null,
    active?.combatState.enemyHp ?? enemy.maxHealth,
    game.player.currentHp /
      Math.max(1, getDerivedStats(game, active?.style ?? 'accurate', selectPlayerCombatEffects(game)).maxHealth),
    selectEnemyCombatEffects(game),
    selectPlayerCombatEffects(game),
    active?.combatState.traitState,
  );
  const baseEnemyDps =
    (1 + enemyStats.maxHit) / 2 / Math.max(0.001, enemyStats.attackIntervalMs / 1000);
  return (
    <section className="combat-dashboard-panel combat-enemy-panel" aria-labelledby="enemy-title">
      <UiPanelRegionGrid screen="combat" panelId="enemy" layout={uiLayout} className="combat-enemy-regions">
      <UiPanelRegionSlot screen="combat" panelId="enemy" regionId="enemyIdentity" layout={uiLayout}>
      <div className="combat-panel-heading">
        <div className="combat-panel-kicker">Enemy</div>
        <div className="combat-enemy-heading-line">
          <CombatPortrait enemy={enemy} large ariaLabel={`${enemy.name} target preview`} />
          <div>
            <h2 id="enemy-title">{enemy.name}</h2>
            <span className="muted">Level {enemy.displayLevel}</span>
            {active?.combatState.eliteModifier && (
              <div className="badge gold" aria-label="Elite enemy">
                ELITE · {eliteById[active.combatState.eliteModifier].name}
              </div>
            )}
          </div>
        </div>
      </div>
      <p className="combat-enemy-description">{enemy.description}</p>
      </UiPanelRegionSlot>
      <UiPanelRegionSlot screen="combat" panelId="enemy" regionId="enemyStats" layout={uiLayout}>
      <div className="combat-subheading-row">
        <span className="combat-panel-kicker">Combat details</span>
        <div className="combat-disclosure-actions">
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
      <div
        id="enemy-combat-details"
        className="combat-stats-grid combat-enemy-details"
        hidden={!combatDetailsExpanded}
      >
        <StatLine label="Accuracy" value={enemyStats.accuracyRating} concept="accuracy" showHelpIcons={game.settings.showHelpIcons} />
        <StatLine label="Defence" value={enemyStats.defenceRating} concept="defence" showHelpIcons={game.settings.showHelpIcons} />
        <StatLine label="Damage" value={formatDamageRange(enemyStats.maxHit)} concept="damage-range" showHelpIcons={game.settings.showHelpIcons} />
        <StatLine label="Attack interval" value={formatSeconds(enemyStats.attackIntervalMs)} concept="attack-speed" showHelpIcons={game.settings.showHelpIcons} />
        <StatLine label="Base DPS" value={baseEnemyDps.toFixed(1)} />
      </div>
      </UiPanelRegionSlot>
      <UiPanelRegionSlot screen="combat" panelId="enemy" regionId="enemyTraits" layout={uiLayout}>
      <div className="combat-panel-note combat-enemy-trait-note">
        <strong>{enemy.trait.name}</strong> — {enemy.trait.description}
      </div>
      {enemy.specialAttack && (
        <div className="combat-panel-note combat-enemy-special-note">
          <EnemySpecialDetails special={enemy.specialAttack} />
        </div>
      )}
      </UiPanelRegionSlot>
      <UiPanelRegionSlot screen="combat" panelId="enemy" regionId="enemyDrops" layout={uiLayout}>
      <div className="combat-drop-preview">
        <div className="combat-subheading-row">
          <span className="combat-panel-kicker">Drop preview</span>
          <button type="button" className="combat-text-link" onClick={() => onViewLoot(enemy.id)}>
            Full drop table <ArrowUpRight size={13} />
          </button>
        </div>
        <div
          className="combat-drop-list"
          role="region"
          aria-label={`${enemy.name} drop preview`}
          tabIndex={0}
        >
          {sortLootByChance(getResolvedLootSections(enemy.id).flatMap((section) => section.entries)).map((drop) => (
            <ItemTooltip
              item={itemById[drop.itemId]}
              disabled={!game.discoveredItems.includes(drop.itemId)}
              key={drop.itemId}
            >
              <div className="combat-drop-item">
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
            </ItemTooltip>
          ))}
        </div>
      </div>
      </UiPanelRegionSlot>
      </UiPanelRegionGrid>
    </section>
  );
}

function CombatPortraitSmall({ enemy }: { enemy: EnemyDefinition }) {
  return (
    <div className={`combat-roster-portrait theme-${enemy.theme}`} aria-hidden="true">
      <EnemyArt enemyId={enemy.id} variant="roster" />
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
          <EnemyTooltip enemy={enemy} kills={kills} key={enemyId}>
            <button
              type="button"
              className={`combat-enemy-card ${selected ? 'selected' : ''} ${fighting ? 'fighting' : ''}`}
              aria-pressed={selected}
              aria-label={`${action} ${enemy.name}, level ${enemy.displayLevel}`}
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
          </EnemyTooltip>
        );
      })}
    </div>
  );
}

function CombatBrowser({
  game,
  uiLayout,
  selectedRegionId,
  selectedSubRegionId,
  selectedArea,
  selectedEnemy,
  activeEnemy,
  activeArea,
  locationsExpanded,
  style,
  onSelectArea,
  onSelectRegion,
  onSelectSubRegion,
  onSelectEnemy,
  onViewLoot,
  onToggleLocations,
}: {
  game: GameState;
  uiLayout: UiLayout;
  selectedRegionId: CombatRegionId;
  selectedSubRegionId: keyof typeof combatSubRegionById;
  selectedArea: AreaId;
  selectedEnemy: EnemyId;
  activeEnemy: EnemyId | null;
  activeArea: AreaId | null;
  locationsExpanded: boolean;
  style: CombatStyle;
  onSelectArea: (areaId: AreaId) => void;
  onSelectRegion: (regionId: CombatRegionId) => void;
  onSelectSubRegion: (subRegionId: keyof typeof combatSubRegionById) => void;
  onSelectEnemy: (enemyId: EnemyId, areaId: AreaId) => void;
  onViewLoot: (enemyId: EnemyId) => void;
  onToggleLocations: () => void;
}) {
  const region = combatRegionById[selectedRegionId] ?? combatRegionById.tauraque;
  const subRegion = combatSubRegionById[selectedSubRegionId] ?? combatSubRegionById['lornwick-vale'];
  const sortedAreaIds = [...subRegion.areaIds].sort(
    (left, right) =>
      (areaById[left]?.requiredCombatLevel ?? Number.MAX_SAFE_INTEGER) -
      (areaById[right]?.requiredCombatLevel ?? Number.MAX_SAFE_INTEGER),
  );
  const area = areaById[selectedArea] ?? areaById['redknife-road-camp'];
  const selectedTarget = enemyById[selectedEnemy] ?? enemyById['redknife-lookout'];
  const currentArea = activeArea ? areaById[activeArea] : null;
  const currentTarget = activeEnemy ? enemyById[activeEnemy] : null;
  const browsingDifferentTarget = Boolean(
    currentArea &&
    currentTarget &&
    (currentArea.id !== area.id || currentTarget.id !== selectedTarget.id),
  );
  return (
    <section className="combat-locations combat-browser" aria-labelledby="combat-locations-title">
      <UiPanelRegionGrid screen="combat" panelId="combatLocations" layout={uiLayout} className="combat-locations-regions">
      <UiPanelRegionSlot screen="combat" panelId="combatLocations" regionId="combatLocationsNavigation" layout={uiLayout}>
      <div className="combat-section-heading">
        <div>
          <div className="eyebrow">Choose your road</div>
          <h2 id="combat-locations-title">Combat Browser</h2>
        </div>
        <button
          type="button"
          className="combat-locations-toggle"
          aria-expanded={locationsExpanded}
          aria-controls="combat-browser-content"
          onClick={onToggleLocations}
        >
          {locationsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {locationsExpanded ? 'Collapse browser' : 'Show browser'}
        </button>
      </div>
      {!locationsExpanded && (
        <div className="combat-browser-collapsed-summary">
          {browsingDifferentTarget ? (
            <>
              <span>
                Current {currentArea?.name} · {currentTarget?.name}
              </span>
              <small>
                Selected {area.name} · {selectedTarget.name}
              </small>
            </>
          ) : (
            <span>
              {activeEnemy
                ? `Current ${area.name} · ${selectedTarget.name}`
                : `Selected ${area.name} · ${selectedTarget.name}`}
            </span>
          )}
        </div>
      )}
      </UiPanelRegionSlot>
      <UiPanelRegionSlot screen="combat" panelId="combatLocations" regionId="combatLocationsAreas" layout={uiLayout}>
      <div
        id="combat-browser-content"
        className="combat-browser-content"
        hidden={!locationsExpanded}
      >
        <div className="combat-regions-heading">
          <span className="combat-panel-kicker">Region</span>
        </div>
        <div className="combat-region-selector" aria-label="Combat regions">
          {COMBAT_REGIONS.map((candidate) => {
            const RegionIcon = regionIcon[candidate.presentation.iconKey];
            const available = candidate.availability === 'available';
            return (
              <button
                type="button"
                className={`combat-region-card ${available ? 'available' : 'coming-soon'} ${candidate.id === selectedRegionId ? 'selected' : ''}`}
                disabled={!available}
                aria-label={`${candidate.name}${available ? '' : ', coming later'}`}
                key={candidate.id}
                onClick={() => available && onSelectRegion(candidate.id)}
              >
                {REGION_ART[candidate.id] ? (
                  <WorldArt kind="region" id={candidate.id} />
                ) : (
                  <RegionIcon size={17} aria-hidden="true" />
                )}
                <span>
                  <strong>{candidate.name}</strong>
                </span>
                {!available && <Lock size={14} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
        <div className="combat-region-description">
          <strong>{region.name}</strong>
          <span>{region.description}</span>
        </div>
        <div className="combat-regions-heading"><span className="combat-panel-kicker">Sub-regions</span></div>
        <div className="combat-region-selector" aria-label="Combat sub-regions">
          {COMBAT_SUB_REGIONS.map((candidate) => {
            const available = candidate.availability === 'available';
            return (
              <button
                type="button"
                className={`combat-region-card ${available ? 'available' : 'coming-soon'} ${candidate.id === selectedSubRegionId ? 'selected' : ''}`}
                aria-label={`${candidate.name}${available ? '' : ', locked'}`}
                key={candidate.id}
                onClick={() => onSelectSubRegion(candidate.id)}
              >
                {SUB_REGION_ART[candidate.id] ? (
                  <WorldArt kind="sub-region" id={candidate.id} />
                ) : null}
                <span><strong>{candidate.name}</strong></span>
                {!available && <Lock size={14} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
        <div className="combat-region-description">
          <strong>{subRegion.name}</strong>
          <span>{subRegion.description}</span>
        </div>
        <div className="combat-area-grid" aria-label={`${region.name} combat areas`}>
          {sortedAreaIds.map((areaId) => {
            const candidate = areaById[areaId];
            const unlocked = isCombatAreaUnlocked(game, candidate);
            const selected = selectedArea === candidate.id;
            const activeFight = activeArea === candidate.id;
            const Icon = zoneIcon[candidate.presentation.iconKey];
            return (
              <button
                type="button"
                className={`combat-area-card ${selected ? 'selected' : ''} ${activeFight ? 'fighting' : ''} ${!unlocked ? 'locked' : ''}`}
                aria-pressed={selected}
                key={candidate.id}
                onClick={() => onSelectArea(candidate.id)}
              >
                <span className="combat-area-card-header">
                  <span className="combat-area-card-icon" style={{ background: candidate.accent }}>
                    {unlocked ? (
                      AREA_ART[candidate.id] ? (
                        <WorldArt kind="area" id={candidate.id} />
                      ) : (
                        <Icon size={18} aria-hidden="true" />
                      )
                    ) : (
                      <Lock size={16} aria-hidden="true" />
                    )}
                  </span>
                  <span className="combat-area-card-copy">
                    <strong>{candidate.name}</strong>
                    <small>{candidate.identity}</small>
                  </span>
                </span>
                <span className="combat-area-card-meta">
                  Requires Combat Lv {candidate.requiredCombatLevel}
                </span>
                <span className="badge combat-area-card-type">AREA</span>
                <span className="combat-area-card-footer">
                  <span className="combat-area-card-status">
                    {activeFight
                      ? 'Fighting here'
                      : selected
                        ? 'Selected'
                        : unlocked
                          ? 'Available'
                          : 'Locked'}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
      </UiPanelRegionSlot>
      <UiPanelRegionSlot screen="combat" panelId="combatLocations" regionId="combatLocationsEnemies" layout={uiLayout}>
      <div className="combat-browser-content combat-browser-enemies-content" hidden={!locationsExpanded}>
        <div className="combat-browser-selection">
          <div className="combat-browser-roster">
            <div className="combat-location-content-heading">
              <span className="combat-panel-kicker">{area.name} · Enemy roster</span>
              <span className="muted">Choose a target to preview it.</span>
            </div>
            <EnemyRoster
              game={game}
              area={area}
              selectedEnemy={selectedEnemy}
              activeEnemy={activeEnemy}
              onSelect={onSelectEnemy}
            />
          </div>
            {area.enemyIds.length ? (
              <TargetAnalysis
                game={game}
                enemy={selectedTarget}
                style={style}
                onViewLoot={onViewLoot}
              />
            ) : (
              <div className="combat-future-content" aria-label="Locked Area preview">
                <Lock size={19} />
                <div><strong>Area locked</strong><span>Targets will be revealed when this Area becomes available.</span></div>
              </div>
            )}
        </div>
      </div>
      </UiPanelRegionSlot>
      </UiPanelRegionGrid>
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
  onViewLoot,
}: {
  game: GameState;
  enemy: EnemyDefinition;
  style: CombatStyle;
  onViewLoot: (enemyId: EnemyId) => void;
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
    ['Enemy damage', formatDamageRange(enemyStats.maxHit)],
    ['Expected XP from full kill', `${getCombatDamageXp(enemyStats.maxHealth)} XP`],
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
          <CombatPortrait enemy={enemy} large />
          <span className="combat-analysis-target-copy">
            <strong>{enemy.name}</strong>
              <span>Enemy Lv {enemy.displayLevel}</span>
            <small>{formatNumber(game.killCounts[enemy.id] ?? 0)} lifetime kills</small>
          </span>
          <button type="button" className="combat-text-link" onClick={() => onViewLoot(enemy.id)}>
            Full drop table <ArrowUpRight size={13} />
          </button>
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
              <span>
                {label.toLowerCase().includes('chance') ? (
                  <ExplainedTerm concept="hit-chance" showHelpIcon={game.settings.showHelpIcons}>
                    {label}
                  </ExplainedTerm>
                ) : (
                  label
                )}
              </span>
              <strong className="ui-stat-compact combat-analysis-value">{value}</strong>
            </div>
          ))}
        </div>
        <div className="combat-analysis-trait combat-analysis-trait-emphasized">
          <strong className="combat-analysis-trait-heading">
            {trait.name}
          </strong>
          <span className="combat-analysis-trait-copy">
            {trait.description}
          </span>
        </div>
        {enemy.specialAttack && (
          <div className="combat-analysis-trait combat-analysis-special">
            <EnemySpecialDetails special={enemy.specialAttack} emphasizeLabel />
          </div>
        )}
      </div>
    </section>
  );
}

function RecentActions({
  game,
  sessionStartedAt,
  encounterStartedAt,
}: {
  game: GameState;
  sessionStartedAt: number | null;
  encounterStartedAt: number | null;
}) {
  const entries = useMemo(
    () =>
      game.activityLogs.combat
        .filter((entry) => sessionStartedAt === null || entry.at >= sessionStartedAt)
        .slice(0, 8),
    [game.activityLogs.combat, sessionStartedAt],
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
            const presentation = getCombatLogPresentation(entry);
            const Icon = presentation.icon;
            return (
              <div
                className={`combat-live-log-entry ${presentation.category} ${presentation.important ? 'important' : ''}`}
                key={entry.id}
              >
                <time className="combat-live-log-time">
                  {formatCombatLogTime(entry.at, entry.encounterStartedAt ?? encounterStartedAt)}
                </time>
                <span className="combat-live-log-icon">
                  <Icon size={12} />
                </span>
                <span className="combat-live-log-message">{presentation.text}</span>
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
  uiLayout,
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
  uiLayout: UiLayout;
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
  const combatAction =
    game.activeAction.type === 'combat' && game.activeAction.enemyId === enemy.id
      ? game.activeAction
      : null;
  const enemyStats = getEnemyCombatStats(
    enemy,
    combatAction?.combatState.eliteModifier ?? null,
    combatAction?.combatState.enemyHp ?? enemy.maxHealth,
    game.player.currentHp /
      Math.max(
        1,
        getDerivedStats(game, combatAction?.style ?? 'accurate', selectPlayerCombatEffects(game)).maxHealth,
      ),
    selectEnemyCombatEffects(game),
  );
  const special = itemById[game.equipment.weapon ?? '']?.specialAttack;
  const adrenaline = combatAction?.combatState.adrenaline ?? 0;
  const enemySpecialCharge = selectEnemySpecialCharge(game);
  const enemySpecialReady = selectEnemySpecialReady(game);
  const enemySpecialProgress = selectEnemySpecialProgress(game);
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
      className={`combat-live-panel status-${status.toLowerCase().replaceAll(' ', '-')} ${combatAction?.combatState.eliteModifier ? 'elite-active' : ''}`}
      aria-label="Live combat resolution"
    >
      <UiPanelRegionGrid screen="combat" panelId="liveCombat" layout={uiLayout} className="combat-live-regions">
      <UiPanelRegionSlot screen="combat" panelId="liveCombat" regionId="liveCombatStatus" layout={uiLayout}>
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
            accessibleName="Player"
            current={game.player.currentHp}
            max={getDerivedStats(game, combatAction?.style ?? 'accurate', selectPlayerCombatEffects(game)).maxHealth}
            tone="player"
          />
          <AttackProgress label="Next attack" progress={playerProgress} tone="player" />
        </div>
        <div className="combat-resolution-vs" aria-hidden="true">
          VS
        </div>
        <div className="combat-resolution-side enemy">
          <HealthBar
            accessibleName={enemy.name}
            current={enemyHp}
            max={combatAction?.combatState.enemyMaxHp ?? enemyStats.maxHealth}
            tone="enemy"
          />
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
        <span className="combat-resolution-status-spacer" aria-hidden="true" />
      </div>
      <div className="combat-effect-lanes" aria-label="Combat effects">
        <CombatEffectLane target="player" effects={selectPlayerCombatEffects(game)} />
        <CombatEffectLane target="enemy" effects={selectEnemyCombatEffects(game)} />
      </div>
      </UiPanelRegionSlot>
      <UiPanelRegionSlot screen="combat" panelId="liveCombat" regionId="liveCombatTimeline" layout={uiLayout}>
      {enemy.specialAttack && combatAction && (
        <div className={`combat-enemy-special ${enemySpecialReady ? 'ready' : ''}`}>
          <div className="combat-enemy-special-head">
            <GameTooltip
              content={<EnemySpecialDetails special={enemy.specialAttack} includeChargeRule includeNormalQualifier />}
              label={`${enemy.specialAttack.name} enemy special details`}
            >
              <span className="combat-enemy-special-name">
                Special Charge · <strong>{enemy.specialAttack.name}</strong>
              </span>
            </GameTooltip>
            <strong className="ui-stat-compact combat-enemy-special-value">{enemySpecialCharge} / {COMBAT_TUNING.enemySpecialChargeMax}{enemySpecialReady ? ' READY' : ''}</strong>
          </div>
          <div
            className="combat-enemy-special-track"
            role="progressbar"
            aria-label={`${enemy.specialAttack.name} Special Charge`}
            aria-valuemin={0}
            aria-valuemax={COMBAT_TUNING.enemySpecialChargeMax}
            aria-valuenow={enemySpecialCharge}
          >
            <i style={{ width: `${enemySpecialProgress * 100}%` }} />
          </div>
        </div>
      )}
      <div className={`combat-adrenaline ${adrenaline >= COMBAT_TUNING.adrenalineMax ? 'ready' : ''}`} aria-label="Adrenaline">
        <div className="combat-adrenaline-head">
          <ExplainedTerm concept="adrenaline" showHelpIcon={game.settings.showHelpIcons}>
            Adrenaline
          </ExplainedTerm>
          <strong className="ui-stat-compact combat-adrenaline-value">
            {adrenaline} / {COMBAT_TUNING.adrenalineMax}{' '}
            {adrenaline >= COMBAT_TUNING.adrenalineMax ? 'READY' : ''}
          </strong>
        </div>
        <div
          className="combat-adrenaline-track"
          role="progressbar"
          aria-label="Adrenaline"
          aria-valuemin={0}
          aria-valuemax={COMBAT_TUNING.adrenalineMax}
          aria-valuenow={adrenaline}
        >
          <i style={{ width: `${(adrenaline / COMBAT_TUNING.adrenalineMax) * 100}%` }} />
        </div>
        <div className="combat-adrenaline-details">
          {special ? (
            <div className="combat-special-summary">
              <strong>{special.name}</strong>
              <SpecialAttackDetails special={special} />
              <small>{special.description}</small>
            </div>
          ) : (
            <small>Equip a weapon with a special attack</small>
          )}
        </div>
      </div>
      </UiPanelRegionSlot>
      <UiPanelRegionSlot screen="combat" panelId="liveCombat" regionId="liveCombatControls" layout={uiLayout}>
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
            <div
              id="combat-settings-popover"
              className="combat-settings-popover"
              role="dialog"
              aria-label="Combat settings"
            >
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
        {!autoSpecial && special && adrenaline >= COMBAT_TUNING.adrenalineMax && (
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
      </UiPanelRegionSlot>
      <UiPanelRegionSlot screen="combat" panelId="liveCombat" regionId="liveCombatLog" layout={uiLayout}>
      <RecentActions
        game={game}
        sessionStartedAt={sessionStartedAt}
        encounterStartedAt={encounterStartedAt}
      />
      </UiPanelRegionSlot>
      </UiPanelRegionGrid>
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
  const goldRange = getCombatGoldRange(enemy.id);
  return (
    <section className="combat-overview-content combat-loot-content" aria-labelledby="loot-title">
      <div className="combat-section-heading">
        <div>
          <div className="eyebrow">Rewards and discovery</div>
          <h2 id="loot-title">
            Loot table <span className="combat-loot-target">({enemy.name})</span>
          </h2>
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
        {sortLootByChance(getResolvedLootSections(enemy.id).flatMap((section) => section.entries)).map((drop) => {
          const discovered = game.discoveredItems.includes(drop.itemId);
          const rarity = getLootRarity(drop.chance);
          return (
            <div className="combat-loot-row" key={drop.itemId}>
              <ItemTooltip item={itemById[drop.itemId]} disabled={!discovered}>
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
              </ItemTooltip>
              <span>
                {drop.min}–{drop.max}
              </span>
              <span>{displayDropChance(drop.chance)}</span>
              <span>{getItemQuantity(game.inventory, drop.itemId)}</span>
            </div>
          );
        })}
        {goldRange && <div className="combat-loot-row gold">
          <span className="combat-loot-item">
            <ItemIcon gold size="sm" />
            <span>
              <strong>Gold</strong>
              <small>Guaranteed</small>
            </span>
          </span>
          <span>{goldRange[0]}–{goldRange[1]}</span>
          <span>Guaranteed</span>
          <span>{formatNumber(game.gold)}</span>
        </div>}
      </div>
      <div className="combat-rewards-list">
        <span className="combat-panel-kicker">Recent rewards</span>
        {recentLoot.length ? (
          recentLoot.map((event) => {
            const summary = formatRecentRewardSummary(event.gold, event.items);
            if (!summary) return null;
            return (
              <div className="combat-reward-row" key={event.id}>
                <Trophy size={13} />
                <span>{summary}</span>
              </div>
            );
          })
        ) : (
          <span className="muted">Rewards from this enemy will appear here.</span>
        )}
      </div>
    </section>
  );
}

function getNextUnlockText(game: GameState): { name: string; requirement: string } {
  const next = AREAS.find((area) => area.availability === 'available' && !isCombatAreaUnlocked(game, area));
  return next
    ? { name: next.name, requirement: `Requires Combat Lv ${next.requiredCombatLevel}` }
    : {
        name: 'All current areas unlocked',
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
        <strong className="ui-stat-compact">{formatNumber(session.xpGained[selectedSkill] ?? 0)} XP</strong>
        <small>{formatNumber(xpHour)} XP/hour</small>
      </div>
      <div className="combat-xp-grid">
        {skills.map((skill) => {
          const progress = getLevelProgress(game.skills[skill]);
          return (
            <div className="combat-xp-row" key={skill}>
              <div>
                <span>{skill[0].toUpperCase() + skill.slice(1)}</span>
                <b className="ui-stat-compact">Lv {game.skills[skill].level}</b>
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
          <strong className="ui-stat-compact">{formatDuration(started)}</strong>
          <span>time active</span>
        </div>
        <div>
          <strong className="ui-stat-compact">{formatNumber(session.enemiesDefeated)}</strong>
          <span>enemies defeated</span>
        </div>
        <div>
          <strong className="ui-stat-compact">{formatNumber(totalXp)}</strong>
          <span>XP gained</span>
        </div>
        <div>
          <strong className="ui-stat-compact">{formatNumber(session.goldGained)}</strong>
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

function OverviewSummary({ session }: { session: CombatSessionStats }) {
  const sessionStartedAt = session.startedAt;
  const started = sessionStartedAt ? Math.max(1_000, Date.now() - sessionStartedAt) : 0;
  const itemsGained = Object.values(session.lootGained).reduce((sum, amount) => sum + amount, 0);
  const actualDps = getActualDps(session.damageDealt, started);
  const playerHitRate =
    session.playerAttacks > 0
      ? `${Math.round((session.playerHits / session.playerAttacks) * 100)}%`
      : '—';
  const enemyHitRate =
    session.enemyAttacks > 0
      ? `${Math.round((session.enemyHits / session.enemyAttacks) * 100)}%`
      : '—';
  const specialHitRate =
    session.specialAttempts > 0
      ? `${Math.round((session.specialHits / session.specialAttempts) * 100)}%`
      : '—';
  const averageKillTime =
    session.enemiesDefeated > 0 ? formatSeconds(started / session.enemiesDefeated) : '—';
  const actualKillsPerHour = getActualKillsPerHour(session.enemiesDefeated, started);
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
          <span className="combat-panel-kicker">Performance · Actual</span>
          <strong className="ui-stat-compact combat-overview-value">{actualDps.toFixed(1)}</strong>
          <small>actual DPS</small>
          <strong className="ui-stat-compact combat-overview-value">{playerHitRate}</strong>
          <small>player hit rate</small>
          <strong className="ui-stat-compact combat-overview-value">{enemyHitRate}</strong>
          <small>enemy hit rate</small>
          <strong className="ui-stat-compact combat-overview-value">{specialHitRate}</strong>
          <small>special hit rate</small>
        </div>
        <div>
          <span className="combat-panel-kicker">Timing · Actual</span>
          <strong className="ui-stat-compact combat-overview-value">{averageKillTime}</strong>
          <small>average kill time</small>
          <strong className="ui-stat-compact combat-overview-value">{actualKillsPerHour.toFixed(1)}</strong>
          <small>actual kills/hour</small>
          <strong className="ui-stat-compact combat-overview-value">{formatNumber(session.damageDealt)}</strong>
          <small>damage dealt</small>
          <strong className="ui-stat-compact combat-overview-value">{formatNumber(session.damageTaken)}</strong>
          <small>damage taken</small>
        </div>
        <div>
          <span className="combat-panel-kicker">Rewards · Actual</span>
          <strong className="ui-stat-compact combat-overview-value">{formatNumber(session.goldGained)}</strong>
          <small>gold gained</small>
          <strong className="ui-stat-compact combat-overview-value">{formatNumber(itemsGained)}</strong>
          <small>items gained</small>
          <strong className="ui-stat-compact combat-overview-value">{session.eliteEnemiesDefeated}</strong>
          <small>elite kills</small>
        </div>
      </div>
    </section>
  );
}

function CombatOverviewTabs({
  game,
  lootEnemy,
  session,
  style,
  events,
  tab,
  onTabChange,
  uiLayout,
}: {
  game: GameState;
  lootEnemy: EnemyDefinition;
  session: CombatSessionStats;
  style: CombatStyle;
  events: CombatVisualEvent[];
  tab: OverviewTab;
  onTabChange: (tab: OverviewTab) => void;
  uiLayout: UiLayout;
}) {
  const tabLabels: Record<OverviewTab, string> = {
    overview: 'Session summary',
    loot: 'Loot',
    progression: 'Progression',
  };
  return (
    <section id="combat-overview-panel" className="combat-overview" aria-label="Combat summary">
      <UiPanelRegionGrid screen="combat" panelId="combatOverview" layout={uiLayout} className="combat-overview-regions">
      <UiPanelRegionSlot screen="combat" panelId="combatOverview" regionId="combatOverviewTabs" layout={uiLayout}>
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
      </UiPanelRegionSlot>
      <UiPanelRegionSlot screen="combat" panelId="combatOverview" regionId="combatOverviewContent" layout={uiLayout}>
      {tab === 'overview' ? (
        <OverviewSummary session={session} />
      ) : tab === 'loot' ? (
        <LootPanel game={game} enemy={lootEnemy} events={events} />
      ) : (
        <ProgressionPanel game={game} session={session} style={style} />
      )}
      </UiPanelRegionSlot>
      </UiPanelRegionGrid>
    </section>
  );
}

export function CombatScreen({
  game,
  uiLayout,
  requestAction,
  requestConfirmation: _requestConfirmation,
  onNavigate,
}: {
  game: GameState;
  uiLayout: UiLayout;
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
  const [locationsExpanded, setLocationsExpanded] = useState(true);
  const [overviewTab, setOverviewTab] = useState<OverviewTab>('overview');
  const [lootEnemyId, setLootEnemyId] = useState<EnemyId | null>(null);
  const [selectedArea, setSelectedArea] = useState<AreaId>(activeAreaId ?? 'redknife-road-camp');
  const [selectedEnemy, setSelectedEnemy] = useState<EnemyId>(activeEnemyId ?? 'redknife-lookout');
  const [selectedRegionId, setSelectedRegionId] = useState<CombatRegionId>(
    areaById[activeAreaId ?? 'redknife-road-camp']?.regionId ?? 'tauraque',
  );
  const [selectedSubRegionId, setSelectedSubRegionId] = useState<keyof typeof combatSubRegionById>(
    activeAreaId ? areaById[activeAreaId].subRegionId : 'lornwick-vale',
  );
  const [style, setStyle] = useState<CombatStyle>(activeStyle ?? 'accurate');
  const [autoRepeat, setAutoRepeat] = useState(activeAutoRepeat ?? true);
  const [autoSpecial, setAutoSpecial] = useState(activeAutoSpecial ?? true);
  const startCombat = useGameStore((store) => store.startCombat);
  const switchCombatTarget = useGameStore((store) => store.switchCombatTarget);
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
  const previousCombatActive = useRef(Boolean(active));
  const autoCollapsedCombatRun = useRef(false);
  const handleViewLoot = (enemyId: EnemyId) => {
    setLootEnemyId(enemyId);
    setOverviewTab('loot');
    const overviewPanel = document.getElementById('combat-overview-panel');
    if (overviewPanel && typeof overviewPanel.scrollIntoView === 'function') {
      overviewPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
  const currentAreaId = activeAreaId ?? selectedArea;
  const currentEnemyId = activeEnemyId ?? selectedEnemy;
  const currentArea = areaById[currentAreaId] ?? areaById['redknife-road-camp'];
  const currentEnemy = enemyById[currentEnemyId] ?? enemyById['redknife-lookout'];
  const lootEnemy = enemyById[lootEnemyId ?? currentEnemyId] ?? currentEnemy;
  const selectedTargetArea = areaById[selectedArea] ?? areaById['redknife-road-camp'];
  const selectedTarget = enemyById[selectedEnemy] ?? enemyById['redknife-lookout'];
  const targetChanged = Boolean(
    active && (active.areaId !== selectedTargetArea.id || active.enemyId !== selectedTarget.id),
  );
  const encounterStartedAt =
    active?.combatState.encounterStartedAt ?? session.encounterStartedAt ?? session.startedAt;
  const inventoryFull = occupiedSlots(game.inventory) >= GAME_CONFIG.inventorySlots;
  const locked = !isCombatAreaUnlocked(game, selectedTargetArea);

  useEffect(() => {
    const combatActive = active !== null;
    if (!combatActive) {
      autoCollapsedCombatRun.current = false;
      setLocationsExpanded(true);
    } else if (!previousCombatActive.current && !autoCollapsedCombatRun.current) {
      setLocationsExpanded(false);
      autoCollapsedCombatRun.current = true;
    }
    previousCombatActive.current = combatActive;
  }, [active]);

  useEffect(() => {
    if (
      activeAreaId === undefined ||
      activeEnemyId === undefined ||
      activeStyle === undefined ||
      activeAutoRepeat === undefined
    )
      return;
    setSelectedArea(activeAreaId);
    setSelectedEnemy(activeEnemyId);
    setSelectedRegionId(areaById[activeAreaId]?.regionId ?? 'tauraque');
    setSelectedSubRegionId(areaById[activeAreaId]?.subRegionId ?? 'lornwick-vale');
    setStyle(activeStyle);
    setAutoRepeat(activeAutoRepeat);
    setAutoSpecial(activeAutoSpecial ?? true);
  }, [activeAreaId, activeEnemyId, activeStyle, activeAutoRepeat, activeAutoSpecial]);

  useEffect(() => {
    setLootEnemyId(null);
  }, [activeEnemyId, selectedEnemy]);

  const selectArea = (areaId: AreaId) => {
    const area = areaById[areaId];
    if (!area) return;
    // Area and enemy changes are browsing-only while combat is active. The
    // action button applies the selected target to the live encounter.
    setSelectedArea(areaId);
    setSelectedRegionId(area.regionId);
    setSelectedSubRegionId(area.subRegionId);
    setSelectedEnemy(area.enemyIds[0] ?? 'redknife-lookout');
  };

  const selectRegion = (regionId: CombatRegionId) => {
    const firstAreaId = combatSubRegionById['lornwick-vale'].areaIds[0] as AreaId;
    const area = firstAreaId ? areaById[firstAreaId] : undefined;
    setSelectedRegionId(regionId);
    if (area) {
      setSelectedArea(area.id);
      setSelectedSubRegionId('lornwick-vale');
      setSelectedEnemy(area.enemyIds[0] ?? 'redknife-lookout');
    }
  };

  const selectSubRegion = (subRegionId: keyof typeof combatSubRegionById) => {
    const subRegion = combatSubRegionById[subRegionId];
    setSelectedSubRegionId(subRegionId);
    const firstAreaId = subRegion.areaIds[0] as AreaId;
    const area = areaById[firstAreaId];
    if (area) {
      setSelectedArea(area.id);
      setSelectedEnemy(area.enemyIds[0] ?? 'redknife-lookout');
    }
  };

  const selectEnemy = (enemyId: EnemyId, areaId: AreaId) => {
    setSelectedArea(areaId);
    setSelectedRegionId(areaById[areaId]?.regionId ?? 'tauraque');
    setSelectedSubRegionId(areaById[areaId]?.subRegionId ?? 'lornwick-vale');
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
      switchCombatTarget(
        selectedTargetArea.id,
        selectedTarget.id,
        active.pendingStyle ?? active.style,
        active.autoRepeat,
        active.autoSpecial,
      );
      setSelectedArea(selectedTargetArea.id);
      setSelectedEnemy(selectedTarget.id);
      return;
    }
    beginFight();
  };
  const changeStyle = (next: CombatStyle) => {
    setStyle(next);
    if (active) setCombatStyle(next);
  };
  const currentStyle = active?.style ?? style;
  const nextEncounterStyle = active?.pendingStyle ?? style;
  const activeAutoRepeatValue = active?.autoRepeat ?? autoRepeat;
  const actionText = locked
    ? 'Target locked'
    : inventoryFull && !active
      ? 'Inventory full'
      : active && targetChanged
        ? `Switch to ${selectedTarget.name}`
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
        <div className="combat-context-section">
          <span className="context-kicker">{active ? 'Current fight' : 'Selected target'}</span>
          <b>
            {combatRegionById[currentArea.regionId].name} · {currentArea.name} · {currentEnemy.name}
          </b>
        </div>
        {targetChanged && (
          <>
            <ChevronRight size={15} />
            <div className="combat-context-section selected-next-target">
              <span className="context-kicker">Selected next target</span>
              <b>
                {combatRegionById[selectedTargetArea.regionId].name} · {selectedTargetArea.name} ·{' '}
                {selectedTarget.name}
              </b>
            </div>
          </>
        )}
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
        {targetChanged && <span className="combat-context-meta">Switch is explicit</span>}
      </div>
      <UiPanelGrid screen="combat" className="combat-dashboard-grid">
        <UiPanelSlot
          screen="combat"
          id="combatLocations"
          layout={uiLayout}
          autoHeight={!locationsExpanded}
        >
          <CombatBrowser
            game={game}
            uiLayout={uiLayout}
            selectedRegionId={selectedRegionId}
            selectedSubRegionId={selectedSubRegionId}
            selectedArea={selectedArea}
            selectedEnemy={selectedEnemy}
            activeEnemy={active?.enemyId ?? null}
            activeArea={active?.areaId ?? null}
            locationsExpanded={locationsExpanded}
            style={nextEncounterStyle}
            onSelectArea={selectArea}
            onSelectRegion={selectRegion}
            onSelectSubRegion={selectSubRegion}
            onSelectEnemy={selectEnemy}
            onViewLoot={handleViewLoot}
            onToggleLocations={() => setLocationsExpanded((expanded) => !expanded)}
          />
        </UiPanelSlot>
        <UiPanelSlot screen="combat" id="player" layout={uiLayout}>
          <PlayerSummaryPanel
            game={game}
            uiLayout={uiLayout}
            enemy={currentEnemy}
            style={currentStyle}
            queuedStyle={active?.pendingStyle}
            onStyleChange={changeStyle}
            onNavigate={onNavigate}
          />
        </UiPanelSlot>
        <UiPanelSlot screen="combat" id="liveCombat" layout={uiLayout}>
          <LiveCombatResolution
            game={game}
            enemy={currentEnemy}
            events={events}
            uiLayout={uiLayout}
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
        </UiPanelSlot>
        <UiPanelSlot screen="combat" id="enemy" layout={uiLayout}>
          <EnemySummaryPanel
            game={game}
            enemy={currentEnemy}
            uiLayout={uiLayout}
            onViewLoot={handleViewLoot}
          />
        </UiPanelSlot>
        <UiPanelSlot screen="combat" id="combatOverview" layout={uiLayout}>
          <CombatOverviewTabs
            game={game}
            lootEnemy={lootEnemy}
            session={session}
            style={currentStyle}
            events={events}
            tab={overviewTab}
            onTabChange={setOverviewTab}
            uiLayout={uiLayout}
          />
        </UiPanelSlot>
      </UiPanelGrid>
    </div>
  );
}
