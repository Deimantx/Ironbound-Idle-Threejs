import type { ImgHTMLAttributes } from 'react';

export type ArtImageProps = ImgHTMLAttributes<HTMLImageElement>;

export function ArtImage({
  className,
  alt = '',
  src,
  ...props
}: ArtImageProps) {
  return (
    <img
      {...props}
      src={src}
      className={`art-image ${className ?? ''}`.trim()}
      alt={alt}
      decoding="async"
    />
  );
}
