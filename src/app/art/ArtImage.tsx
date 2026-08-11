import type { ImgHTMLAttributes } from 'react';

export function ArtImage({ className, alt = '', ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  return <img {...props} className={className} alt={alt} decoding="async" />;
}
