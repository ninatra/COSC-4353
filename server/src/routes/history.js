import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { FINISHED_STATUSES, sortHistory, toHistoryRow, historyQuery } from '../logic/history.js';
import { validateCompletion } from '../logic/queue.js';
import { parseServiceId as parseId } from '../validation/service.js';

const router = Router();
router.use(requireAuth);
const include = { user: { select: { name: true, email: true } }, service: { select: { name: true } } };

// Users see their own finished visits; administrators see every visit.
router.get('/', async (req, res) => {
  if (req.query.paginated === 'true') {
    const parsed = historyQuery(req.query);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const { where, page, pageSize, skip } = parsed;
    if (req.user.role !== 'ADMIN') where.userId = req.user.id;
    const [total, entries] = await prisma.$transaction([
      prisma.queueEntry.count({ where }),
      prisma.queueEntry.findMany({ where, include, orderBy: [{ completedAt: 'desc' }, { id: 'desc' }], skip, take: pageSize }),
    ]);
    return res.json({ history: entries.map(toHistoryRow), total, page, pageSize });
  }
  const entries = await prisma.queueEntry.findMany({
    where: { status: { in: FINISHED_STATUSES }, ...(req.user.role === 'ADMIN' ? {} : { userId: req.user.id }) },
    include,
  });
  res.json({ history: sortHistory(entries.map(toHistoryRow)) });
});

// Staff can edit served visit details, or notes only for left/removed visits.
router.put('/:id', requireRole('ADMIN'), async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'Visit ID must be a positive integer' });
  const { data, error } = validateCompletion(req.body);
  if (error) return res.status(400).json({ error });
  const entry = await prisma.queueEntry.findUnique({ where: { id } });
  if (!entry) return res.status(404).json({ error: 'Visit not found' });
  if (!FINISHED_STATUSES.includes(entry.status)) return res.status(409).json({ error: 'Only finished visits can be edited' });
  const changes = entry.status === 'SERVED' ? data : { notes: data.notes };
  const updated = await prisma.queueEntry.update({ where: { id }, data: changes, include });
  res.json({ visit: toHistoryRow(updated) });
});

export default router;
