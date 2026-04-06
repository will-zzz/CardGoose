/** Internal CSV column for per-card layout assignment (not shown in Data preview as user-facing if desired). */
export const CF_LAYOUT_ID_KEY = '_cf_layout_id';

export function getRowLayoutId(
  row: Record<string, string>,
  defaultLayoutId: string,
): string {
  const v = row[CF_LAYOUT_ID_KEY]?.trim();
  if (v) return v;
  return defaultLayoutId;
}

export function layoutNameForId(
  layouts: { id: string; name: string }[],
  layoutId: string,
): string {
  return layouts.find((l) => l.id === layoutId)?.name ?? 'Unknown layout';
}

export function ensureLayoutIdColumn(headers: string[]): string[] {
  if (headers.includes(CF_LAYOUT_ID_KEY)) return headers;
  return [...headers, CF_LAYOUT_ID_KEY];
}

/** Search across visible row cells and layout name (excludes internal key from values). */
export function rowSearchBlob(row: Record<string, string>, layoutName: string): string {
  const parts: string[] = [layoutName];
  for (const [k, v] of Object.entries(row)) {
    if (k === CF_LAYOUT_ID_KEY) continue;
    parts.push(v);
  }
  return parts.join(' ').toLowerCase();
}
