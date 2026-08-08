import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { itemById } from '../content/items';
import { ItemTooltip } from '../app/items/ItemTooltip';

const openTooltip = () =>
  act(() => {
    vi.advanceTimersByTime(160);
  });

describe('custom item tooltips', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows Bronze weapon effects on hover and keeps the tooltip out of layout flow', () => {
    vi.useFakeTimers();
    render(
      <ItemTooltip item={itemById['bronze-sword']}>
        <button type="button">Bronze Sword</button>
      </ItemTooltip>,
    );
    fireEvent.pointerEnter(screen.getByRole('button'));
    openTooltip();
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent('Bronze Sword');
    expect(tooltip).toHaveTextContent('Deals 160% damage');
    expect(tooltip).toHaveTextContent('+25% Accuracy');
    expect(tooltip.parentElement).toBe(document.body);
  });

  it('supports keyboard focus, Escape, armor bonuses, and empty slots without fake data', () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <ItemTooltip item={itemById['bronze-helmet']}>
        <button type="button">Bronze Helm</button>
      </ItemTooltip>,
    );
    const trigger = screen.getByRole('button');
    trigger.focus();
    openTooltip();
    expect(screen.getByRole('tooltip')).toHaveTextContent('Defence');
    expect(screen.getByRole('tooltip')).not.toHaveTextContent('Special attack');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();

    rerender(
      <ItemTooltip disabled item={undefined}>
        <button type="button">Empty</button>
      </ItemTooltip>,
    );
    fireEvent.pointerEnter(screen.getByRole('button'));
    openTooltip();
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
