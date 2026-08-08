import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { COMBAT_TUNING } from '../config/combatTuning';
import { enemyById } from '../content/enemies';
import { EnemyTooltip } from '../app/tooltips/EnemyTooltip';
import { ExplainedTerm } from '../app/tooltips/GameConceptTooltip';
import { GAME_CONCEPTS } from '../app/tooltips/gameConcepts';

const openTooltip = () =>
  act(() => {
    vi.advanceTimersByTime(160);
  });

afterEach(() => {
  vi.useRealTimers();
});

describe('Tooltip 1.0 concepts and enemies', () => {
  it('keeps an Accuracy explanation available when the help icon is hidden', () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <ExplainedTerm concept="accuracy" showHelpIcon>
        Accuracy
      </ExplainedTerm>,
    );
    const term = screen.getByText('Accuracy').closest('.explained-term');
    expect(term).not.toBeNull();
    expect(term?.querySelector('.explained-term-icon')).toBeInTheDocument();
    fireEvent.focus(term!);
    openTooltip();
    expect(screen.getByRole('tooltip')).toHaveTextContent('Improves your chance to hit');

    fireEvent.keyDown(document, { key: 'Escape' });
    rerender(
      <ExplainedTerm concept="accuracy" showHelpIcon={false}>
        Accuracy
      </ExplainedTerm>,
    );
    const hiddenIconTerm = screen.getByText('Accuracy').closest('.explained-term');
    expect(hiddenIconTerm?.querySelector('.explained-term-icon')).toBeNull();
    fireEvent.focus(hiddenIconTerm!);
    openTooltip();
    expect(screen.getByRole('tooltip')).toHaveTextContent('Improves your chance to hit');
  });

  it('presents known enemy data without inventing a separate enemy model', () => {
    vi.useFakeTimers();
    const enemy = enemyById['forest-rat'];
    render(
      <EnemyTooltip enemy={enemy} kills={7}>
        <button type="button">Forest Rat</button>
      </EnemyTooltip>,
    );
    fireEvent.focus(screen.getByRole('button', { name: 'Forest Rat' }));
    openTooltip();
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent(enemy.name);
    expect(tooltip).toHaveTextContent(`Level ${enemy.displayLevel}`);
    expect(tooltip).toHaveTextContent(`Health ${enemy.maxHealth}`);
    expect(tooltip).toHaveTextContent(`Damage 1–${enemy.maxHit}`);
    expect(tooltip).toHaveTextContent('Lifetime kills: 7');
  });

  it('derives Adrenaline copy from current combat tuning', () => {
    const details = GAME_CONCEPTS.adrenaline.details;
    const lines = typeof details === 'function' ? details() : details;
    expect(lines).toContain(`+${COMBAT_TUNING.adrenalinePerPlayerHit} when you land a hit`);
    expect(lines).toContain(`+${COMBAT_TUNING.adrenalinePerDirectDamageTaken} when you take direct damage`);
    expect(lines).toContain(`Maximum: ${COMBAT_TUNING.adrenalineMax}`);
  });
});
