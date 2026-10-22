import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { parseServiceId as parseId } from '../validation/service.js';

const router = Router();
router.use(requireAuth);

// The signed-in account's notifications, newest first.
router.get('/', async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user.id },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  res.json({ notifications, unread: notifications.filter((n) => !n.read).length });
});

router.patch('/read-all', async (req, res) => {
  const { count } = await prisma.notification.updateMany({ where: { userId: req.user.id, read: false }, data: { read: true } });
  res.json({ updated: count });
});

router.patch('/:id/read', async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'Notification ID must be a positive integer' });
  // Scoped to the owner, so nobody can mark someone else's notification.
  const { count } = await prisma.notification.updateMany({ where: { id, userId: req.user.id }, data: { read: true } });
  if (!count) return res.status(404).json({ error: 'Notification not found' });
  res.json({ message: 'Marked as read' });
});

router.delete('/', async (req, res) => {
  const { count } = await prisma.notification.deleteMany({ where: { userId: req.user.id } });
  res.json({ deleted: count });
});

export default router;
