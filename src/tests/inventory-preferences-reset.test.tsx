import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createNewGame } from '../game/state/initialState';
import { useGameStore } from '../game/state/gameStore';
import { DEFAULT_UI_LAYOUT } from '../app/ui-editor/uiLayout';
import { InventoryScreen } from '../app/screens/inventory/InventoryScreen';
import {
  getInventoryViewStorageKey,
  resetInventoryViewPreferences,
} from '../app/shared/inventoryPreferences';

describe('live Inventory preference reset', () => {
  beforeEach(() => {
    window.localStorage.clear();
    const state = createNewGame(0, 'Preference Tester');
    state.inventory = [
      { itemId: 'iron-ore', quantity: 4, locked: false },
      { itemId: 'iron-sword', quantity: 1, locked: false },
    ];
    useGameStore.getState().setGame(state);
  });

  it('reloads defaults in an already mounted Inventory screen without touching stacks', () => {
    const game = useGameStore.getState().game!;
    const key = getInventoryViewStorageKey(game.profileId);
    const otherKey = getInventoryViewStorageKey('other-profile');
    window.localStorage.setItem(
      key,
      JSON.stringify({
        version: 1,
        sortMode: 'name',
        sortDirection: 'desc',
        lastAutoSortMode: 'name',
        manualOrder: ['iron-sword', 'iron-ore'],
      }),
    );
    window.localStorage.setItem(otherKey, 'preserve-me');

    render(
      <InventoryScreen game={game} uiLayout={DEFAULT_UI_LAYOUT} onNavigate={() => undefined} />,
    );
    expect(screen.getByRole('combobox', { name: 'Sort inventory' })).toHaveValue('name');
    expect(screen.getByRole('checkbox', { name: 'Auto Sort' })).toBeChecked();

    act(() => resetInventoryViewPreferences(game.profileId));

    expect(screen.getByRole('combobox', { name: 'Sort inventory' })).toHaveValue('category');
    expect(screen.getByRole('checkbox', { name: 'Auto Sort' })).toBeChecked();
    expect(window.localStorage.getItem(key)).toBeNull();
    expect(window.localStorage.getItem(otherKey)).toBe('preserve-me');
    expect(useGameStore.getState().game?.inventory).toEqual(game.inventory);
  });
});
