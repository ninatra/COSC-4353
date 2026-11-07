import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { FINISHED_STATUSES, sortHistory, toHistoryRow, historyQuery } from '../logic/history.js';
import { validateCompletion } from '../logic/queue.js';
import { parseServiceId as parseId } from '../validation/service.js';
import { identitySelect } from '../logic/users.js';

import { entryInclude, entryView } from '../logic/entries.js';

const router = Router();
router.use(requireAuth);
const include = { entry: { include: { ...entryInclude, history: false, user: { select: identitySelect } } } };
const historyView = ({ entry, ...history }) => toHistoryRow(entryView({ ...entry, history }));

// Users see their own finished visits; administrators see every visit.
router.get('/', async (req, res) => {
  if (req.query.paginated === 'true') {
    const parsed = historyQuery(req.query);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const { where, page, pageSize, skip } = parsed;
    if (req.user.role !== 'ADMIN') where.entry = { ...where.entry, userId: req.user.id };
    const [total, entries] = await prisma.$transaction([
      prisma.history.count({ where }),
      prisma.history.findMany({ where, include, orderBy: [{ completedAt: 'desc' }, { entryId: 'desc' }], skip, take: pageSize }),
    ]);
    return res.json({ history: entries.map(historyView), total, page, pageSize });
  }
  const entries = await prisma.history.findMany({
    where: { status: { in: FINISHED_STATUSES }, ...(req.user.role === 'ADMIN' ? {} : { entry: { userId: req.user.id } }) },
    include,
  });
  res.json({ history: sortHistory(entries.map(historyView)) });
});

// Staff can edit served visit details, or notes only for left/removed visits.
router.put('/:id', requireRole('ADMIN'), async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'Visit ID must be a positive integer' });
  const { data, error } = validateCompletion(req.body);
  if (error) return res.status(400).json({ error });
  const entry = await prisma.queueEntry.findUnique({ where: { id }, include: { history: true } });
  if (!entry) return res.status(404).json({ error: 'Visit not found' });
  if (!entry.history) return res.status(409).json({ error: 'Only finished visits can be edited' });
  const changes = entry.history.status === 'SERVED' ? data : { notes: data.notes };
  const updated = await prisma.history.update({ where: { entryId: id }, data: changes, include });
  res.json({ visit: historyView(updated) });
});

export default router;
