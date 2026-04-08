import cardgooseMarkSvg from '../assets/cardgoose-mark.svg?raw';

type BrandLogoProps = {
  /** CSS height in pixels; width follows aspect ratio. */
  heightPx: number;
  className?: string;
  /** Empty string when decorative (e.g. next to visible “CardGoose” text). */
  alt?: string;
};

/** Normalize any exported SVG so it always renders: strip XML PI, replace root &lt;svg&gt;, theme fill. */
function buildLogoHtml(raw: string, heightPx: number): string {
  let s = raw.replace(/^\uFEFF/, '').replace(/<\?xml[^?]*\?>\s*/i, '');

  const openMatch = s.match(/^<svg\b([^>]*)>/i);
  if (!openMatch) {
    return s;
  }

  const attrStr = openMatch[1] ?? '';
  let viewBoxStr: string | null = null;
  const vb = attrStr.match(/\bviewBox\s*=\s*["']([^"']*)["']/i);
  if (vb?.[1]) {
    viewBoxStr = vb[1].trim();
  }

  let viewW = 1704;
  let viewH = 905;
  if (viewBoxStr) {
    const p = viewBoxStr.split(/\s+/).map(Number);
    if (p.length === 4 && p.every((n) => !Number.isNaN(n))) {
      viewW = p[2];
      viewH = p[3];
    }
  } else {
    const w = attrStr.match(/\bwidth\s*=\s*["']?(\d+(?:\.\d+)?)/i);
    const h = attrStr.match(/\bheight\s*=\s*["']?(\d+(?:\.\d+)?)/i);
    if (w && h) {
      viewW = parseFloat(w[1]);
      viewH = parseFloat(h[1]);
      viewBoxStr = `0 0 ${viewW} ${viewH}`;
    }
  }

  if (!viewBoxStr) {
    viewBoxStr = `0 0 ${viewW} ${viewH}`;
  }

  const widthPx = (heightPx * viewW) / viewH;

  s = s.replace(
    /^<svg\b[^>]*>/i,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBoxStr}" width="${widthPx}" height="${heightPx}" focusable="false" class="brand-logo-mark-svg" preserveAspectRatio="xMidYMid meet">`
  );

  s = s.replace(/\bfill\s*=\s*["']#000000["']/gi, 'fill="currentColor"');
  s = s.replace(/\bfill\s*=\s*["']black["']/gi, 'fill="currentColor"');

  return s;
}

export function BrandLogo({ heightPx, className, alt = '' }: BrandLogoProps) {
  const svgHtml = buildLogoHtml(cardgooseMarkSvg, heightPx);

  return (
    <span
      className={['brand-logo-mark', className].filter(Boolean).join(' ')}
      style={{
        display: 'inline-flex',
        lineHeight: 0,
        verticalAlign: 'middle',
        color: 'var(--accent)',
      }}
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={!alt}
      dangerouslySetInnerHTML={{ __html: svgHtml }}
    />
  );
}
