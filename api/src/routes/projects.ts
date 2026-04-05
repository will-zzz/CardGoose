import { Router, type IRouter } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

export const projectsRouter: IRouter = Router();
projectsRouter.use(requireAuth);

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
