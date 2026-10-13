import { Router } from 'express';
import { validateService, parseServiceId } from '../validation/service.js';
import { prisma } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// Both roles can view the catalog, including closed services and their details.
router.get('/', async (req, res) => {
  const services = await prisma.service.findMany({
    orderBy: { id: 'asc' },
  });
  res.json({ services });
});

router.post('/', requireRole('ADMIN'), async (req, res) => {
  const { data, error } = validateService(req.body);
  if (error) return res.status(400).json({ error });
  const service = await prisma.service.create({ data });
  res.status(201).json({ service });
});

// Accept any subset of the supported fields, including opening/closing a service.
router.put('/:id', requireRole('ADMIN'), async (req, res) => {
  const id = parseServiceId(req.params.id);
  if (id === null) {
    return res.status(400).json({ error: 'Service ID must be a positive integer' });
  }
  const { data, error } = validateService(req.body, true);
  if (error) return res.status(400).json({ error });
  try {
    const service = await prisma.service.update({ where: { id }, data });
    res.json({ service });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Service not found' });
    }
    throw err;
  }
});

router.delete('/:id', requireRole('ADMIN'), async (req, res) => {
  const id = parseServiceId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'Service ID must be a positive integer' });
  try {
    // Preserve visits and queue history rather than cascading their deletion.
    await prisma.$transaction(async (db) => {
      const entries = await db.queueEntry.count({ where: { serviceId: id } });
      if (entries) throw Object.assign(new Error('This service has queue history. Close it instead of deleting it.'), { status: 409 });
      await db.service.delete({ where: { id } });
    });
    res.json({ message: 'Service deleted' });
  } catch (err) {
    if (err.status === 409) return res.status(409).json({ error: err.message });
    if (err.code === 'P2025') return res.status(404).json({ error: 'Service not found' });
    throw err;
  }
});

export default router;
