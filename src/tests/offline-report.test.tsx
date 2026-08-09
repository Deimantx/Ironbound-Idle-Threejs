import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OfflineModal, formatOfflineDuration } from '../app/components/OfflineReport';
import { getXpForLevel } from '../game/formulas/experienceFormulas';
import { createNewGame } from '../game/state/initialState';
import { emptySummary } from '../game/types';

describe('Offline Report 2.0', () => {
  it('formats natural offline durations', () => {
    expect(formatOfflineDuration(42_000)).toBe('42s');
    expect(formatOfflineDuration(8 * 60_000)).toBe('8m');
    expect(formatOfflineDuration((64 * 60 + 2) * 1_000)).toBe('1h 4m');
    expect(formatOfflineDuration(24 * 60 * 60_000)).toBe('24h');
  });

  it('renders a player-facing Mining report without internal completion keys', () => {
    const game = createNewGame(0, 'Offline Miner');
    game.skills.mining.level = 98;
    game.skills.mining.xp = getXpForLevel(98);
    game.activeAction = {
      type: 'mining',
      nodeId: 'stone-outcrop',
      startedAt: 0,
      phase: 'swing',
      progressMs: 0,
    };
    const summary = emptySummary(64 * 60_000);
    summary.requestedElapsedMs = 64 * 60_000;
    summary.offlineContext = { activity: 'mining', miningNodeId: 'stone-outcrop' };
    summary.itemsGained = { 'stone-ore': 714, 'iron-ore': 43, 'rough-gem': 2 };
    summary.xpGained = { mining: 5_712 };
    summary.levelsGained = { mining: 2 };
    summary.completed = {
      'mine-swing:stone-outcrop': 70,
      'mine-stage:stone-outcrop:0': 2,
      'mine-rock:stone-outcrop': 1,
    };
    render(<OfflineModal game={game} summary={summary} onClose={() => undefined} />);

    expect(screen.getByRole('heading', { name: '1h 4m away' })).toBeInTheDocument();
    expect(screen.getAllByText('Welcome back')).toHaveLength(1);
    expect(screen.getByText('1h 4m away')).toBeInTheDocument();
    expect(screen.getByText('Mining continued while you were gone.')).toBeInTheDocument();
    expect(screen.getByText('Stone Outcrop')).toBeInTheDocument();
    expect(screen.getByText('Stone Ore')).toBeInTheDocument();
    expect(screen.getByText('+714')).toBeInTheDocument();
    expect(screen.getByText('+43')).toBeInTheDocument();
    expect(screen.getByText('+2')).toBeInTheDocument();
    expect(screen.getByText('+5,712')).toBeInTheDocument();
    expect(screen.getByText('96 → 98')).toBeInTheDocument();
    expect(screen.getByText('Mining continues automatically.')).toBeInTheDocument();
    expect(screen.queryByText('foes defeated')).not.toBeInTheDocument();
    expect(screen.queryByText(/mine-swing|mine-stage|mine-rock/)).not.toBeInTheDocument();
  });

  it('uses activity-specific progress for Combat and Smithing', () => {
    const combat = createNewGame(0, 'Offline Combatant');
    combat.activeAction = { type: 'none' };
    const combatSummary = emptySummary(60_000);
    combatSummary.requestedElapsedMs = 60_000;
    combatSummary.offlineContext = { activity: 'combat', enemyId: 'forest-rat' };
    combatSummary.enemiesDefeated = 4;
    combatSummary.goldGained = 12;
    combatSummary.xpGained = { attack: 24 };
    const { unmount } = render(
      <OfflineModal game={combat} summary={combatSummary} onClose={() => undefined} />,
    );
    expect(screen.getByText('Enemies defeated')).toBeInTheDocument();
    expect(screen.getByText('Gold gained')).toBeInTheDocument();
    expect(screen.queryByText('Mining XP')).not.toBeInTheDocument();

    unmount();
    const smithing = createNewGame(0, 'Offline Smith');
    smithing.activeAction = { type: 'none' };
    const smithingSummary = emptySummary(60_000);
    smithingSummary.requestedElapsedMs = 60_000;
    smithingSummary.offlineContext = { activity: 'smithing', recipeId: 'bronze-bar' };
    smithingSummary.itemsGained = { 'bronze-bar': 3 };
    smithingSummary.xpGained = { smithing: 72 };
    render(<OfflineModal game={smithing} summary={smithingSummary} onClose={() => undefined} />);
    expect(screen.getAllByText('Bronze Bar').length).toBeGreaterThan(0);
    expect(screen.getByText('+72')).toBeInTheDocument();
    expect(screen.queryByText('foes defeated')).not.toBeInTheDocument();
  });
});
