/** Normalize for case-insensitive matching; strips common image extensions. */
export function normalizeArtLookupKey(raw: string): string {
  let s = raw.trim().toLowerCase();
  s = s.replace(/\{\{|\}\}/g, '').trim();
  s = s.replace(/\.(png|jpe?g|gif|webp|svg|bmp)$/i, '');
  return s;
}

export type AssetKeyRow = { artKey: string; s3Key: string };

/** Build map normalizedKey -> s3Key (project rows win over global when both match). */
export function mergeAssetS3KeysByNormalizedKey(
  projectAssets: AssetKeyRow[],
  globalAssets: AssetKeyRow[]
): Map<string, string> {
  const m = new Map<string, string>();
  for (const a of globalAssets) {
    const k = normalizeArtLookupKey(a.artKey);
    if (!m.has(k)) m.set(k, a.s3Key);
  }
  for (const a of projectAssets) {
    m.set(normalizeArtLookupKey(a.artKey), a.s3Key);
  }
  return m;
}
