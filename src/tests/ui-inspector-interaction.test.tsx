import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UiInspector } from '../app/debug/ui-inspector/UiInspector';

describe('UI Inspector interaction safety', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('captures inspected clicks, copies a reference, and leaves the inspector active', async () => {
    const gameClick = vi.fn();
    render(
      <UiInspector active onDeactivate={vi.fn()} />,
    );
    const button = document.createElement('button');
    button.className = 'button ghost';
    button.textContent = 'Fight';
    button.addEventListener('click', gameClick);
    document.body.appendChild(button);

    fireEvent.pointerMove(button, { clientX: 20, clientY: 30 });
    fireEvent.click(button);

    await waitFor(() => expect(screen.getByText('UI reference copied')).toBeInTheDocument());
    expect(gameClick).not.toHaveBeenCalled();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('Element: button'),
    );
  });

  it('exits on Escape and allows only the inspector control exception', () => {
    function Harness() {
      const [active, setActive] = useState(true);
      return (
        <>
          <button data-ui-inspector-control onClick={() => setActive(false)}>
            Inspect UI
          </button>
          <UiInspector active={active} onDeactivate={() => setActive(false)} />
        </>
      );
    }

    render(<Harness />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.querySelector('.ui-inspector-layer')).not.toBeInTheDocument();
  });

  it('does not install inspection behavior while inactive', () => {
    const gameClick = vi.fn();
    render(<UiInspector active={false} onDeactivate={vi.fn()} />);
    const button = document.createElement('button');
    button.textContent = 'Normal action';
    button.addEventListener('click', gameClick);
    document.body.appendChild(button);

    fireEvent.click(button);

    expect(gameClick).toHaveBeenCalledOnce();
    expect(document.querySelector('.ui-inspector-layer')).not.toBeInTheDocument();
  });
});
