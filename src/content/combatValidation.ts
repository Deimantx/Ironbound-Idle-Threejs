import { combatRegionById } from './combatRegions';
import { COMBAT_SUB_REGIONS, combatSubRegionById } from './combatSubRegions';
import { AREAS, areaById } from './areas';
import { ENEMIES, enemyById } from './enemies';
import { itemById } from './items';
import { getCombatEffectDefinition } from '../game/formulas/combatEffects';
import { getResolvedEnemyLoot } from '../game/formulas/combatLoot';

const validLoot = (itemId: string, chance: number, min: number, max: number, errors: string[], owner: string): void => {
  if (!itemById[itemId]) errors.push(`${owner} references missing item ${itemId}.`);
  if (!(chance > 0 && chance <= 1)) errors.push(`${owner} has invalid chance for ${itemId}.`);
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max < min)
    errors.push(`${owner} has invalid quantity range for ${itemId}.`);
};

export const validateCombatContent = (): string[] => {
  const errors: string[] = [];
  const region = combatRegionById.tauraque;
  if (!region || region.availability !== 'available') errors.push('Tauraque must be available.');
  if (region?.subRegionIds.length !== 8 || new Set(region?.subRegionIds).size !== 8)
    errors.push('Tauraque must contain exactly eight unique Sub-regions.');
  if (COMBAT_SUB_REGIONS.length !== 8) errors.push('There must be exactly eight Sub-regions.');
  if (AREAS.length !== 24 || new Set(AREAS.map((area) => area.id)).size !== 24)
    errors.push('There must be exactly twenty-four unique Areas.');

  for (const subRegion of COMBAT_SUB_REGIONS) {
    if (!region?.subRegionIds.includes(subRegion.id)) errors.push(`${subRegion.id} is not owned by Tauraque.`);
    if (subRegion.regionId !== 'tauraque') errors.push(`${subRegion.id} points to the wrong Region.`);
    if (subRegion.areaIds.length !== 3 || new Set(subRegion.areaIds).size !== 3)
      errors.push(`${subRegion.id} must contain exactly three unique Areas.`);
    for (const areaId of subRegion.areaIds) {
      const area = areaById[areaId as keyof typeof areaById];
      if (!area) {
        errors.push(`Missing Area ${areaId}.`);
        continue;
      }
      if (area.subRegionId !== subRegion.id) errors.push(`${areaId} points to the wrong Sub-region.`);
      if (area.regionId !== subRegion.regionId) errors.push(`${areaId} points to the wrong Region.`);
      if (area.activityType !== 'area') errors.push(`${areaId} is not an Area activity.`);
      if (area.availability === 'locked') {
        if (area.enemyIds.length !== 0) errors.push(`Locked Area ${areaId} must have no enemies.`);
        if (area.sharedLoot.length !== 0 || area.gold) errors.push(`Locked Area ${areaId} must have no loot or Gold.`);
      } else if (area.enemyIds.length !== 4) errors.push(`Playable Area ${areaId} must contain exactly four enemies.`);
      for (const loot of area.sharedLoot) validLoot(loot.itemId, loot.chance, loot.min, loot.max, errors, areaId);
    }
  }

  if (ENEMIES.length !== 12) errors.push('There must be exactly twelve current enemies.');
  for (const enemy of ENEMIES) {
    const area = areaById[enemy.areaId];
    if (!area || area.availability !== 'available' || !area.enemyIds.includes(enemy.id))
      errors.push(`${enemy.id} is not assigned to a playable Area.`);
    if (!enemy.trait?.id) errors.push(`${enemy.id} is missing its Trait.`);
    if (!enemy.specialAttack?.id) errors.push(`${enemy.id} is missing its Special.`);
    validLoot(enemy.signatureLoot.itemId, enemy.signatureLoot.chance, enemy.signatureLoot.min, enemy.signatureLoot.max, errors, enemy.id);
    for (const effect of enemy.specialAttack.effects ?? [])
      if (effect.kind === 'apply-combat-effect' && !getCombatEffectDefinition(effect.effectId))
        errors.push(`${enemy.id} references missing effect ${effect.effectId}.`);
    const composed = getResolvedEnemyLoot(enemy.id);
    if (new Set(composed.map((loot) => loot.itemId)).size !== composed.length)
      errors.push(`${enemy.id} has duplicate composed loot.`);
  }

  for (const loot of region?.sharedLoot ?? []) validLoot(loot.itemId, loot.chance, loot.min, loot.max, errors, 'Tauraque');
  const playableAreas = AREAS.filter((area) => area.availability === 'available');
  if (playableAreas.length !== 3) errors.push('There must be exactly three playable Areas.');
  if (areaById['redknife-road-camp']?.gold === undefined) errors.push('Redknife Road Camp must define Gold.');
  if (areaById['greyfang-pastures']?.gold !== undefined) errors.push('Greyfang Pastures must not define direct Gold.');
  if (areaById['brambletooth-camp']?.gold !== undefined) errors.push('Brambletooth Camp must not define direct Gold.');
  const trace = region?.sharedLoot.some((loot) => loot.itemId === 'trace-of-nature');
  if (trace) errors.push('Trace of Nature must not be Tauraque shared loot.');
  if (!areaById['greyfang-pastures']?.sharedLoot.some((loot) => loot.itemId === 'trace-of-nature')) errors.push('Greyfang Pastures must contain Trace of Nature.');
  if (areaById['redknife-road-camp']?.sharedLoot.some((loot) => loot.itemId === 'trace-of-nature')) errors.push('Redknife Road Camp must not contain Trace of Nature.');
  if (areaById['brambletooth-camp']?.sharedLoot.some((loot) => loot.itemId === 'trace-of-nature')) errors.push('Brambletooth Camp must not contain Trace of Nature.');
  return errors;
};

export const assertCombatContent = (): void => {
  const errors = validateCombatContent();
  if (errors.length) throw new Error(`Combat content validation failed:\n${errors.join('\n')}`);
};

export { combatRegionById, combatSubRegionById, areaById, enemyById };
