import { Router, type IRouter } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { assertHttpsCsvUrl, parseCsvText } from '../lib/csv.js';

export const projectsRouter: IRouter = Router();
projectsRouter.use(requireAuth);

const MAX_CSV_ROWS = 5000;
const MAX_CSV_COLS = 64;

function parseCsvPayload(raw: unknown): { headers: string[]; rows: Record<string, string>[] } | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as { headers?: unknown; rows?: unknown };
  if (!Array.isArray(o.headers) || !Array.isArray(o.rows)) return null;
  const headers = o.headers.filter((h): h is string => typeof h === 'string' && h.length > 0).slice(0, MAX_CSV_COLS);
  if (headers.length === 0) return null;
  const rows: Record<string, string>[] = [];
  for (const row of o.rows) {
    if (rows.length >= MAX_CSV_ROWS) break;
    if (!row || typeof row !== 'object') continue;
    const rec: Record<string, string> = {};
    for (const h of headers) {
      const v = (row as Record<string, unknown>)[h];
      rec[h] = v == null ? '' : String(v);
    }
    rows.push(rec);
  }
  return { headers, rows };
}

projectsRouter.get('/', async (req, res) => {
  const userId = req.user!.id;
  const projects = await prisma.project.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, name: true, createdAt: true, updatedAt: true },
  });
  res.json({ projects });
});

projectsRouter.post('/', async (req, res) => {
  const userId = req.user!.id;
  const { name } = req.body as { name?: string };
  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  const project = await prisma.project.create({
    data: { userId, name: name.trim() },
    select: { id: true, name: true, createdAt: true, updatedAt: true },
  });
  res.status(201).json({ project });
});

/** List layouts (card templates) for a project */
projectsRouter.get('/:id/layouts', async (req, res) => {
  const userId = req.user!.id;
  const id = String(req.params.id);
  const project = await prisma.project.findFirst({ where: { id, userId } });
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }
  const layouts = await prisma.layout.findMany({
    where: { projectId: id },
    orderBy: { lastUpdated: 'desc' },
    select: { id: true, name: true, lastUpdated: true, state: true },
  });
  res.json({ layouts });
});

/** Create a layout */
projectsRouter.post('/:id/layouts', async (req, res) => {
  const userId = req.user!.id;
  const id = String(req.params.id);
  const project = await prisma.project.findFirst({ where: { id, userId } });
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }
  const { name, state } = req.body as { name?: string; state?: unknown };
  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  if (state === undefined || state === null || typeof state !== 'object') {
    res.status(400).json({ error: 'state (JSON object) is required' });
    return;
  }
  const layout = await prisma.layout.create({
    data: {
      projectId: id,
      name: name.trim(),
      state: state as object,
    },
    select: { id: true, name: true, lastUpdated: true, state: true },
  });
  res.status(201).json({ layout });
});

/** Single layout */
projectsRouter.get('/:id/layouts/:layoutId', async (req, res) => {
  const userId = req.user!.id;
  const id = String(req.params.id);
  const layoutId = String(req.params.layoutId);
  const project = await prisma.project.findFirst({ where: { id, userId } });
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }
  const layout = await prisma.layout.findFirst({
    where: { id: layoutId, projectId: id },
    select: { id: true, name: true, lastUpdated: true, state: true },
  });
  if (!layout) {
    res.status(404).json({ error: 'Layout not found' });
    return;
  }
  res.json({ layout });
});

projectsRouter.put('/:id/layouts/:layoutId', async (req, res) => {
  const userId = req.user!.id;
  const id = String(req.params.id);
  const layoutId = String(req.params.layoutId);
  const project = await prisma.project.findFirst({ where: { id, userId } });
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }
  const existing = await prisma.layout.findFirst({ where: { id: layoutId, projectId: id } });
  if (!existing) {
    res.status(404).json({ error: 'Layout not found' });
    return;
  }
  const { name, state } = req.body as { name?: string; state?: unknown };
  const data: { name?: string; state?: object; lastUpdated?: Date } = { lastUpdated: new Date() };
  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'invalid name' });
      return;
    }
    data.name = name.trim();
  }
  if (state !== undefined) {
    if (state === null || typeof state !== 'object') {
      res.status(400).json({ error: 'state must be a JSON object' });
      return;
    }
    data.state = state as object;
  }
  const layout = await prisma.layout.update({
    where: { id: layoutId },
    data,
    select: { id: true, name: true, lastUpdated: true, state: true },
  });
  res.json({ layout });
});

projectsRouter.delete('/:id/layouts/:layoutId', async (req, res) => {
  const userId = req.user!.id;
  const id = String(req.params.id);
  const layoutId = String(req.params.layoutId);
  const project = await prisma.project.findFirst({ where: { id, userId } });
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }
  const existing = await prisma.layout.findFirst({ where: { id: layoutId, projectId: id } });
  if (!existing) {
    res.status(404).json({ error: 'Layout not found' });
    return;
  }
  await prisma.layout.delete({ where: { id: layoutId } });
  res.status(204).send();
});

