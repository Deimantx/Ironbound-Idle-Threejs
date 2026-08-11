export const UI_INSPECTOR_PREFERENCES_KEY = 'ironbound.dev.uiInspector.v1';

export interface UiInspectorPreferences {
  showToolbarButton: boolean;
}

export const DEFAULT_UI_INSPECTOR_PREFERENCES: UiInspectorPreferences = {
  showToolbarButton: true,
};

const copyDefaults = (): UiInspectorPreferences => ({
  ...DEFAULT_UI_INSPECTOR_PREFERENCES,
});

export function loadUiInspectorPreferences(): UiInspectorPreferences {
  if (typeof window === 'undefined') return copyDefaults();

  try {
    const stored = window.localStorage.getItem(UI_INSPECTOR_PREFERENCES_KEY);
    if (!stored) return copyDefaults();
    const parsed: unknown = JSON.parse(stored);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('showToolbarButton' in parsed) ||
      typeof parsed.showToolbarButton !== 'boolean'
    ) {
      return copyDefaults();
    }
    return { showToolbarButton: parsed.showToolbarButton };
  } catch {
    return copyDefaults();
  }
}

export function saveUiInspectorPreferences(preferences: UiInspectorPreferences): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(UI_INSPECTOR_PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // A blocked or unavailable browser store must not affect the game.
  }
}
