import {
  Clock3,
  Droplets,
  Heart,
  ShieldAlert,
  Skull,
  Sparkles,
  Sword,
  Swords,
  Target,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { enemyById } from '../../content/enemies';
import { eliteById } from '../../content/elites';
import { itemById } from '../../content/items';
import type { CombatLogEntry } from '../../game/types';

export interface CombatLogPresentation {
  text: string;
  label: string;
  icon: LucideIcon;
  category: string;
  important: boolean;
}

const formatCombatDamage = (damage: number): string =>
  String(Math.max(0, Math.round(Number.isFinite(damage) ? damage : 0)));

export const getCombatLogPresentation = (entry: CombatLogEntry): CombatLogPresentation => {
  if (entry.kind === 'legacy')
    return {
      text: entry.message,
      label: 'History',
      icon: Clock3,
      category: 'legacy',
      important: false,
    };

  const enemyName = enemyById[entry.enemyId]?.name ?? entry.enemyId;
  const specialName =
    enemyById[entry.enemyId]?.specialAttack?.name ??
    ('specialId' in entry ? entry.specialId : 'Special Attack');
  switch (entry.kind) {
    case 'player-hit':
      return {
        text: `You hit ${enemyName} for ${formatCombatDamage(entry.damage)}${entry.special ? ' with a special' : ''}.`,
        label: entry.special ? 'Special' : 'Player hit',
        icon: entry.special ? Zap : Sword,
        category: entry.special ? 'special' : 'player-hit',
        important: entry.special,
      };
    case 'player-miss':
      return {
        text: `You missed ${enemyName}.`,
        label: 'Miss',
        icon: Target,
        category: 'miss',
        important: false,
      };
    case 'enemy-hit':
      return {
        text: `${enemyName} hit you for ${formatCombatDamage(entry.damage)}${entry.heavy ? ' with a heavy strike' : ''}.`,
        label: entry.heavy ? 'Heavy hit' : 'Enemy hit',
        icon: entry.heavy ? ShieldAlert : Swords,
        category: 'enemy-hit',
        important: entry.heavy,
      };
    case 'enemy-miss':
      return {
        text: `${enemyName} missed you.`,
        label: 'Miss',
        icon: Target,
        category: 'miss',
        important: false,
      };
    case 'enemy-special-hit':
      return {
        text: `${enemyName} used ${specialName} for ${formatCombatDamage(entry.damage)} damage.`,
        label: 'Enemy special',
        icon: ShieldAlert,
        category: 'special enemy-hit',
        important: true,
      };
    case 'enemy-special-miss':
      return {
        text: `${enemyName}'s ${specialName} missed.`,
        label: 'Enemy special miss',
        icon: ShieldAlert,
        category: 'special miss',
        important: true,
      };
    case 'enemy-special-used':
      return {
        text: `${enemyName} used ${specialName}.`,
        label: 'Enemy special',
        icon: ShieldAlert,
        category: 'special',
        important: true,
      };
    case 'enemy-bleed':
      return {
        text: `Bleeding bites dealt ${formatCombatDamage(entry.damage)} damage.`,
        label: 'Bleed',
        icon: Droplets,
        category: 'enemy-hit',
        important: true,
      };
    case 'enemy-defeated':
      return {
        text: `${entry.eliteModifier ? `${eliteById[entry.eliteModifier]?.name ?? entry.eliteModifier} ` : ''}${enemyName} defeated.`,
        label: 'Defeat',
        icon: Skull,
        category: 'defeat',
        important: true,
      };
    case 'loot': {
      const itemName = itemById[entry.itemId]?.name ?? entry.itemId;
      return {
        text: `Received ${entry.quantity} ${itemName}.`,
        label: 'Loot',
        icon: Sparkles,
        category: 'loot',
        important: true,
      };
    }
    case 'gold':
      return {
        text: `Gained ${entry.amount} Gold.`,
        label: 'Gold',
        icon: Sparkles,
        category: 'gold',
        important: false,
      };
    case 'elite-spawned':
      return {
        text: `${enemyName} spawned as a ${eliteById[entry.modifier]?.name ?? entry.modifier} elite.`,
        label: 'Elite',
        icon: Zap,
        category: 'elite',
        important: true,
      };
    case 'enemy-spawned':
      return {
        text: `${enemyName} spawned.`,
        label: 'Spawn',
        icon: Heart,
        category: 'spawn',
        important: false,
      };
    case 'player-defeated':
      return {
        text:
          entry.cause.kind === 'bleed'
            ? `You were killed by ${enemyName} from bleeding bites for ${formatCombatDamage(entry.cause.damage)} damage.`
            : entry.cause.kind === 'enemy-special'
              ? `You were killed by ${enemyName}'s ${specialName} for ${formatCombatDamage(entry.cause.damage)} damage.`
              : `You were killed by ${enemyName} with a hit for ${formatCombatDamage(entry.cause.damage)}${entry.cause.heavy ? ' from a heavy strike' : ''}.`,
        label: 'Death',
        icon: Skull,
        category: 'death',
        important: true,
      };
  }
};
