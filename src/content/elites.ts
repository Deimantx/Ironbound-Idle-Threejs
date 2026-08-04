import type { EliteModifierId } from '../game/types';

export interface EliteModifierDefinition {
  id: EliteModifierId;
  name: string;
  description: string;
}

export const ELITE_MODIFIERS: EliteModifierDefinition[] = [
  { id: 'savage', name: 'Savage', description: '+35% effective maximum hit.' },
  {
    id: 'armoured',
    name: 'Armoured',
    description: '+35% Defence and 1 additional flat damage reduction.',
  },
  { id: 'swift', name: 'Swift', description: 'Attacks 20% faster.' },
  { id: 'wealthy', name: 'Wealthy', description: 'Rewards 2.5× final gold.' },
  {
    id: 'treasure-touched',
    name: 'Treasure-Touched',
    description: 'Loot chances are increased by 75%.',
  },
];

export const eliteById = Object.fromEntries(
  ELITE_MODIFIERS.map((modifier) => [modifier.id, modifier]),
) as Record<EliteModifierId, EliteModifierDefinition>;
