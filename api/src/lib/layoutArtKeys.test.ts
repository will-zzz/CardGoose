import { describe, expect, it } from 'vitest';
import { collectArtKeysFromLayoutState } from './layoutArtKeys.js';

describe('collectArtKeysFromLayoutState', () => {
  it('collects image art keys from v2 root', () => {
    const keys = collectArtKeysFromLayoutState({
      version: 2,
      width: 100,
      height: 100,
      root: [
        { type: 'text', id: '1', x: 0, y: 0, text: 'x' },
        { type: 'image', id: '2', x: 0, y: 0, width: 10, height: 10, artKey: 'hero' },
      ],
    });
    expect(keys).toEqual(['hero']);
  });

  it('walks nested groups', () => {
    const keys = collectArtKeysFromLayoutState({
      version: 2,
      width: 100,
      height: 100,
      root: [
        {
          type: 'group',
          id: 'g',
          name: 'g',
          x: 0,
          y: 0,
          children: [{ type: 'image', id: 'i', x: 0, y: 0, width: 1, height: 1, artKey: 'bg' }],
        },
      ],
    });
    expect(keys).toEqual(['bg']);
  });
});
