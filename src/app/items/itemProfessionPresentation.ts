import { getMiningToolDefinition } from '../../content/miningTools';
import { getSmithingHammerDefinition } from '../../content/smithingTools';
import type { MiningToolDefinition, SmithingToolDefinition } from '../../game/types';
import type { GameConceptId } from '../tooltips/gameConcepts';

export interface ProfessionToolEffectRow {
  id: string;
  label: string;
  value: string;
  concept?: GameConceptId;
}

export interface ProfessionToolPresentation {
  profession: 'mining' | 'smithing';
  professionLabel: string;
  requiredLevelLabel: string;
  requiredLevel: number;
  effects: ProfessionToolEffectRow[];
}

export const formatProfessionPercent = (value: number): string => `${Math.round(value * 100)}%`;

export const formatProfessionSeconds = (milliseconds: number): string =>
  `${(milliseconds / 1000).toFixed(1)}s`;

export const formatMiningToolSummary = (definition: MiningToolDefinition): string =>
  `${definition.rockDamage} damage · ${definition.penetration} pen · ${formatProfessionSeconds(definition.swingIntervalMs)} · ${definition.staminaCost} stamina`;

export const formatSmithingToolSummary = (definition: SmithingToolDefinition): string =>
  `${formatProfessionPercent(definition.speedBonus)} faster · ${formatProfessionPercent(definition.materialPreservationChance)} preservation`;

export const getProfessionToolPresentation = (
  itemId: string | undefined,
): ProfessionToolPresentation | null => {
  const mining = getMiningToolDefinition(itemId);
  if (mining) {
    return {
      profession: 'mining',
      professionLabel: 'Mining Tool',
      requiredLevelLabel: 'Required Mining Level',
      requiredLevel: mining.requiredMiningLevel,
      effects: [
        { id: 'rock-damage', label: 'Rock Damage', value: String(mining.rockDamage) },
        {
          id: 'penetration',
          label: 'Penetration',
          value: String(mining.penetration),
          concept: 'mining-penetration',
        },
        {
          id: 'swing-interval',
          label: 'Swing Interval',
          value: formatProfessionSeconds(mining.swingIntervalMs),
        },
        {
          id: 'stamina-cost',
          label: 'Stamina Cost',
          value: String(mining.staminaCost),
          concept: 'mining-stamina',
        },
      ],
    };
  }

  const smithing = getSmithingHammerDefinition(itemId);
  if (smithing) {
    return {
      profession: 'smithing',
      professionLabel: 'Smithing Hammer',
      requiredLevelLabel: 'Required Smithing Level',
      requiredLevel: smithing.requiredSmithingLevel,
      effects: [
        {
          id: 'smithing-speed',
          label: 'Smithing Speed / Action Speed',
          value: `+${formatProfessionPercent(smithing.speedBonus)}`,
          concept: 'smithing-speed',
        },
        {
          id: 'material-preservation',
          label: 'Material Preservation',
          value: formatProfessionPercent(smithing.materialPreservationChance),
          concept: 'material-preservation',
        },
      ],
    };
  }

  return null;
};
