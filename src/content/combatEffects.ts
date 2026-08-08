import type { CombatEffectDefinition } from '../game/types';

export const COMBAT_EFFECTS: CombatEffectDefinition[] = [
  {
    id: 'bleeding',
    name: 'Bleeding',
    polarity: 'debuff',
    description: 'Takes periodic damage as the bleeding wears off.',
    durationMs: null,
    maxStacks: 3,
  },
  {
    id: 'desperate-swing',
    name: 'Desperate Swing',
    polarity: 'buff',
    description: 'The enemy deals heavier damage while badly wounded.',
    durationMs: null,
  },
  {
    id: 'defence-rend',
    name: 'Defence Rend',
    polarity: 'debuff',
    description: 'Reduces Defence for a short time.',
    durationMs: 8_000,
    modifiers: { defenceMultiplier: 0.85 },
  },
  {
    id: 'enemy-damage-up',
    name: 'Empowered Damage',
    polarity: 'buff',
    description: 'Increases outgoing damage.',
    durationMs: 8_000,
    modifiers: { damageMultiplier: 1.2 },
  },
  {
    id: 'enemy-defence-up',
    name: 'Hardened Defence',
    polarity: 'buff',
    description: 'Increases Defence.',
    durationMs: 8_000,
    modifiers: { defenceMultiplier: 1.2 },
  },
  {
    id: 'enemy-attack-speed-up',
    name: 'Hastened',
    polarity: 'buff',
    description: 'Shortens the attack interval.',
    durationMs: 8_000,
    modifiers: { attackIntervalMultiplier: 0.8 },
  },
  {
    id: 'enemy-damage-defence-up',
    name: 'Battle Trance',
    polarity: 'buff',
    description: 'Increases outgoing damage and Defence.',
    durationMs: 8_000,
    modifiers: { damageMultiplier: 1.15, defenceMultiplier: 1.15 },
  },
];

export const combatEffectById: Record<string, CombatEffectDefinition> = Object.fromEntries(
  COMBAT_EFFECTS.map((effect) => [effect.id, effect]),
);
