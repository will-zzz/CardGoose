import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/prisma.js', async () => {
  const { prisma } = await import('../test/prisma-mock.js');
  return { prisma };
});

vi.mock('../lib/s3.js', () => ({
  getAssetsBucket: () => 'assets-bucket',
  getSignedGetUrl: vi.fn(async () => 'https://signed.example/asset'),
}));

import { prisma } from '../test/prisma-mock.js';
import {
  buildPdfExportPayload,
  EXPORT_PDF_DPI_MAX,
  EXPORT_PDF_DPI_MIN,
  resolveExportPdfDpi,
} from './pdfExportPayload.js';

describe('resolveExportPdfDpi', () => {
  const env = process.env.EXPORT_PDF_DPI;

  afterEach(() => {
    if (env === undefined) delete process.env.EXPORT_PDF_DPI;
    else process.env.EXPORT_PDF_DPI = env;
  });

  it('clamps client number', () => {
    expect(resolveExportPdfDpi(50)).toBe(EXPORT_PDF_DPI_MIN);
    expect(resolveExportPdfDpi(400)).toBe(EXPORT_PDF_DPI_MAX);
    expect(resolveExportPdfDpi(200)).toBe(200);
  });

  it('uses env when client missing', () => {
    process.env.EXPORT_PDF_DPI = '175';
    expect(resolveExportPdfDpi(undefined)).toBe(175);
  });

  it('uses default when env invalid', () => {
    process.env.EXPORT_PDF_DPI = 'nope';
    expect(resolveExportPdfDpi(undefined)).toBe(150);
  });
});

describe('buildPdfExportPayload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns project not found', async () => {
    prisma.project.findFirst.mockResolvedValueOnce(null);
    const r = await buildPdfExportPayload('p', 'u');
    expect(r).toEqual({ error: 'Project not found' });
  });

  it('returns error when no exportable groups', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p' });
    prisma.cardGroup.findMany.mockResolvedValueOnce([
      { layoutId: null, layout: null, csvData: null, name: 'g' },
    ]);
    const r = await buildPdfExportPayload('p', 'u');
    expect(r).toMatchObject({ error: expect.stringContaining('No card groups') });
  });

  it('builds payload with groups and assets', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p' });
    prisma.cardGroup.findMany.mockResolvedValueOnce([
      {
        layoutId: 'L1',
        layout: {
          state: {
            version: 2,
            width: 100,
            height: 100,
            root: [
              {
                type: 'image',
                id: 'i',
                x: 0,
                y: 0,
                width: 10,
                height: 10,
                artKey: 'art1',
              },
            ],
          },
        },
        csvData: { headers: ['A'], rows: [{ A: '1' }] },
        name: 'Deck',
      },
    ]);
    prisma.asset.findMany.mockResolvedValueOnce([{ artKey: 'art1', s3Key: 'k1' }]);
    prisma.globalAsset.findMany.mockResolvedValueOnce([]);

    const r = await buildPdfExportPayload('p', 'u', { dpi: 200 });
    if ('error' in r) throw new Error(String(r.error));
    expect(r.payload.type).toBe('export-pdf');
    expect(r.payload.dpi).toBe(200);
    expect(r.payload.assetUrls).toEqual({ art1: 'https://signed.example/asset' });
    expect(r.payload.assetResolveOrder).toEqual(['art1']);
  });
});
