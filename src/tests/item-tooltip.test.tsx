import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { itemById } from '../content/items';
import { InventoryItemDetails } from '../app/screens/inventory/InventoryItemDetails';
import { ItemTooltip } from '../app/items/ItemTooltip';
import { getProfessionToolPresentation } from '../app/items/itemProfessionPresentation';

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

  it('shows definition-backed mining fields for each pickaxe', () => {
    vi.useFakeTimers();
    render(
      <ItemTooltip item={itemById['bronze-pickaxe']}>
        <button type="button">Bronze Pickaxe</button>
      </ItemTooltip>,
    );
    screen.getByRole('button').focus();
    openTooltip();
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent('Required Mining Level: 8');
    expect(tooltip).toHaveTextContent('Rock Damage: 16');
    expect(tooltip).toHaveTextContent('Penetration: 25');
    expect(tooltip).toHaveTextContent('Swing Interval: 2.8s');
    expect(tooltip).toHaveTextContent('Stamina Cost: 18');
    expect(tooltip).not.toHaveTextContent('Smithing Hammer');
  });

  it('shows definition-backed Smithing hammer fields and keeps ordinary items generic', () => {
    vi.useFakeTimers();
    render(
      <ItemTooltip item={itemById['steel-smithing-hammer']}>
        <button type="button">Steel Smithing Hammer</button>
      </ItemTooltip>,
    );
    screen.getByRole('button').focus();
    openTooltip();
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent('Required Smithing Level: 32');
    expect(tooltip).toHaveTextContent('Smithing Speed / Action Speed: +15%');
    expect(tooltip).toHaveTextContent('Material Preservation: 6%');
    expect(tooltip).not.toHaveTextContent('Mining Tool');

    const presentation = getProfessionToolPresentation(itemById['bronze-sword']?.id);
    expect(presentation).toBeNull();
  });

  it('uses the same profession rows in the Inventory full details panel', () => {
    render(
      <InventoryItemDetails
        stack={{ itemId: 'iron-pickaxe', quantity: 1, locked: false }}
        item={itemById['iron-pickaxe']}
        headingId="inventory-item-heading"
        onEquip={() => undefined}
        onOpenEquipment={() => undefined}
        onToggleLock={() => undefined}
        onDestroyOne={() => undefined}
      />,
    );
    const details = screen.getByRole('region');
    expect(details).toHaveTextContent('Required Mining Level: 20');
    expect(details).toHaveTextContent('Rock Damage: 28');
    expect(details).toHaveTextContent('Penetration: 45');
    expect(details).toHaveTextContent('Swing Interval: 2.5s');
    expect(details).toHaveTextContent('Stamina Cost: 16');
  });
});
