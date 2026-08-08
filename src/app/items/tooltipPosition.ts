export type TooltipPlacement = 'top' | 'right' | 'bottom' | 'left';

export interface TooltipRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface TooltipViewport {
  width: number;
  height: number;
}

export interface TooltipPosition {
  top: number;
  left: number;
  placement: TooltipPlacement;
}

const oppositePlacement: Record<TooltipPlacement, TooltipPlacement> = {
  top: 'bottom',
  right: 'left',
  bottom: 'top',
  left: 'right',
};

export const getTooltipPosition = (
  trigger: TooltipRect,
  tooltip: Pick<TooltipRect, 'width' | 'height'>,
  viewport: TooltipViewport,
  preferred: TooltipPlacement = 'right',
  gap = 10,
): TooltipPosition => {
  const fits = (placement: TooltipPlacement): boolean => {
    const candidate = getUnclampedPosition(trigger, tooltip, placement, gap);
    return (
      candidate.left >= gap &&
      candidate.top >= gap &&
      candidate.left + tooltip.width <= viewport.width - gap &&
      candidate.top + tooltip.height <= viewport.height - gap
    );
  };
  const placement = fits(preferred) ? preferred : oppositePlacement[preferred];
  const raw = getUnclampedPosition(trigger, tooltip, placement, gap);
  return {
    left: clamp(raw.left, gap, Math.max(gap, viewport.width - tooltip.width - gap)),
    top: clamp(raw.top, gap, Math.max(gap, viewport.height - tooltip.height - gap)),
    placement,
  };
};

export const calculateTooltipPosition = getTooltipPosition;

const getUnclampedPosition = (
  trigger: TooltipRect,
  tooltip: Pick<TooltipRect, 'width' | 'height'>,
  placement: TooltipPlacement,
  gap: number,
): { top: number; left: number } => {
  switch (placement) {
    case 'top':
      return {
        top: trigger.top - tooltip.height - gap,
        left: trigger.left + (trigger.width - tooltip.width) / 2,
      };
    case 'bottom':
      return {
        top: trigger.top + trigger.height + gap,
        left: trigger.left + (trigger.width - tooltip.width) / 2,
      };
    case 'left':
      return {
        top: trigger.top + (trigger.height - tooltip.height) / 2,
        left: trigger.left - tooltip.width - gap,
      };
    case 'right':
    default:
      return {
        top: trigger.top + (trigger.height - tooltip.height) / 2,
        left: trigger.left + trigger.width + gap,
      };
  }
};

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), maximum);
