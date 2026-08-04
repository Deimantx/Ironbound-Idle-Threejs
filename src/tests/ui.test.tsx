import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, beforeEach } from 'vitest';
import { App } from '../app/App';
import { createNewGame } from '../game/state/initialState';
import { useGameStore } from '../game/state/gameStore';

describe('navigation integration', () => {
  beforeEach(() => {
    const game = createNewGame(0, 'Navigator');
    game.settings.threeQuality = 'off';
    useGameStore.getState().setGame(game);
  });
  it('keeps an action active while navigating to Inventory', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Mining/ }));
    await user.click(screen.getAllByRole('button', { name: 'Mine' })[0]);
    await user.click(screen.getAllByRole('button', { name: /Inventory/ })[0]);
    expect(screen.getByRole('heading', { name: 'Inventory' })).toBeInTheDocument();
    expect(useGameStore.getState().game?.activeAction.type).toBe('mining');
  });

  it('opens and closes the local visual UI editor', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Edit game UI' }));
    expect(screen.getByRole('dialog', { name: 'Edit game UI' })).toBeInTheDocument();
    expect(screen.getByText('Sidebar width')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close UI editor' }));
    expect(screen.queryByRole('dialog', { name: 'Edit game UI' })).not.toBeInTheDocument();
  });

  it('drives the real-time combat controls from the selected roster target', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole('button', { name: /Combat/ })[0]);
    expect(screen.getByRole('heading', { name: 'Combat' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Training Grounds roster' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Goblin Scavenger/ }));
    expect(screen.getByText('Goblin Scavenger', { selector: 'b' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Aggressive/ }));
    await user.click(screen.getByRole('button', { name: 'Fight' }));
    const activeCombat = useGameStore.getState().game?.activeAction;
    expect(activeCombat?.type).toBe('combat');
    expect(activeCombat?.type === 'combat' ? activeCombat.enemyId : null).toBe('goblin-scavenger');
    expect(screen.getByRole('button', { name: 'Stop combat' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Stop combat' }));
    expect(useGameStore.getState().game?.activeAction.type).toBe('none');
  });

  it('keeps target switching inside the game UI and restarts combat', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole('button', { name: /Combat/ })[0]);
    await user.click(screen.getByRole('button', { name: 'Fight' }));
    expect(useGameStore.getState().game?.activeAction.type).toBe('combat');
    expect(screen.getByRole('img', { name: 'Forest Rat combatant' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Switch target Goblin Scavenger/ }));
    expect(screen.getByRole('heading', { name: 'Switch target?' })).toBeInTheDocument();
    expect(useGameStore.getState().game?.activeAction.type).toBe('combat');
    await user.click(screen.getByRole('button', { name: 'Switch target' }));
    const activeCombat = useGameStore.getState().game?.activeAction;
    expect(activeCombat?.type).toBe('combat');
    expect(activeCombat?.type === 'combat' ? activeCombat.enemyId : null).toBe('goblin-scavenger');
  });

  it('opens the development debug menu beside the UI editor', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Open debug menu' }));
    expect(screen.getByRole('dialog', { name: 'Debug menu' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Skill target' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kill current monster' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Give gold' }));
    expect(useGameStore.getState().game?.gold).toBe(1000);
  });
});
