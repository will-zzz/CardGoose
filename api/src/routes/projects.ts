import { Router, type IRouter } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

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

/** Replace CSV dataset (parsed client-side to JSON) */
projectsRouter.put('/:id/data', async (req, res) => {
  const userId = req.user!.id;
  const id = String(req.params.id);
  const project = await prisma.project.findFirst({ where: { id, userId } });
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }
  const parsed = parseCsvPayload(req.body);
  if (!parsed) {
    res.status(400).json({ error: 'Body must be { headers: string[], rows: Record<string,string>[] }' });
    return;
  }
  await prisma.project.update({
    where: { id },
    data: { csvData: parsed },
  });
  res.json({ csvData: parsed });
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
