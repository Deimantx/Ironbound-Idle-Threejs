import type { ReactNode } from 'react';
import { enemyById } from '../../content/enemies';
import { getCombatEffectDefinition } from '../../game/formulas/combatEffects';
import type { ActiveCombatEffect, CombatEffectTarget } from '../../game/types';
import { GameTooltip } from '../items/GameTooltip';

const formatRemaining = (remainingMs: number | null): string | null => {
  if (remainingMs === null) return null;
  return `${Math.ceil(Math.max(0, remainingMs) / 1000)}s`;
};

const getEffectLabel = (effect: ActiveCombatEffect): string => {
  const definition = getCombatEffectDefinition(effect.effectId);
  return definition?.name ?? effect.effectId;
};

const formatModifier = (label: string, value: number): string => {
  const percent = Math.round((value - 1) * 100);
  return `${label}: ${percent >= 0 ? '+' : ''}${percent}%`;
};

function CombatEffectTooltip({
  effect,
  children,
}: {
  effect: ActiveCombatEffect;
  children: ReactNode;
}) {
  const definition = getCombatEffectDefinition(effect.effectId);
  const sourceEnemy = effect.sourceEnemyId ? enemyById[effect.sourceEnemyId] : undefined;
  const sourceSpecial = sourceEnemy && sourceEnemy.specialAttack?.id === effect.sourceSpecialId
    ? sourceEnemy.specialAttack
    : undefined;
  const modifiers = definition?.modifiers;
  const modifierRows = modifiers
    ? [
        modifiers.accuracyMultiplier !== undefined && formatModifier('Accuracy', modifiers.accuracyMultiplier),
        modifiers.defenceMultiplier !== undefined && formatModifier('Defence', modifiers.defenceMultiplier),
        modifiers.damageMultiplier !== undefined && formatModifier('Damage', modifiers.damageMultiplier),
        modifiers.attackIntervalMultiplier !== undefined && formatModifier('Attack interval', modifiers.attackIntervalMultiplier),
        modifiers.flatDamageReduction !== undefined && `Flat damage reduction: ${modifiers.flatDamageReduction}`,
      ].filter((row): row is string => Boolean(row))
    : [];
  const periodic = definition?.periodicDamage;
  return (
    <GameTooltip
      content={
        <div className="combat-effect-tooltip">
          <strong>{getEffectLabel(effect)}</strong>
          <span>{definition?.polarity ?? 'status'}</span>
          <p>{definition?.description ?? 'A temporary combat effect.'}</p>
          <span>Stacks: {effect.stacks}</span>
          {modifierRows.map((row) => <span key={row}>{row}</span>)}
          {periodic && (
            <span>
              Periodic damage: {periodic.damagePerStack} per stack every {periodic.intervalMs / 1000}s
              {periodic.ignoresDefence ? ' (ignores Defence)' : ''}
            </span>
          )}
          {definition?.stacking && <span>Stacking: {definition.stacking}</span>}
          <span>
            Remaining: {formatRemaining(effect.remainingMs) ?? 'Encounter-long'}
          </span>
          {(sourceEnemy || sourceSpecial) && (
            <span>
              Source: {sourceEnemy?.name ?? 'Enemy'}{sourceSpecial ? ` · ${sourceSpecial.name}` : ''}
            </span>
          )}
        </div>
      }
      label={`${getEffectLabel(effect)} effect`}
    >
      <span className="combat-effect-chip-trigger">{children}</span>
    </GameTooltip>
  );
}

export function CombatEffectLane({
  target,
  effects,
}: {
  target: CombatEffectTarget;
  effects: ActiveCombatEffect[];
}) {
  const label = target === 'player' ? 'Player Effects' : 'Enemy Effects';
  return (
    <div className={`combat-effect-lane ${target}`}>
      <span className="combat-effect-lane-label">{label}</span>
      <div className="combat-effect-list">
        {effects.length ? (
          effects.map((effect) => {
            const remaining = formatRemaining(effect.remainingMs);
            return (
              <CombatEffectTooltip effect={effect} key={effect.instanceId}>
                <span className="combat-effect-chip">
                  <strong>{getEffectLabel(effect)}</strong>
                  {effect.stacks > 1 && <b>×{effect.stacks}</b>}
                  {remaining && <small>{remaining}</small>}
                </span>
              </CombatEffectTooltip>
            );
          })
        ) : (
          <span className="combat-effect-none">None</span>
        )}
      </div>
    </div>
  );
}
