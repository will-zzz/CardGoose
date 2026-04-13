import { describe, expect, it } from 'vitest';
import { mergeAssetS3KeysByNormalizedKey, normalizeArtLookupKey } from './assetResolve.js';

describe('normalizeArtLookupKey', () => {
  it('lowercases and strips extension', () => {
    expect(normalizeArtLookupKey('Hero.PNG')).toBe('hero');
  });

  it('strips mustache tokens', () => {
    expect(normalizeArtLookupKey('{{ Gold }}')).toBe('gold');
  });
});

describe('mergeAssetS3KeysByNormalizedKey', () => {
  it('project shadows global', () => {
    const m = mergeAssetS3KeysByNormalizedKey(
      [{ artKey: 'hero', s3Key: 'p/hero' }],
      [{ artKey: 'Hero', s3Key: 'g/hero' }]
    );
    expect(m.get('hero')).toBe('p/hero');
  });
});
