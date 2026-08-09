import { describe, expect, it } from 'vitest';
import {
  DEFAULT_UI_TYPOGRAPHY,
  getTypographyCssVariables,
  UI_TYPOGRAPHY_ROLE_IDS,
} from '../app/ui-editor/typography';

describe('semantic typography coverage', () => {
  it('keeps compact variants derived outside the persisted typography schema', () => {
    const variables = getTypographyCssVariables(DEFAULT_UI_TYPOGRAPHY);

    expect(Object.keys(DEFAULT_UI_TYPOGRAPHY.roles)).toEqual(UI_TYPOGRAPHY_ROLE_IDS);
    expect(variables).not.toHaveProperty('--font-size-button-compact');
    expect(variables).not.toHaveProperty('--font-size-stat-compact');
    expect(variables).not.toHaveProperty('--font-weight-button-compact');
    expect(variables).not.toHaveProperty('--font-weight-stat-compact');
  });

  it('maps all ten editor roles to their master semantic variables', () => {
    const variables = getTypographyCssVariables(DEFAULT_UI_TYPOGRAPHY);

    for (const roleId of UI_TYPOGRAPHY_ROLE_IDS) {
      const cssName = roleId.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
      const sizeName = roleId === 'pageTitle' ? 'page-title-max' : cssName;
      expect(variables).toHaveProperty(`--font-size-${sizeName}`);
      expect(variables).toHaveProperty(`--font-weight-${cssName}`);
    }
  });

  it('keeps the editor-controlled family and stat masters available to gameplay selectors', () => {
    expect(getTypographyCssVariables(DEFAULT_UI_TYPOGRAPHY)).toMatchObject({
      '--font-family-body': "'Inter', ui-sans-serif, system-ui, sans-serif",
      '--font-family-stat': "'Inter', ui-sans-serif, system-ui, sans-serif",
      '--font-size-stat': '26px',
      '--font-weight-stat': '700',
    });
  });
});
