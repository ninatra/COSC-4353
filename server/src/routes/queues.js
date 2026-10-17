import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { parseServiceId } from '../validation/service.js';
import { orderQueue, joinError, positionInQueue, validateCompletion, formatTicketId, validateReorder } from '../logic/queue.js';

const router = Router();
router.use(requireAuth);
const active = ['WAITING', 'SERVING'];
// Select only public identity fields; password hashes and tokens never leave the server.
const include = { user: { select: { name: true, email: true } }, service: true };
const fail = (status, message) => Object.assign(new Error(message), { status });

router.param('serviceId', (req, res, next, value) => {
  req.serviceId = parseServiceId(value);
  if (req.serviceId === null) return res.status(400).json({ error: 'Service ID must be a positive integer' });
  next();
});

// The client receives counts/positions without exposing other visitors' identities.
router.get('/', async (req, res) => {
  const entries = orderQueue(await prisma.queueEntry.findMany({ where: { status: { in: active } }, include }));
  const queues = {};
  for (const entry of entries) {
    const { user, service, ...data } = entry;
    (queues[entry.serviceId] ??= []).push({ ...data,
      ...(req.user.role === 'ADMIN' || entry.userId === req.user.id ? { user } : {}),
    });
  }
  const mine = req.user.role === 'USER' ? await prisma.queueEntry.findFirst({
    where: { userId: req.user.id }, orderBy: { id: 'desc' },
  }) : null;
  res.json({ queues, ticket: mine && [...active, 'SERVED'].includes(mine.status) ? mine : null });
});

router.get('/me', requireRole('USER'), async (req, res) => {
  const entry = await prisma.queueEntry.findFirst({ where: { userId: req.user.id, status: { in: active } }, include: { service: true } });
  if (!entry) return res.json({ ticket: null });
  const entries = await prisma.queueEntry.findMany({ where: { serviceId: entry.serviceId, status: { in: active } } });
  res.json({ ticket: { ...entry, ...positionInQueue(entries, entry.id, entry.service.expectedDuration) } });
});

router.get('/:serviceId', requireRole('ADMIN'), async (req, res) => {
  const service = await prisma.service.findUnique({ where: { id: req.serviceId } });
  if (!service) return res.status(404).json({ error: 'Service not found' });
  const entries = await prisma.queueEntry.findMany({ where: { serviceId: req.serviceId, status: { in: active } }, include });
  res.json({ queue: orderQueue(entries) });
});

router.post('/:serviceId/join', requireRole('USER'), async (req, res) => {
  const entry = await prisma.$transaction(async db => {
    const service = await db.service.findUnique({ where: { id: req.serviceId } });
    const existing = await db.queueEntry.findFirst({ where: { userId: req.user.id, status: { in: active } } });
    const count = await db.queueEntry.count({ where: { serviceId: req.serviceId, status: { in: active } } });
    const error = joinError(service, existing, count);
    if (error) throw fail(error.status, error.error);
    // Service priority does not give individual visitors an advantage. Standard
    // visitors share MEDIUM priority, preserving arrival order within a service.
    const created = await db.queueEntry.create({ data: { userId: req.user.id, serviceId: service.id, priority: 'MEDIUM' } });
    const entries = await db.queueEntry.findMany({ where: { serviceId: service.id, status: { in: active } } });
    const { position } = positionInQueue(entries, created.id, service.expectedDuration);
    return db.queueEntry.update({ where: { id: created.id }, data: {
      ticketId: formatTicketId(service.name, created.id), initialPosition: position,
    } });
  });
  res.status(201).json({ entry });
});

router.put('/:serviceId/reorder', requireRole('ADMIN'), async (req, res) => {
  await prisma.$transaction(async db => {
    if (!(await db.service.findUnique({ where: { id: req.serviceId } }))) throw fail(404, 'Service not found');
    const current = orderQueue(await db.queueEntry.findMany({ where: { serviceId: req.serviceId, status: { in: active } } }));
    const error = validateReorder(req.body, current.map(entry => entry.id));
    if (error) throw fail(error.status, error.error);
    for (const [manualOrder, id] of req.body.entryIds.entries()) {
      await db.queueEntry.update({ where: { id }, data: { manualOrder } });
    }
  });
  res.json({ message: 'Queue order updated' });
});

router.post('/:serviceId/leave', requireRole('USER'), async (req, res) => {
  const result = await prisma.queueEntry.updateMany({
    where: { userId: req.user.id, serviceId: req.serviceId, status: { in: active } },
    data: { status: 'LEFT', completedAt: new Date() },
  });
  if (!result.count) return res.status(404).json({ error: 'You are not in this queue' });
  res.json({ message: 'You left the queue' });
});

// The existing UI completes a visit in one action, rather than a separate start/end flow.
router.post('/:serviceId/serve-next', requireRole('ADMIN'), async (req, res) => {
  const { data, error } = validateCompletion(req.body);
  if (error) return res.status(400).json({ error });
  const entry = await prisma.$transaction(async db => {
    if (!(await db.service.findUnique({ where: { id: req.serviceId } }))) throw fail(404, 'Service not found');
    const next = orderQueue(await db.queueEntry.findMany({ where: { serviceId: req.serviceId, status: { in: active } } }))[0];
    if (!next) throw fail(409, 'Nobody is waiting in this queue');
    if (req.body?.entryId !== undefined && req.body.entryId !== next.id) throw fail(409, 'The queue changed. Review the next visitor and try again.');
    const now = new Date();
    return db.queueEntry.update({ where: { id: next.id }, data: { ...data, status: 'SERVED', servedAt: now, completedAt: now } });
  });
  res.json({ entry });
});

router.use((err, req, res, next) => {
  if (err.status) return res.status(err.status).json({ error: err.message });
  if (['P2034', 'P1008', 'P2028'].includes(err.code)) return res.status(409).json({ error: 'Queue changed. Please try again.' });
  next(err);
});
export default router;
