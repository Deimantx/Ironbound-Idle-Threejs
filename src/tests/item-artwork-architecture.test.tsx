import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { itemById } from '../content/items';
import { ITEM_ART, ITEM_ARTWORK_SIZES } from '../app/items/itemArtRegistry';
import { ItemArtwork } from '../app/items/ItemArtwork';

describe('canonical item artwork system', () => {
  it('keeps every profile flat and limited to canonical geometry', () => {
    const allowedKeys = new Set(['src', 'scale', 'x', 'y', 'objectPosition']);

    for (const [itemId, profile] of Object.entries(ITEM_ART)) {
      expect(itemById[itemId], `${itemId} should reference a current item`).toBeDefined();
      expect(Object.keys(profile).every((key) => allowedKeys.has(key))).toBe(true);
      expect(profile.src).toBeTruthy();
      expect(typeof profile.scale, `${itemId} should define scale`).toBe('number');
      expect(typeof profile.x, `${itemId} should define x`).toBe('number');
      expect(typeof profile.y, `${itemId} should define y`).toBe('number');
    }
  });

  it('propagates one registry calibration through the shared renderer', () => {
    const { container } = render(<ItemArtwork itemId="rough-gem" size="sm" />);
    const viewport = container.querySelector<HTMLElement>('.item-artwork');

    expect(viewport?.style.getPropertyValue('--item-artwork-scale')).toBe(String(ITEM_ART['rough-gem'].scale));
    expect(viewport?.style.getPropertyValue('--item-artwork-x')).toBe(`${ITEM_ART['rough-gem'].x}%`);
    expect(viewport?.style.getPropertyValue('--item-artwork-y')).toBe(`${ITEM_ART['rough-gem'].y}%`);
  });

  it('maps semantic resource and tool IDs to their matching assets', () => {
    expect(ITEM_ART['iron-ore']?.src).toContain('iron-ore');
    expect(ITEM_ART['iron-pickaxe']?.src).toContain('iron-pickaxe');
    expect(ITEM_ART['steel-pickaxe']?.src).toContain('steel-pickaxe');
    expect(ITEM_ART['iron-smithing-hammer']?.src).toContain('iron-smithing-hammer');
    expect(ITEM_ART['steel-smithing-hammer']?.src).toContain('steel-smithing-hammer');
  });

  it('uses one canonical pose at every physical viewport size', () => {
    const { container } = render(
      <div>
        {(Object.keys(ITEM_ARTWORK_SIZES) as Array<keyof typeof ITEM_ARTWORK_SIZES>).map((size) => (
          <ItemArtwork key={size} itemId="redknife-reinforced-greatsword" size={size} />
        ))}
      </div>,
    );
    const viewports = [...container.querySelectorAll<HTMLElement>('.item-artwork')];
    expect(viewports).toHaveLength(Object.keys(ITEM_ARTWORK_SIZES).length);
    expect(viewports.map((viewport) => viewport.style.getPropertyValue('--item-artwork-scale'))).toEqual([
      '0.752',
      '0.752',
      '0.752',
      '0.752',
      '0.752',
    ]);
    expect(viewports.map((viewport) => viewport.style.getPropertyValue('--item-artwork-y'))).toEqual([
      '0%',
      '0%',
      '0%',
      '0%',
      '0%',
    ]);
  });

  it('does not reveal custom artwork for undiscovered items', () => {
    const { container } = render(<ItemArtwork itemId="iron-sword" discovered={false} size="sm" />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[data-debug-item-id]')).toBeNull();
    expect(container.querySelector('.item-artwork-fallback')).not.toBeNull();
  });
});
