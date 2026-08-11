import type { HTMLAttributes, ReactNode } from 'react';

export interface ArtViewportProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
}

/** The containment boundary for artwork that may be transformed by ArtImage. */
export function ArtViewport({ children, className, ...props }: ArtViewportProps) {
  return (
    <span {...props} className={`art-viewport ${className ?? ''}`.trim()}>
      {children}
    </span>
  );
}
