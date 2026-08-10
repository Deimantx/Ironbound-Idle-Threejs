import type { ReactElement } from 'react';
import type { EnemyDefinition } from '../../game/types';
import { areaById } from '../../content/areas';
import { combatRegionById } from '../../content/combatRegions';
import { combatSubRegionById } from '../../content/combatSubRegions';
import { getEnemyCombatStats, type EffectiveEnemyStats } from '../../game/formulas/combatStats';
import { GameTooltip } from '../items/GameTooltip';
import { EnemySpecialDetails } from '../combat/EnemySpecialDetails';
import { formatDamageRange } from '../combat/combatPresentation';

export function EnemyTooltipContent({
  enemy,
  kills = 0,
  stats = getEnemyCombatStats(enemy),
}: {
  enemy: EnemyDefinition;
  kills?: number;
  stats?: EffectiveEnemyStats;
}) {
  return (
    <div className="enemy-tooltip-content">
      <div className="enemy-tooltip-header">
        <strong>{enemy.name}</strong>
        <span>Level {enemy.displayLevel}</span>
      </div>
      <span className="enemy-tooltip-location">
        {combatRegionById[areaById[enemy.areaId].regionId]?.name} · {combatSubRegionById[areaById[enemy.areaId].subRegionId]?.name} · {areaById[enemy.areaId].name}
      </span>
      <p>{enemy.description}</p>
      <div className="enemy-tooltip-stats">
        <span>Health <strong>{stats.maxHealth}</strong></span>
        <span>Damage <strong>{formatDamageRange(stats.maxHit)}</strong></span>
        <span>Accuracy <strong>{stats.accuracyRating}</strong></span>
        <span>Defence <strong>{stats.defenceRating}</strong></span>
        <span>Attack interval <strong>{(stats.attackIntervalMs / 1000).toFixed(1)}s</strong></span>
      </div>
      <div className="enemy-tooltip-trait">
        <span className="item-tooltip-kicker">Trait · {enemy.trait.name}</span>
        <span>{enemy.trait.description}</span>
      </div>
      {enemy.specialAttack && <EnemySpecialDetails special={enemy.specialAttack} includeChargeRule includeNormalQualifier />}
      <span className="enemy-tooltip-kills">Lifetime kills: {kills}</span>
    </div>
  );
}

export function EnemyTooltip({
  enemy,
  kills = 0,
  stats,
  children,
  disabled = false,
}: {
  enemy: EnemyDefinition;
  kills?: number;
  stats?: EffectiveEnemyStats;
  children: ReactElement;
  disabled?: boolean;
}) {
  if (disabled) return children;
  return (
    <GameTooltip
      content={<EnemyTooltipContent enemy={enemy} kills={kills} stats={stats} />}
      label={enemy.name}
    >
      {children}
    </GameTooltip>
  );
}
