import { useEffect, useRef, useState } from 'react';
import {
  formatUiInspectorReference,
  getUiInspectorDisplayRows,
  resolveUiInspectorTarget,
  type UiInspectorTarget,
} from './uiInspectorModel';

type CopyStatus = 'copied' | 'failed' | null;

const getFrameScheduler = () => {
  if (typeof window !== 'undefined' && window.requestAnimationFrame) {
    return {
      request: (callback: FrameRequestCallback) => window.requestAnimationFrame(callback),
      cancel: (handle: number) => window.cancelAnimationFrame(handle),
    };
  }
  return {
    request: (callback: FrameRequestCallback) => window.setTimeout(() => callback(Date.now()), 0),
    cancel: (handle: number) => window.clearTimeout(handle),
  };
};

const isInspectorControl = (element: Element): boolean =>
  Boolean(element.closest('[data-ui-inspector-control]'));

const isIgnored = (element: Element): boolean =>
  Boolean(element.closest('[data-ui-inspector-ignore]'));

async function copyText(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    if (!document.execCommand?.('copy')) throw new Error('Clipboard copy was rejected.');
  } finally {
    textarea.remove();
  }
}

const getCardPosition = (x: number, y: number): { left: number; top: number } => {
  const estimatedWidth = 330;
  const estimatedHeight = 280;
  const gap = 14;
  const viewportWidth = window.innerWidth || 1024;
  const viewportHeight = window.innerHeight || 768;
  const safeX = Number.isFinite(x) ? x : 0;
  const safeY = Number.isFinite(y) ? y : 0;
  const left = safeX + gap + estimatedWidth <= viewportWidth
    ? safeX + gap
    : safeX - estimatedWidth - gap;
  const top = safeY + gap + estimatedHeight <= viewportHeight
    ? safeY + gap
    : safeY - estimatedHeight - gap;
  return {
    left: Math.max(8, Math.min(left, Math.max(8, viewportWidth - estimatedWidth - 8))),
    top: Math.max(8, Math.min(top, Math.max(8, viewportHeight - estimatedHeight - 8))),
  };
};

export function UiInspector({ active, onDeactivate }: { active: boolean; onDeactivate: () => void }) {
  const [target, setTarget] = useState<UiInspectorTarget | null>(null);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [copyStatus, setCopyStatus] = useState<CopyStatus>(null);
  const copyStatusTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!import.meta.env.DEV || !active) {
      setTarget(null);
      setCopyStatus(null);
      return;
    }

    const latestTarget = { current: null as Element | null };
    const latestPointer = { current: { x: 0, y: 0 } };
    const scheduler = getFrameScheduler();
    let frameHandle: number | null = null;
    let lastResolvedElement: Element | null = null;

    const inspectLatestTarget = () => {
      frameHandle = null;
      const element = latestTarget.current;
      const nextPointer = latestPointer.current;
      setPointer(nextPointer);
      if (!element || isIgnored(element)) {
        lastResolvedElement = null;
        setTarget(null);
        return;
      }

      const semantic = element.closest('[data-debug-kind]') ?? element;
      if (semantic !== lastResolvedElement) {
        lastResolvedElement = semantic;
        setTarget(resolveUiInspectorTarget(element));
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      const element = event.target instanceof Element ? event.target : null;
      latestTarget.current = element;
      latestPointer.current = {
        x: Number.isFinite(event.clientX) ? event.clientX : 0,
        y: Number.isFinite(event.clientY) ? event.clientY : 0,
      };
      if (frameHandle !== null) return;
      frameHandle = scheduler.request(inspectLatestTarget);
    };

    const onPointerDown = (event: PointerEvent) => {
      const element = event.target instanceof Element ? event.target : null;
      if (!element || isIgnored(element) || isInspectorControl(element)) return;
      event.preventDefault();
      event.stopPropagation();
    };

    const onClick = (event: MouseEvent) => {
      const element = event.target instanceof Element ? event.target : null;
      if (!element || isIgnored(element) || isInspectorControl(element)) return;
      event.preventDefault();
      event.stopPropagation();
      const resolved = resolveUiInspectorTarget(element);
      if (!resolved) return;
      setTarget(resolved);
      void copyText(formatUiInspectorReference(resolved))
        .then(() => setCopyStatus('copied'))
        .catch(() => setCopyStatus('failed'));
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onDeactivate();
    };

    document.addEventListener('pointermove', onPointerMove, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.removeEventListener('pointermove', onPointerMove, true);
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKeyDown, true);
      if (frameHandle !== null) scheduler.cancel(frameHandle);
    };
  }, [active, onDeactivate]);

  useEffect(() => {
    if (!copyStatus) return;
    if (copyStatusTimer.current !== null) window.clearTimeout(copyStatusTimer.current);
    copyStatusTimer.current = window.setTimeout(() => {
      copyStatusTimer.current = null;
      setCopyStatus(null);
    }, 1600);
    return () => {
      if (copyStatusTimer.current !== null) window.clearTimeout(copyStatusTimer.current);
    };
  }, [copyStatus]);

  if (!import.meta.env.DEV || !active) return null;

  const position = getCardPosition(pointer.x, pointer.y);
  const rows = target ? getUiInspectorDisplayRows(target) : [];

  return (
    <div className="ui-inspector-layer" data-ui-inspector-ignore>
      {target && (
        <>
          <div
            className="ui-inspector-highlight"
            data-ui-inspector-ignore
            style={{
              left: target.rect.left,
              top: target.rect.top,
              width: target.rect.width,
              height: target.rect.height,
            }}
          />
          <div
            className="ui-inspector-card"
            data-ui-inspector-ignore
            style={{ left: position.left, top: position.top }}
          >
            <div className="ui-inspector-card-heading">UI Inspector</div>
            <div className="ui-inspector-card-rows">
              {rows.map((row) => (
                <div className="ui-inspector-card-row" key={`${row.label}-${row.value}`}>
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                </div>
              ))}
            </div>
            <div className="ui-inspector-card-footer">Click to copy reference · Esc to exit</div>
          </div>
        </>
      )}
      {copyStatus && (
        <div className="ui-inspector-copy-toast" data-ui-inspector-ignore role="status">
          {copyStatus === 'copied' ? 'UI reference copied' : 'Copy failed'}
        </div>
      )}
    </div>
  );
}
