import { itemById } from '../../content/items';
import type { EquipmentLoadout, GameState } from '../types';

export interface DerivedStats {
  attack: number;
  strength: number;
  defence: number;
  maxHealth: number;
  attackIntervalMs: number;
  miningIntervalMultiplier: number;
  maxHit: number;
  combatLevel: number;
}

export const getEquipmentBonuses = (equipment: EquipmentLoadout) =>
  Object.values(equipment).reduce(
    (total, id) => {
      const bonuses = itemById[id ?? '']?.bonuses;
      if (!bonuses) return total;
      total.attack += bonuses.attack ?? 0;
      total.strength += bonuses.strength ?? 0;
      total.defence += bonuses.defence ?? 0;
      total.health += bonuses.health ?? 0;
      total.speed += bonuses.speed ?? 0;
      return total;
    },
    { attack: 0, strength: 0, defence: 0, health: 0, speed: 0 },
  );

export const getDerivedStats = (state: GameState): DerivedStats => {
  const bonuses = getEquipmentBonuses(state.equipment);
  const attack = state.skills.attack.level + bonuses.attack;
  const strength = state.skills.strength.level + bonuses.strength;
  const defence = state.skills.defence.level + bonuses.defence;
  const maxHealth = 10 + state.skills.hitpoints.level * 10 + bonuses.health;
  const maxHit = Math.max(1, Math.floor(1 + strength / 5));
  const combatLevel = Math.floor(
    (state.skills.attack.level +
      state.skills.strength.level +
      state.skills.defence.level +
      state.skills.hitpoints.level) /
      4,
  );
  return {
    attack,
    strength,
    defence,
    maxHealth,
    attackIntervalMs: Math.max(900, 2400 * (1 - bonuses.speed * 0.25)),
    miningIntervalMultiplier: Math.max(0.55, 1 - bonuses.speed),
    maxHit,
    combatLevel,
  };
};
