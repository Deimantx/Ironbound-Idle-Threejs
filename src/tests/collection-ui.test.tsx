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

  it('keeps filter groups, category progress, sections, and clear behavior distinct', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Collection Log/ }));

    expect(screen.getByRole('group', { name: 'Discovery Status' })).toBeInTheDocument();
    const categoryGroup = screen.getByRole('group', { name: 'Category' });
    expect(categoryGroup).toBeInTheDocument();
    const divider = document.querySelector('.collection-filter-divider');
    expect(divider).toBeInTheDocument();
    expect(divider?.previousElementSibling).toBe(screen.getByRole('group', { name: 'Discovery Status' }));
    expect(divider?.nextElementSibling).toBe(categoryGroup);
    expect(within(categoryGroup).getByRole('button', { name: /All Items/ })).toHaveTextContent(/\d+\/57/);
    expect(screen.getByRole('heading', { name: 'Discovered Items' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Undiscovered Items' })).toBeInTheDocument();

    const allItemsButton = within(categoryGroup).getByRole('button', { name: /All Items/ });
    const initialProgress = allItemsButton.textContent;
    await user.type(screen.getByRole('searchbox', { name: 'Search items' }), 'iron');
    expect(within(categoryGroup).getByRole('button', { name: /All Items/ })).toHaveTextContent(initialProgress ?? '');
    expect(screen.getByRole('button', { name: 'Clear Filters' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear Filters' }));

    await user.click(screen.getByRole('button', { name: 'Undiscovered' }));
    expect(screen.queryByRole('heading', { name: 'Discovered Items' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Undiscovered Items' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear Filters' }));
    expect(screen.getByRole('searchbox', { name: 'Search items' })).toHaveValue('');
    expect(screen.getByRole('button', { name: /^All$/ })).toHaveAttribute('aria-pressed', 'true');
    expect(within(categoryGroup).getByRole('button', { name: /All Items/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('navigates from discovered source records without exposing unknown sources', async () => {
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

    await user.click(screen.getByRole('button', { name: /Collection Log/ }));
    const unknownCard = screen.getAllByRole('button', { name: 'Unknown item' })[0];
    await user.click(unknownCard);
    expect(screen.queryByRole('button', { name: /Open (Combat|Mining|Smithing)/ })).not.toBeInTheDocument();
  });

  it('shows the current combat hierarchy for Greenvale item sources', async () => {
    const game = createNewGame(0, 'Collection Tester');
    game.settings.threeQuality = 'off';
    game.discoveredItems.push('rat-tail');
    useGameStore.getState().setGame(game);
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Collection Log/ }));
    await user.click(screen.getByRole('button', { name: 'Rat Tail' }));

    expect(screen.getByText('Greenvale · Forest Path · Forest Rat')).toBeInTheDocument();
    expect(screen.queryByText('Training Grounds · Forest Rat')).not.toBeInTheDocument();
  });

  it('keeps monster region selection when clearing filters', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Collection Log/ }));
    await user.click(screen.getByRole('tab', { name: 'Monsters' }));

    expect(screen.getByRole('group', { name: 'Discovery Status' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Region' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Category' })).not.toBeInTheDocument();
    const stonehill = screen.getByRole('button', { name: /Stonehill/ });
    await user.click(stonehill);
    await user.click(screen.getByRole('button', { name: 'Undiscovered' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search monsters' }), 'captain');
    await user.click(screen.getByRole('button', { name: 'Clear Filters' }));

    expect(screen.getByRole('searchbox', { name: 'Search monsters' })).toHaveValue('');
    expect(screen.getByRole('button', { name: /^All$/ })).toHaveAttribute('aria-pressed', 'true');
    expect(stonehill).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Rocky Foothills')).toBeInTheDocument();
  });
});
