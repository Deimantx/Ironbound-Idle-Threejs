import { COMBAT_TUNING } from '../../config/combatTuning';
import { MINING_TUNING } from '../../config/miningTuning';

export type GameConceptId =
  | 'accuracy'
  | 'strength'
  | 'defence'
  | 'hitpoints'
  | 'max-hit'
  | 'damage-range'
  | 'attack-speed'
  | 'combat-level'
  | 'total-level'
  | 'total-combat-levels'
  | 'total-profession-levels'
  | 'hit-chance'
  | 'adrenaline'
  | 'flat-damage-reduction'
  | 'mining-stamina'
  | 'mining-penetration'
  | 'mining-effectiveness'
  | 'rock-durability'
  | 'bonus-drop'
  | 'smithing-speed'
  | 'material-preservation'
  | 'forge-fuel';

export interface GameConceptDefinition {
  id: GameConceptId;
  title: string;
  description: string;
  details?: string[] | (() => string[]);
}

export const GAME_CONCEPTS: Record<GameConceptId, GameConceptDefinition> = {
  accuracy: {
    id: 'accuracy',
    title: 'Accuracy',
    description: 'Improves your chance to hit.',
    details: ['Your Accuracy rating is compared against the enemy’s Defence rating to determine final hit chance.'],
  },
  strength: {
    id: 'strength',
    title: 'Strength',
    description: 'Increases your maximum melee damage.',
    details: ['Equipment and combat style can modify your effective Strength.'],
  },
  defence: {
    id: 'defence',
    title: 'Defence',
    description: 'Makes enemy attacks less likely to hit.',
    details: ["Your Defence rating is compared against the enemy’s Accuracy."],
  },
  hitpoints: {
    id: 'hitpoints',
    title: 'Hitpoints',
    description: 'Determines your base maximum Health.',
    details: ['Equipment can further increase maximum Health.'],
  },
  'max-hit': {
    id: 'max-hit',
    title: 'Max Hit',
    description: 'The highest normal damage your current attack can roll.',
    details: ['Enemy mitigation and Special Attack modifiers can change final damage.'],
  },
  'damage-range': {
    id: 'damage-range',
    title: 'Damage',
    description: "Your normal attack's base damage range.",
    details: [
      'A successful normal attack rolls between 1 and your current maximum before enemy mitigation.',
      'Special Attacks can modify the final damage.',
    ],
  },
  'attack-speed': {
    id: 'attack-speed',
    title: 'Attack Speed',
    description: 'Reduces the time between your attacks.',
    details: ['A lower attack interval means more attacks over time.'],
  },
  'combat-level': {
    id: 'combat-level',
    title: 'Combat Level',
    description: 'A summary of your current combat progression.',
    details: ['Normal combat areas use Combat Level as their unlock requirement.'],
  },
  'total-level': {
    id: 'total-level',
    title: 'Total Level',
    description: 'The sum of all currently implemented Combat and Profession skill levels.',
  },
  'total-combat-levels': {
    id: 'total-combat-levels',
    title: 'Total Combat Levels',
    description: 'The combined levels of Attack, Strength, Defence, and Hitpoints.',
  },
  'total-profession-levels': {
    id: 'total-profession-levels',
    title: 'Total Profession Levels',
    description: 'The combined levels of all currently implemented professions.',
  },
  'hit-chance': {
    id: 'hit-chance',
    title: 'Hit Chance',
    description: 'Your estimated chance for an attack to connect.',
    details: ['It is determined from attacker Accuracy and defender Defence, subject to the game’s hit-chance limits.'],
  },
  adrenaline: {
    id: 'adrenaline',
    title: 'Adrenaline',
    description: 'Powers your equipped weapon’s Special Attack.',
    details: () => [
      `+${COMBAT_TUNING.adrenalinePerPlayerHit} when you land a hit`,
      `+${COMBAT_TUNING.adrenalinePerDirectDamageTaken} when you take direct damage`,
      `Maximum: ${COMBAT_TUNING.adrenalineMax}`,
    ],
  },
  'flat-damage-reduction': {
    id: 'flat-damage-reduction',
    title: 'Flat Damage Reduction',
    description: 'Reduces incoming damage by a fixed amount after a hit lands.',
    details: ['Some Special Attacks can ignore this protection.'],
  },
  'mining-stamina': {
    id: 'mining-stamina',
    title: 'Stamina',
    description: 'Each mining swing consumes Stamina.',
    details: [`When Stamina is exhausted, the miner rests for ${MINING_TUNING.restDurationMs / 1000} seconds before swinging again.`],
  },
  'mining-penetration': {
    id: 'mining-penetration',
    title: 'Penetration',
    description: 'Determines how effectively your pickaxe can work harder deposits.',
    details: ['A tool below the deposit’s required Penetration becomes less effective.'],
  },
  'mining-effectiveness': {
    id: 'mining-effectiveness',
    title: 'Effectiveness',
    description: 'Shows how well your equipped mining tool performs against this deposit.',
    details: ['Effectiveness modifies mining performance when tool Penetration does not match the deposit requirement.'],
  },
  'rock-durability': {
    id: 'rock-durability',
    title: 'Durability',
    description: 'How much work remains in the current stage of the deposit.',
    details: ['Reducing it to zero advances the rock to its next stage.'],
  },
  'bonus-drop': {
    id: 'bonus-drop',
    title: 'Bonus Drop',
    description: 'An additional item that can be gained alongside normal mining progress.',
    details: ['Its chance changes with the current rock stage.'],
  },
  'smithing-speed': {
    id: 'smithing-speed',
    title: 'Smithing Speed',
    description: 'Reduces the time required for Smithing actions.',
    details: ['Tool bonuses can improve the final action interval.'],
  },
  'material-preservation': {
    id: 'material-preservation',
    title: 'Material Preservation',
    description: 'Chance for an Anvil action to complete without consuming its normal material input.',
    details: ['The output and XP are still awarded normally.'],
  },
  'forge-fuel': {
    id: 'forge-fuel',
    title: 'Forge Fuel',
    description: 'Fuel powers Smelting actions.',
    details: ['The Forge hopper can hold fuel and automatically load more when Auto Refuel is enabled.'],
  },
};

export const getGameConcept = (concept: GameConceptId): GameConceptDefinition =>
  GAME_CONCEPTS[concept];
