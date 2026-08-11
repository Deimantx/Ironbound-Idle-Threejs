import type { CSSProperties, ImgHTMLAttributes } from 'react';
import type { ArtAsset } from './artRegistry';

export interface ArtImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  asset?: ArtAsset;
  defaultScale?: number;
}

export function ArtImage({
  asset,
  className,
  alt = '',
  defaultScale = 1,
  src,
  style,
  ...props
}: ArtImageProps) {
  const presentationStyle = {
    '--art-scale': asset?.scale ?? defaultScale,
    '--art-x': `${asset?.x ?? 0}%`,
    '--art-y': `${asset?.y ?? 0}%`,
    '--art-position': asset?.objectPosition ?? 'center',
    ...style,
  } as CSSProperties;
  return (
    <img
      {...props}
      src={asset?.src ?? src}
      className={`art-image ${className ?? ''}`.trim()}
      style={presentationStyle}
      alt={alt}
      decoding="async"
    />
  );
}
