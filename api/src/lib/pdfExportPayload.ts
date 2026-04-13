import { mergeAssetS3KeysByNormalizedKey, normalizeArtLookupKey } from './assetResolve.js';
import { prisma } from './prisma.js';
import { collectArtKeysFromLayoutState } from './layoutArtKeys.js';
import { getAssetsBucket, getSignedGetUrl } from './s3.js';

/** UI / server default; slider range is 150–300. */
export const EXPORT_PDF_DPI_MIN = 150;
export const EXPORT_PDF_DPI_MAX = 300;
const DEFAULT_EXPORT_PDF_DPI = 150;

function dpiFromEnv(): number {
  const raw = process.env.EXPORT_PDF_DPI;
  if (raw === undefined || raw === '') return DEFAULT_EXPORT_PDF_DPI;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return DEFAULT_EXPORT_PDF_DPI;
  return Math.min(EXPORT_PDF_DPI_MAX, Math.max(EXPORT_PDF_DPI_MIN, n));
}

/** Client `dpi` from export request, or env default, always clamped to 150–300. */
export function resolveExportPdfDpi(clientDpi?: unknown): number {
  if (typeof clientDpi === 'number' && Number.isFinite(clientDpi)) {
    return Math.min(EXPORT_PDF_DPI_MAX, Math.max(EXPORT_PDF_DPI_MIN, Math.round(clientDpi)));
  }
  return dpiFromEnv();
}

type CsvData = { headers: string[]; rows: Record<string, string>[] };

function parseCsvData(raw: unknown): CsvData | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as { headers?: unknown; rows?: unknown };
  if (!Array.isArray(o.headers) || !Array.isArray(o.rows)) return null;
  return { headers: o.headers as string[], rows: o.rows as Record<string, string>[] };
}

/**
 * Full JSON body the Python worker needs for PDF export (direct subprocess or S3 + SQS pointer).
 */
export async function buildPdfExportPayload(
  projectId: string,
  userId: string,
  options?: { dpi?: unknown }
): Promise<{ payload: Record<string, unknown>; timestamp: string } | { error: string }> {
  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) {
    return { error: 'Project not found' };
  }

  const cardGroups = await prisma.cardGroup.findMany({
    where: { projectId },
    orderBy: { sortOrder: 'asc' },
    include: { layout: true },
  });

  const exportGroups: {
    name: string;
    layout: unknown;
    rows: Record<string, string>[];
  }[] = [];

  for (const g of cardGroups) {
    if (!g.layoutId || !g.layout) continue;
    const csv = parseCsvData(g.csvData);
    if (!csv || csv.rows.length === 0) continue;
    exportGroups.push({
      name: g.name,
      layout: g.layout.state,
      rows: csv.rows,
    });
  }

  if (exportGroups.length === 0) {
    return {
      error:
        'No card groups with a layout and synced CSV rows. Add data to at least one card group first.',
    };
  }

  const artKeys = new Set<string>();
  for (const eg of exportGroups) {
    for (const k of collectArtKeysFromLayoutState(eg.layout)) artKeys.add(k);
  }

  const [projectAssets, globalAssets] = await Promise.all([
    prisma.asset.findMany({
      where: { projectId },
      select: { artKey: true, s3Key: true },
    }),
    prisma.globalAsset.findMany({
      where: { userId },
      select: { artKey: true, s3Key: true },
    }),
  ]);

  const merged = mergeAssetS3KeysByNormalizedKey(projectAssets, globalAssets);
  const assetsBucket = getAssetsBucket();
  const assetUrls: Record<string, string> = {};
  for (const rk of artKeys) {
    const sk = merged.get(normalizeArtLookupKey(rk));
    if (!sk) continue;
    assetUrls[rk.trim()] = await getSignedGetUrl(assetsBucket, sk, 3600);
  }

  const timestamp = new Date().toISOString();
  const payload: Record<string, unknown> = {
    type: 'export-pdf',
    projectId,
    userId,
    timestamp,
    paperSize: { width: 8.5, height: 11, unit: 'in' },
    pageMarginIn: 0.25,
    dpi: resolveExportPdfDpi(options?.dpi),
    groups: exportGroups,
    assetUrls,
  };

  return { payload, timestamp };
}
