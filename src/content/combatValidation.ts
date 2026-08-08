import { combatRegionById } from './combatRegions';
import { areaById } from './areas';
import { enemyById } from './enemies';
import { itemById } from './items';
import { getCombatEffectDefinition } from '../game/formulas/combatEffects';

const STONEHILL_AREAS = [
  'rocky-foothills',
  'abandoned-mine',
  'mountain-pass',
  'ruined-watchtower',
] as const;

const STONEHILL_ENEMIES = [
  'hill-boar',
  'stonehide-ram',
  'tunnel-crawler',
  'forsaken-miner',
  'cliff-harpy',
  'stonehill-marauder',
  'ironbound-sentinel',
  'watchtower-captain',
] as const;

const STONEHILL_GOLD_ENEMIES = new Set(['forsaken-miner', 'stonehill-marauder', 'watchtower-captain']);

const EFFECT_IDS = [
  'cornered-fury',
  'stunned',
  'rending-bleed',
  'armour-broken',
  'raking-wound',
  'blood-scent',
  'battle-fury',
  'war-cry',
  'fortified',
  'reinforced-plating',
  'last-stand',
  'iron-command',
] as const;

const expectedDropSources: Record<string, string> = {
  'coarse-boar-hide': 'Stonehill · Rocky Foothills · Hill Boar',
  'boar-tusk': 'Stonehill · Rocky Foothills · Hill Boar',
  'stonehill-bristle': 'Stonehill · Rocky Foothills · Hill Boar',
  'stonewool-fleece': 'Stonehill · Rocky Foothills · Stonehide Ram',
  'ram-horn': 'Stonehill · Rocky Foothills · Stonehide Ram',
  'dense-hoof-fragment': 'Stonehill · Rocky Foothills · Stonehide Ram',
  'crawler-carapace': 'Stonehill · Abandoned Mine · Tunnel Crawler',
  'burrow-claw': 'Stonehill · Abandoned Mine · Tunnel Crawler',
  'glow-sac': 'Stonehill · Abandoned Mine · Tunnel Crawler',
  'bent-pick-head': 'Stonehill · Abandoned Mine · Forsaken Miner',
  'miners-badge': 'Stonehill · Abandoned Mine · Forsaken Miner',
  'blackened-lantern': 'Stonehill · Abandoned Mine · Forsaken Miner',
  'old-claim-token': 'Stonehill · Abandoned Mine · Forsaken Miner',
  'harpy-feather': 'Stonehill · Mountain Pass · Cliff Harpy',
  'hooked-talon': 'Stonehill · Mountain Pass · Cliff Harpy',
  'windworn-pinion': 'Stonehill · Mountain Pass · Cliff Harpy',
  'cliff-nest-trinket': 'Stonehill · Mountain Pass · Cliff Harpy',
  'marauder-insignia': 'Stonehill · Mountain Pass · Stonehill Marauder',
  'riveted-leather-scrap': 'Stonehill · Mountain Pass · Stonehill Marauder',
  'warband-token': 'Stonehill · Mountain Pass · Stonehill Marauder',
  'notched-whetstone': 'Stonehill · Mountain Pass · Stonehill Marauder',
  'sentinel-plate-fragment': 'Stonehill · Ruined Watchtower · Ironbound Sentinel',
  'rusted-gear': 'Stonehill · Ruined Watchtower · Ironbound Sentinel',
  'runed-rivet': 'Stonehill · Ruined Watchtower · Ironbound Sentinel',
  'watchtower-core': 'Stonehill · Ruined Watchtower · Ironbound Sentinel',
  'captains-sigil': "Stonehill · Ruined Watchtower · Watchtower Captain",
  'watchtower-key-fragment': "Stonehill · Ruined Watchtower · Watchtower Captain",
  'commanders-strap': "Stonehill · Ruined Watchtower · Watchtower Captain",
  'old-garrison-seal': "Stonehill · Ruined Watchtower · Watchtower Captain",
};

export const validateCombatContent = (): string[] => {
  const errors: string[] = [];
  const stonehill = combatRegionById.stonehill;
  if (!stonehill || stonehill.availability !== 'available') errors.push('Stonehill must be available.');
  if (stonehill?.areaIds.length !== 4) errors.push('Stonehill must contain exactly four areas.');

  for (const areaId of STONEHILL_AREAS) {
    const area = areaById[areaId];
    if (!area) {
      errors.push(`Missing Stonehill area: ${areaId}`);
      continue;
    }
    if (area.regionId !== 'stonehill') errors.push(`${areaId} is not assigned to Stonehill.`);
    if (area.enemyIds.length !== 2) errors.push(`${areaId} must contain exactly two enemies.`);
    for (const enemyId of area.enemyIds) {
      const enemy = enemyById[enemyId];
      if (!enemy) errors.push(`Missing enemy ${enemyId} from ${areaId}.`);
      else if (enemy.areaId !== area.id) errors.push(`${enemyId} points at the wrong area.`);
    }
  }

  for (const enemyId of STONEHILL_ENEMIES) {
    const enemy = enemyById[enemyId];
    if (!enemy) {
      errors.push(`Missing Stonehill enemy: ${enemyId}`);
      continue;
    }
    if (!enemy.trait?.id) errors.push(`${enemyId} is missing its trait.`);
    if (!enemy.specialAttack) errors.push(`${enemyId} is missing its special attack.`);
    if (enemy.loot.length < 2 || enemy.loot.length > 4) errors.push(`${enemyId} must have 2–4 loot entries.`);
    if (STONEHILL_GOLD_ENEMIES.has(enemyId) !== Boolean(enemy.gold))
      errors.push(`${enemyId} has invalid Stonehill Gold configuration.`);
    for (const loot of enemy.loot) {
      if (!itemById[loot.itemId]) errors.push(`${enemyId} references missing loot ${loot.itemId}.`);
      else if (expectedDropSources[loot.itemId] !== itemById[loot.itemId].source)
        errors.push(`${loot.itemId} has an invalid Stonehill source.`);
    }
    for (const effect of enemy.specialAttack?.effects ?? []) {
      if (effect.kind === 'apply-combat-effect' && !getCombatEffectDefinition(effect.effectId))
        errors.push(`${enemyId} references missing combat effect ${effect.effectId}.`);
    }
  }
  for (const effectId of EFFECT_IDS)
    if (!getCombatEffectDefinition(effectId)) errors.push(`Missing Stonehill combat effect: ${effectId}`);
  return errors;
};

export const assertCombatContent = (): void => {
  const errors = validateCombatContent();
  if (errors.length) throw new Error(`Combat content validation failed:\n${errors.join('\n')}`);
};
