import { COMBAT_TUNING } from '../../config/combatTuning';
import { enemyById } from '../../content/enemies';
import { eliteById } from '../../content/elites';
import { getCombatEffectModifiers, hasCombatEffect, hasCombatEffectKind } from './combatEffects';
import type { ActiveCombatEffect } from '../types';
import type { EliteModifierId, EnemyDefinition, EnemyId } from '../types';

export interface EffectiveEnemyStats {
  maxHealth: number;
  maxHit: number;
  accuracyRating: number;
  defenceRating: number;
  attackIntervalMs: number;
  flatDamageReduction: number;
  goldMultiplier: number;
  lootChanceMultiplier: number;
}

export const getEliteName = (modifier: EliteModifierId | null): string =>
  modifier ? eliteById[modifier]?.name ?? modifier : '';

export const getEnemyCombatStats = (
  enemy: EnemyDefinition,
  eliteModifier: EliteModifierId | null = null,
  currentHp = enemy.maxHealth,
  playerHealthPercent = 1,
  effects: ActiveCombatEffect[] = [],
  playerEffects: ActiveCombatEffect[] = [],
): EffectiveEnemyStats => {
  const elite = eliteModifier;
  const effectiveMaxHealth = enemy.maxHealth * (eliteModifier ? COMBAT_TUNING.eliteHealthMultiplier : 1);
  const lowHealth = currentHp <= effectiveMaxHealth * COMBAT_TUNING.goblinDesperateThreshold;
  let maxHitMultiplier = 1;
  let defenceMultiplier = 1;
  let intervalMultiplier = 1;
  let goldMultiplier = 1;
  let lootChanceMultiplier = 1;
  const effectModifiers = getCombatEffectModifiers(effects);
  let flatDamageReduction = effectModifiers.flatDamageReduction;
  const corneredHealth = currentHp <= effectiveMaxHealth * COMBAT_TUNING.corneredFuryHealthThreshold;
  const lastStandHealth = currentHp <= effectiveMaxHealth * COMBAT_TUNING.lastStandHealthThreshold;

  let accuracyMultiplier = 1;
  if (
    enemy.trait.id === 'opportunist' &&
    playerHealthPercent < COMBAT_TUNING.banditOpportunistHealthThreshold
  )
    accuracyMultiplier *= COMBAT_TUNING.banditOpportunistAccuracyMultiplier;

  if (enemy.trait.id === 'desperate-swing' && lowHealth)
    maxHitMultiplier *= COMBAT_TUNING.goblinDesperateMaxHitMultiplier;
  if (enemy.trait.id === 'evasive') defenceMultiplier *= COMBAT_TUNING.batDefenceMultiplier;
  if (enemy.trait.id === 'armoured-shell') flatDamageReduction += COMBAT_TUNING.crabFlatReduction;
  if (enemy.trait.id === 'stonehide') flatDamageReduction += COMBAT_TUNING.stonehideFlatReduction;
  if (enemy.trait.id === 'patchwork-plate') flatDamageReduction += COMBAT_TUNING.patchworkPlateFlatReduction;

  if (enemy.trait.id === 'cornered-fury' && corneredHealth && !hasCombatEffect(effects, 'cornered-fury')) {
    maxHitMultiplier *= COMBAT_TUNING.corneredFuryDamageMultiplier;
    intervalMultiplier *= COMBAT_TUNING.corneredFuryAttackIntervalMultiplier;
  }
  if (
    enemy.trait.id === 'blood-scent' &&
    hasCombatEffectKind(playerEffects, 'bleed') &&
    !hasCombatEffect(effects, 'blood-scent')
  )
    maxHitMultiplier *= COMBAT_TUNING.bloodScentDamageMultiplier;
  if (enemy.trait.id === 'reinforced-plating' && currentHp > effectiveMaxHealth * COMBAT_TUNING.reinforcedPlatingHealthThreshold && !hasCombatEffect(effects, 'reinforced-plating')) {
    defenceMultiplier *= COMBAT_TUNING.reinforcedPlatingDefenceMultiplier;
    flatDamageReduction += COMBAT_TUNING.reinforcedPlatingFlatReduction;
  }
  if (enemy.trait.id === 'last-stand' && lastStandHealth && !hasCombatEffect(effects, 'last-stand')) {
    accuracyMultiplier *= COMBAT_TUNING.lastStandAccuracyMultiplier;
    intervalMultiplier *= COMBAT_TUNING.lastStandAttackIntervalMultiplier;
  }

  if (elite === 'savage') maxHitMultiplier *= COMBAT_TUNING.eliteSavageMaxHitMultiplier;
  if (elite === 'armoured') {
    defenceMultiplier *= COMBAT_TUNING.eliteArmouredDefenceMultiplier;
    flatDamageReduction += COMBAT_TUNING.eliteArmouredFlatReduction;
  }
  if (elite === 'swift') intervalMultiplier *= COMBAT_TUNING.eliteSwiftIntervalMultiplier;
  if (elite) goldMultiplier *= COMBAT_TUNING.eliteGoldMultiplier;
  if (elite === 'wealthy') goldMultiplier *= COMBAT_TUNING.wealthyGoldMultiplier;
  if (elite === 'treasure-touched') lootChanceMultiplier = COMBAT_TUNING.treasureTouchedLootMultiplier;
  maxHitMultiplier *= effectModifiers.damageMultiplier;
  defenceMultiplier *= effectModifiers.defenceMultiplier;
  intervalMultiplier *= effectModifiers.attackIntervalMultiplier;
  accuracyMultiplier *= effectModifiers.accuracyMultiplier;

  return {
    maxHealth: Math.max(1, Math.round(effectiveMaxHealth)),
    maxHit: Math.max(1, Math.round(enemy.maxHit * maxHitMultiplier)),
    accuracyRating: Math.max(0, Math.round(enemy.accuracyRating * accuracyMultiplier)),
    defenceRating: Math.max(0, Math.round(enemy.defenceRating * defenceMultiplier)),
    attackIntervalMs: Math.max(
      COMBAT_TUNING.minimumAttackIntervalMs,
      Math.round(enemy.attackIntervalMs * intervalMultiplier),
    ),
    flatDamageReduction,
    goldMultiplier,
    lootChanceMultiplier,
  };
};

export const getEnemyByIdOrNull = (enemyId: EnemyId): EnemyDefinition | null =>
  enemyById[enemyId] ?? null;

export const getEliteModifierDisplay = (modifier: EliteModifierId | null) =>
  modifier ? eliteById[modifier] : null;
