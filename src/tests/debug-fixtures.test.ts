import { describe, expect, it } from 'vitest';
import {
  createLegacyArmorFixture,
  createLegacyShieldFixture,
  previewMigration,
  validateFixture,
} from '../game/debug/debugFixtures';

describe('Debug Tools migration fixtures', () => {
  it('creates fresh Armor and Shield fixtures with useful legacy state', () => {
    const armor = createLegacyArmorFixture();
    const secondArmor = createLegacyArmorFixture();
    const shield = createLegacyShieldFixture();
    expect(armor).not.toBe(secondArmor);
    expect(armor.equipment.body).toBe('bronze-platebody');
    expect(shield.equipment.shield).toBe('bronze-shield');
    expect(validateFixture(armor).ok).toBe(true);
    expect(validateFixture(shield).ok).toBe(true);
  });

  it('previews the current migration changes', () => {
    expect(previewMigration(createLegacyArmorFixture()).join(' ')).toMatch(/body\/legs.*armor/);
    expect(previewMigration(createLegacyShieldFixture()).join(' ')).toMatch(/shield.*offhand/);
  });
});
