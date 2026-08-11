import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ENEMIES, enemyById } from '../content/enemies';
import { CombatTargetPortrait } from '../app/screens/combat/CombatTargetPortrait';
import { EnemyArtwork } from '../app/art/EnemyArtwork';
import {
  ENEMY_ART,
  ENEMY_ARTWORK_SIZES,
  type EnemyArtworkSize,
} from '../app/art/enemyArtRegistry';

describe('canonical enemy artwork system', () => {
  it('gives every active enemy one flat, explicitly calibrated profile', () => {
    const allowedKeys = new Set(['src', 'scale', 'x', 'y', 'objectPosition']);

    for (const enemy of ENEMIES) {
      const profile = ENEMY_ART[enemy.id];
      expect(profile, `${enemy.id} should have canonical art`).toBeDefined();
      expect(Object.keys(profile).every((key) => allowedKeys.has(key))).toBe(true);
      expect(profile.src).toBeTruthy();
      expect(typeof profile.scale).toBe('number');
      expect(typeof profile.x).toBe('number');
      expect(typeof profile.y).toBe('number');
    }
  });

  it('keeps Redknife Lookout composition identical across all physical sizes', () => {
    const sizes = Object.keys(ENEMY_ARTWORK_SIZES) as EnemyArtworkSize[];
    const { container } = render(
      <div>
        {sizes.map((size) => <EnemyArtwork key={size} enemyId="redknife-lookout" size={size} />)}
      </div>,
    );
    const viewports = [...container.querySelectorAll<HTMLElement>('.enemy-artwork')];
    const profile = ENEMY_ART['redknife-lookout'];

    expect(viewports).toHaveLength(sizes.length);
    expect(viewports.map((viewport) => viewport.style.getPropertyValue('--enemy-artwork-scale'))).toEqual(
      sizes.map(() => String(profile.scale)),
    );
    expect(viewports.map((viewport) => viewport.style.getPropertyValue('--enemy-artwork-x'))).toEqual(
      sizes.map(() => `${profile.x}%`),
    );
    expect(viewports.map((viewport) => viewport.style.getPropertyValue('--enemy-artwork-y'))).toEqual(
      sizes.map(() => `${profile.y}%`),
    );
  });

  it('uses only physical size changes for combat roster, selected, and preview portraits', () => {
    const enemy = enemyById['redknife-lookout'];
    const profile = ENEMY_ART['redknife-lookout'];
    const contexts = [
      ['roster', 'sm'],
      ['selected', 'lg'],
      ['preview', 'xl'],
    ] as const;

    for (const [context, size] of contexts) {
      const { container } = render(
        <CombatTargetPortrait enemy={enemy} context={context} ariaLabel="Redknife Lookout" />,
      );
      const artwork = container.querySelector<HTMLElement>('.enemy-artwork');
      expect(artwork).not.toBeNull();
      expect(artwork).toHaveClass(`enemy-artwork-${size}`);
      expect(artwork?.style.getPropertyValue('--enemy-artwork-scale')).toBe(String(profile.scale));
      expect(artwork?.style.getPropertyValue('--enemy-artwork-x')).toBe(`${profile.x}%`);
      expect(artwork?.style.getPropertyValue('--enemy-artwork-y')).toBe(`${profile.y}%`);
    }
  });

  it('shows a fallback for unknown or undiscovered enemies', () => {
    const unknown = render(<EnemyArtwork enemyId="missing-enemy" />);
    expect(unknown.container.querySelector('img')).toBeNull();
    expect(unknown.container.querySelector('.enemy-artwork-fallback')).not.toBeNull();

    const undiscovered = render(<EnemyArtwork enemyId="redknife-lookout" discovered={false} />);
    expect(undiscovered.container.querySelector('img')).toBeNull();
    expect(undiscovered.container.querySelector('.enemy-artwork-fallback')).not.toBeNull();
  });
});
