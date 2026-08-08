import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type SyntheticEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { getTooltipPosition, type TooltipPlacement } from './tooltipPosition';

const OPEN_DELAY_MS = 150;
const CLOSE_DELAY_MS = 80;
let activeTooltipCloser: (() => void) | null = null;

interface TriggerProps {
  ref?: (element: HTMLElement | null) => void;
  tabIndex?: number;
  'aria-describedby'?: string;
  'aria-label'?: string;
  'data-tooltip-trigger'?: boolean;
  onPointerEnter?: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerLeave?: (event: React.PointerEvent<HTMLElement>) => void;
  onMouseEnter?: (event: React.MouseEvent<HTMLElement>) => void;
  onMouseLeave?: (event: React.MouseEvent<HTMLElement>) => void;
  onFocus?: (event: React.FocusEvent<HTMLElement>) => void;
  onBlur?: (event: React.FocusEvent<HTMLElement>) => void;
}

export function GameTooltip({
  children,
  content,
  label,
  placement = 'right',
  disabled = false,
}: {
  children: ReactElement<TriggerProps>;
  content: ReactNode;
  label?: string;
  placement?: TooltipPlacement;
  disabled?: boolean;
}) {
  const triggerRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const focusedRef = useRef(false);
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  const tooltipId = useRef(`game-tooltip-${Math.random().toString(36).slice(2)}`);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, placement });
  const [positioned, setPositioned] = useState(false);

  const clearTimers = useCallback(() => {
    if (openTimer.current !== null) window.clearTimeout(openTimer.current);
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    openTimer.current = null;
    closeTimer.current = null;
  }, []);

  const closeImmediately = useCallback(() => {
    clearTimers();
    setOpen(false);
    setPositioned(false);
  }, [clearTimers]);

  const scheduleOpen = useCallback(() => {
    if (disabled) return;
    clearTimers();
    openTimer.current = window.setTimeout(() => {
      activeTooltipCloser?.();
      activeTooltipCloser = closeImmediately;
      setOpen(true);
    }, OPEN_DELAY_MS);
  }, [clearTimers, closeImmediately, disabled]);

  const scheduleClose = useCallback(() => {
    clearTimers();
    closeTimer.current = window.setTimeout(closeImmediately, CLOSE_DELAY_MS);
  }, [clearTimers, closeImmediately]);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeImmediately();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [closeImmediately, open]);

  useEffect(
    () => () => {
      clearTimers();
      if (activeTooltipCloser === closeImmediately) activeTooltipCloser = null;
    },
    [clearTimers, closeImmediately],
  );

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const tooltip = tooltipRef.current;
    if (!trigger || !tooltip) return;
    const next = getTooltipPosition(
      trigger.getBoundingClientRect(),
      { width: tooltip.offsetWidth, height: tooltip.offsetHeight },
      { width: window.innerWidth, height: window.innerHeight },
      placement,
    );
    setPosition(next);
    setPositioned(true);
  }, [placement]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const handleViewportChange = () => updatePosition();
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [open, updatePosition]);

  if (!isValidElement(children)) return children;
  const originalProps = children.props as TriggerProps & {
    'aria-describedby'?: string;
    'aria-label'?: string;
  };
  const callOriginal = (
    name: Exclude<keyof TriggerProps, 'ref' | 'tabIndex' | 'aria-describedby' | 'aria-label' | 'data-tooltip-trigger'>,
    event: SyntheticEvent<HTMLElement>,
  ) => {
    const handler = originalProps[name];
    if (handler) handler(event as never);
  };
  const trigger = cloneElement(children, {
    ref: (element: HTMLElement | null) => {
      triggerRef.current = element;
    },
    tabIndex: children.props.tabIndex ?? 0,
    'aria-describedby': open ? tooltipId.current : originalProps['aria-describedby'],
    'aria-label': originalProps['aria-label'] ?? label,
    'data-tooltip-trigger': true,
    onPointerEnter: (event: React.PointerEvent<HTMLElement>) => {
      callOriginal('onPointerEnter', event);
      scheduleOpen();
    },
    onPointerLeave: (event: React.PointerEvent<HTMLElement>) => {
      callOriginal('onPointerLeave', event);
      if (!focusedRef.current) scheduleClose();
    },
    onMouseEnter: (event: React.MouseEvent<HTMLElement>) => {
      callOriginal('onMouseEnter', event);
      scheduleOpen();
    },
    onMouseLeave: (event: React.MouseEvent<HTMLElement>) => {
      callOriginal('onMouseLeave', event);
      if (!focusedRef.current) scheduleClose();
    },
    onFocus: (event: React.FocusEvent<HTMLElement>) => {
      callOriginal('onFocus', event);
      focusedRef.current = true;
      scheduleOpen();
    },
    onBlur: (event: React.FocusEvent<HTMLElement>) => {
      callOriginal('onBlur', event);
      focusedRef.current = false;
      scheduleClose();
    },
  });

  return (
    <>
      {trigger}
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={tooltipRef}
              id={tooltipId.current}
              role="tooltip"
              className="game-tooltip"
              data-placement={position.placement}
              style={{
                top: position.top,
                left: position.left,
                visibility: positioned ? 'visible' : 'hidden',
              }}
            >
              {content}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
