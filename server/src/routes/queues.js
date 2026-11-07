import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { parseServiceId } from '../validation/service.js';
import { orderQueue, joinError, positionInQueue, validateCompletion, formatTicketId, validateReorder } from '../logic/queue.js';
import { almostReadyNotifications, joinNotifications, leftNotification, servedNotification } from '../logic/notifications.js';
import { identity, identitySelect } from '../logic/users.js';

import { entryInclude, entryView, serviceView, serviceFilter, finishEntry } from '../logic/entries.js';

const router = Router();
router.use(requireAuth);
const active = ['WAITING'];
// Select only public identity fields; password hashes and tokens never leave the server.
const include = { ...entryInclude, user: { select: identitySelect } };

async function findEntries(db, args) {
  return (await db.queueEntry.findMany({ ...args, include: args.include ?? entryInclude })).map(entryView);
}
async function findEntry(db, args) {
  return entryView(await db.queueEntry.findFirst({ ...args, include: args.include ?? entryInclude }));
}
async function findService(db, id) {
  return serviceView(await db.service.findUnique({ where: { id }, include: { queue: true } }));
}
const fail = (status, message) => Object.assign(new Error(message), { status });

// Compare positions within the same transaction as the queue change.
async function alertAlmostReady(db, service, previous) {
  const ordered = orderQueue(await findEntries(db, { where: { ...serviceFilter(service.id), status: { in: active } } }));
  const notices = almostReadyNotifications(ordered, previous, service);
  // Respect each visitor's profile preference for these alerts.
  const muted = await db.userProfile.findMany({
    where: { almostReadyAlerts: false, credentials: { id: { in: notices.map(n => n.userId) } } }, select: { credentials: { select: { id: true } } },
  });
  const mutedIds = new Set(muted.map(p => p.credentials.id));
  const data = notices.filter(n => !mutedIds.has(n.userId));
  if (data.length) await db.notification.createMany({ data });
}

router.param('serviceId', (req, res, next, value) => {
  req.serviceId = parseServiceId(value);
  if (req.serviceId === null) return res.status(400).json({ error: 'Service ID must be a positive integer' });
  next();
});

// The client receives counts/positions without exposing other visitors' identities.
router.get('/', async (req, res) => {
  const entries = orderQueue(await findEntries(prisma, { where: { status: { in: active } }, include }));
  const queues = {};
  for (const entry of entries) {
    const { user, service, ...data } = entry;
    (queues[entry.serviceId] ??= []).push({ ...data,
      ...(req.user.role === 'ADMIN' || entry.userId === req.user.id ? { user: identity(user) } : {}),
    });
  }
  // The active ticket wins; otherwise show the most recently finished visit.
  const mine = req.user.role === 'USER'
    ? await findEntry(prisma, { where: { userId: req.user.id, status: { in: active } } })
      ?? await findEntry(prisma, { where: { userId: req.user.id }, orderBy: [{ history: { completedAt: 'desc' } }, { id: 'desc' }] })
    : null;
  res.json({ queues, ticket: mine && [...active, 'SERVED'].includes(mine.status) ? mine : null });
});

router.get('/me', requireRole('USER'), async (req, res) => {
  const entry = await findEntry(prisma, { where: { userId: req.user.id, status: { in: active } }, include: entryInclude });
  if (!entry) return res.json({ ticket: null });
  const entries = await findEntries(prisma, { where: { ...serviceFilter(entry.serviceId), status: { in: active } } });
  res.json({ ticket: { ...entry, ...positionInQueue(entries, entry.id, entry.service.expectedDuration) } });
});

router.get('/:serviceId', requireRole('ADMIN'), async (req, res) => {
  const service = await findService(prisma, req.serviceId);
  if (!service) return res.status(404).json({ error: 'Service not found' });
  const entries = await findEntries(prisma, { where: { ...serviceFilter(req.serviceId), status: { in: active } }, include });
  res.json({ queue: orderQueue(entries).map(entry => ({ ...entry, user: identity(entry.user) })) });
});