/** Replace CSV dataset (parsed client-side to JSON). Optional `sourceUrl` clears or sets linked fetch URL. */
projectsRouter.put('/:id/data', async (req, res) => {
  const userId = req.user!.id;
  const id = String(req.params.id);
  const project = await prisma.project.findFirst({ where: { id, userId } });
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }
  const body = req.body as {
    headers?: unknown;
    rows?: unknown;
    sourceUrl?: unknown;
  };
  const parsed = parseCsvPayload(req.body);
  if (!parsed) {
    res.status(400).json({ error: 'Body must be { headers: string[], rows: Record<string,string>[] }' });
    return;
  }
  const data: { csvData: typeof parsed; csvSourceUrl?: string | null } = { csvData: parsed };
  if (body.sourceUrl !== undefined) {
    if (body.sourceUrl === null || body.sourceUrl === '') {
      data.csvSourceUrl = null;
    } else if (typeof body.sourceUrl === 'string') {
      try {
        data.csvSourceUrl = assertHttpsCsvUrl(body.sourceUrl);
      } catch (e) {
        res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid source URL' });
        return;
      }
    } else {
      res.status(400).json({ error: 'sourceUrl must be string or null' });
      return;
    }
  }
  await prisma.project.update({
    where: { id },
    data,
  });
  const updated = await prisma.project.findFirst({
    where: { id },
    select: { csvData: true, csvSourceUrl: true },
  });
  res.json({ csvData: updated!.csvData as typeof parsed, csvSourceUrl: updated!.csvSourceUrl });
});

/** Save published CSV link without fetching (https only). */
projectsRouter.put('/:id/csv-link', async (req, res) => {
  const userId = req.user!.id;
  const id = String(req.params.id);
  const { url } = req.body as { url?: unknown };
  const project = await prisma.project.findFirst({ where: { id, userId } });
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }
  if (url === null || url === '') {
    await prisma.project.update({ where: { id }, data: { csvSourceUrl: null } });
    res.json({ csvSourceUrl: null });
    return;
  }
  if (typeof url !== 'string') {
    res.status(400).json({ error: 'url must be string or null' });
    return;
  }
  let href: string;
  try {
    href = assertHttpsCsvUrl(url);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid URL' });
    return;
  }
  await prisma.project.update({ where: { id }, data: { csvSourceUrl: href } });
  res.json({ csvSourceUrl: href });
});

/** Fetch CSV from saved URL or body `url` (server-side; avoids browser CORS). */
projectsRouter.post('/:id/csv/refresh', async (req, res) => {
  const userId = req.user!.id;
  const id = String(req.params.id);
  const { url } = req.body as { url?: unknown };
  const project = await prisma.project.findFirst({ where: { id, userId } });
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }
  const raw =
    typeof url === 'string' && url.trim()
      ? url.trim()
      : project.csvSourceUrl ?? null;
  if (!raw) {
    res.status(400).json({ error: 'Set a CSV link or pass url in the request body' });
    return;
  }
  let href: string;
  try {
    href = assertHttpsCsvUrl(raw);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid URL' });
    return;
  }
  let text: string;
  try {
    const r = await fetch(href, {
      redirect: 'follow',
      headers: { 'User-Agent': 'CardboardForge/1.0', Accept: 'text/csv,*/*' },
    });
    if (!r.ok) {
      res.status(502).json({ error: `Fetch failed: ${r.status} ${r.statusText}` });
      return;
    }
    text = await r.text();
  } catch (e) {
    req.log?.warn({ err: e, href }, 'csv.refresh fetch failed');
    res.status(502).json({ error: 'Could not download CSV from URL' });
    return;
  }
  const parsedRaw = parseCsvText(text);
  const parsed = parseCsvPayload(parsedRaw);
  if (!parsed) {
    res.status(400).json({ error: 'CSV did not contain a valid header row' });
    return;
  }
  await prisma.project.update({
    where: { id },
    data: { csvData: parsed, csvSourceUrl: href },
  });
  res.json({ csvData: parsed, csvSourceUrl: href });
});

/** Project detail: metadata, csvData, layouts summary */
projectsRouter.get('/:id', async (req, res) => {
  const userId = req.user!.id;
  const id = String(req.params.id);
  const project = await prisma.project.findFirst({
    where: { id, userId },
    select: {
      id: true,
      name: true,
      csvData: true,
      csvSourceUrl: true,
      createdAt: true,
      updatedAt: true,
      layouts: {
        orderBy: { lastUpdated: 'desc' },
        select: { id: true, name: true, lastUpdated: true },
      },
    },
  });
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }
  res.json({ project });
});

projectsRouter.put('/:id', async (req, res) => {
  const userId = req.user!.id;
  const id = String(req.params.id);
  const { name } = req.body as { name?: string };
  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  const existing = await prisma.project.findFirst({ where: { id, userId } });
  if (!existing) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const project = await prisma.project.update({
    where: { id },
    data: { name: name.trim() },
    select: { id: true, name: true, createdAt: true, updatedAt: true },
  });
  res.json({ project });
});

projectsRouter.delete('/:id', async (req, res) => {
  const userId = req.user!.id;
  const id = String(req.params.id);

  const existing = await prisma.project.findFirst({ where: { id, userId } });
  if (!existing) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  await prisma.project.delete({ where: { id } });
  res.status(204).send();
});
