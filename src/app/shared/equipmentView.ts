import type { DerivedStats } from '../../game/formulas/statFormulas';
import type { ActiveEquipmentSlot } from '../../game/equipmentSlots';
import type { GameState, InventoryStack, ItemDefinition } from '../../game/types';

export { getEquipmentSlotLabel } from '../../game/equipmentSlots';

export type EquipmentBonusId =
  'attack' | 'strength' | 'defence' | 'health' | 'attackSpeed' | 'miningSpeed';

export interface EquipmentBonusComparisonRow {
  id: EquipmentBonusId;
  label: string;
  current: number;
  candidate: number;
  delta: number;
}

export type DerivedStatComparisonId =
  'accuracy' | 'maxHit' | 'defence' | 'maxHealth' | 'attackIntervalMs' | 'miningIntervalMultiplier';

export interface DerivedStatComparisonRow {
  id: DerivedStatComparisonId;
  label: string;
  current: number;
  candidate: number;
  delta: number;
  beneficial: boolean;
}

export type EquipmentComparisonScope = 'combat' | 'profession';

export interface EquipmentEmptyState {
  message: string;
  secondary?: string;
  showOpenInventory: boolean;
}

const EQUIPMENT_EMPTY_LABELS: Record<ActiveEquipmentSlot, string> = {
  head: 'Helmets',
  armor: 'Armor',
  gloves: 'Gloves',
  boots: 'Boots',
  weapon: 'Weapons',
  offhand: 'Off-hand items',
  amulet: 'Amulets',
  ring: 'Rings',
  cape: 'Capes',
  tool: 'Tools',
};

export const getEquipmentEmptyState = (
  slot: ActiveEquipmentSlot,
  hasKnownContent: boolean,
): EquipmentEmptyState => {
  const label = EQUIPMENT_EMPTY_LABELS[slot];
  if (!hasKnownContent) {
    return {
      message: `No ${label} are currently available.`,
      showOpenInventory: false,
    };
  }
  return {
    message: `No compatible ${label} in Inventory.`,
    secondary: 'Forge or collect gear for this slot.',
    showOpenInventory: true,
  };
};

const tierRank: Record<string, number> = { bronze: 1, iron: 2, steel: 3 };
const rarityRank: Record<string, number> = { common: 1, uncommon: 2, rare: 3, epic: 4 };

export const getEquipmentTierRank = (itemOrTier?: ItemDefinition | string | null): number => {
  const tier = typeof itemOrTier === 'object' && itemOrTier !== null ? itemOrTier.tier : itemOrTier;
  return tier ? (tierRank[tier] ?? 0) : 0;
};

export const getCompatibleEquipmentStacks = (
  inventory: InventoryStack[],
  definitions: Record<string, ItemDefinition>,
  slot: ActiveEquipmentSlot,
): InventoryStack[] =>
  inventory
    .filter((stack) => stack.quantity > 0 && definitions[stack.itemId]?.slot === slot)
    .slice()
    .sort((left, right) => {
      const leftItem = definitions[left.itemId];
      const rightItem = definitions[right.itemId];
      const tierDelta = getEquipmentTierRank(rightItem) - getEquipmentTierRank(leftItem);
      if (tierDelta !== 0) return tierDelta;
      const rarityDelta =
        (rarityRank[rightItem?.rarity ?? ''] ?? 0) - (rarityRank[leftItem?.rarity ?? ''] ?? 0);
      if (rarityDelta !== 0) return rarityDelta;
      const nameDelta = (leftItem?.name ?? left.itemId).localeCompare(
        rightItem?.name ?? right.itemId,
      );
      return nameDelta || left.itemId.localeCompare(right.itemId);
    });

export const EQUIPMENT_BONUS_LABELS: Record<EquipmentBonusId, string> = {
  attack: 'Attack',
  strength: 'Strength',
  defence: 'Defence',
  health: 'Health',
  attackSpeed: 'Attack speed',
  miningSpeed: 'Mining speed',
};

export const getEquipmentBonusLabel = (key: string): string =>
  EQUIPMENT_BONUS_LABELS[key as EquipmentBonusId] ??
  key.replace(/[-_]/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());

export const formatEquipmentBonus = (key: string, value: number): string => {
  const sign = value >= 0 ? '+' : '';
  if (key === 'attackSpeed') return `${sign}${(value * 25).toFixed(2)}% interval reduction`;
  if (key === 'miningSpeed') return `${sign}${Math.round(value * 100)}% faster`;
  return `${sign}${value}`;
};

export const getEquipmentBonusComparison = (
  currentItem?: ItemDefinition,
  candidateItem?: ItemDefinition,
  scope: EquipmentComparisonScope = 'combat',
): EquipmentBonusComparisonRow[] => {
  const keys: EquipmentBonusId[] =
    scope === 'profession'
      ? ['miningSpeed']
      : ['attack', 'strength', 'defence', 'health', 'attackSpeed'];
  return keys.flatMap((id) => {
    const current = currentItem?.bonuses?.[id] ?? 0;
    const candidate = candidateItem?.bonuses?.[id] ?? 0;
    if (current === 0 && candidate === 0) return [];
    return [
      { id, label: EQUIPMENT_BONUS_LABELS[id], current, candidate, delta: candidate - current },
    ];
  });
};

export const getEquipmentPreviewState = (
  game: GameState,
  slot: ActiveEquipmentSlot,
  candidateItemId: string,
): GameState => ({
  ...game,
  equipment: { ...game.equipment, [slot]: candidateItemId },
});

export const getDerivedStatComparison = (
  currentStats: DerivedStats,
  previewStats: DerivedStats,
  scope: EquipmentComparisonScope = 'combat',
): DerivedStatComparisonRow[] => {
  const values: Array<[DerivedStatComparisonId, string, number, (delta: number) => boolean]> =
    scope === 'profession'
      ? [
          [
            'miningIntervalMultiplier',
            'Mining interval',
            currentStats.miningIntervalMultiplier,
            (delta) => delta < 0,
          ],
        ]
      : [
          ['accuracy', 'Accuracy rating', currentStats.baseAccuracyRating, (delta) => delta > 0],
          ['maxHit', 'Maximum hit', currentStats.baseMaxHit, (delta) => delta > 0],
          ['defence', 'Defence rating', currentStats.baseDefenceRating, (delta) => delta > 0],
          ['maxHealth', 'Maximum health', currentStats.maxHealth, (delta) => delta > 0],
          [
            'attackIntervalMs',
            'Attack interval',
            currentStats.attackIntervalMs,
            (delta) => delta < 0,
          ],
        ];
  return values.map(([id, label, current, improvement]) => {
    const candidate =
      id === 'accuracy'
        ? previewStats.baseAccuracyRating
        : id === 'maxHit'
          ? previewStats.baseMaxHit
          : id === 'defence'
            ? previewStats.baseDefenceRating
            : previewStats[id];
    const delta = candidate - current;
    return { id, label, current, candidate, delta, beneficial: delta === 0 || improvement(delta) };
  });
};
