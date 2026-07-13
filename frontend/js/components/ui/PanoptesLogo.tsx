import type { ImgHTMLAttributes } from 'react';

import logoUrl from '@/assets/images/panoptes-logo.png';

type PanoptesLogoProps = {
  size?: number;
  alt?: string;
} & Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'>;

/** Brand mark: eye + RFID, system green palette, transparent background. */
export function PanoptesLogo({ size = 40, alt = 'Panoptes', className = '', ...props }: PanoptesLogoProps) {
  return (
    <img
      alt={alt}
      className={`inline-block object-contain ${className}`}
      height={size}
      src={logoUrl}
      width={size}
      {...props}
    />
  );
}