router.post('/:serviceId/join', requireRole('USER'), async (req, res) => {
  const entry = await prisma.$transaction(async db => {
    const service = await findService(db, req.serviceId);
    const existing = await findEntry(db, { where: { userId: req.user.id, status: { in: active } } });
    const previous = orderQueue(await findEntries(db, { where: { ...serviceFilter(req.serviceId), status: { in: active } } }));
    const count = previous.length;
    const error = joinError(service, existing, count);
    if (error) throw fail(error.status, error.error);
    // Append new visitors after everyone currently waiting, including reordered entries.
    const created = await db.queueEntry.create({ data: { userId: req.user.id, queueId: service.queueId, position: count + 1 } });
    const entries = await findEntries(db, { where: { ...serviceFilter(service.id), status: { in: active } } });
    const { position } = positionInQueue(entries, created.id, service.expectedDuration);
    const joined = await db.queueEntry.update({ where: { id: created.id }, data: {
      ticketId: formatTicketId(service.name, created.id), initialPosition: position,
    } });
    const admins = await db.userCredentials.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
    await db.notification.createMany({ data: joinNotifications({
      entry: joined, service, position, waitingCount: entries.length, userId: req.user.id, adminIds: admins.map(a => a.id),
    }) });
    await alertAlmostReady(db, service, previous);
    return { ...joined, serviceId: service.id };
  });
  res.status(201).json({ entry });
});

router.put('/:serviceId/reorder', requireRole('ADMIN'), async (req, res) => {
  await prisma.$transaction(async db => {
    const service = await findService(db, req.serviceId);
    if (!service) throw fail(404, 'Service not found');
    const current = orderQueue(await findEntries(db, { where: { ...serviceFilter(req.serviceId), status: { in: active } } }));
    const error = validateReorder(req.body, current.map(entry => entry.id));
    if (error) throw fail(error.status, error.error);
    for (const [index, id] of req.body.entryIds.entries()) {
      await db.queueEntry.update({ where: { id }, data: { position: index + 1 } });
    }
    await alertAlmostReady(db, service, current);
  });
  res.json({ message: 'Queue order updated' });
});

router.delete('/:serviceId/entries/:entryId', requireRole('ADMIN'), async (req, res) => {
  const entryId = parseServiceId(req.params.entryId);
  if (entryId === null) return res.status(400).json({ error: 'Queue entry ID must be a positive integer' });
  const { data, error } = validateCompletion(req.body);
  if (error) return res.status(400).json({ error });
  await prisma.$transaction(async db => {
    const entry = await findEntry(db, {
      where: { id: entryId, ...serviceFilter(req.serviceId), status: { in: active } }, include: entryInclude,
    });
    if (!entry) throw fail(404, 'This visitor is no longer in this queue');
    const previous = orderQueue(await findEntries(db, { where: { queueId: entry.queueId, status: 'WAITING' } }));
    await finishEntry(db, entry, 'NO_SHOW', { notes: data.notes });
    await db.notification.create({ data: {
      userId: entry.userId, kind: 'removed', title: 'Removed from queue',
      serviceId: entry.serviceId, ticketId: entry.ticketId, entryId: entry.id,
      message: `Your ticket ${entry.ticketId} was removed from ${entry.service.name} by an administrator. You can join again if you still need service.`,
    } });
    await alertAlmostReady(db, entry.service, previous);
  });
  res.json({ message: 'Visitor removed from queue' });
});

router.post('/:serviceId/leave', requireRole('USER'), async (req, res) => {
  await prisma.$transaction(async db => {
    const entry = await findEntry(db, {
      where: { userId: req.user.id, ...serviceFilter(req.serviceId), status: { in: active } }, include: entryInclude,
    });
    if (!entry) throw fail(404, 'You are not in this queue');
    const previous = orderQueue(await findEntries(db, { where: { queueId: entry.queueId, status: 'WAITING' } }));
    await finishEntry(db, entry, 'LEFT');
    await db.notification.create({ data: leftNotification(entry, entry.service) });
    await alertAlmostReady(db, entry.service, previous);
  });
  res.json({ message: 'You left the queue' });
});

// The existing UI completes a visit in one action, rather than a separate start/end flow.
router.post('/:serviceId/serve-next', requireRole('ADMIN'), async (req, res) => {
  const { data, error } = validateCompletion(req.body);
  if (error) return res.status(400).json({ error });
  const entry = await prisma.$transaction(async db => {
    const service = await findService(db, req.serviceId);
    if (!service) throw fail(404, 'Service not found');
    const previous = orderQueue(await findEntries(db, { where: { ...serviceFilter(req.serviceId), status: { in: active } } }));
    const next = previous[0];
    if (!next) throw fail(409, 'Nobody is waiting in this queue');
    if (req.body?.entryId !== undefined && req.body.entryId !== next.id) throw fail(409, 'The queue changed. Review the next visitor and try again.');
    const served = await finishEntry(db, next, 'SERVED', data);
    await db.notification.create({ data: servedNotification(served, service) });
    await alertAlmostReady(db, service, previous);
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
