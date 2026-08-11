import { render, screen, within } from '@testing-library/react';
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

  it('exposes current Items and Monsters completion counts', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Collection Log/ }));
    expect(screen.getByRole('heading', { name: 'Collection Log' })).toBeInTheDocument();
    expect(screen.getByText('1 / 47')).toBeInTheDocument();
    expect(screen.getByText('0 / 12')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Skills / Achievements' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Monsters' }));
    await user.click(screen.getByRole('button', { name: /Tauraque/ }));
    expect(screen.getByText('Redknife Road Camp')).toBeInTheDocument();
  });

  it('keeps hidden item names private while searching', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Collection Log/ }));
    await user.click(screen.getByRole('button', { name: 'Undiscovered' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search items' }), 'Goblin Scrap');
    expect(screen.queryByText('Goblin Scrap')).not.toBeInTheDocument();
    expect(screen.getByText('UNKNOWN ITEM')).toBeInTheDocument();
  });

  it('keeps filter groups and clear behavior distinct', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Collection Log/ }));
    const discoveryGroup = screen.getByRole('group', { name: 'Discovery Status' });
    expect(discoveryGroup).toBeInTheDocument();
    const categoryGroup = screen.getByRole('group', { name: 'Category' });
    const filterDivider = categoryGroup.previousElementSibling;
    expect(filterDivider).toHaveClass('collection-filter-divider');
    expect(filterDivider?.previousElementSibling).toBe(discoveryGroup);
    expect(within(discoveryGroup).getByRole('button', { name: 'All' })).toHaveClass('inventory-filter', 'is-active');
    expect(within(categoryGroup).getByRole('button', { name: /All Items/ })).toHaveTextContent(/\d+\/47/);
    expect(within(categoryGroup).getByRole('button', { name: /All Items/ })).toHaveClass('inventory-filter', 'is-active');
    expect(screen.getByRole('heading', { name: 'Discovered Items' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Undiscovered Items' })).toBeInTheDocument();

    const initialProgress = within(categoryGroup).getByRole('button', { name: /All Items/ }).textContent;
    await user.type(screen.getByRole('searchbox', { name: 'Search items' }), 'iron');
    expect(within(categoryGroup).getByRole('button', { name: /All Items/ })).toHaveTextContent(initialProgress ?? '');
    expect(screen.getByRole('button', { name: 'Clear Filters' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear Filters' }));
    expect(screen.getByRole('searchbox', { name: 'Search items' })).toHaveValue('');
  });

  it('navigates from discovered current source records', async () => {
    const game = createNewGame(0, 'Collection Tester');
    game.settings.threeQuality = 'off';
    game.discoveredItems.push('iron-ore');
    useGameStore.getState().setGame(game);
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Collection Log/ }));
    await user.click(screen.getByRole('button', { name: 'Iron Ore' }));
    expect(screen.getByRole('button', { name: /Open Mining/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Open Mining/ }));
    expect(screen.getByRole('heading', { name: 'Mining' })).toBeInTheDocument();
  });

  it('shows the current Tauraque combat source hierarchy', async () => {
    const game = createNewGame(0, 'Collection Tester');
    game.settings.threeQuality = 'off';
    game.discoveredItems.push('redknife-token');
    useGameStore.getState().setGame(game);
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Collection Log/ }));
    await user.click(screen.getByRole('button', { name: 'Redknife Token' }));
    expect(screen.getByText(/Tauraque.*Redknife Road Camp/)).toBeInTheDocument();
    expect(screen.queryByText(/Greenvale|Forest Path/)).not.toBeInTheDocument();
  });

  it('keeps the Tauraque monster region selected when clearing filters', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Collection Log/ }));
    await user.click(screen.getByRole('tab', { name: 'Monsters' }));
    const tauraque = screen.getByRole('button', { name: /Tauraque/ });
    await user.click(tauraque);
    await user.click(screen.getByRole('button', { name: 'Undiscovered' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search monsters' }), 'lookout');
    await user.click(screen.getByRole('button', { name: 'Clear Filters' }));
    expect(screen.getByRole('searchbox', { name: 'Search monsters' })).toHaveValue('');
    expect(tauraque).toHaveAttribute('aria-pressed', 'true');
  });
});
