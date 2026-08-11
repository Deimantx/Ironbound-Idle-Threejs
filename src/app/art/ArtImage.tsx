import type { CSSProperties, ImgHTMLAttributes } from 'react';
import type { ArtAsset, ArtTransform, ArtVariant } from './artRegistry';

export interface ArtImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  asset?: ArtAsset;
  defaultScale?: number;
  variant?: ArtVariant;
}

const resolveTransform = (asset: ArtAsset | undefined, variant: ArtVariant | undefined, defaultScale: number): ArtTransform => {
  const base = asset?.base ?? {};
  const context = variant ? asset?.variants?.[variant] ?? {} : {};
  return {
    scale: defaultScale * (base.scale ?? 1) * (context.scale ?? 1),
    x: (base.x ?? 0) + (context.x ?? 0),
    y: (base.y ?? 0) + (context.y ?? 0),
    objectPosition: context.objectPosition ?? base.objectPosition,
  };
};

export function ArtImage({
  asset,
  className,
  alt = '',
  defaultScale = 1,
  variant,
  src,
  style,
  ...props
}: ArtImageProps) {
  const transform = resolveTransform(asset, variant, defaultScale);
  const presentationStyle = {
    '--art-scale': transform.scale ?? 1,
    '--art-x': `${transform.x ?? 0}%`,
    '--art-y': `${transform.y ?? 0}%`,
    '--art-position': transform.objectPosition ?? 'center',
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
