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
  flatDamageReduction: number;
}

export interface CombatEffectTick {
  effect: ActiveCombatEffect;
  definition: CombatEffectDefinition;
  damage: number;
}

export const emptyCombatEffects = (): CombatEffectsState => ({ player: [], enemy: [] });

const getEffectsForTarget = (
  effects: CombatEffectsState,
  target: CombatEffectTarget,
): ActiveCombatEffect[] => effects[target];

const asEffectList = (
  effects: CombatEffectsState | ActiveCombatEffect[],
  target: CombatEffectTarget,
): ActiveCombatEffect[] => (Array.isArray(effects) ? effects : getEffectsForTarget(effects, target));

export const getCombatEffectDefinition = (effectId: string): CombatEffectDefinition | null =>
  combatEffectById[effectId] ?? null;

export const getCombatEffectModifiers = (
  effects: CombatEffectsState | ActiveCombatEffect[],
  target: CombatEffectTarget = 'player',
): CombatEffectModifiers => {
  const active = asEffectList(effects, target);
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
      if (effectModifiers.flatDamageReduction !== undefined)
        modifiers.flatDamageReduction += effectModifiers.flatDamageReduction * stacks;
      return modifiers;
    },
    {
      accuracyMultiplier: 1,
      defenceMultiplier: 1,
      damageMultiplier: 1,
      attackIntervalMultiplier: 1,
      flatDamageReduction: 0,
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

const getPeriodicInterval = (effectId: string): number | null => {
  const interval = getCombatEffectDefinition(effectId)?.periodicDamage?.intervalMs;
  return interval !== undefined && interval > 0 ? interval : null;
};

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
  const requestedStacks = Math.max(1, options.stacks ?? 1);
  const stacking = definition?.stacking ?? 'refresh';
  const stacks =
    stacking === 'stack'
      ? Math.min(maxStacks, Math.max(1, (existing?.stacks ?? 0) + requestedStacks))
      : Math.min(maxStacks, requestedStacks);
  const durationMs = options.durationMs !== undefined ? options.durationMs : definition?.durationMs ?? null;
  const periodicInterval = getPeriodicInterval(effectId);

  if (existing && stacking !== 'replace') {
    existing.stacks = stacks;
    existing.remainingMs = durationMs;
    if (options.magnitude !== undefined) existing.magnitude = options.magnitude;
    if (periodicInterval !== null && existing.nextTickMs === undefined) existing.nextTickMs = periodicInterval;
    return existing;
  }

  if (existing) {
    const index = targetEffects.indexOf(existing);
    targetEffects.splice(index, 1);
  }

  const next: ActiveCombatEffect = {
    instanceId,
    effectId,
    target,
    sourceEnemyId: options.sourceEnemyId,
    sourceSpecialId: options.sourceSpecialId,
    remainingMs: durationMs,
    stacks,
    ...(periodicInterval === null ? {} : { nextTickMs: periodicInterval }),
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
): ActiveCombatEffect => {
  const effect = applyCombatEffect(effects, effectId, target, options);
  effect.stacks = 1;
  return effect;
};

export const hasCombatEffect = (
  effects: CombatEffectsState | ActiveCombatEffect[],
  effectId: string,
  target: CombatEffectTarget = 'player',
): boolean => asEffectList(effects, target).some((effect) => effect.effectId === effectId);

export const hasCombatEffectTag = (
  effects: CombatEffectsState | ActiveCombatEffect[],
  tag: 'bleed',
  target: CombatEffectTarget = 'player',
): boolean =>
  asEffectList(effects, target).some((effect) => getCombatEffectDefinition(effect.effectId)?.tags?.includes(tag));

export const getCombatEffectStacks = (
  effects: CombatEffectsState | ActiveCombatEffect[],
  effectId: string,
  target: CombatEffectTarget = 'player',
): number =>
  asEffectList(effects, target)
    .filter((effect) => effect.effectId === effectId)
    .reduce((total, effect) => total + effect.stacks, 0);

export const setCombatEffectStacks = (
  effects: CombatEffectsState,
  effectId: string,
  target: CombatEffectTarget,
  stacks: number,
): void => {
  const definition = getCombatEffectDefinition(effectId);
  const maxStacks = definition?.maxStacks ?? Number.POSITIVE_INFINITY;
  for (const effect of effects[target]) {
    if (effect.effectId === effectId) effect.stacks = Math.min(maxStacks, Math.max(1, stacks));
  }
};

export const removeCombatEffect = (effects: CombatEffectsState, instanceId: string): void => {
  effects.player = effects.player.filter((effect) => effect.instanceId !== instanceId);
  effects.enemy = effects.enemy.filter((effect) => effect.instanceId !== instanceId);
};

export const removeCombatEffectsByEffectId = (
  effects: CombatEffectsState,
  effectId: string,
  target?: CombatEffectTarget,
): void => {
  const targets = target ? [target] : (['player', 'enemy'] as const);
  for (const lane of targets) effects[lane] = effects[lane].filter((effect) => effect.effectId !== effectId);
};

/** Advance durations and periodic timers without resolving a tick. */
export const advanceCombatEffects = (effects: CombatEffectsState, elapsedMs: number): void => {
  if (elapsedMs <= 0) return;
  for (const target of ['player', 'enemy'] as const) {
    effects[target] = effects[target].filter((effect) => {
      if (effect.remainingMs !== null) {
        effect.remainingMs = Math.max(0, effect.remainingMs - elapsedMs);
      }
      const periodicInterval = getPeriodicInterval(effect.effectId);
      if (periodicInterval !== null) {
        effect.nextTickMs ??= periodicInterval;
        effect.nextTickMs -= elapsedMs;
      }
      return effect.remainingMs === null || effect.remainingMs > 0;
    });
  }
};

/** Backwards-compatible name used by older callers. */
export const tickCombatEffects = advanceCombatEffects;

export const getTimeUntilNextCombatEffectEvent = (
  effects: CombatEffectsState,
): number | null => {
  let next: number | null = null;
  for (const target of ['player', 'enemy'] as const) {
    for (const effect of effects[target]) {
      if (getPeriodicInterval(effect.effectId) === null) continue;
      const until = Math.max(0, effect.nextTickMs ?? getPeriodicInterval(effect.effectId)!);
      next = next === null ? until : Math.min(next, until);
    }
  }
  return next;
};

/** Resolve one or more due periodic ticks, keeping the next tick deterministic. */
export const resolveReadyCombatEffectTicks = (
  effects: CombatEffectsState,
): CombatEffectTick[] => {
  const ticks: CombatEffectTick[] = [];
  for (const target of ['player', 'enemy'] as const) {
    for (const effect of effects[target]) {
      const definition = getCombatEffectDefinition(effect.effectId);
      const periodic = definition?.periodicDamage;
      if (!periodic || effect.nextTickMs === undefined || effect.nextTickMs > 0) continue;
      const interval = Math.max(1, periodic.intervalMs);
      ticks.push({ effect, definition, damage: periodic.damagePerStack * Math.max(1, effect.stacks) });
      effect.nextTickMs += interval;
    }
  }
  return ticks;
};
