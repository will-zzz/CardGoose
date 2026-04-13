import { applyTemplate } from './template';

/** Normalize for case-insensitive matching; strips common image extensions and {{}}. */
export function normalizeArtLookupKey(raw: string): string {
  let s = raw.trim().toLowerCase();
  s = s.replace(/\{\{|\}\}/g, '').trim();
  s = s.replace(/\.(png|jpe?g|gif|webp|svg|bmp)$/i, '');
  return s;
}

type AssetWithUrl = { artKey: string; url?: string };

/**
 * Flat lookup: project assets override global for the same normalized key.
 * Keys include both raw `artKey` and normalized form so lookups succeed without re-normalizing callers.
 */
export function buildMergedAssetUrlRecord(
  project: AssetWithUrl[],
  global: AssetWithUrl[]
): Record<string, string> {
  const out: Record<string, string> = {};
  const add = (artKey: string, url: string | undefined) => {
    if (!url) return;
    out[artKey] = url;
    out[normalizeArtLookupKey(artKey)] = url;
  };
  for (const g of global) add(g.artKey, g.url);
  for (const p of project) add(p.artKey, p.url);
  return out;
}

export function resolveImageUrlFromLookup(
  artKeyTemplate: string,
  row: Record<string, string>,
  urls: Record<string, string>
): string | undefined {
  const resolved = applyTemplate(artKeyTemplate, row).trim();
  if (urls[resolved]) return urls[resolved];
  return urls[normalizeArtLookupKey(resolved)];
}
