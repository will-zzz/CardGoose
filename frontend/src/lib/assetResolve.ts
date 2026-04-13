import type { LayoutImage } from '../types/layout';
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

/** Read a cell value; matches column name case-insensitively when row keys differ from headers. */
export function rowValueForColumn(row: Record<string, string>, column: string): string {
  const c = column.trim();
  if (!c) return '';
  if (Object.prototype.hasOwnProperty.call(row, c)) return String(row[c] ?? '').trim();
  const lower = c.toLowerCase();
  for (const k of Object.keys(row)) {
    if (k.trim().toLowerCase() === lower) return String(row[k] ?? '').trim();
  }
  return '';
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

/** Resolve a literal art key or normalized key against the merged URL map. */
export function resolveLiteralArtKeyToUrl(
  artKey: string,
  urls: Record<string, string>
): string | undefined {
  const t = artKey.trim();
  if (!t) return undefined;
  if (urls[t]) return urls[t];
  return urls[normalizeArtLookupKey(t)];
}

/**
 * Match a spreadsheet cell value to an asset URL (exact / normalized, then fuzzy substring).
 * `orderedArtKeys` should list project art keys first, then global, for tie-breaking.
 */
export function resolveCellValueToAssetUrl(
  cellValue: string,
  urls: Record<string, string>,
  orderedArtKeys: string[]
): string | undefined {
  const v = cellValue.trim();
  if (!v) return undefined;
  const direct = resolveLiteralArtKeyToUrl(v, urls);
  if (direct) return direct;
  const vn = normalizeArtLookupKey(v);
  if (!vn) return undefined;
  const keys =
    orderedArtKeys.length > 0
      ? orderedArtKeys
      : [...new Set(Object.keys(urls))].filter((k) => k.indexOf('{{') < 0);
  for (const k of keys) {
    if (normalizeArtLookupKey(k) === vn) return urls[k] ?? urls[normalizeArtLookupKey(k)];
  }
  for (const k of keys) {
    const kn = normalizeArtLookupKey(k);
    if (!kn) continue;
    if (kn.includes(vn) || (vn.length >= 3 && vn.includes(kn))) {
      return urls[k] ?? urls[normalizeArtLookupKey(k)];
    }
  }
  return undefined;
}

/**
 * Smart image URL for layout image zones: dynamic column → fuzzy resolve → fallback art key → legacy artKey template.
 */
export function smartResolveLayoutImageUrl(
  el: Pick<LayoutImage, 'artKey' | 'dynamicSourceColumn' | 'fallbackArtKey'>,
  row: Record<string, string>,
  urls: Record<string, string>,
  orderedArtKeys: string[]
): string | undefined {
  const col = el.dynamicSourceColumn?.trim();
  if (col) {
    const cell = rowValueForColumn(row, col);
    const fromCell = resolveCellValueToAssetUrl(cell, urls, orderedArtKeys);
    if (fromCell) return fromCell;
    const fb = el.fallbackArtKey?.trim();
    if (fb) {
      const u = resolveLiteralArtKeyToUrl(fb, urls);
      if (u) return u;
    }
    return undefined;
  }
  const legacy = resolveImageUrlFromLookup(el.artKey, row, urls);
  if (legacy) return legacy;
  const fb2 = el.fallbackArtKey?.trim();
  if (fb2) return resolveLiteralArtKeyToUrl(fb2, urls);
  return undefined;
}
