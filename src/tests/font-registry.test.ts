import { describe, expect, it } from 'vitest';
import {
  DEFAULT_UI_FONT_FAMILIES,
  UI_FONT_IDS,
  UI_FONT_REGISTRY,
  UI_FONT_REGISTRY_ENTRIES,
  UI_FONT_ROLE_DEFINITIONS,
  resolveFontWeight,
  sanitizeUiFontFamilies,
} from '../app/ui-editor/fontRegistry';

describe('UI font registry', () => {
  it('contains only explicit bundled font families with complete metadata', () => {
    expect(UI_FONT_REGISTRY_ENTRIES.map((font) => font.id)).toEqual(UI_FONT_IDS);
    expect(UI_FONT_ROLE_DEFINITIONS.map((role) => role.id)).toEqual(['heading', 'body', 'stat']);
    expect(UI_FONT_REGISTRY.inter).toMatchObject({
      label: 'Inter',
      weightMode: 'variable',
      minWeight: 100,
      maxWeight: 900,
      weightStep: 1,
    });
    expect(UI_FONT_REGISTRY.interDisplay).toMatchObject({
      label: 'Inter Display',
      cssFamily: "'Inter Display', 'Inter', ui-sans-serif, system-ui, sans-serif",
      weightMode: 'static',
      minWeight: 100,
      maxWeight: 900,
      weightStep: 100,
      supportedWeights: [100, 200, 300, 400, 500, 600, 700, 800, 900],
    });
    expect(DEFAULT_UI_FONT_FAMILIES).toEqual({ heading: 'inter', body: 'inter', stat: 'inter' });
  });

  it('sanitizes unknown stored family IDs to the Inter default', () => {
    expect(sanitizeUiFontFamilies({ heading: 'interDisplay', body: 'missing', stat: 42 })).toEqual({
      heading: 'interDisplay',
      body: 'inter',
      stat: 'inter',
    });
    expect(sanitizeUiFontFamilies(null)).toEqual(DEFAULT_UI_FONT_FAMILIES);
  });

  it('keeps variable weights and resolves static weights to the nearest face', () => {
    expect(resolveFontWeight('inter', 650)).toBe(650);
    expect(resolveFontWeight('interDisplay', 650)).toBe(600);
    expect(resolveFontWeight('interDisplay', 680)).toBe(700);
    expect(resolveFontWeight('interDisplay', 9999)).toBe(900);
    expect(resolveFontWeight('interDisplay', -1)).toBe(100);
    expect(resolveFontWeight('interDisplay', Number.NaN)).toBe(400);
  });
});
