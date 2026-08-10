import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HomeScreen } from '../app/screens/home/HomeScreen';
import { startCombat } from '../game/engine/actionController';
import { createNewGame } from '../game/state/initialState';
import { useGameStore } from '../game/state/gameStore';

describe('HomeScreen 2.3', () => {
  it('presents the four top-level progression concepts and shared progression boards', () => {
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
    const combat = screen.getByRole('region', { name: 'Combat Progression' });
    expect(Array.from(combat.querySelectorAll('.home-progression-group > h3')).map((node) => node.textContent)).toEqual([
      'Hitpoints',
      'Melee',
    ]);
    expect(combat.querySelectorAll('.home-progression-group-melee .home-skill-tile')).toHaveLength(3);
    expect(screen.getByText('Attack')).toBeInTheDocument();
    expect(screen.getByText('Mining')).toBeInTheDocument();
    expect(screen.queryByText('Ranged')).not.toBeInTheDocument();
    expect(screen.queryByText('Magic')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Hitpoints, level/ }).querySelector('.lucide-heart')).toBeInTheDocument();
    expect(screen.getAllByText('Idle').length).toBeGreaterThan(0);
    expect(screen.queryByText('Current loadout')).not.toBeInTheDocument();

    const overview = screen.getByRole('region', { name: 'Your standing on the frontier' });
    expect(Array.from(overview.querySelectorAll('.home-metric-label')).map((node) => node.textContent?.trim())).toEqual([
      'TOTAL LEVEL',
      'TOTAL PROFESSION LEVELS',
      'TOTAL COMBAT LEVELS',
      'COMBAT LEVEL',
    ]);
  });

  it('integrates recent progress and keeps navigation unambiguous', () => {
    const game = createNewGame(0, 'Dashboard Tester');
    game.settings.threeQuality = 'off';
    game.equipment.weapon = 'bronze-sword';
    useGameStore.getState().setGame(game);

    render(<HomeScreen game={game} onNavigate={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Recent Combat' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recent Profession' })).toBeInTheDocument();
    expect(screen.getByText('Enemies defeated')).toBeInTheDocument();
    expect(screen.getByText('Items')).toBeInTheDocument();
    expect(screen.getByText('Monsters')).toBeInTheDocument();
    expect(screen.getByText('Overall')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Overall collection progress' })).toBeInTheDocument();
    expect(screen.queryByText('The same eligible world and collection totals shown in the Collection Log.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /View Gear/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Equipment' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mining, level/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Smithing, level/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Open Mining/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Open Smithing/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Starter Path')).not.toBeInTheDocument();
    expect(screen.queryByText('Combat snapshot')).not.toBeInTheDocument();
    expect(screen.getByText('Total items gained')).toBeInTheDocument();
    expect(screen.getByText('Time played')).toBeInTheDocument();
    expect(screen.queryByText('Equipped for the frontier')).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /Weapon: Bronze Sword/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Choose a profession or seek a fight.')).not.toBeInTheDocument();
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

  it('renders max levels and presentational levels without hardcoding the current cap', () => {
    const game = createNewGame(0, 'Level Display Tester');
    game.settings.threeQuality = 'off';
    game.skills.attack = { level: 200, xp: 9_999_999 };
    game.skills.strength = { level: 100, xp: 9_999_999 };
    render(<HomeScreen game={game} onNavigate={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Attack, level 200, max level' })).toHaveTextContent('Lv 200');
    expect(screen.getByRole('button', { name: 'Strength, level 100, max level' })).toHaveTextContent('MAX');
  });

  it('shows idle and active activity status without changing game state', () => {
    const game = createNewGame(0, 'Activity Tester');
    game.settings.threeQuality = 'off';
    const navigate = vi.fn();
    useGameStore.getState().setGame(game);
    const { rerender } = render(<HomeScreen game={game} onNavigate={navigate} />);
    expect(screen.getByText('Idle')).toBeInTheDocument();

    const activeGame = startCombat(game, 'redknife-road-camp', 'redknife-lookout', 'accurate', true, 1_000);
    const before = structuredClone(activeGame.activeAction);
    rerender(<HomeScreen game={activeGame} onNavigate={navigate} />);
    expect(screen.getByText(/Combat .* Redknife Lookout/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Return to Combat' })).toBeInTheDocument();
    expect(screen.queryByText(/Session/)).not.toBeInTheDocument();
    expect(activeGame.activeAction).toEqual(before);
  });
});
