import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { FINISHED_STATUSES, sortHistory, toHistoryRow } from '../logic/history.js';
import { validateCompletion } from '../logic/queue.js';
import { parseServiceId as parseId } from '../validation/service.js';

const router = Router();
router.use(requireAuth);
const include = { user: { select: { name: true, email: true } }, service: { select: { name: true } } };

// Users see their own finished visits; administrators see every visit.
router.get('/', async (req, res) => {
  const entries = await prisma.queueEntry.findMany({
    where: { status: { in: FINISHED_STATUSES }, ...(req.user.role === 'ADMIN' ? {} : { userId: req.user.id }) },
    include,
  });
  res.json({ history: sortHistory(entries.map(toHistoryRow)) });
});

// Staff can correct the outcome, problem and notes of a served visit.
router.put('/:id', requireRole('ADMIN'), async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'Visit ID must be a positive integer' });
  const { data, error } = validateCompletion(req.body);
  if (error) return res.status(400).json({ error });
  const entry = await prisma.queueEntry.findUnique({ where: { id } });
  if (!entry) return res.status(404).json({ error: 'Visit not found' });
  if (entry.status !== 'SERVED') return res.status(409).json({ error: 'Only served visits can be edited' });
  const updated = await prisma.queueEntry.update({ where: { id }, data, include });
  res.json({ visit: toHistoryRow(updated) });
});

export default router;
