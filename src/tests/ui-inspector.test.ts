import {
  formatUiInspectorReference,
  getUiInspectorDisplayRows,
  resolveUiInspectorTarget,
} from '../app/debug/ui-inspector/uiInspectorModel';
import {
  DEFAULT_UI_INSPECTOR_PREFERENCES,
  loadUiInspectorPreferences,
  saveUiInspectorPreferences,
  UI_INSPECTOR_PREFERENCES_KEY,
} from '../app/debug/ui-inspector/uiInspectorPreferences';
import { beforeEach, describe, expect, it } from 'vitest';

describe('UI Inspector preferences', () => {
  beforeEach(() => window.localStorage.clear());

  it('defaults safely when localStorage is missing or malformed', () => {
    expect(loadUiInspectorPreferences()).toEqual(DEFAULT_UI_INSPECTOR_PREFERENCES);
    window.localStorage.setItem(UI_INSPECTOR_PREFERENCES_KEY, '{bad json');
    expect(loadUiInspectorPreferences()).toEqual(DEFAULT_UI_INSPECTOR_PREFERENCES);
    window.localStorage.setItem(UI_INSPECTOR_PREFERENCES_KEY, JSON.stringify({ showToolbarButton: 'no' }));
    expect(loadUiInspectorPreferences()).toEqual(DEFAULT_UI_INSPECTOR_PREFERENCES);
  });

  it('persists the developer preference independently', () => {
    saveUiInspectorPreferences({ showToolbarButton: false });
    expect(window.localStorage.getItem(UI_INSPECTOR_PREFERENCES_KEY)).toBe(
      JSON.stringify({ showToolbarButton: false }),
    );
    expect(loadUiInspectorPreferences()).toEqual({ showToolbarButton: false });
  });
});

describe('UI Inspector DOM resolver', () => {
  it('recovers screen, shell, panel, region, and semantic entity metadata', () => {
    document.body.innerHTML = `
      <main data-debug-screen="combat" data-ui-region="content">
        <section data-ui-panel="combatLocations">
          <div data-ui-panel-region="combatLocationsBrowser" data-ui-panel-owner="combatLocations">
            <button data-debug-kind="enemy" data-debug-enemy-id="greyfang-wolf" data-debug-label="Greyfang Wolf">
              <strong>Greyfang Wolf</strong>
            </button>
          </div>
        </section>
      </main>
    `;
    const raw = document.querySelector('strong');
    expect(raw).not.toBeNull();

    const target = resolveUiInspectorTarget(raw!);
    expect(target).toMatchObject({
      tagName: 'button',
      screen: 'combat',
      uiRegion: 'content',
      panelId: 'combatLocations',
      panelRegionId: 'combatLocationsBrowser',
      panelOwnerId: 'combatLocations',
      debugKind: 'enemy',
      debugId: 'greyfang-wolf',
      debugLabel: 'Greyfang Wolf',
    });
  });

  it('keeps generic controls useful and omits empty fields from copied references', () => {
    document.body.innerHTML = '<button class="button ghost" aria-label="Unequip item">Unequip</button>';
    const target = resolveUiInspectorTarget(document.querySelector('button')!);
    expect(target).not.toBeNull();
    expect(getUiInspectorDisplayRows(target!)).toEqual([
      { label: 'ELEMENT', value: 'button' },
      { label: 'ARIA', value: 'Unequip item' },
      { label: 'CSS', value: 'button ghost' },
      { label: 'TEXT', value: 'Unequip' },
    ]);
    const reference = formatUiInspectorReference(target!);
    expect(reference).toContain('Element: button');
    expect(reference).toContain('ARIA: Unequip item');
    expect(reference).not.toContain('undefined');
    expect(reference).not.toContain('null');
  });

  it('ignores inspector overlay descendants', () => {
    document.body.innerHTML =
      '<div data-ui-inspector-ignore><button class="button ghost">Overlay</button></div>';
    expect(resolveUiInspectorTarget(document.querySelector('button')!)).toBeNull();
  });
});
