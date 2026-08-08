import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../app/App';
import { createNewGame } from '../game/state/initialState';
import { useGameStore } from '../game/state/gameStore';

describe('Collection Log screen', () => {
  beforeEach(() => {
    const game = createNewGame(0, 'Collection Tester');
    game.settings.threeQuality = 'off';
    useGameStore.getState().setGame(game);
  });

  it('exposes only Items and Monsters with eligible completion counts', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Collection Log/ }));
    expect(screen.getByRole('heading', { name: 'Collection Log' })).toBeInTheDocument();
    expect(screen.getByText('1 / 57')).toBeInTheDocument();
    expect(screen.getByText('0 / 14')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Skills / Achievements' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Monsters' }));
    await user.click(screen.getByRole('button', { name: /Stonehill/ }));
    expect(screen.getByText('Rocky Foothills')).toBeInTheDocument();
  });

  it('keeps hidden item names private while searching', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Collection Log/ }));
    await user.click(screen.getByRole('button', { name: 'Undiscovered' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search items' }), 'Boar Tusk');
    expect(screen.queryByText('Boar Tusk')).not.toBeInTheDocument();
    expect(screen.getByText('UNKNOWN ITEM')).toBeInTheDocument();
  });
});
