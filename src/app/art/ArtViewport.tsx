import type { HTMLAttributes, ReactNode } from 'react';

export interface ArtViewportProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
}

/** A containment boundary for transformed artwork such as ArtImage or ItemArtwork. */
export function ArtViewport({ children, className, ...props }: ArtViewportProps) {
  return (
    <span {...props} className={`art-viewport ${className ?? ''}`.trim()}>
      {children}
    </span>
  );
}
