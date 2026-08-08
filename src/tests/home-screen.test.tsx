import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HomeScreen } from '../app/HomeScreen';
import { startCombat } from '../game/engine/actionController';
import { createNewGame } from '../game/state/initialState';
import { useGameStore } from '../game/state/gameStore';

describe('HomeScreen 2.1', () => {
  it('presents the four top-level progression concepts and separate pillars in the approved order', () => {
    const game = createNewGame(0, 'Dashboard Tester');
    game.settings.threeQuality = 'off';
    game.skills.attack.level = 10;
    game.skills.strength.level = 20;
    game.skills.defence.level = 30;
    game.skills.hitpoints.level = 40;
    game.skills.mining.level = 50;
    game.skills.smithing.level = 60;
    useGameStore.getState().setGame(game);

    render(<HomeScreen game={game} onNavigate={vi.fn()} />);

    expect(screen.getByText('TOTAL LEVEL')).toBeInTheDocument();
    expect(screen.getByText('COMBAT LEVEL')).toBeInTheDocument();
    expect(screen.getByText('TOTAL COMBAT LEVELS')).toBeInTheDocument();
    expect(screen.getByText('TOTAL PROFESSION LEVELS')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Combat Progression' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Profession Progression' })).toBeInTheDocument();
    expect(screen.getByText('Attack')).toBeInTheDocument();
    expect(screen.getByText('Mining')).toBeInTheDocument();
    expect(screen.getAllByText('Idle').length).toBeGreaterThan(0);
    expect(screen.getByText('Offhand')).toBeInTheDocument();

    const overview = screen.getByRole('region', { name: 'Your standing on the frontier' });
    expect(Array.from(overview.querySelectorAll('.home-metric-label')).map((node) => node.textContent?.trim())).toEqual([
      'TOTAL LEVEL',
      'TOTAL PROFESSION LEVELS',
      'TOTAL COMBAT LEVELS',
      'COMBAT LEVEL',
    ]);
  });

  it('consolidates supporting records and keeps navigation unambiguous', () => {
    const game = createNewGame(0, 'Dashboard Tester');
    game.settings.threeQuality = 'off';
    game.equipment.weapon = 'bronze-sword';
    useGameStore.getState().setGame(game);

    render(<HomeScreen game={game} onNavigate={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Recent Progress' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Combat' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Professions' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: 'Recent Progress' })).toHaveLength(1);
    expect(screen.getByText('Enemies defeated')).toBeInTheDocument();
    expect(screen.getByText('Items')).toBeInTheDocument();
    expect(screen.getByText('Monsters')).toBeInTheDocument();
    expect(screen.getByText('Overall')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Overall collection progress' })).toBeInTheDocument();
    expect(screen.queryByText('The same eligible world and collection totals shown in the Collection Log.')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /View Gear/ })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Equipment' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Mining' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Smithing' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Weapon: Bronze Sword' })).toHaveAttribute('data-tooltip-trigger', 'true');
    expect(screen.getByRole('group', { name: 'Offhand: Empty' })).not.toHaveAttribute('data-tooltip-trigger');
  });

  it('keeps Home totals accurate after the metric strip redesign', () => {
    const game = createNewGame(0, 'Totals Tester');
    game.settings.threeQuality = 'off';
    game.skills.attack.level = 50;
    game.skills.strength.level = 50;
    game.skills.defence.level = 50;
    game.skills.hitpoints.level = 50;
    game.skills.mining.level = 44;
    game.skills.smithing.level = 99;
    useGameStore.getState().setGame(game);

    render(<HomeScreen game={game} onNavigate={vi.fn()} />);

    const overview = screen.getByRole('region', { name: 'Your standing on the frontier' });
    expect(Array.from(overview.querySelectorAll('.home-overview-metric strong')).map((node) => node.textContent)).toEqual([
      '343',
      '143',
      '200',
      '50',
    ]);
  });

  it('shows idle and active activity status without changing game state', () => {
    const game = createNewGame(0, 'Activity Tester');
    game.settings.threeQuality = 'off';
    const navigate = vi.fn();
    useGameStore.getState().setGame(game);
    const { rerender } = render(<HomeScreen game={game} onNavigate={navigate} />);
    expect(screen.getByText('No action running')).toBeInTheDocument();

    const activeGame = startCombat(game, 'forest-path', 'forest-rat', 'accurate', true, 1_000);
    const before = structuredClone(activeGame.activeAction);
    rerender(<HomeScreen game={activeGame} onNavigate={navigate} />);
    expect(screen.getByText(/Combat · Forest Rat/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Return to Combat' })).toBeInTheDocument();
    expect(activeGame.activeAction).toEqual(before);
  });
});
