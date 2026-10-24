import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { parseServiceId } from '../validation/service.js';
import { orderQueue, joinError, positionInQueue, validateCompletion, formatTicketId, validateReorder } from '../logic/queue.js';
import { almostReadyNotifications, joinNotifications, leftNotification, servedNotification } from '../logic/notifications.js';

const router = Router();
router.use(requireAuth);
const active = ['WAITING', 'SERVING'];
// Select only public identity fields; password hashes and tokens never leave the server.
const include = { user: { select: { name: true, email: true } }, service: true };
const fail = (status, message) => Object.assign(new Error(message), { status });

// Tells visitors who just reached the front of the line, once per visit.
async function alertAlmostReady(db, service) {
  const ordered = orderQueue(await db.queueEntry.findMany({ where: { serviceId: service.id, status: { in: active } } }));
  const alerted = await db.notification.findMany({
    where: { kind: { in: ['almost', 'next'] }, entryId: { in: ordered.map(entry => entry.id) } }, select: { entryId: true, kind: true },
  });
  const data = almostReadyNotifications(ordered, alerted.filter(n => n.kind === 'almost').map(n => n.entryId), service, alerted.filter(n => n.kind === 'next').map(n => n.entryId));
  if (data.length) await db.notification.createMany({ data });
}

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
  // The active ticket wins; otherwise show the most recently finished visit.
  const mine = req.user.role === 'USER'
    ? await prisma.queueEntry.findFirst({ where: { userId: req.user.id, status: { in: active } } })
      ?? await prisma.queueEntry.findFirst({ where: { userId: req.user.id }, orderBy: [{ completedAt: 'desc' }, { id: 'desc' }] })
    : null;
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
    const joined = await db.queueEntry.update({ where: { id: created.id }, data: {
      ticketId: formatTicketId(service.name, created.id), initialPosition: position,
    } });
    const admins = await db.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
    await db.notification.createMany({ data: joinNotifications({
      entry: joined, service, position, waitingCount: entries.length, userId: req.user.id, adminIds: admins.map(a => a.id),
    }) });
    await alertAlmostReady(db, service);
    return joined;
  });
  res.status(201).json({ entry });
});

router.put('/:serviceId/reorder', requireRole('ADMIN'), async (req, res) => {
  await prisma.$transaction(async db => {
    const service = await db.service.findUnique({ where: { id: req.serviceId } });
    if (!service) throw fail(404, 'Service not found');
    const current = orderQueue(await db.queueEntry.findMany({ where: { serviceId: req.serviceId, status: { in: active } } }));
    const error = validateReorder(req.body, current.map(entry => entry.id));
    if (error) throw fail(error.status, error.error);
    for (const [manualOrder, id] of req.body.entryIds.entries()) {
      await db.queueEntry.update({ where: { id }, data: { manualOrder } });
    }
    await alertAlmostReady(db, service);
  });
  res.json({ message: 'Queue order updated' });
});

router.delete('/:serviceId/entries/:entryId', requireRole('ADMIN'), async (req, res) => {
  const entryId = parseServiceId(req.params.entryId);
  if (entryId === null) return res.status(400).json({ error: 'Queue entry ID must be a positive integer' });
  const notes = req.body?.notes ?? '';
  const { error } = validateCompletion({ notes });
  if (error) return res.status(400).json({ error });
  await prisma.$transaction(async db => {
    const entry = await db.queueEntry.findFirst({
      where: { id: entryId, serviceId: req.serviceId, status: { in: active } }, include: { service: true },
    });
    if (!entry) throw fail(404, 'This visitor is no longer in this queue');
    await db.queueEntry.update({ where: { id: entry.id }, data: { status: 'NO_SHOW', notes: notes.trim(), completedAt: new Date() } });
    await db.notification.create({ data: {
      userId: entry.userId, kind: 'removed', title: 'Removed from queue',
      serviceId: entry.serviceId, ticketId: entry.ticketId, entryId: entry.id,
      message: `Your ticket ${entry.ticketId} was removed from ${entry.service.name} by an administrator. You can join again if you still need service.`,
    } });
    await alertAlmostReady(db, entry.service);
  });
  res.json({ message: 'Visitor removed from queue' });
});

router.post('/:serviceId/leave', requireRole('USER'), async (req, res) => {
  await prisma.$transaction(async db => {
    const entry = await db.queueEntry.findFirst({
      where: { userId: req.user.id, serviceId: req.serviceId, status: { in: active } }, include: { service: true },
    });
    if (!entry) throw fail(404, 'You are not in this queue');
    await db.queueEntry.update({ where: { id: entry.id }, data: { status: 'LEFT', completedAt: new Date() } });
    await db.notification.create({ data: leftNotification(entry, entry.service) });
    await alertAlmostReady(db, entry.service);
  });
  res.json({ message: 'You left the queue' });
});

// The existing UI completes a visit in one action, rather than a separate start/end flow.
router.post('/:serviceId/serve-next', requireRole('ADMIN'), async (req, res) => {
  const { data, error } = validateCompletion(req.body);
  if (error) return res.status(400).json({ error });
  const entry = await prisma.$transaction(async db => {
    const service = await db.service.findUnique({ where: { id: req.serviceId } });
    if (!service) throw fail(404, 'Service not found');
    const next = orderQueue(await db.queueEntry.findMany({ where: { serviceId: req.serviceId, status: { in: active } } }))[0];
    if (!next) throw fail(409, 'Nobody is waiting in this queue');
    if (req.body?.entryId !== undefined && req.body.entryId !== next.id) throw fail(409, 'The queue changed. Review the next visitor and try again.');
    const now = new Date();
    const served = await db.queueEntry.update({ where: { id: next.id }, data: { ...data, status: 'SERVED', servedAt: now, completedAt: now } });
    await db.notification.create({ data: servedNotification(served, service) });
    await alertAlmostReady(db, service);
    return served;
  });
  res.json({ entry });
});

router.use((err, req, res, next) => {
  if (err.status) return res.status(err.status).json({ error: err.message });
  if (['P2034', 'P1008', 'P2028'].includes(err.code)) return res.status(409).json({ error: 'Queue changed. Please try again.' });
  next(err);
});
export default router;
