import type { ScreenId } from '../game/types';

export interface NavigationItem {
  id: ScreenId;
  label: string;
  group: string;
  icon: string;
  locked?: boolean;
  description?: string;
}
export const NAVIGATION: NavigationItem[] = [
  { id: 'home', label: 'Home', group: 'Main', icon: '⌂' },
  { id: 'combat', label: 'Combat', group: 'Main', icon: '⚔' },
  { id: 'inventory', label: 'Inventory', group: 'Main', icon: '▦' },
  { id: 'equipment', label: 'Equipment', group: 'Main', icon: '◇' },
  { id: 'collection', label: 'Collection Log', group: 'Main', icon: '✧' },
  { id: 'mining', label: 'Mining', group: 'Skills', icon: '⛏' },
  { id: 'smithing', label: 'Smithing', group: 'Skills', icon: '♨' },
  ...[
    'Woodcutting',
    'Fishing',
    'Firemaking',
    'Cooking',
    'Thieving',
    'Farming',
    'Herblore',
    'Crafting',
    'Fletching',
    'Runecrafting',
    'Agility',
    'Summoning',
  ].map((label) => ({
    id: 'locked' as const,
    label,
    group: 'Skills',
    icon: '·',
    locked: true,
    description: `${label} will expand your long-term progression.`,
  })),
  ...['Shop', 'Dungeons', 'Slayer', 'Township', 'Astrology', 'Pets'].map((label) => ({
    id: 'locked' as const,
    label,
    group: 'World',
    icon: '·',
    locked: true,
    description: `${label} is planned for a future content pass.`,
  })),
  { id: 'settings', label: 'Settings', group: 'System', icon: '⚙' },
  { id: 'help', label: 'Help', group: 'System', icon: '?' },
];
