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
    }
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
