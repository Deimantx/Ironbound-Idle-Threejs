import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../app/App';
import { createNewGame } from '../game/state/initialState';
import { useGameStore } from '../game/state/gameStore';

describe('Debug Tools development panel', () => {
  beforeEach(() => {
    const state = createNewGame(0, 'Debug UI Tester');
    state.settings.threeQuality = 'off';
    state.inventory = [{ itemId: 'iron-ore', quantity: 2, locked: false }];
    useGameStore.getState().setGame(state);
  });

  it('opens one accessible panel with all development categories', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Open debug menu' }));
    const dialog = await screen.findByRole('dialog', { name: 'Debug menu' });
    const backdrop = document.querySelector<HTMLElement>('.debug-tools-backdrop');
    expect(backdrop).not.toBeNull();
    if (!backdrop) throw new Error('Debug backdrop was not rendered');
    await user.click(backdrop);
    await user.keyboard('{Escape}');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText('DEVELOPMENT TOOLS')).toBeInTheDocument();
    for (const label of [
      'Overview',
      'Inventory',
      'Equipment',
      'Progression',
      'Combat',
      'Professions',
      'Simulation',
      'Saves & UI',
    ])
      expect(within(dialog).getByRole('button', { name: label })).toBeInTheDocument();
    for (const label of ['Attack level', 'Strength level', 'Defence level', 'Hitpoints level'])
      expect(within(dialog).getByText(label)).toBeInTheDocument();
    expect(within(dialog).queryByText('Melee level')).not.toBeInTheDocument();
  });

  it('keeps native debug dropdowns usable', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Open debug menu' }));
    const dialog = await screen.findByRole('dialog', { name: 'Debug menu' });
    const skillTarget = within(dialog).getByRole('combobox', { name: 'Skill target' });

    await user.click(skillTarget);
    await new Promise((resolve) => window.setTimeout(resolve, 250));
    expect(document.activeElement).toBe(skillTarget);
    await user.selectOptions(skillTarget, 'mining');

    expect(skillTarget).toHaveValue('mining');
    expect(dialog).toBeInTheDocument();
  });

  it('searches registry items and applies a normal inventory add', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Open debug menu' }));
    const dialog = await screen.findByRole('dialog', { name: 'Debug menu' });
    await user.click(within(dialog).getByRole('button', { name: 'Inventory' }));
    const search = within(dialog).getByRole('textbox', { name: 'Search items' });
    await user.type(search, 'iron sword');
    expect(within(dialog).getByRole('button', { name: /Iron Sword/ })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /Iron Sword/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Add to Inventory' }));
    expect(
      useGameStore.getState().game?.inventory.find((stack) => stack.itemId === 'iron-sword')
        ?.quantity,
    ).toBe(1);
    expect(within(dialog).getByRole('status')).toHaveTextContent('Added Iron Sword');
  });

  it('keeps destructive actions behind the shared confirmation dialog', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Open debug menu' }));
    const dialog = await screen.findByRole('dialog', { name: 'Debug menu' });
    await user.click(within(dialog).getByRole('button', { name: 'Inventory' }));
    await user.click(within(dialog).getByRole('button', { name: 'Clear Inventory' }));
    expect(screen.getByRole('dialog', { name: 'Clear Inventory?' })).toBeInTheDocument();
    expect(useGameStore.getState().game?.inventory).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
  });
});
