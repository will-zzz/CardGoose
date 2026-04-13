/**
 * Collect art_key values from stored layout JSON (v1/v2, optional nested groups).
 */
export function collectArtKeysFromLayoutState(state: unknown): string[] {
  const keys = new Set<string>();

  function visitNode(n: unknown): void {
    if (!n || typeof n !== 'object') return;
    const o = n as Record<string, unknown>;
    if (o.type === 'image') {
      if (typeof o.artKey === 'string' && o.artKey.trim()) {
        keys.add(o.artKey.trim());
      }
      const fb = (o as { fallbackArtKey?: unknown }).fallbackArtKey;
      if (typeof fb === 'string' && fb.trim()) {
        keys.add(fb.trim());
      }
    }
    if (o.type === 'group' && Array.isArray(o.children)) {
      for (const c of o.children) visitNode(c);
    }
  }

  function visitState(s: Record<string, unknown>): void {
    if (Array.isArray(s.root)) for (const n of s.root) visitNode(n);
    if (Array.isArray(s.elements)) for (const n of s.elements) visitNode(n);
  }

  if (!state || typeof state !== 'object') return [];
  visitState(state as Record<string, unknown>);
  return [...keys];
}
