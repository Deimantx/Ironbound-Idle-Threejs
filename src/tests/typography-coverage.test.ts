import { describe, expect, it } from 'vitest';
import {
  DEFAULT_UI_TYPOGRAPHY,
  getCompactButtonSize,
  getCompactStatSize,
  getTypographyCssVariables,
  UI_TYPOGRAPHY_ROLE_IDS,
} from '../app/ui-editor/typography';

describe('semantic typography coverage', () => {
  it('keeps compact variants outside the persisted typography schema', () => {
    const variables = getTypographyCssVariables(DEFAULT_UI_TYPOGRAPHY);

    expect(Object.keys(DEFAULT_UI_TYPOGRAPHY)).toEqual(['fontFamilies', 'roles']);
    expect(Object.keys(DEFAULT_UI_TYPOGRAPHY.roles)).toEqual(UI_TYPOGRAPHY_ROLE_IDS);
    expect(variables).toHaveProperty('--font-size-button-compact');
    expect(variables).toHaveProperty('--font-size-stat-compact');
    expect(variables).toHaveProperty('--font-weight-button-compact');
    expect(variables).toHaveProperty('--font-weight-stat-compact');
  });

  it('maps Stat and Button master sizes to runtime compact values', () => {
    expect([14, 20, 26, 34, 42].map(getCompactStatSize)).toEqual([10, 11, 14, 19, 22]);
    expect([9, 12, 16, 20].map(getCompactButtonSize)).toEqual([9, 10, 13, 16]);

    const typography = {
      ...DEFAULT_UI_TYPOGRAPHY,
      roles: {
        ...DEFAULT_UI_TYPOGRAPHY.roles,
        button: { size: 20, weight: 800 },
        stat: { size: 42, weight: 550 },
      },
      fontFamilies: {
        ...DEFAULT_UI_TYPOGRAPHY.fontFamilies,
        stat: 'dmMono' as const,
      },
    };
    expect(getTypographyCssVariables(typography)).toMatchObject({
      '--font-size-button': '20px',
      '--font-size-button-compact': '16px',
      '--font-weight-button': '800',
      '--font-weight-button-compact': '800',
      '--font-size-stat': '42px',
      '--font-size-stat-compact': '22px',
      '--font-weight-stat': '500',
      '--font-weight-stat-compact': '500',
      '--font-family-stat': "'DM Mono', ui-monospace, SFMono-Regular, Consolas, monospace",
    });
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
