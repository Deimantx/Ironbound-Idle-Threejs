import { combatEffectById } from '../../content/combatEffects';
import type {
  ActiveCombatEffect,
  CombatEffectDefinition,
  CombatEffectsState,
  CombatEffectTarget,
  EnemyId,
  EnemySpecialId,
} from '../types';

export interface CombatEffectModifiers {
  accuracyMultiplier: number;
  defenceMultiplier: number;
  damageMultiplier: number;
  attackIntervalMultiplier: number;
}

export const emptyCombatEffects = (): CombatEffectsState => ({ player: [], enemy: [] });

const getEffectsForTarget = (
  effects: CombatEffectsState,
  target: CombatEffectTarget,
): ActiveCombatEffect[] => effects[target];

export const getCombatEffectDefinition = (effectId: string): CombatEffectDefinition | null =>
  combatEffectById[effectId] ?? null;

export const getCombatEffectModifiers = (
  effects: CombatEffectsState | ActiveCombatEffect[],
  target: CombatEffectTarget = 'player',
): CombatEffectModifiers => {
  const active = Array.isArray(effects) ? effects : getEffectsForTarget(effects, target);
  return active.reduce(
    (modifiers, instance) => {
      const definition = getCombatEffectDefinition(instance.effectId);
      if (!definition?.modifiers) return modifiers;
      const stacks = Math.max(1, instance.stacks);
      const effectModifiers = definition.modifiers;
      if (effectModifiers.accuracyMultiplier !== undefined)
        modifiers.accuracyMultiplier *= Math.pow(effectModifiers.accuracyMultiplier, stacks);
      if (effectModifiers.defenceMultiplier !== undefined)
        modifiers.defenceMultiplier *= Math.pow(effectModifiers.defenceMultiplier, stacks);
      if (effectModifiers.damageMultiplier !== undefined)
        modifiers.damageMultiplier *= Math.pow(effectModifiers.damageMultiplier, stacks);
      if (effectModifiers.attackIntervalMultiplier !== undefined)
        modifiers.attackIntervalMultiplier *= Math.pow(effectModifiers.attackIntervalMultiplier, stacks);
      return modifiers;
    },
    {
      accuracyMultiplier: 1,
      defenceMultiplier: 1,
      damageMultiplier: 1,
      attackIntervalMultiplier: 1,
    },
  );
};

const nextInstanceId = (
  effectId: string,
  target: CombatEffectTarget,
  sourceEnemyId?: EnemyId,
  sourceSpecialId?: EnemySpecialId,
): string =>
  `${effectId}-${target}-${sourceEnemyId ?? 'system'}-${sourceSpecialId ?? 'trait'}`;

export const applyCombatEffect = (
  effects: CombatEffectsState,
  effectId: string,
  target: CombatEffectTarget,
  options: {
    sourceEnemyId?: EnemyId;
    sourceSpecialId?: EnemySpecialId;
    durationMs?: number | null;
    stacks?: number;
    magnitude?: number;
  } = {},
): ActiveCombatEffect => {
  const definition = getCombatEffectDefinition(effectId);
  const targetEffects = effects[target];
  const instanceId = nextInstanceId(effectId, target, options.sourceEnemyId, options.sourceSpecialId);
  const existing = targetEffects.find((effect) => effect.instanceId === instanceId);
  const maxStacks = definition?.maxStacks ?? Number.POSITIVE_INFINITY;
  const stacks = Math.min(maxStacks, Math.max(1, (existing?.stacks ?? 0) + (options.stacks ?? 1)));
  const durationMs =
    options.durationMs !== undefined ? options.durationMs : definition?.durationMs ?? null;
  if (existing) {
    existing.stacks = stacks;
    existing.remainingMs = durationMs;
    if (options.magnitude !== undefined) existing.magnitude = options.magnitude;
    return existing;
  }
  const next: ActiveCombatEffect = {
    instanceId,
    effectId,
    target,
    sourceEnemyId: options.sourceEnemyId,
    sourceSpecialId: options.sourceSpecialId,
    remainingMs: durationMs,
    stacks,
    ...(options.magnitude === undefined ? {} : { magnitude: options.magnitude }),
  };
  targetEffects.push(next);
  return next;
};

export const refreshCombatEffect = (
  effects: CombatEffectsState,
  effectId: string,
  target: CombatEffectTarget,
  options: Parameters<typeof applyCombatEffect>[3] = {},
): ActiveCombatEffect => applyCombatEffect(effects, effectId, target, { ...options, stacks: 0 });

export const removeCombatEffect = (
  effects: CombatEffectsState,
  instanceId: string,
): void => {
  effects.player = effects.player.filter((effect) => effect.instanceId !== instanceId);
  effects.enemy = effects.enemy.filter((effect) => effect.instanceId !== instanceId);
};

export const tickCombatEffects = (effects: CombatEffectsState, elapsedMs: number): void => {
  if (elapsedMs <= 0) return;
  for (const target of ['player', 'enemy'] as const) {
    effects[target] = effects[target].filter((effect) => {
      if (effect.remainingMs === null) return true;
      effect.remainingMs = Math.max(0, effect.remainingMs - elapsedMs);
      return effect.remainingMs > 0;
    });
  }
};
