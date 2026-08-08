import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HomeScreen } from '../app/HomeScreen';
import { createNewGame } from '../game/state/initialState';
import { useGameStore } from '../game/state/gameStore';

describe('HomeScreen 2.0', () => {
  it('presents the four top-level progression concepts and separate pillars', () => {
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
  });
});
