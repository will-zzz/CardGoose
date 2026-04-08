/** CardGoose mark — served from `public/cardgoose-logo.png`. */
export const BRAND_LOGO_SRC = '/cardgoose-logo.png';

type BrandLogoProps = {
  /** CSS height in pixels; width follows aspect ratio. */
  heightPx: number;
  className?: string;
  /** Empty string when decorative (e.g. next to visible “CardGoose” text). */
  alt?: string;
};

export function BrandLogo({ heightPx, className, alt = '' }: BrandLogoProps) {
  return (
    <img
      src={BRAND_LOGO_SRC}
      alt={alt}
      className={className}
      style={{ height: heightPx, width: 'auto', display: 'block' }}
      decoding="async"
    />
  );
}
