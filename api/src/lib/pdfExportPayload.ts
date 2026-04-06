import { prisma } from './prisma.js';
import { collectArtKeysFromLayoutState } from './layoutArtKeys.js';
import { getAssetsBucket, getSignedGetUrl } from './s3.js';

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

  const assets = await prisma.asset.findMany({
    where: { projectId, artKey: { in: [...artKeys] } },
    select: { artKey: true, s3Key: true },
  });

  const assetsBucket = getAssetsBucket();
  const assetUrls: Record<string, string> = {};
  for (const a of assets) {
    assetUrls[a.artKey] = await getSignedGetUrl(assetsBucket, a.s3Key, 3600);
  }

  const timestamp = new Date().toISOString();
  const payload: Record<string, unknown> = {
    type: 'export-pdf',
    projectId,
    userId,
    timestamp,
    paperSize: { width: 8.5, height: 11, unit: 'in' },
    pageMarginIn: 0.25,
    dpi: 300,
    groups: exportGroups,
    assetUrls,
  };

  return { payload, timestamp };
}
