import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../app/App';
import { UI_LAYOUT_STORAGE_KEY } from '../app/ui-editor/uiLayout';
import { createNewGame } from '../game/state/initialState';
import { useGameStore } from '../game/state/gameStore';

describe('Tauraque Combat navigation', () => {
  beforeEach(() => {
    window.localStorage.removeItem(UI_LAYOUT_STORAGE_KEY);
    const game = createNewGame(0, 'Tauraque Navigator', 0);
    game.settings.threeQuality = 'off';
    useGameStore.getState().setGame(game);
  });

  it('shows the current hierarchy, Area badges, locked previews, and only new targets', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole('button', { name: /Combat/ })[0]);

    expect(screen.getByRole('button', { name: 'Tauraque' })).toBeInTheDocument();
    const subRegions = screen.getByLabelText('Combat sub-regions');
    expect(within(subRegions).getAllByRole('button')).toHaveLength(8);
    expect(within(subRegions).getByRole('button', { name: 'Lornwick Vale' })).toHaveClass('selected');
    expect(screen.getAllByText('AREA')).toHaveLength(3);
    expect(screen.getByRole('button', { name: /Select target Redknife Lookout/ })).toBeInTheDocument();
    expect(screen.queryByText('Forest Rat')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Dungeons|Special|Conquest/ })).not.toBeInTheDocument();

    await user.click(within(subRegions).getByRole('button', { name: 'Greymoss Woods, locked' }));
    expect(screen.getByRole('button', { name: /Mossfang Encampment/ })).toHaveClass('locked');
    expect(screen.getByText('Targets will be revealed when this Area becomes available.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Target locked' })).toBeDisabled();

    await user.click(within(subRegions).getByRole('button', { name: 'Lornwick Vale' }));
    expect(screen.getAllByText('AREA')).toHaveLength(3);
    expect(screen.getByRole('button', { name: /Select target Redknife Lookout/ })).toBeInTheDocument();
  });
});
